import { useCallback, useEffect, useMemo, useState } from "react";
import CompareHeader from "../components/compare/CompareHeader";
import CompareTabs from "../components/compare/CompareTabs";
import CompareSetupPanel from "../components/compare/CompareSetupPanel";
import CompareResultsTable from "../components/compare/CompareResultsTable";
import CompareUnmatchedPanel from "../components/compare/CompareUnmatchedPanel";
import {
  applyManualPairs,
  getDefaultCompareFields,
  scorePair,
} from "../utils/compareUtils";
import "./CompareFormattedData.css";
import { exportCSV, exportExcel } from "../utils/exportUtils";
import { fetchRowEdits } from "../services/rowEditsApi";
import { fetchCompareConfig, saveCompareConfig } from "../services/compareConfigApi";
import { runCompare } from "../services/compareApi";

export default function CompareFormattedData({
  importMeta,
  formattedPanels,
  onBack,
}) {
  const leftPanel = formattedPanels?.panel1 || null;
  const rightPanel = formattedPanels?.panel2 || null;

  const [activeTab, setActiveTab] = useState("results");
  const [rowFilter, setRowFilter] = useState("all");
  const [compareFields, setCompareFields] = useState([]);
  const [manualPairs, setManualPairs] = useState([]);
  const [rowEdits, setRowEdits] = useState({});
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [baseResult, setBaseResult] = useState({
    matchedRows: [],
    unmatchedLeft: [],
    unmatchedRight: [],
  });
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState("");

  useEffect(() => {
    if (!importMeta?.importId) return;
    fetchRowEdits(importMeta.importId)
      .then((rows) => {
        const map = {};
        for (const r of rows) map[r.pairId] = { versions: r.versions };
        setRowEdits(map);
      })
      .catch(console.error);
  }, [importMeta?.importId]);

  // Load compare setup: sessionStorage (import-specific) → DB (format-pair default) → auto-detect
  useEffect(() => {
    if (!leftPanel?.headers?.length || !rightPanel?.headers?.length) return;

    const importId = importMeta?.importId;
    const leftFormat = leftPanel.formatKey;
    const rightFormat = rightPanel.formatKey;

    // Migrate older saved compareFields that have no `required` flag.
    // Use legacy minimumMatchCount as a hint: if N of M were required, mark first N as required.
    const migrate = (fields, legacyMin) => {
      if (!Array.isArray(fields)) return [];
      const total = fields.length;
      const min = Number.isFinite(legacyMin) && legacyMin > 0 ? Math.min(legacyMin, total) : total;
      return fields.map((f, i) => ({
        ...f,
        required: f.required === undefined ? i < min : f.required,
      }));
    };

    // 1. Try sessionStorage first (import-specific override)
    try {
      const saved = importId
        ? JSON.parse(sessionStorage.getItem(`compareSetup_${importId}`) || "null")
        : null;
      if (saved?.compareFields?.length) {
        setCompareFields(migrate(saved.compareFields, saved.minimumMatchCount));
        return;
      }
    } catch {}

    // 2. Try DB config for this format pair
    if (leftFormat && rightFormat) {
      fetchCompareConfig(leftFormat, rightFormat)
        .then((cfg) => {
          if (cfg?.compareFields?.length) {
            setCompareFields(migrate(cfg.compareFields, cfg.minimumMatchCount));
          } else {
            setCompareFields(getDefaultCompareFields(leftPanel.headers, rightPanel.headers));
          }
        })
        .catch(() => {
          setCompareFields(getDefaultCompareFields(leftPanel.headers, rightPanel.headers));
        });
      return;
    }

    // 3. Auto-detect fallback
    setCompareFields(getDefaultCompareFields(leftPanel.headers, rightPanel.headers));
  }, [leftPanel?.headers, rightPanel?.headers, importMeta?.importId]);

  // Persist to sessionStorage on every change
  useEffect(() => {
    if (!importMeta?.importId || !compareFields.length) return;
    try {
      sessionStorage.setItem(
        `compareSetup_${importMeta.importId}`,
        JSON.stringify({ compareFields })
      );
    } catch {}
  }, [compareFields, importMeta?.importId]);

  const handleSaveAsDefault = useCallback(async () => {
    const leftFormat = leftPanel?.formatKey;
    const rightFormat = rightPanel?.formatKey;
    if (!leftFormat || !rightFormat) return;
    setSaveStatus("saving");
    // Required/Optional ticks now control column visibility only; the legacy
    // minimum_match_count column is no longer read by the matcher. Persist the
    // visible-column count so older clients still get a sensible interpretation.
    const visibleCount = compareFields.filter((f) => f.required !== false).length;
    try {
      await saveCompareConfig(leftFormat, rightFormat, compareFields, visibleCount || compareFields.length);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2500);
    }
  }, [leftPanel?.formatKey, rightPanel?.formatKey, compareFields]);

  // Server-side comparison: backend reads ALL rows for both files, projects through
  // the mapping, runs buildCompareRows, returns matched/unmatched. Keeps display
  // pagination (200 rows/page in Format step) decoupled from the comparison set.
  useEffect(() => {
    const importId = importMeta?.importId;
    if (!importId) return;
    if (!leftPanel?.fileSide || !rightPanel?.fileSide) return;
    if (!leftPanel?.headers?.length || !rightPanel?.headers?.length) return;
    if (!compareFields.length) return;

    let cancelled = false;
    setCompareLoading(true);
    setCompareError("");

    runCompare(importId, leftPanel, rightPanel, compareFields)
      .then((result) => {
        if (cancelled) return;
        setBaseResult({
          matchedRows: result.matchedRows || [],
          unmatchedLeft: result.unmatchedLeft || [],
          unmatchedRight: result.unmatchedRight || [],
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setCompareError(String(e.message || e));
      })
      .finally(() => {
        if (!cancelled) setCompareLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    importMeta?.importId,
    leftPanel?.fileSide,
    rightPanel?.fileSide,
    leftPanel?.mapping,
    rightPanel?.mapping,
    leftPanel?.headers,
    rightPanel?.headers,
    compareFields,
  ]);

  const finalResult = useMemo(() => {
    return applyManualPairs({
      baseMatchedRows: baseResult.matchedRows,
      unmatchedLeft: baseResult.unmatchedLeft,
      unmatchedRight: baseResult.unmatchedRight,
      manualPairs,
      compareFields,
    });
  }, [baseResult, manualPairs, compareFields]);

  const exportResult = useMemo(() => {
    const editedMatchedRows = finalResult.matchedRows.map((pair) => {
      const edits = rowEdits[pair.id];
      if (!edits?.versions?.length) return pair;
      const last = edits.versions[edits.versions.length - 1];
      const { matches, detail } = scorePair(last.leftRow, last.rightRow, compareFields);
      return { ...pair, leftRow: last.leftRow, rightRow: last.rightRow, matchDetail: detail, matchedCount: matches };
    });
    return { ...finalResult, matchedRows: editedMatchedRows };
  }, [finalResult, rowEdits, compareFields]);

  const handleExportCSV = () => {
    try {
      exportCSV(exportResult, compareFields, leftPanel, rightPanel, rowEdits, activeTab, rowFilter);
    } catch (err) {
      console.error("CSV Export Error:", err);
      alert("Failed to export CSV: " + err.message);
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportExcel(exportResult, compareFields, leftPanel, rightPanel, rowEdits, activeTab, rowFilter);
    } catch (err) {
      console.error("Excel Export Error:", err);
      alert("Failed to export Excel: " + err.message);
    }
  };

  if (!importMeta?.importId || !leftPanel?.rows?.length || !rightPanel?.rows?.length) {
    return (
      <div className="comparePage">
        <div className="compareSimpleBox">
          <h2>Compare Formatted Data</h2>
          <div className="compareError">
            Missing formatted data. Please go back and save/show both formatted outputs first.
          </div>
          <button onClick={onBack}>Back to Format</button>
        </div>
      </div>
    );
  }

  return (
    <div className="comparePage">
      <CompareHeader
        importMeta={importMeta}
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        onBack={onBack}
      />

      <CompareSetupPanel
        leftPanel={leftPanel}
        rightPanel={rightPanel}
        compareFields={compareFields}
        setCompareFields={setCompareFields}
        onSaveAsDefault={handleSaveAsDefault}
        saveStatus={saveStatus}
      />

      <div className="compareExportBar">
        <span className="exportLabel">Export Current View:</span>
        <button
          className="btn-export btn-csv"
          onClick={handleExportCSV}
          disabled={
            activeTab === "results"
              ? !finalResult?.matchedRows?.length
              : !finalResult?.unmatchedLeft?.length && !finalResult?.unmatchedRight?.length
          }
        >
          📊 CSV
        </button>
        <button
          className="btn-export btn-excel"
          onClick={handleExportExcel}
          disabled={
            activeTab === "results"
              ? !finalResult?.matchedRows?.length
              : !finalResult?.unmatchedLeft?.length && !finalResult?.unmatchedRight?.length
          }
        >
          📈 Excel
        </button>
      </div>

      {compareLoading && (
        <div className="compareStatusBar compareStatusLoading">Comparing all rows…</div>
      )}
      {compareError && (
        <div className="compareStatusBar compareStatusError">Compare failed: {compareError}</div>
      )}

      <CompareTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        resultsCount={finalResult.matchedRows.length}
        unmatchedLeftCount={finalResult.unmatchedLeft.length}
        unmatchedRightCount={finalResult.unmatchedRight.length}
      />

      {activeTab === "results" && (
        <CompareResultsTable
          importId={importMeta?.importId}
          leftPanel={leftPanel}
          rightPanel={rightPanel}
          compareFields={compareFields}
          matchedRows={finalResult.matchedRows}
          rowEdits={rowEdits}
          setRowEdits={setRowEdits}
          rowFilter={rowFilter}
          setRowFilter={setRowFilter}
        />
      )}

      {activeTab === "unmatched" && (
        <CompareUnmatchedPanel
          leftPanel={leftPanel}
          rightPanel={rightPanel}
          compareFields={compareFields}
          unmatchedLeft={finalResult.unmatchedLeft}
          unmatchedRight={finalResult.unmatchedRight}
          manualPairs={manualPairs}
          setManualPairs={setManualPairs}
        />
      )}
    </div>
  );
}
