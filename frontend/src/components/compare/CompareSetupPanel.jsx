import "./CompareSetupPanel.css";
import { MIN_MATCHES_FOR_PAIR, isFieldRequired } from "../../utils/compareUtils";

function FieldRow({ idx, leftHeaders, rightHeaders, field, onChange, onRemove }) {
  const required = isFieldRequired(field);

  return (
    <div className={`compareSetupRow ${required ? "compareSetupRowRequired" : "compareSetupRowOptional"}`}>
      <span className="compareSetupRowNum">#{idx + 1}</span>

      <label
        className={`compareSetupRequiredToggle ${required ? "isRequired" : "isOptional"}`}
        title={
          required
            ? "Required — this comparison column is SHOWN in the Results table."
            : "Optional — this comparison column is HIDDEN from the Results table (still used for matching)."
        }
      >
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => onChange(idx, { ...field, required: e.target.checked })}
        />
        <span className="compareSetupRequiredText">{required ? "Required" : "Optional"}</span>
      </label>

      <input
        type="text"
        value={field.label}
        onChange={(e) => onChange(idx, { ...field, label: e.target.value })}
        placeholder="Comparison label (e.g. Date)"
      />

      <select
        value={field.leftField}
        onChange={(e) => onChange(idx, { ...field, leftField: e.target.value })}
      >
        <option value="">-- Left column --</option>
        {leftHeaders.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <span className="compareSetupArrow">↔</span>

      <select
        value={field.rightField}
        onChange={(e) => onChange(idx, { ...field, rightField: e.target.value })}
      >
        <option value="">-- Right column --</option>
        {rightHeaders.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <button type="button" onClick={() => onRemove(idx)} title="Remove this field">
        Remove
      </button>
    </div>
  );
}

export default function CompareSetupPanel({
  leftPanel,
  rightPanel,
  compareFields,
  setCompareFields,
  onSaveAsDefault,
  saveStatus,
}) {
  const updateField = (idx, next) => {
    setCompareFields((prev) => prev.map((f, i) => (i === idx ? next : f)));
  };

  const removeField = (idx) => {
    setCompareFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const addField = () => {
    setCompareFields((prev) => [
      ...prev,
      {
        key: `custom-${Date.now()}-${prev.length}`,
        label: "",
        leftField: "",
        rightField: "",
        required: true,
      },
    ]);
  };

  const totalFields = compareFields.length;
  const requiredFields = compareFields.filter(isFieldRequired);
  const requiredCount = requiredFields.length;
  const optionalCount = totalFields - requiredCount;
  const matchThreshold = Math.min(MIN_MATCHES_FOR_PAIR, totalFields);

  return (
    <div className="compareSetupPanel">
      <div className="compareSetupTop">
        <div>
          <b>Comparison Setup</b>
          <div className="compareSetupSub">
            Configure the comparison columns. Pairing uses all fields below; ticks only choose which columns appear in the Results table.
          </div>
        </div>

        <div className="compareSetupMinimum">
          <span className="compareSetupMinimumLabel">
            A pair is shown side-by-side when at least
            {" "}<strong className="compareSetupRequiredCount">{matchThreshold}</strong>{" "}
            of the {totalFields} compare field{totalFields !== 1 ? "s" : ""} match.
            {" "}{requiredCount} shown / {optionalCount} hidden in Results.
          </span>
        </div>
      </div>

      <div className="compareSetupHint">
        The <b className="hintRequired">Required</b> tick means "show this column in Results"; <b className="hintOptional">Optional</b> means "hide it".
        Matching is independent of the ticks — a pair is kept whenever at least {matchThreshold} of the compare fields match; otherwise it goes to <b>Unmatched</b>.
        Row color uses the visible columns only: all shown columns match → <b>Truth</b> (green); name matched via Employer/Organization fallback → <b>Conditional Truth</b> (blue); any shown column fails → <b>False</b> (red).
        <span className="hintTip"> Tip: hide a column (Optional) when its wording differs between files (e.g. <i>Category</i>) and you don't want the FALSE noise.</span>
      </div>

      <div className="compareSetupFieldsHeader">
        <b>{totalFields} comparison field{totalFields !== 1 ? "s" : ""}</b>
        <span className="compareSetupFieldsSub">
          — each row pairs one column from <b>{leftPanel?.title || "Left"}</b> with one column from <b>{rightPanel?.title || "Right"}</b>.
        </span>
      </div>

      <div className="compareSetupColHeader">
        <span></span>
        <span>Show column?</span>
        <span>Field name</span>
        <span>Left column ({leftPanel?.title || "Left"})</span>
        <span></span>
        <span>Right column ({rightPanel?.title || "Right"})</span>
        <span></span>
      </div>

      <div className="compareSetupList">
        {compareFields.length === 0 && (
          <div className="compareSetupEmpty">
            No fields configured. Click <b>Add Comparison Field</b> to add one.
          </div>
        )}
        {compareFields.map((field, idx) => (
          <FieldRow
            key={field.key}
            idx={idx}
            field={field}
            leftHeaders={leftPanel?.headers || []}
            rightHeaders={rightPanel?.headers || []}
            onChange={updateField}
            onRemove={removeField}
          />
        ))}
      </div>

      <div className="compareSetupActions">
        <button type="button" onClick={addField}>
          Add Comparison Field
        </button>

        {onSaveAsDefault && (
          <button
            type="button"
            className={`compareSetupSaveBtn${saveStatus === "saved" ? " compareSetupSaveBtnOk" : saveStatus === "error" ? " compareSetupSaveBtnErr" : ""}`}
            onClick={onSaveAsDefault}
            disabled={saveStatus === "saving"}
            title={`Save this comparison setup as the default for ${leftPanel?.formatKey ?? "left format"} + ${rightPanel?.formatKey ?? "right format"}`}
          >
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
              ? "✓ Saved as default"
              : saveStatus === "error"
              ? "Save failed — try again"
              : "💾 Save as default for this format pair"}
          </button>
        )}
      </div>
    </div>
  );
}
