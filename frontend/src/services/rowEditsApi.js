import { getJsonOrThrow } from "./importApi";

export async function fetchRowEdits(importId) {
  const res = await fetch(`/api/import/${importId}/row-edits`);
  return getJsonOrThrow(res);
}

export async function saveRowEdit(importId, pairId, versions) {
  const res = await fetch(`/api/import/${importId}/row-edits/${encodeURIComponent(pairId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versions }),
  });
  return getJsonOrThrow(res);
}
