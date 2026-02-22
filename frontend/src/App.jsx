import { useState } from "react";
import ImportTwoFiles from "./pages/ImportTwoFiles";
import FormatTwoFiles from "./pages/FormatTwoFiles";
import "./App.css";

export default function App() {
  const [importMeta, setImportMeta] = useState(null);
  const [page, setPage] = useState("import"); // "import" | "format"

  return (
    <>
      {page === "import" && (
        <ImportTwoFiles
          importMeta={importMeta}
          onImported={(meta) => {
            setImportMeta(meta);
          }}
          onGoFormat={() => setPage("format")}
        />
      )}

      {page === "format" && (
        <FormatTwoFiles
          importMeta={importMeta}
          onBack={() => setPage("import")}
        />
      )}
    </>
  );
}