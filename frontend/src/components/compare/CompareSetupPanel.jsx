import "./CompareSetupPanel.css";

function FieldRow({ idx, leftHeaders, rightHeaders, field, onChange, onRemove }) {
  return (
    <div className="compareSetupRow">
      <input
        type="text"
        value={field.label}
        onChange={(e) => onChange(idx, { ...field, label: e.target.value })}
        placeholder="Comparison label"
      />

      <select
        value={field.leftField}
        onChange={(e) => onChange(idx, { ...field, leftField: e.target.value })}
      >
        <option value="">-- Left field --</option>
        {leftHeaders.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <select
        value={field.rightField}
        onChange={(e) => onChange(idx, { ...field, rightField: e.target.value })}
      >
        <option value="">-- Right field --</option>
        {rightHeaders.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <button type="button" onClick={() => onRemove(idx)}>
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
  minimumMatchCount,
  setMinimumMatchCount,
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
      },
    ]);
  };

  return (
    <div className="compareSetupPanel">
      <div className="compareSetupTop">
        <div>
          <b>Comparison Setup</b>
          <div className="compareSetupSub">
            Choose which columns should be used to pair rows from the two formatted outputs.
          </div>
        </div>

        <label className="compareSetupMinimum">
          Minimum matched fields:
          <select
            value={minimumMatchCount}
            onChange={(e) => setMinimumMatchCount(Number(e.target.value))}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
      </div>

      <div className="compareSetupList">
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

      <button type="button" onClick={addField}>
        Add Comparison Field
      </button>
    </div>
  );
}