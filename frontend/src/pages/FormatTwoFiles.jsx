import { useMemo, useState } from "react";
import FormatPanel from "../components/format/FormatPanel";
import "./FormatTwoFiles.css";

export default function FormatTwoFiles({
  importMeta,
  onBack,
  onFormattedChange,
  onGoCompare,
}) {
  const [panelReady, setPanelReady] = useState({
    panel1: false,
    panel2: false,
  });

  const canGoCompare = useMemo(() => {
    return panelReady.panel1 && panelReady.panel2;
  }, [panelReady]);

  if (!importMeta?.fileA?.fileId || !importMeta?.fileB?.fileId) {
    return (
      <div className="formatPageSmall">
        <h2>Format Imported Files</h2>

        <div className="formatPageError">
          Missing import metadata. Go back and load/import files first.
        </div>

        <button className="formatBackTop" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="formatPage">
      <div className="formatPageHead">
        <h2>Format Imported Files</h2>

        <div className="formatTopActions">
          <button className="formatBackTop" onClick={onBack}>
            Back to Import
          </button>

          <button
            className="formatCompareBtn"
            disabled={!canGoCompare}
            onClick={onGoCompare}
          >
            Go to Compare
          </button>
        </div>
      </div>

      <div className="formatPageSub">
        Saved mappings are reused automatically for this import. You only remap if you
        want to change them.
      </div>

      {!canGoCompare && (
        <div className="formatWarnBox">
          Save and show both formatted outputs before going to Compare.
        </div>
      )}

      <div className="formatPageGrid">
        <FormatPanel
          panelKey="panel1"
          title="Formatted Output 1"
          importMeta={importMeta}
          defaultFileSide="A"
          defaultFormatKey="QBO"
          onFormattedChange={(panelKey, payload) => {
            onFormattedChange?.(panelKey, payload);
            setPanelReady((prev) => ({
              ...prev,
              [panelKey]: !!payload?.rows?.length,
            }));
          }}
        />

        <FormatPanel
          panelKey="panel2"
          title="Formatted Output 2"
          importMeta={importMeta}
          defaultFileSide="B"
          defaultFormatKey="LGL"
          onFormattedChange={(panelKey, payload) => {
            onFormattedChange?.(panelKey, payload);
            setPanelReady((prev) => ({
              ...prev,
              [panelKey]: !!payload?.rows?.length,
            }));
          }}
        />
      </div>
    </div>
  );
}