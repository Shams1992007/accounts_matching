import "./MappingRow.css";

export default function MappingRow({ label, headers, value, onChange }) {
  return (
    <div className="mappingRow">
      <div className="mappingLabel">
        <b>{label}</b>
      </div>

      <select value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">-- select source column --</option>

        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}