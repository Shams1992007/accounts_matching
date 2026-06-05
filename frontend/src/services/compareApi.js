export async function runCompare(importId, panel1, panel2, compareFields) {
  const r = await fetch(`/api/imports/${importId}/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      panel1: {
        fileSide: panel1.fileSide,
        mapping: panel1.mapping,
        headers: panel1.headers,
      },
      panel2: {
        fileSide: panel2.fileSide,
        mapping: panel2.mapping,
        headers: panel2.headers,
      },
      compareFields,
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(t || `Compare failed (${r.status})`);
  }
  return r.json();
}
