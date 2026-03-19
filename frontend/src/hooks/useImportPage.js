import { useEffect, useMemo, useState } from "react";
import {
  compareImportRows,
  getMissingHeaders,
  getSortOptions,
  isBlankHeaderKey,
} from "../utils/importUtils";
import {
  createImportApi,
  deleteImportApi,
  fetchFileRows,
  fetchImportMeta,
  fetchImportsList,
  replaceImportFilesApi,
  saveFileHeadersApi,
} from "../services/importApi";

export default function useImportPage({ importMetaProp, onImported }) {
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);

  const [replaceFileA, setReplaceFileA] = useState(null);
  const [replaceFileB, setReplaceFileB] = useState(null);

  const [loading, setLoading] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [savingHeaders, setSavingHeaders] = useState(false);

  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [importMetaLocal, setImportMetaLocal] = useState(null);
  const importMeta = importMetaProp || importMetaLocal;

  const [importsList, setImportsList] = useState([]);
  const [selectedImportId, setSelectedImportId] = useState("");

  const [activeSide, setActiveSide] = useState("A");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(200);

  const [rowsResp, setRowsResp] = useState(null);

  const [headerInputsA, setHeaderInputsA] = useState({});
  const [headerInputsB, setHeaderInputsB] = useState({});

  const [sortField, setSortField] = useState("");
  const [sortDir, setSortDir] = useState("asc");

  const [confirmDelete, setConfirmDelete] = useState(false);

  const activeFile = activeSide === "A" ? importMeta?.fileA : importMeta?.fileB;

  const totalPages = useMemo(() => {
    const total = activeFile?.rowCount || 0;
    return Math.max(1, Math.ceil(total / limit));
  }, [activeFile?.rowCount, limit]);

  const sortOptions = useMemo(() => {
    return getSortOptions(activeFile?.headers || []);
  }, [activeFile?.headers]);

  const missingA = getMissingHeaders(importMeta?.fileA?.headers || []);
  const missingB = getMissingHeaders(importMeta?.fileB?.headers || []);
  const hasMissingHeaders = missingA.length > 0 || missingB.length > 0;

  const sortedRows = useMemo(() => {
    const arr = Array.isArray(rowsResp?.rows) ? [...rowsResp.rows] : [];
    if (!sortField) return arr;

    arr.sort((a, b) => {
      const cmp = compareImportRows(a, b, sortField);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return arr;
  }, [rowsResp?.rows, sortField, sortDir]);

  const clearMessages = () => {
    setErr("");
    setMsg("");
  };

  const resetViewer = () => {
    setRowsResp(null);
    setActiveSide("A");
    setPage(1);
  };

  const refreshImportsList = async () => {
    try {
      const data = await fetchImportsList();
      setImportsList(Array.isArray(data) ? data : []);
    } catch (_) {
      // ignore list refresh error
    }
  };

  useEffect(() => {
    refreshImportsList();
  }, []);

  useEffect(() => {
    const allowed = new Set(sortOptions.map((x) => x.value));
    if (!allowed.has(sortField)) {
      setSortField(sortOptions[0]?.value || "");
    }
  }, [sortOptions, sortField]);

  const loadImportMeta = async (importId) => {
    clearMessages();
    resetViewer();

    try {
      const data = await fetchImportMeta(importId);
      setImportMetaLocal(data);
      onImported?.(data);
      setHeaderInputsA({});
      setHeaderInputsB({});
    } catch (e) {
      setErr(String(e.message || e));
    }
  };

  const createImport = async () => {
    clearMessages();
    setImportMetaLocal(null);
    setRowsResp(null);

    if (!fileA || !fileB) {
      setErr("Please select BOTH files.");
      return;
    }

    setLoading(true);
    try {
      const data = await createImportApi(fileA, fileB);

      setImportMetaLocal(data);
      onImported?.(data);
      setSelectedImportId(String(data.importId));
      setFileA(null);
      setFileB(null);
      setHeaderInputsA({});
      setHeaderInputsB({});
      setMsg("Import created successfully.");

      await refreshImportsList();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const replaceImportFiles = async () => {
    clearMessages();

    if (!importMeta?.importId) {
      setErr("No import loaded.");
      return;
    }

    if (!replaceFileA || !replaceFileB) {
      setErr("Please select BOTH replacement files.");
      return;
    }

    setReplacing(true);
    try {
      const data = await replaceImportFilesApi(importMeta.importId, replaceFileA, replaceFileB);

      setImportMetaLocal(data);
      onImported?.(data);
      resetViewer();
      setReplaceFileA(null);
      setReplaceFileB(null);
      setHeaderInputsA({});
      setHeaderInputsB({});
      setSelectedImportId(String(data.importId));
      setMsg("Import files replaced successfully.");

      await refreshImportsList();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setReplacing(false);
    }
  };

  const deleteImport = async () => {
    clearMessages();

    if (!importMeta?.importId) {
      setErr("No import loaded.");
      return;
    }

    setDeleting(true);
    try {
      const data = await deleteImportApi(importMeta.importId);

      setImportMetaLocal(null);
      setRowsResp(null);
      setSelectedImportId("");
      setActiveSide("A");
      setPage(1);
      setReplaceFileA(null);
      setReplaceFileB(null);
      setHeaderInputsA({});
      setHeaderInputsB({});
      setMsg(`Import #${data?.deletedImportId} deleted successfully.`);
      setConfirmDelete(false);

      onImported?.(null);
      await refreshImportsList();
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setDeleting(false);
    }
  };

  const saveMissingHeaders = async () => {
    clearMessages();

    if (!importMeta) {
      setErr("No import loaded.");
      return;
    }

    const buildUpdates = (headers, values) =>
      headers
        .filter(isBlankHeaderKey)
        .map((h) => ({
          from: h,
          to: String(values[h] || "").trim(),
        }));

    const updatesA = buildUpdates(importMeta.fileA?.headers || [], headerInputsA);
    const updatesB = buildUpdates(importMeta.fileB?.headers || [], headerInputsB);

    for (const u of [...updatesA, ...updatesB]) {
      if (!u.to) {
        setErr("All missing headers must be filled before saving.");
        return;
      }
    }

    setSavingHeaders(true);
    try {
      let latestMeta = importMeta;

      if (updatesA.length) {
        latestMeta = await saveFileHeadersApi(importMeta.fileA.fileId, updatesA);
      }

      if (updatesB.length) {
        latestMeta = await saveFileHeadersApi(latestMeta.fileB.fileId, updatesB);
      }

      setImportMetaLocal(latestMeta);
      onImported?.(latestMeta);
      setHeaderInputsA({});
      setHeaderInputsB({});
      setMsg("Missing headers saved successfully.");
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSavingHeaders(false);
    }
  };

  useEffect(() => {
    if (!activeFile?.fileId) return;

    const run = async () => {
      setErr("");
      try {
        const data = await fetchFileRows(activeFile.fileId, page, limit);
        setRowsResp(data);
      } catch (e) {
        setErr(String(e.message || e));
      }
    };

    run();
  }, [activeFile?.fileId, page, limit]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  return {
    importMeta,
    importsList,
    selectedImportId,
    setSelectedImportId,

    fileA,
    setFileA,
    fileB,
    setFileB,

    replaceFileA,
    setReplaceFileA,
    replaceFileB,
    setReplaceFileB,

    loading,
    replacing,
    deleting,
    savingHeaders,

    err,
    msg,

    activeSide,
    setActiveSide,
    page,
    setPage,
    limit,
    setLimit,

    rowsResp,
    headerInputsA,
    setHeaderInputsA,
    headerInputsB,
    setHeaderInputsB,

    sortField,
    setSortField,
    sortDir,
    setSortDir,

    activeFile,
    totalPages,
    sortOptions,
    hasMissingHeaders,
    sortedRows,

    confirmDelete,
    setConfirmDelete,

    refreshImportsList,
    loadImportMeta,
    createImport,
    replaceImportFiles,
    deleteImport,
    saveMissingHeaders,
  };
}