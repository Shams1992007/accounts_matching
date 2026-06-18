import { useEffect, useMemo, useRef, useState } from "react";
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
  const [activeTab, setActiveTab] = useState("panel1");

  const canGoCompare = useMemo(() => {
    return panelReady.panel1 && panelReady.panel2;
  }, [panelReady]);

  // Synced horizontal scrolling: both tables share a single scrollbar below the
  // grid. Each table wrap hides its native scrollbar; the shared proxy below is
  // wide enough to cover whichever table has the most overflow, and scrolling
  // it (or either table programmatically) writes the same scrollLeft to both.
  const leftScrollRef = useRef(null);
  const rightScrollRef = useRef(null);
  const sharedScrollRef = useRef(null);
  const [sharedScrollWidth, setSharedScrollWidth] = useState(0);
  const syncingRef = useRef(false);

  useEffect(() => {
    const measure = () => {
      const lw = leftScrollRef.current?.scrollWidth || 0;
      const rw = rightScrollRef.current?.scrollWidth || 0;
      setSharedScrollWidth(Math.max(lw, rw));
    };

    measure();

    const ro = new ResizeObserver(measure);
    if (leftScrollRef.current) ro.observe(leftScrollRef.current);
    if (rightScrollRef.current) ro.observe(rightScrollRef.current);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [panelReady.panel1, panelReady.panel2]);

  useEffect(() => {
    const writeAll = (sourceEl, x) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      if (sharedScrollRef.current && sharedScrollRef.current !== sourceEl) {
        sharedScrollRef.current.scrollLeft = x;
      }
      if (leftScrollRef.current && leftScrollRef.current !== sourceEl) {
        leftScrollRef.current.scrollLeft = x;
      }
      if (rightScrollRef.current && rightScrollRef.current !== sourceEl) {
        rightScrollRef.current.scrollLeft = x;
      }
      requestAnimationFrame(() => {
        syncingRef.current = false;
      });
    };

    const onShared = () => writeAll(sharedScrollRef.current, sharedScrollRef.current?.scrollLeft ?? 0);
    const onLeft = () => writeAll(leftScrollRef.current, leftScrollRef.current?.scrollLeft ?? 0);
    const onRight = () => writeAll(rightScrollRef.current, rightScrollRef.current?.scrollLeft ?? 0);

    const s = sharedScrollRef.current;
    const l = leftScrollRef.current;
    const r = rightScrollRef.current;

    s?.addEventListener("scroll", onShared, { passive: true });
    l?.addEventListener("scroll", onLeft, { passive: true });
    r?.addEventListener("scroll", onRight, { passive: true });

    return () => {
      s?.removeEventListener("scroll", onShared);
      l?.removeEventListener("scroll", onLeft);
      r?.removeEventListener("scroll", onRight);
    };
  }, [sharedScrollWidth, panelReady.panel1, panelReady.panel2]);

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

      <div className="formatMobileTabs">
        <button
          className={`formatMobileTab ${activeTab === "panel1" ? "formatMobileTabActive" : ""}`}
          onClick={() => setActiveTab("panel1")}
        >
          File A
          {panelReady.panel1 && <span className="formatTabReady">✓</span>}
        </button>
        <button
          className={`formatMobileTab ${activeTab === "panel2" ? "formatMobileTabActive" : ""}`}
          onClick={() => setActiveTab("panel2")}
        >
          File B
          {panelReady.panel2 && <span className="formatTabReady">✓</span>}
        </button>
      </div>

      <div className="formatPageGrid">
        <div className={activeTab !== "panel1" ? "formatPanelHidden" : ""}>
          <FormatPanel
            panelKey="panel1"
            title="Formatted Output 1"
            importMeta={importMeta}
            defaultFileSide="A"
            defaultFormatKey="QBO"
            tableScrollRef={leftScrollRef}
            hideTableScrollbar
            onFormattedChange={(panelKey, payload) => {
              onFormattedChange?.(panelKey, payload);
              setPanelReady((prev) => ({
                ...prev,
                [panelKey]: !!payload?.rows?.length,
              }));
            }}
          />
        </div>

        <div className={activeTab !== "panel2" ? "formatPanelHidden" : ""}>
          <FormatPanel
            panelKey="panel2"
            title="Formatted Output 2"
            importMeta={importMeta}
            defaultFileSide="B"
            defaultFormatKey="LGL"
            tableScrollRef={rightScrollRef}
            hideTableScrollbar
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

      {sharedScrollWidth > 0 && (panelReady.panel1 || panelReady.panel2) && (
        <div className="formatSharedScroll" ref={sharedScrollRef}>
          <div
            className="formatSharedScrollInner"
            style={{ width: sharedScrollWidth }}
          />
        </div>
      )}
    </div>
  );
}