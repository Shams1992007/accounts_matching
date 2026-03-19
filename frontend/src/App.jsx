import { useCallback, useState } from "react";
import ImportTwoFiles from "./pages/ImportTwoFiles";
import FormatTwoFiles from "./pages/FormatTwoFiles";
import CompareFormattedData from "./pages/CompareFormattedData";
import "./App.css";

export default function App() {
  const [importMeta, setImportMeta] = useState(null);
  const [page, setPage] = useState("import");

  const [formattedPanels, setFormattedPanels] = useState({
    panel1: null,
    panel2: null,
  });

  const handleImported = useCallback((meta) => {
    setImportMeta(meta);
    setFormattedPanels({
      panel1: null,
      panel2: null,
    });
  }, []);

  const handleFormattedChange = useCallback((panelKey, payload) => {
    setFormattedPanels((prev) => ({
      ...prev,
      [panelKey]: payload,
    }));
  }, []);

  return (
    <>
      {page === "import" && (
        <ImportTwoFiles
          importMeta={importMeta}
          onImported={handleImported}
          onGoFormat={() => setPage("format")}
        />
      )}

      {page === "format" && (
        <FormatTwoFiles
          importMeta={importMeta}
          onBack={() => setPage("import")}
          onGoCompare={() => setPage("compare")}
          onFormattedChange={handleFormattedChange}
        />
      )}

      {page === "compare" && (
        <CompareFormattedData
          importMeta={importMeta}
          formattedPanels={formattedPanels}
          onBack={() => setPage("format")}
        />
      )}
    </>
  );
}