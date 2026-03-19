import "./FileUploadCard.css";

export default function FileUploadCard({ title, file, onChange }) {
  return (
    <div className="uploadCard">
      <b>{title}</b>

      <input
        className="uploadInput"
        type="file"
        accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />

      <div className="uploadFileName">
        {file ? file.name : "No file selected"}
      </div>
    </div>
  );
}