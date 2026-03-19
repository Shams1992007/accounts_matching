import Pager from "../components/common/Pager";
import DataTable from "../components/common/DataTable";
import ConfirmModal from "../components/common/ConfirmModal";
import ImportHeader from "../components/import/ImportHeader";
import ImportLoadBar from "../components/import/ImportLoadBar";
import FileUploadCard from "../components/import/FileUploadCard";
import LoadedImportActions from "../components/import/LoadedImportActions";
import ImportViewerToolbar from "../components/import/ImportViewerToolbar";
import { isBlankHeaderKey } from "../utils/importUtils";
import useImportPage from "../hooks/useImportPage";
import "./ImportTwoFiles.css";

export default function ImportTwoFiles({ importMeta: importMetaProp, onImported, onGoFormat }) {
  const vm = useImportPage({
    importMetaProp,
    onImported,
  });

  return (
    <div className="importPage">
      <ImportHeader />

      <ImportLoadBar
        importsList={vm.importsList}
        selectedImportId={vm.selectedImportId}
        setSelectedImportId={vm.setSelectedImportId}
        onLoad={() => vm.loadImportMeta(vm.selectedImportId)}
        onRefresh={vm.refreshImportsList}
        canGoFormat={!!vm.importMeta}
        onGoFormat={() => onGoFormat?.()}
        hasMissingHeaders={vm.hasMissingHeaders}
      />

      {!vm.importMeta && (
        <>
          <div className="importUploadGrid">
            <FileUploadCard title="File A" file={vm.fileA} onChange={vm.setFileA} />
            <FileUploadCard title="File B" file={vm.fileB} onChange={vm.setFileB} />
          </div>

          <div className="importTopSpace">
            <button onClick={vm.createImport} disabled={vm.loading}>
              {vm.loading ? "Importing..." : "Import & Save to DB"}
            </button>
          </div>
        </>
      )}

      {vm.importMeta && (
        <>
          <LoadedImportActions
            importMeta={vm.importMeta}
            headerInputsA={vm.headerInputsA}
            setHeaderInputsA={vm.setHeaderInputsA}
            headerInputsB={vm.headerInputsB}
            setHeaderInputsB={vm.setHeaderInputsB}
            hasMissingHeaders={vm.hasMissingHeaders}
            savingHeaders={vm.savingHeaders}
            onSaveMissingHeaders={vm.saveMissingHeaders}
            replaceFileA={vm.replaceFileA}
            setReplaceFileA={vm.setReplaceFileA}
            replaceFileB={vm.replaceFileB}
            setReplaceFileB={vm.setReplaceFileB}
            replacing={vm.replacing}
            onReplace={vm.replaceImportFiles}
            deleting={vm.deleting}
            onDelete={() => vm.setConfirmDelete(true)}
          />

          <div className="importTopSpace">
            <ImportViewerToolbar
              importMeta={vm.importMeta}
              activeSide={vm.activeSide}
              setActiveSide={(side) => {
                vm.setActiveSide(side);
                vm.setPage(1);
              }}
              sortField={vm.sortField}
              setSortField={vm.setSortField}
              sortOptions={vm.sortOptions}
              sortDir={vm.sortDir}
              setSortDir={vm.setSortDir}
              limit={vm.limit}
              setLimit={vm.setLimit}
            />

            <Pager page={vm.page} setPage={vm.setPage} totalPages={vm.totalPages} />

            <div className="importFileTitle">
              <b>{vm.activeSide === "A" ? vm.importMeta.fileA?.name : vm.importMeta.fileB?.name}</b>
            </div>

            <DataTable
              headers={vm.activeFile?.headers || []}
              rows={vm.sortedRows}
              getValue={(r, h) => r?.data?.[h] ?? ""}
              renderHeader={(h) => (isBlankHeaderKey(h) ? "(missing header)" : h)}
              emptyText="No headers"
            />
          </div>
        </>
      )}

      {vm.msg && <div className="importMsgOk">{vm.msg}</div>}
      {vm.err && <div className="importMsgErr">{vm.err}</div>}

      <ConfirmModal
        open={vm.confirmDelete}
        title="Delete Import"
        message={`Are you sure you want to delete Import #${vm.importMeta?.importId}? This will remove both files and all imported rows.`}
        confirmText={vm.deleting ? "Deleting..." : "Delete Import"}
        cancelText="Cancel"
        danger
        onCancel={() => {
          if (!vm.deleting) vm.setConfirmDelete(false);
        }}
        onConfirm={async () => {
          if (vm.deleting) return;
          await vm.deleteImport();
        }}
      />
    </div>
  );
}