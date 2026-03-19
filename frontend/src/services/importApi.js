export async function getJsonOrThrow(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }

  return data;
}

export async function fetchImportsList() {
  const r = await fetch("/api/import/list");
  return getJsonOrThrow(r);
}

export async function fetchImportMeta(importId) {
  const r = await fetch(`/api/import/${importId}`);
  return getJsonOrThrow(r);
}

export async function createImportApi(fileA, fileB) {
  const fd = new FormData();
  fd.append("fileA", fileA);
  fd.append("fileB", fileB);

  const r = await fetch("/api/import/create", {
    method: "POST",
    body: fd,
  });

  return getJsonOrThrow(r);
}

export async function replaceImportFilesApi(importId, fileA, fileB) {
  const fd = new FormData();
  fd.append("fileA", fileA);
  fd.append("fileB", fileB);

  const r = await fetch(`/api/import/${importId}/replace`, {
    method: "PUT",
    body: fd,
  });

  return getJsonOrThrow(r);
}

export async function deleteImportApi(importId) {
  const r = await fetch(`/api/import/${importId}`, {
    method: "DELETE",
  });

  return getJsonOrThrow(r);
}

export async function saveFileHeadersApi(fileId, updates) {
  const r = await fetch(`/api/import/file/${fileId}/headers`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });

  return getJsonOrThrow(r);
}

export async function fetchFileRows(fileId, page, limit) {
  const r = await fetch(`/api/import/file/${fileId}/rows?page=${page}&limit=${limit}`);
  return getJsonOrThrow(r);
}