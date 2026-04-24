import { useEffect, useMemo, useState } from "react";
import {
  amountDifference,
  compareBoolClass,
  scorePair,
} from "../../utils/compareUtils";
import { fetchRowEdits, saveRowEdit } from "../../services/rowEditsApi";
import "./CompareResultsTable.css";

function getRowType(pair, compareFields, nameCompareField) {
  const nameDetail = nameCompareField
    ? pair?.matchDetail?.[nameCompareField.key]
    : null;
  const isEmployerFallback =
    nameDetail?.ok &&
    (nameDetail?.mode === "left_name_to_right_employer" ||
      nameDetail?.mode === "right_name_to_left_employer");
  if (isEmployerFallback) return "conditional";
  const allMatch = compareFields.every((f) => pair.matchDetail?.[f.key]?.ok);
  return allMatch ? "truth" : "false";
}

function buildHistoryTooltip(versions, compareFields) {
  const typeLabel = { truth: "Truth ✓", conditional: "Conditional Truth", false: "False ✗" };
  const lines = [`Full history (${versions.length} version${versions.length !== 1 ? "s" : ""}):`, ""];

  versions.forEach((v, i) => {
    const when =
      i === 0
        ? "Original"
        : `${v.label}  —  ${new Date(v.timestamp).toLocaleString()}`;
    lines.push(`${when}  [${typeLabel[v.type] || v.type}]`);

    if (v.matchDetail) {
      const fieldLine = compareFields
        .map((f) => `${f.label}: ${v.matchDetail[f.key]?.ok ? "✓" : "✗"}`)
        .join("   ");
      lines.push(`  ${fieldLine}`);
    }

    if (i > 0) {
      const prev = versions[i - 1];
      const leftChanges = [];
      const rightChanges = [];

      for (const key of Object.keys(v.leftRow || {})) {
        if (key.startsWith("__")) continue;
        const before = String(prev.leftRow?.[key] ?? "");
        const after = String(v.leftRow[key] ?? "");
        if (before !== after)
          leftChanges.push(`  ${key}: "${before}" → "${after}"`);
      }
      for (const key of Object.keys(v.rightRow || {})) {
        if (key.startsWith("__")) continue;
        const before = String(prev.rightRow?.[key] ?? "");
        const after = String(v.rightRow[key] ?? "");
        if (before !== after)
          rightChanges.push(`  ${key}: "${before}" → "${after}"`);
      }

      if (leftChanges.length) {
        lines.push("  [Left file changed]");
        leftChanges.forEach((c) => lines.push(c));
      }
      if (rightChanges.length) {
        lines.push("  [Right file changed]");
        rightChanges.forEach((c) => lines.push(c));
      }
    }

    lines.push("");
  });

  return lines.join("\n").trim();
}

export default function CompareResultsTable({
  importId,
  leftPanel,
  rightPanel,
  compareFields,
  matchedRows,
}) {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: "" });
  const [rowFilter, setRowFilter] = useState("all");
  const [editingPairId, setEditingPairId] = useState(null);
  const [editDraft, setEditDraft] = useState({ left: {}, right: {} });
  const [rowEdits, setRowEdits] = useState({});

  useEffect(() => {
    if (!importId) return;
    fetchRowEdits(importId)
      .then((rows) => {
        const map = {};
        for (const r of rows) map[r.pairId] = { versions: r.versions };
        setRowEdits(map);
      })
      .catch(console.error);
  }, [importId]);

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
    const newType = getRowType(editedPair, compareFields, nameCompareField);

    const prevEdits = rowEdits[originalPair.id];
    const originalVersion = prevEdits?.versions?.[0] || {
      leftRow: { ...originalPair.leftRow },
      rightRow: { ...originalPair.rightRow },
      matchDetail: originalPair.matchDetail,
      type: getRowType(originalPair, compareFields, nameCompareField),
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
      c[getRowType(pair, compareFields, nameCompareField)]++;
    return c;
  }, [effectivePairs, compareFields, nameCompareField]);

  const visiblePairs = useMemo(() => {
    if (rowFilter === "all") return effectivePairs;
    return effectivePairs.filter(
      (pair) => getRowType(pair, compareFields, nameCompareField) === rowFilter
    );
  }, [effectivePairs, compareFields, nameCompareField, rowFilter]);

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
              <th colSpan={compareFields.length + 1}>Do the records match?</th>
              <th />
            </tr>
            <tr>
              {leftPanel.headers.map((h) => <th key={`lh-${h}`}>{h}</th>)}
              <th className="compareSpacer" />
              {rightPanel.headers.map((h) => <th key={`rh-${h}`}>{h}</th>)}
              <th className="compareSpacer" />
              {compareFields.map((f) => <th key={`cf-${f.key}`}>{f.label}</th>)}
              <th>Amount Diff</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {visiblePairs.map((pair) => {
              const originalPair = pair._originalPair || pair;
              const rowType = getRowType(pair, compareFields, nameCompareField);
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

              const historyText = isEdited
                ? buildHistoryTooltip(edits.versions, compareFields)
                : "";
              const dataCellTooltip = isEdited ? historyText : professionalReason;

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
                    {compareFields.map((f) => {
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

                  {compareFields.map((f) => {
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
          { bg: "#14532d", border: "#16a34a", label: "Green — Corrected to Truth via editing (hover for full history)." },
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
