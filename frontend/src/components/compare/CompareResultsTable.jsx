import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
// A name match that isn't a strict name-to-name hit (employer fallback, or any
// of the new partial-token matches) downgrades the row from Truth to
// Conditional Truth so the user can spot it.
const SOFT_NAME_MODES = new Set([
  "left_name_to_right_employer",
  "right_name_to_left_employer",
  "name_to_name_partial",
  "left_name_to_right_employer_partial",
  "right_name_to_left_employer_partial",
]);

function getRowType(pair, visibleCompareFields, nameCompareField) {
  const nameVisible = nameCompareField && visibleCompareFields.some((f) => f.key === nameCompareField.key);
  const nameDetail = nameVisible ? pair?.matchDetail?.[nameCompareField.key] : null;
  const isSoftNameMatch = nameDetail?.ok && SOFT_NAME_MODES.has(nameDetail?.mode);
  const allMatch = visibleCompareFields.every((f) => pair.matchDetail?.[f.key]?.ok);
  if (!allMatch) return "false";
  if (isSoftNameMatch) return "conditional";
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
  searchQuery,
  setSearchQuery,
  hideStandalone,
  setHideStandalone,
}) {
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, text: "" });
  const [editingPairId, setEditingPairId] = useState(null);
  const [editDraft, setEditDraft] = useState({ left: {}, right: {} });
  const [historyModalVersions, setHistoryModalVersions] = useState(null);

  // Synced horizontal scrolling between left and right output panes (matches
  // the Format-page behaviour). A single sticky scrollbar at the bottom of the
  // results wrap drives both panes; scrolling either pane directly also syncs
  // the other. The fixed match section never scrolls horizontally.
  const leftPaneRef = useRef(null);
  const rightPaneRef = useRef(null);
  const matchPaneRef = useRef(null);
  const compareSharedScrollRef = useRef(null);
  const [compareSharedWidth, setCompareSharedWidth] = useState(0);
  const compareSyncingRef = useRef(false);

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

  // Counts reflect the hideStandalone toggle so the chip numbers match the
  // table, but they ignore the search query — search narrows what you see
  // within a type, not the type populations themselves.
  const countablePairs = useMemo(
    () => (hideStandalone ? effectivePairs.filter((p) => !p.isStandalone) : effectivePairs),
    [effectivePairs, hideStandalone]
  );

  const standaloneCount = useMemo(
    () => effectivePairs.filter((p) => p.isStandalone).length,
    [effectivePairs]
  );

  const counts = useMemo(() => {
    const c = { truth: 0, conditional: 0, false: 0 };
    for (const pair of countablePairs)
      c[getRowType(pair, visibleCompareFields, nameCompareField)]++;
    return c;
  }, [countablePairs, visibleCompareFields, nameCompareField]);

  const rowMatchesSearch = useCallback(
    (pair, q) => {
      if (!q) return true;
      for (const h of leftPanel.headers) {
        if (String(pair.leftRow?.[h] ?? "").toLowerCase().includes(q)) return true;
      }
      for (const h of rightPanel.headers) {
        if (String(pair.rightRow?.[h] ?? "").toLowerCase().includes(q)) return true;
      }
      return false;
    },
    [leftPanel.headers, rightPanel.headers]
  );

  const visiblePairs = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    return countablePairs.filter((pair) => {
      if (rowFilter !== "all" && getRowType(pair, visibleCompareFields, nameCompareField) !== rowFilter) return false;
      if (!rowMatchesSearch(pair, q)) return false;
      return true;
    });
  }, [countablePairs, visibleCompareFields, nameCompareField, rowFilter, searchQuery, rowMatchesSearch]);

  const filterBtns = [
    { key: "all", label: "All", count: countablePairs.length },
    { key: "truth", label: "Truth", count: counts.truth },
    { key: "conditional", label: "Conditional Truth", count: counts.conditional },
    { key: "false", label: "False", count: counts.false },
  ];

  // Quick-jump: move each output pane independently so the matched column
  // lands at that pane's left edge — but never past the natural scroll range,
  // so we don't reveal empty space when the column already fits. Each pane is
  // clamped to its own [0, scrollWidth − clientWidth], so the two panes may
  // end up at different scrollLefts (which is the point — column alignment
  // beats pixel alignment for this action). Pixel sync is suppressed for two
  // animation frames so the writes' async scroll events don't undo the jump.
  const jumpToField = useCallback((field) => {
    const leftEl = leftPaneRef.current;
    const rightEl = rightPaneRef.current;
    const sharedEl = compareSharedScrollRef.current;
    if (!leftEl || !rightEl) return;

    const leftIdx = leftPanel.headers.indexOf(field.leftField);
    const rightIdx = rightPanel.headers.indexOf(field.rightField);
    const leftTh = leftEl.querySelectorAll("thead tr:nth-child(2) th")[leftIdx];
    const rightTh = rightEl.querySelectorAll("thead tr:nth-child(2) th")[rightIdx];

    // Compute each column's distance from its own pane's left edge using
    // getBoundingClientRect. Raw th.offsetLeft is relative to the nearest
    // positioned ancestor (here .compareResultsWrap), which would otherwise
    // include the left pane's width when measuring the right pane.
    const offsetWithinPane = (th, paneEl) => {
      if (!th || !paneEl) return 0;
      return th.getBoundingClientRect().left - paneEl.getBoundingClientRect().left + paneEl.scrollLeft;
    };
    const leftMax = Math.max(0, leftEl.scrollWidth - leftEl.clientWidth);
    const rightMax = Math.max(0, rightEl.scrollWidth - rightEl.clientWidth);
    const leftX = Math.min(offsetWithinPane(leftTh, leftEl), leftMax);
    const rightX = Math.min(offsetWithinPane(rightTh, rightEl), rightMax);

    compareSyncingRef.current = true;
    leftEl.scrollLeft = leftX;
    rightEl.scrollLeft = rightX;
    if (sharedEl) sharedEl.scrollLeft = leftX;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        compareSyncingRef.current = false;
      });
    });
  }, [leftPanel?.headers, rightPanel?.headers]);

  // Measure both panes' scrollWidth and feed the larger into the shared bottom
  // scrollbar; re-measure on resize or whenever the dataset changes.
  useEffect(() => {
    const measure = () => {
      const lw = leftPaneRef.current?.scrollWidth || 0;
      const rw = rightPaneRef.current?.scrollWidth || 0;
      setCompareSharedWidth(Math.max(lw, rw));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (leftPaneRef.current) ro.observe(leftPaneRef.current);
    if (rightPaneRef.current) ro.observe(rightPaneRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [visiblePairs.length, leftPanel?.headers?.length, rightPanel?.headers?.length]);

  // Bidirectional sync: horizontal scroll syncs between left pane, right pane,
  // and the shared bottom bar; vertical scroll syncs between all three panes
  // (including the fixed match pane) so rows always line up across panes.
  useEffect(() => {
    const writeAll = (sourceEl, { x, y }) => {
      if (compareSyncingRef.current) return;
      compareSyncingRef.current = true;
      const setH = (el) => {
        if (x !== undefined && el && el !== sourceEl) el.scrollLeft = x;
      };
      const setV = (el) => {
        if (y !== undefined && el && el !== sourceEl) el.scrollTop = y;
      };
      setH(compareSharedScrollRef.current);
      setH(leftPaneRef.current);
      setH(rightPaneRef.current);
      setV(leftPaneRef.current);
      setV(rightPaneRef.current);
      setV(matchPaneRef.current);
      requestAnimationFrame(() => {
        compareSyncingRef.current = false;
      });
    };

    const onShared = () =>
      writeAll(compareSharedScrollRef.current, { x: compareSharedScrollRef.current?.scrollLeft ?? 0 });
    const onLeft = () =>
      writeAll(leftPaneRef.current, { x: leftPaneRef.current?.scrollLeft ?? 0, y: leftPaneRef.current?.scrollTop ?? 0 });
    const onRight = () =>
      writeAll(rightPaneRef.current, { x: rightPaneRef.current?.scrollLeft ?? 0, y: rightPaneRef.current?.scrollTop ?? 0 });
    const onMatch = () =>
      writeAll(matchPaneRef.current, { y: matchPaneRef.current?.scrollTop ?? 0 });

    const s = compareSharedScrollRef.current;
    const l = leftPaneRef.current;
    const r = rightPaneRef.current;
    const m = matchPaneRef.current;
    s?.addEventListener("scroll", onShared, { passive: true });
    l?.addEventListener("scroll", onLeft, { passive: true });
    r?.addEventListener("scroll", onRight, { passive: true });
    m?.addEventListener("scroll", onMatch, { passive: true });
    return () => {
      s?.removeEventListener("scroll", onShared);
      l?.removeEventListener("scroll", onLeft);
      r?.removeEventListener("scroll", onRight);
      m?.removeEventListener("scroll", onMatch);
    };
  }, [compareSharedWidth]);

  return (
    <div className="compareResultsWrap" style={{ position: "relative" }}>
      <div className="compareSearchBar">
        <div className="compareSearchInputWrap">
          <input
            type="search"
            className="compareSearchInput"
            placeholder="Search any field…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="compareSearchClear"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <label className="compareStandaloneToggle">
          <input
            type="checkbox"
            checked={hideStandalone}
            onChange={(e) => setHideStandalone(e.target.checked)}
          />
          Hide one-sided rows
          {standaloneCount > 0 && (
            <span className="compareStandaloneCount">{standaloneCount}</span>
          )}
        </label>
      </div>

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
        Showing {visiblePairs.length} of {countablePairs.length} paired rows
        {searchQuery ? ` matching “${searchQuery}”` : ""}
        {hideStandalone && standaloneCount > 0
          ? ` · ${standaloneCount} one-sided hidden`
          : ""}
        .
      </div>

      {compareFields.length > 0 && (
        <div className="compareJumpBar">
          <span className="compareJumpLabel">Jump to:</span>
          {compareFields.map((f) => (
            <button
              key={`jump-${f.key}`}
              type="button"
              className="compareJumpBtn"
              onClick={() => jumpToField(f)}
              title={`Align both panes on ${f.label}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {(() => {
        // Precompute per-pair display metadata once so each of the three
        // sub-tables (left output / right output / fixed match section)
        // renders consistently and stays in lockstep row-by-row.
        const pairMeta = visiblePairs.map((pair) => {
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

          const isEditing = editingPairId === originalPair.id;
          return { pair, originalPair, rowType, edits, isEdited, canEdit, dataCellTooltip, infoCellStyle, isEditing };
        });

        return (
          <div className="compareResultsTableWrap">
            <div className="compareTriPaneRow">
              <div className="compareScrollPane comparePaneLeft" ref={leftPaneRef}>
                <table className="compareSubTable">
                  <colgroup>
                    {leftPanel.headers.map((h) => <col key={`lc-${h}`} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th colSpan={leftPanel.headers.length}>{leftPanel.title || "Left"}</th>
                    </tr>
                    <tr>
                      {leftPanel.headers.map((h) => <th key={`lh-${h}`}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {pairMeta.map(({ pair, isEditing, infoCellStyle, dataCellTooltip }) => (
                      isEditing ? (
                        <tr key={`L-${pair.id}`} className="editingRow">
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
                        </tr>
                      ) : (
                        <tr key={`L-${pair.id}`}>
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
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="compareScrollPane comparePaneRight" ref={rightPaneRef}>
                <table className="compareSubTable">
                  <colgroup>
                    {rightPanel.headers.map((h) => <col key={`rc-${h}`} />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th colSpan={rightPanel.headers.length}>{rightPanel.title || "Right"}</th>
                    </tr>
                    <tr>
                      {rightPanel.headers.map((h) => <th key={`rh-${h}`}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {pairMeta.map(({ pair, isEditing, infoCellStyle, dataCellTooltip }) => (
                      isEditing ? (
                        <tr key={`R-${pair.id}`} className="editingRow">
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
                        </tr>
                      ) : (
                        <tr key={`R-${pair.id}`}>
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
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="comparePaneFixed" ref={matchPaneRef}>
                <table className="compareSubTable">
                  <thead>
                    <tr>
                      <th colSpan={visibleCompareFields.length + 2}>Do the records match?</th>
                    </tr>
                    <tr>
                      {visibleCompareFields.map((f) => (
                        <th
                          key={`cf-${f.key}`}
                          className="compareMatchJumpable"
                          title={`Align ${f.label} on both panes`}
                          onClick={() => jumpToField(f)}
                        >
                          {f.label}
                        </th>
                      ))}
                      <th>Amount Diff</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {pairMeta.map(({ pair, originalPair, edits, isEdited, canEdit, isEditing }) => (
                      isEditing ? (
                        <tr key={`M-${pair.id}`} className="editingRow">
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
                      ) : (
                        <tr key={`M-${pair.id}`}>
                          {visibleCompareFields.map((f) => {
                            const result = pair.matchDetail?.[f.key];
                            const isSpecialNameMatch =
                              f.key === nameCompareField?.key &&
                              result?.ok &&
                              SOFT_NAME_MODES.has(result?.mode);
                            const cellTooltip = isSpecialNameMatch
                              ? `TRUE - ${result?.reason || "Name matched via fallback/partial"}`
                              : result?.reason || "";
                            return (
                              <td
                                key={`m-${pair.id}-${f.key}`}
                                className={`${compareBoolClass(result)} compareMatchJumpable`}
                                onMouseEnter={(e) => showTooltip(e, cellTooltip)}
                                onMouseMove={(e) => moveTooltip(e, cellTooltip)}
                                onMouseLeave={hideTooltip}
                                onClick={() => jumpToField(f)}
                                style={{ cursor: "pointer" }}
                                title={cellTooltip ? undefined : `Align ${f.label} on both panes`}
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
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {compareSharedWidth > 0 && (
              <div className="compareSharedScroll" ref={compareSharedScrollRef}>
                <div
                  className="compareSharedScrollInner"
                  style={{ width: compareSharedWidth }}
                />
              </div>
            )}
          </div>
        );
      })()}

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
