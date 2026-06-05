import { useMemo, useState } from "react";
import {
  amountDifference,
  compareBoolClass,
  isFieldRequired,
  scorePair,
} from "../../utils/compareUtils";
import { saveRowEdit } from "../../services/rowEditsApi";
import "./CompareResultsTable.css";

// Row color is judged on *visible* (Required) fields only — hidden Optional
// fields are not part of what the user sees, so they don't influence the verdict.
function getRowType(pair, visibleCompareFields, nameCompareField) {
  const nameVisible = nameCompareField && visibleCompareFields.some((f) => f.key === nameCompareField.key);
  const nameDetail = nameVisible ? pair?.matchDetail?.[nameCompareField.key] : null;
  const isEmployerFallback =
    nameDetail?.ok &&
    (nameDetail?.mode === "left_name_to_right_employer" ||
      nameDetail?.mode === "right_name_to_left_employer");
  const allMatch = visibleCompareFields.every((f) => pair.matchDetail?.[f.key]?.ok);
  if (!allMatch) return "false";
  if (isEmployerFallback) return "conditional";
  return "truth";
}

function getVersionDiffs(versions, idx) {
  if (idx === 0) return { left: [], right: [] };
  const prev = versions[idx - 1];
  const curr = versions[idx];
  const left = [];
  const right = [];
  for (const key of Object.keys(curr.leftRow || {})) {
    if (key.startsWith("__")) continue;
    const before = String(prev.leftRow?.[key] ?? "");
    const after = String(curr.leftRow[key] ?? "");
    if (before !== after) left.push({ key, before, after });
  }
  for (const key of Object.keys(curr.rightRow || {})) {
    if (key.startsWith("__")) continue;
    const before = String(prev.rightRow?.[key] ?? "");
    const after = String(curr.rightRow[key] ?? "");
    if (before !== after) right.push({ key, before, after });
  }
  return { left, right };
}

const TYPE_LABEL = { truth: "Truth", conditional: "Conditional Truth", false: "False" };
const TYPE_STYLE = {
  truth:       { background: "#14532d", color: "#bbf7d0" },
  conditional: { background: "#1e1b70", color: "#c7d2fe" },
  false:       { background: "#7f1d1d", color: "#fecaca" },
};

