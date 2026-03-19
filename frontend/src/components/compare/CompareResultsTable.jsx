import { useState } from "react";
import {
  amountDifference,
  compareBoolClass,
} from "../../utils/compareUtils";
import "./CompareResultsTable.css";

export default function CompareResultsTable({
  leftPanel,
  rightPanel,
  compareFields,
  matchedRows,
}) {
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });

  const amountCompareField = compareFields.find(
    (f) => f.label.toLowerCase().includes("amount")
  );

  const nameCompareField = compareFields.find(
    (f) => f.label.toLowerCase().includes("name")
  );

  const showTooltip = (e, text) => {
    if (!text) return;
    setTooltip({
      visible: true,
      x: e.clientX + 14,
      y: e.clientY + 14,
      text,
    });
  };

  const moveTooltip = (e, text) => {
    if (!text) return;
    setTooltip({
      visible: true,
      x: e.clientX + 14,
      y: e.clientY + 14,
      text,
    });
  };

  const hideTooltip = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  return (
    <div className="compareResultsWrap" style={{ position: "relative" }}>
      <div className="compareResultsInfo">
        Showing {matchedRows.length} paired rows.
      </div>

      <div className="compareResultsTableWrap">
        <table className="compareResultsTable">
          <thead>
            <tr>
              <th colSpan={leftPanel.headers.length}>
                {leftPanel.title || "Left"}
              </th>
              <th className="compareSpacer" />
              <th colSpan={rightPanel.headers.length}>
                {rightPanel.title || "Right"}
              </th>
              <th className="compareSpacer" />
              <th colSpan={compareFields.length + 1}>
                Do the records match?
              </th>
            </tr>

            <tr>
              {leftPanel.headers.map((h) => (
                <th key={`lh-${h}`}>{h}</th>
              ))}
              <th className="compareSpacer" />
              {rightPanel.headers.map((h) => (
                <th key={`rh-${h}`}>{h}</th>
              ))}
              <th className="compareSpacer" />
              {compareFields.map((f) => (
                <th key={`cf-${f.key}`}>{f.label}</th>
              ))}
              <th>Amount Difference</th>
            </tr>
          </thead>

          <tbody>
            {matchedRows.map((pair) => {
              const nameDetail = nameCompareField
                ? pair?.matchDetail?.[nameCompareField.key]
                : null;

              const isEmployerFallback =
                nameDetail?.ok &&
                (nameDetail?.mode === "left_name_to_right_employer" ||
                  nameDetail?.mode === "right_name_to_left_employer");

              const professionalReason = isEmployerFallback
                ? `Name matched using Employer/Organization fallback. ${nameDetail?.reason || ""}`
                : "";

              const infoCellStyle = isEmployerFallback
                ? {
                    backgroundColor: "#0009b5",
                    color: "#ffffff",
                    cursor: "help",
                  }
                : undefined;

              return (
                <tr key={pair.id}>
                  {leftPanel.headers.map((h) => (
                    <td
                      key={`l-${pair.id}-${h}`}
                      style={infoCellStyle}
                      onMouseEnter={(e) => showTooltip(e, professionalReason)}
                      onMouseMove={(e) => moveTooltip(e, professionalReason)}
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
                      onMouseEnter={(e) => showTooltip(e, professionalReason)}
                      onMouseMove={(e) => moveTooltip(e, professionalReason)}
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
                        style={{
                          cursor: cellTooltip ? "help" : "default",
                        }}
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
            maxWidth: 320,
            background: "#111827",
            color: "#ffffff",
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.4,
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            pointerEvents: "none",
            whiteSpace: "normal",
          }}
        >
          {tooltip.text}
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
        <span
          style={{
            display: "inline-block",
            width: 14,
            height: 14,
            background: "#0009b5",
            border: "1px solid #1d4ed8",
            verticalAlign: "middle",
            marginRight: 6,
          }}
        />
        Blue rows indicate the Name matched through Employer/Organization fallback.
        Hover the row or the comparison cell to see the reason.
      </div>
    </div>
  );
}