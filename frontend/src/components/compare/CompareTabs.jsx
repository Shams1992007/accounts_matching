import "./CompareTabs.css";

export default function CompareTabs({ activeTab, onChange }) {
  return (
    <div className="compareTabs">
      <button
        className={activeTab === "results" ? "compareTabActive" : ""}
        onClick={() => onChange("results")}
      >
        Compared Result
      </button>

      <button
        className={activeTab === "unmatched" ? "compareTabActive" : ""}
        onClick={() => onChange("unmatched")}
      >
        Unmatched Rows / Manual Pairing
      </button>
    </div>
  );
}