import { useCallback, useEffect, useState } from "react";
import { fetchImportMeta } from "./services/importApi";
import ImportTwoFiles from "./pages/ImportTwoFiles";
import FormatTwoFiles from "./pages/FormatTwoFiles";
import CompareFormattedData from "./pages/CompareFormattedData";
import ManageFormats from "./pages/ManageFormats";
import UserGuide from "./pages/UserGuide";
import "./App.css";

function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    page: p.get("page") || "import",
    importId: p.get("importId") || null,
  };
}

function pushUrl(page, importId) {
  const p = new URLSearchParams();
  p.set("page", page);
  if (importId != null) p.set("importId", String(importId));
  window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
}

function loadStoredPanels(importId) {
  try {
    const raw = sessionStorage.getItem(`panels_${importId}`);
    return raw ? JSON.parse(raw) : { panel1: null, panel2: null };
  } catch {
    return { panel1: null, panel2: null };
  }
}

function savePanels(importId, panels) {
  try {
    sessionStorage.setItem(`panels_${importId}`, JSON.stringify(panels));
  } catch {}
}

export default function App() {
  const [importMeta, setImportMeta] = useState(null);
  const [page, setPageInner] = useState("import");
  const [formattedPanels, setFormattedPanels] = useState({ panel1: null, panel2: null });
  const [bootstrapping, setBootstrapping] = useState(true);

  // On mount: restore state from URL
  useEffect(() => {
    const { page: urlPage, importId } = getUrlParams();

    if (!importId) {
      const staticPage = urlPage === "formats" || urlPage === "guide" ? urlPage : "import";
      setPageInner(staticPage);
      setBootstrapping(false);
      return;
    }

    fetchImportMeta(importId)
      .then((meta) => {
        setImportMeta(meta);
        const panels = loadStoredPanels(importId);
        setFormattedPanels(panels);

        // If on compare but panels weren't cached, fall back to format
        const hasPanels = panels.panel1 || panels.panel2;
        const targetPage = urlPage === "compare" && !hasPanels ? "format" : urlPage;
        setPageInner(targetPage);
        if (targetPage !== urlPage) pushUrl(targetPage, importId);
      })
      .catch(() => {
        pushUrl("import", null);
      })
      .finally(() => setBootstrapping(false));
  }, []);

  const goTo = useCallback(
    (newPage) => {
      setPageInner(newPage);
      pushUrl(newPage, importMeta?.importId);
    },
    [importMeta?.importId]
  );

  const handleImported = useCallback((meta) => {
    setImportMeta(meta);
    setFormattedPanels({ panel1: null, panel2: null });
    pushUrl("import", meta?.importId ?? null);
    setPageInner("import");
  }, []);

  const handleFormattedChange = useCallback(
    (panelKey, payload) => {
      setFormattedPanels((prev) => {
        const next = { ...prev, [panelKey]: payload };
        if (importMeta?.importId) savePanels(importMeta.importId, next);
        return next;
      });
    },
    [importMeta?.importId]
  );

  if (bootstrapping) return null;

  const isImportFlow = page === "import" || page === "format" || page === "compare";

  return (
    <>
      <nav className="appNav">
        <button
          className={`appNavBtn ${isImportFlow ? "appNavActive" : ""}`}
          onClick={() => goTo("import")}
        >
          Import & Match
        </button>
        <button
          className={`appNavBtn ${page === "formats" ? "appNavActive" : ""}`}
          onClick={() => goTo("formats")}
        >
          Manage Formats
        </button>
        <button
          className={`appNavBtn ${page === "guide" ? "appNavActive" : ""}`}
          onClick={() => goTo("guide")}
        >
          User Guide
        </button>
      </nav>

      {page === "import" && (
        <ImportTwoFiles
          importMeta={importMeta}
          onImported={handleImported}
          onGoFormat={() => goTo("format")}
        />
      )}

      {page === "format" && (
        <FormatTwoFiles
          importMeta={importMeta}
          onBack={() => goTo("import")}
          onGoCompare={() => goTo("compare")}
          onFormattedChange={handleFormattedChange}
        />
      )}

      {page === "compare" && (
        <CompareFormattedData
          importMeta={importMeta}
          formattedPanels={formattedPanels}
          onBack={() => goTo("format")}
        />
      )}

      {page === "formats" && <ManageFormats />}

      {page === "guide" && <UserGuide />}
    </>
  );
}
