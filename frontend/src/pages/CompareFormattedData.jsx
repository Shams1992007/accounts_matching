import { useEffect, useMemo, useState } from "react";
import CompareHeader from "../components/compare/CompareHeader";
import CompareTabs from "../components/compare/CompareTabs";
import CompareSetupPanel from "../components/compare/CompareSetupPanel";
import CompareResultsTable from "../components/compare/CompareResultsTable";
import CompareUnmatchedPanel from "../components/compare/CompareUnmatchedPanel";
import {
  applyManualPairs,
  buildCompareRows,
  getDefaultCompareFields,
} from "../utils/compareUtils";
import "./CompareFormattedData.css";
import { exportCSV, exportExcel, exportPDF } from "../utils/exportUtils";

export default function CompareFormattedData({
  importMeta,
  formattedPanels,
  onBack,
}) {
  const leftPanel = formattedPanels?.panel1 || null;
  const rightPanel = formattedPanels?.panel2 || null;

  const [activeTab, setActiveTab] = useState("results");
  const [minimumMatchCount, setMinimumMatchCount] = useState(2);
  const [compareFields, setCompareFields] = useState([]);
  const [manualPairs, setManualPairs] = useState([]);

  useEffect(() => {
    if (!leftPanel?.headers?.length || !rightPanel?.headers?.length) return;

    setCompareFields(
      getDefaultCompareFields(leftPanel.headers, rightPanel.headers)
    );
  }, [leftPanel?.headers, rightPanel?.headers]);

  const baseResult = useMemo(() => {
    return buildCompareRows({
      leftRows: leftPanel?.rows || [],
      rightRows: rightPanel?.rows || [],
      compareFields,
      minimumMatchCount,
    });
  }, [leftPanel?.rows, rightPanel?.rows, compareFields, minimumMatchCount]);

  const finalResult = useMemo(() => {
    return applyManualPairs({
      baseMatchedRows: baseResult.matchedRows,
      unmatchedLeft: baseResult.unmatchedLeft,
      unmatchedRight: baseResult.unmatchedRight,
      manualPairs,
      compareFields,
    });
  }, [baseResult, manualPairs, compareFields]);

    // --- Export Handlers ---
  const handleExportCSV = () => {
    try {
      exportCSV(
        finalResult,
        compareFields,
        leftPanel?.headers || [],
        rightPanel?.headers || []
      );
    } catch (err) {
      console.error("CSV Export Error:", err);
      alert("Failed to export CSV: " + err.message);
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportExcel(
        finalResult,
        compareFields,
        leftPanel?.headers || [],
        rightPanel?.headers || []
      );
    } catch (err) {
      console.error("Excel Export Error:", err);
      alert("Failed to export Excel: " + err.message);
    }
  };

  const handleExportPDF = () => {
    try {
      exportPDF(
        finalResult,
        compareFields,
        leftPanel?.headers || [],
        rightPanel?.headers || []
      );
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("Failed to export PDF: " + err.message);
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
        minimumMatchCount={minimumMatchCount}
        setMinimumMatchCount={setMinimumMatchCount}
      />

            {/* --- Export Buttons --- */}
      <div className="compareExportBar">
        <span className="exportLabel">Export Full Results:</span>
        <button 
          className="btn-export btn-csv" 
          onClick={handleExportCSV}
          disabled={!finalResult?.matchedRows?.length}
        >
          📊 CSV
        </button>
        <button 
          className="btn-export btn-excel" 
          onClick={handleExportExcel}
          disabled={!finalResult?.matchedRows?.length}
        >
          📈 Excel
        </button>
        <button 
          className="btn-export btn-pdf" 
          onClick={handleExportPDF}
          disabled={!finalResult?.matchedRows?.length}
        >
          📄 PDF
        </button>
      </div>

      <CompareTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "results" && (
        <CompareResultsTable
          leftPanel={leftPanel}
          rightPanel={rightPanel}
          compareFields={compareFields}
          matchedRows={finalResult.matchedRows}
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