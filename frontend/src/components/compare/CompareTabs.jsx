import "./CompareTabs.css";

export default function CompareTabs({ activeTab, onChange, resultsCount = 0, unmatchedLeftCount = 0, unmatchedRightCount = 0 }) {
  const unmatchedTotal = unmatchedLeftCount + unmatchedRightCount;

  return (
    <div className="compareTabs">
      <button
        className={activeTab === "results" ? "compareTabActive" : ""}
        onClick={() => onChange("results")}
      >
        Compared Result
        <span className="compareTabCount">({resultsCount})</span>
      </button>

      <button
        className={activeTab === "unmatched" ? "compareTabActive" : ""}
        onClick={() => onChange("unmatched")}
        title={`${unmatchedLeftCount} unmatched on left · ${unmatchedRightCount} unmatched on right`}
      >
        Unmatched Rows / Manual Pairing
        <span className="compareTabCount">
          ({unmatchedTotal}
          <span className="compareTabCountBreakdown"> = {unmatchedLeftCount} left + {unmatchedRightCount} right</span>
          )
        </span>
      </button>
    </div>
  );
}