function HistoryModal({ versions, compareFields, onClose }) {
  return (
    <div className="historyModalOverlay" onClick={onClose}>
      <div className="historyModalBox" onClick={(e) => e.stopPropagation()}>
        <div className="historyModalHeader">
          <span>Edit History — {versions.length} version{versions.length !== 1 ? "s" : ""}</span>
          <button className="historyModalClose" onClick={onClose}>✕</button>
        </div>
        <div className="historyModalBody">
          {versions.map((v, i) => {
            const { left: leftDiffs, right: rightDiffs } = getVersionDiffs(versions, i);
            const hasDiffs = leftDiffs.length > 0 || rightDiffs.length > 0;
            const typeStyle = TYPE_STYLE[v.type] || {};
            return (
              <div key={i} className="historyVersion">
                <div className="historyVersionHeader">
                  <span className="historyVersionLabel">
                    {i === 0 ? "Original" : v.label}
                  </span>
                  <span className="historyVersionType" style={typeStyle}>
                    {TYPE_LABEL[v.type] || v.type}
                  </span>
                  {i > 0 && v.timestamp && (
                    <span className="historyVersionTime">
                      {new Date(v.timestamp).toLocaleString()}
                    </span>
                  )}
                </div>

                {v.matchDetail && (
                  <div className="historyMatchFields">
                    {compareFields.map((f) => {
                      const ok = v.matchDetail[f.key]?.ok;
                      return (
                        <span key={f.key} className={ok ? "historyFieldTrue" : "historyFieldFalse"}>
                          {f.label}: {ok ? "✓" : "✗"}
                        </span>
                      );
                    })}
                  </div>
                )}

                {hasDiffs && (
                  <div className="historyDiffs">
                    {leftDiffs.map(({ key, before, after }) => (
                      <div key={`l-${key}`} className="historyDiffRow">
                        <span className="historyDiffSide">Left</span>
                        <span className="historyDiffField">{key}</span>
                        <span className="historyDiffBefore">"{before}"</span>
                        <span className="historyDiffArrow">→</span>
                        <span className="historyDiffAfter">"{after}"</span>
                      </div>
                    ))}
                    {rightDiffs.map(({ key, before, after }) => (
                      <div key={`r-${key}`} className="historyDiffRow">
                        <span className="historyDiffSide">Right</span>
                        <span className="historyDiffField">{key}</span>
                        <span className="historyDiffBefore">"{before}"</span>
                        <span className="historyDiffArrow">→</span>
                        <span className="historyDiffAfter">"{after}"</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CompareResultsTable({
  importId,
  leftPanel,
  rightPanel,
  compareFields,
  matchedRows,
  rowEdits,
  setRowEdits,
  rowFilter,
  setRowFilter,
}) {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: "" });
  const [editingPairId, setEditingPairId] = useState(null);
  const [editDraft, setEditDraft] = useState({ left: {}, right: {} });
  const [historyModalVersions, setHistoryModalVersions] = useState(null);

  const visibleCompareFields = useMemo(
    () => compareFields.filter(isFieldRequired),
    [compareFields]
  );

  const amountCompareField = compareFields.find((f) =>
    f.label.toLowerCase().includes("amount")
  );
  const nameCompareField = compareFields.find((f) =>
    f.label.toLowerCase().includes("name")
  );

  const showTooltip = (e, text) => {
    if (!text) return;
    setTooltip({ visible: true, x: e.clientX + 14, y: e.clientY + 14, text });
  };
  const moveTooltip = (e, text) => {
    if (!text) return;
    setTooltip({ visible: true, x: e.clientX + 14, y: e.clientY + 14, text });
  };
  const hideTooltip = () => setTooltip((prev) => ({ ...prev, visible: false }));

  function startEdit(pair) {
    setEditingPairId(pair.id);
    setEditDraft({ left: { ...pair.leftRow }, right: { ...pair.rightRow } });
  }

  function cancelEdit() {
    setEditingPairId(null);
    setEditDraft({ left: {}, right: {} });
  }

  function saveEdit(originalPair, currentPair) {
    const { matches, detail } = scorePair(editDraft.left, editDraft.right, compareFields);
    const editedPair = {
      ...currentPair,
      leftRow: editDraft.left,
      rightRow: editDraft.right,
      matchDetail: detail,
      matchedCount: matches,
    };
    const newType = getRowType(editedPair, visibleCompareFields, nameCompareField);

    const prevEdits = rowEdits[originalPair.id];
    const originalVersion = prevEdits?.versions?.[0] || {
      leftRow: { ...originalPair.leftRow },
      rightRow: { ...originalPair.rightRow },
      matchDetail: originalPair.matchDetail,
      type: getRowType(originalPair, visibleCompareFields, nameCompareField),
      label: "Original",
      timestamp: Date.now(),
    };

    const editCount = prevEdits ? prevEdits.versions.length : 1;
    const newVersion = {
      leftRow: { ...editDraft.left },
      rightRow: { ...editDraft.right },
      matchDetail: detail,
      type: newType,
      label: `Edit ${editCount}`,
      timestamp: Date.now(),
    };

    const newVersions = prevEdits
      ? [...prevEdits.versions, newVersion]
      : [originalVersion, newVersion];

    setRowEdits((prev) => ({
      ...prev,
      [originalPair.id]: { versions: newVersions },
    }));

    if (importId) {
      saveRowEdit(importId, originalPair.id, newVersions).catch(console.error);
    }

    setEditingPairId(null);
    setEditDraft({ left: {}, right: {} });
  }

  const liveDetail = useMemo(() => {
    if (!editingPairId) return {};
    const { detail } = scorePair(editDraft.left, editDraft.right, compareFields);
    return detail;
  }, [editingPairId, editDraft, compareFields]);

  const effectivePairs = useMemo(() => {
    return matchedRows.map((pair) => {
      const edits = rowEdits[pair.id];
      if (!edits?.versions?.length) return pair;
      const last = edits.versions[edits.versions.length - 1];
      const { matches, detail } = scorePair(last.leftRow, last.rightRow, compareFields);
      return {
        ...pair,
        leftRow: last.leftRow,
        rightRow: last.rightRow,
        matchDetail: detail,
        matchedCount: matches,
        _originalPair: pair,
      };
    });
  }, [matchedRows, rowEdits, compareFields]);

  const counts = useMemo(() => {
    const c = { truth: 0, conditional: 0, false: 0 };
    for (const pair of effectivePairs)
      c[getRowType(pair, visibleCompareFields, nameCompareField)]++;
    return c;
  }, [effectivePairs, visibleCompareFields, nameCompareField]);

  const visiblePairs = useMemo(() => {
    if (rowFilter === "all") return effectivePairs;
    return effectivePairs.filter(
      (pair) => getRowType(pair, visibleCompareFields, nameCompareField) === rowFilter
    );
  }, [effectivePairs, visibleCompareFields, nameCompareField, rowFilter]);

  const filterBtns = [
    { key: "all", label: "All", count: matchedRows.length },
    { key: "truth", label: "Truth", count: counts.truth },
    { key: "conditional", label: "Conditional Truth", count: counts.conditional },
    { key: "false", label: "False", count: counts.false },
  ];

  return (
    <div className="compareResultsWrap" style={{ position: "relative" }}>
      <div className="compareFilterBar">
        {filterBtns.map((btn) => (
          <button
            key={btn.key}
            className={`compareFilterBtn${rowFilter === btn.key ? " active" : ""} filterType-${btn.key}`}
            onClick={() => setRowFilter(btn.key)}
          >
            {btn.label} <span className="compareFilterCount">{btn.count}</span>
          </button>
        ))}
      </div>

      <div className="compareResultsInfo">
        Showing {visiblePairs.length} of {matchedRows.length} paired rows.
      </div>

      <div className="compareResultsTableWrap">
        <table className="compareResultsTable">
          <thead>
            <tr>
              <th colSpan={leftPanel.headers.length}>{leftPanel.title || "Left"}</th>
              <th className="compareSpacer" />
              <th colSpan={rightPanel.headers.length}>{rightPanel.title || "Right"}</th>
              <th className="compareSpacer" />
              <th colSpan={visibleCompareFields.length + 1}>Do the records match?</th>
              <th />
            </tr>
            <tr>
              {leftPanel.headers.map((h) => <th key={`lh-${h}`}>{h}</th>)}
              <th className="compareSpacer" />
              {rightPanel.headers.map((h) => <th key={`rh-${h}`}>{h}</th>)}
              <th className="compareSpacer" />
              {visibleCompareFields.map((f) => (
                <th key={`cf-${f.key}`} title={`Comparison field: ${f.label}`}>
                  {f.label}
                </th>
              ))}
              <th>Amount Diff</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {visiblePairs.map((pair) => {
              const originalPair = pair._originalPair || pair;
              const rowType = getRowType(pair, visibleCompareFields, nameCompareField);
              const isEmployerFallback = rowType === "conditional";
              const edits = rowEdits[originalPair.id];
              const isEdited = (edits?.versions?.length || 0) > 1;
              const originalType = edits?.versions?.[0]?.type;
              const wasEditedToTruth =
                isEdited && rowType === "truth" &&
                (originalType === "conditional" || originalType === "false");
              const canEdit =
                rowType === "false" || rowType === "conditional" || isEdited;

              const nameDetail = nameCompareField
                ? pair?.matchDetail?.[nameCompareField.key]
                : null;
              const professionalReason = isEmployerFallback
                ? `Name matched using Employer/Organization fallback. ${nameDetail?.reason || ""}`
                : "";

              const editCount = isEdited ? edits.versions.length - 1 : 0;
              const dataCellTooltip = isEdited
                ? `Edited ${editCount} time${editCount !== 1 ? "s" : ""}. Click the History button to view full edit history.`
                : professionalReason;

              const infoCellStyle = wasEditedToTruth
                ? { backgroundColor: "#14532d", color: "#bbf7d0", cursor: "help" }
                : rowType === "conditional"
                ? { backgroundColor: "#0009b5", color: "#ffffff", cursor: "help" }
                : rowType === "false"
                ? { backgroundColor: "#7f1d1d", color: "#fecaca" }
                : undefined;

              if (editingPairId === originalPair.id) {
                return (
                  <tr key={pair.id} className="editingRow">
                    {leftPanel.headers.map((h) => (
                      <td key={`el-${h}`} className="editCell">
                        <input
                          className="editInput"
                          value={editDraft.left[h] ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              left: { ...d.left, [h]: e.target.value },
                            }))
                          }
                        />
                      </td>
                    ))}
                    <td className="compareSpacer" />
                    {rightPanel.headers.map((h) => (
                      <td key={`er-${h}`} className="editCell">
                        <input
                          className="editInput"
                          value={editDraft.right[h] ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              right: { ...d.right, [h]: e.target.value },
                            }))
                          }
                        />
                      </td>
                    ))}
                    <td className="compareSpacer" />
                    {visibleCompareFields.map((f) => {
                      const result = liveDetail[f.key];
                      return (
                        <td key={`em-${f.key}`} className={compareBoolClass(result)}>
                          {result?.ok ? "TRUE" : "FALSE"}
                        </td>
                      );
                    })}
                    <td>
                      {amountCompareField
                        ? amountDifference(
                            editDraft.left,
                            editDraft.right,
                            amountCompareField.leftField,
                            amountCompareField.rightField
                          )
                        : ""}
                    </td>
                    <td className="editActions">
                      <button
                        className="editSaveBtn"
                        onClick={() => saveEdit(originalPair, pair)}
                      >
                        Save
                      </button>
                      <button className="editCancelBtn" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={pair.id}>
                  {leftPanel.headers.map((h) => (
                    <td
                      key={`l-${pair.id}-${h}`}
                      style={infoCellStyle}
                      onMouseEnter={(e) => showTooltip(e, dataCellTooltip)}
                      onMouseMove={(e) => moveTooltip(e, dataCellTooltip)}
                      onMouseLeave={hideTooltip}
                    >
                      {String(pair.leftRow?.[h] ?? "")}
                    </td>
                  ))}

                  <td className="compareSpacer" />

                  {rightPanel.headers.map((h) => (
                    <td
                      key={`r-${pair.id}-${h}`}
                      style={infoCellStyle}
                      onMouseEnter={(e) => showTooltip(e, dataCellTooltip)}
                      onMouseMove={(e) => moveTooltip(e, dataCellTooltip)}
                      onMouseLeave={hideTooltip}
                    >
                      {String(pair.rightRow?.[h] ?? "")}
                    </td>
                  ))}

                  <td className="compareSpacer" />

                  {visibleCompareFields.map((f) => {
                    const result = pair.matchDetail?.[f.key];
                    const isSpecialNameMatch =
                      f.key === nameCompareField?.key &&
                      result?.ok &&
                      (result?.mode === "left_name_to_right_employer" ||
                        result?.mode === "right_name_to_left_employer");
                    const cellTooltip = isSpecialNameMatch
                      ? `TRUE - Name matched using Employer/Organization fallback. ${result?.reason || ""}`
                      : result?.reason || "";

                    return (
                      <td
                        key={`m-${pair.id}-${f.key}`}
                        className={compareBoolClass(result)}
                        onMouseEnter={(e) => showTooltip(e, cellTooltip)}
                        onMouseMove={(e) => moveTooltip(e, cellTooltip)}
                        onMouseLeave={hideTooltip}
                        style={{ cursor: cellTooltip ? "help" : "default" }}
                      >
                        {result?.ok ? "TRUE" : "FALSE"}
                        {isSpecialNameMatch ? " *" : ""}
                      </td>
                    );
                  })}

                  <td>
                    {amountCompareField
                      ? amountDifference(
                          pair.leftRow,
                          pair.rightRow,
                          amountCompareField.leftField,
                          amountCompareField.rightField
                        )
                      : ""}
                  </td>

                  <td className="editActionCell">
                    {canEdit && (
                      <button
                        className="editRowBtn"
                        onClick={() => startEdit(pair)}
                      >
                        Edit
                      </button>
                    )}
                    {isEdited && (
                      <button
                        className="historyRowBtn"
                        onClick={() => setHistoryModalVersions(edits.versions)}
                      >
                        History
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {historyModalVersions && (
        <HistoryModal
          versions={historyModalVersions}
          compareFields={visibleCompareFields}
          onClose={() => setHistoryModalVersions(null)}
        />
      )}

      {tooltip.visible && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            zIndex: 9999,
            maxWidth: 460,
            background: "#111827",
            color: "#ffffff",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.6,
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            pointerEvents: "none",
            whiteSpace: "pre-line",
            fontFamily: "monospace",
          }}
        >
          {tooltip.text}
        </div>
      )}

      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          opacity: 0.8,
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        {[
          { bg: "#0009b5", border: "#1d4ed8", label: "Blue — Name matched via Employer/Organization fallback." },
          { bg: "#7f1d1d", border: "#991b1b", label: "Red — One or more fields did not match." },
          { bg: "#14532d", border: "#16a34a", label: "Green — Corrected to Truth via editing (click History to view)." },
        ].map(({ bg, border, label }) => (
          <span key={bg}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                background: bg,
                border: `1px solid ${border}`,
                verticalAlign: "middle",
                marginRight: 6,
              }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
