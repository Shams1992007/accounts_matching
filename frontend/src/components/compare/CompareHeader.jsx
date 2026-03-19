import "./CompareHeader.css";

export default function CompareHeader({
  importMeta,
  leftPanel,
  rightPanel,
  onBack,
}) {
  return (
    <div className="compareHeader">
      <div>
        <h2 className="compareHeaderTitle">Compare Formatted Data</h2>
        <div className="compareHeaderSub">
          Import #{importMeta?.importId} • {leftPanel?.fileName} vs {rightPanel?.fileName}
        </div>
      </div>

      <button onClick={onBack}>Back to Format</button>
    </div>
  );
}