const BASE = "http://localhost:5020/api/import";

export async function fetchRowEdits(importId) {
  const res = await fetch(`${BASE}/${importId}/row-edits`);
  if (!res.ok) throw new Error("Failed to fetch row edits");
  return res.json(); // [{ pairId, versions }]
}

export async function saveRowEdit(importId, pairId, versions) {
  const res = await fetch(`${BASE}/${importId}/row-edits/${encodeURIComponent(pairId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ versions }),
  });
  if (!res.ok) throw new Error("Failed to save row edit");
  return res.json();
}
