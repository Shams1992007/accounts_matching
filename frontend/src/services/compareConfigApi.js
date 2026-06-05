export async function fetchCompareConfig(leftFormat, rightFormat) {
  const r = await fetch(
    `/api/compare-configs?leftFormat=${encodeURIComponent(leftFormat)}&rightFormat=${encodeURIComponent(rightFormat)}`
  );
  if (!r.ok) throw new Error("Failed to fetch compare config");
  return r.json(); // null or { compareFields, minimumMatchCount }
}

export async function saveCompareConfig(leftFormat, rightFormat, compareFields, minimumMatchCount) {
  const r = await fetch(
    `/api/compare-configs?leftFormat=${encodeURIComponent(leftFormat)}&rightFormat=${encodeURIComponent(rightFormat)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compareFields, minimumMatchCount }),
    }
  );
  if (!r.ok) throw new Error("Failed to save compare config");
  return r.json();
}
