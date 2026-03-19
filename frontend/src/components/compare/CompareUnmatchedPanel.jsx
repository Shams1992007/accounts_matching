import { useMemo, useState } from "react";
import "./CompareUnmatchedPanel.css";

export default function CompareUnmatchedPanel({
  leftPanel,
  rightPanel,
  unmatchedLeft,
  unmatchedRight,
  manualPairs,
  setManualPairs,
}) {
  const [selectedLeft, setSelectedLeft] = useState("");
  const [selectedRight, setSelectedRight] = useState("");

  const existingPairKeys = useMemo(() => {
    return new Set(
      manualPairs.map((p) => `${p.leftRowKey}__${p.rightRowKey}`)
    );
  }, [manualPairs]);

  const addManualPair = () => {
    if (!selectedLeft || !selectedRight) return;

    const pairKey = `${selectedLeft}__${selectedRight}`;
    if (existingPairKeys.has(pairKey)) return;

    setManualPairs((prev) => [
      ...prev,
      {
        leftRowKey: selectedLeft,
        rightRowKey: selectedRight,
      },
    ]);

    setSelectedLeft("");
    setSelectedRight("");
  };

  const removeManualPair = (leftRowKey, rightRowKey) => {
    setManualPairs((prev) =>
      prev.filter(
        (p) => !(p.leftRowKey === leftRowKey && p.rightRowKey === rightRowKey)
      )
    );
  };

  return (
    <div className="compareUnmatchedWrap">
      <div className="compareManualPairBox">
        <b>Manual Pairing</b>
        <div className="compareManualPairSub">
          Choose one unmatched row from each side and add them as a manual pair.
        </div>

        <div className="compareManualPairRow">
          <select value={selectedLeft} onChange={(e) => setSelectedLeft(e.target.value)}>
            <option value="">-- Select unmatched row from {leftPanel.title} --</option>
            {unmatchedLeft.map((row) => (
              <option key={row.__rowKey} value={row.__rowKey}>
                #{row.__rowKey} — {row.Name || row["Name"] || "(no name)"}
              </option>
            ))}
          </select>

          <select value={selectedRight} onChange={(e) => setSelectedRight(e.target.value)}>
            <option value="">-- Select unmatched row from {rightPanel.title} --</option>
            {unmatchedRight.map((row) => (
              <option key={row.__rowKey} value={row.__rowKey}>
                #{row.__rowKey} — {row.Name || row["Name"] || "(no name)"}
              </option>
            ))}
          </select>

          <button onClick={addManualPair}>Add Pair</button>
        </div>

        {!!manualPairs.length && (
          <div className="compareManualPairsList">
            {manualPairs.map((p) => (
              <div key={`${p.leftRowKey}-${p.rightRowKey}`} className="compareManualPairItem">
                <span>
                  Left #{p.leftRowKey} ↔ Right #{p.rightRowKey}
                </span>
                <button onClick={() => removeManualPair(p.leftRowKey, p.rightRowKey)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="compareUnmatchedGrid">
        <div className="compareUnmatchedBox">
          <h3>{leftPanel.title} Unmatched Rows</h3>
          <div className="compareUnmatchedCount">{unmatchedLeft.length} rows</div>
          <div className="compareUnmatchedTableWrap">
            <table className="compareMiniTable">
              <thead>
                <tr>
                  {leftPanel.headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unmatchedLeft.map((row) => (
                  <tr key={row.__rowKey}>
                    {leftPanel.headers.map((h) => (
                      <td key={`${row.__rowKey}-${h}`}>{String(row[h] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="compareUnmatchedBox">
          <h3>{rightPanel.title} Unmatched Rows</h3>
          <div className="compareUnmatchedCount">{unmatchedRight.length} rows</div>
          <div className="compareUnmatchedTableWrap">
            <table className="compareMiniTable">
              <thead>
                <tr>
                  {rightPanel.headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unmatchedRight.map((row) => (
                  <tr key={row.__rowKey}>
                    {rightPanel.headers.map((h) => (
                      <td key={`${row.__rowKey}-${h}`}>{String(row[h] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}