import { parseMaybeAmount, parseMaybeDate } from "./importUtils";

export function getFormatSortOptions(headers = []) {
  const opts = [];
  const seen = new Set();

  for (const h of headers) {
    const lower = h.toLowerCase();
    if (lower.includes("date") && !seen.has("date")) {
      opts.push({ value: h, label: "Date" });
      seen.add("date");
    } else if (lower.includes("name") && !seen.has("name")) {
      opts.push({ value: h, label: "Name" });
      seen.add("name");
    } else if (lower.includes("amount") && !seen.has("amount")) {
      opts.push({ value: h, label: "Amount" });
      seen.add("amount");
    }
  }

  return opts;
}

export function compareFormattedRows(a, b, field) {
  const av = a?.[field];
  const bv = b?.[field];

  const ad = parseMaybeDate(av);
  const bd = parseMaybeDate(bv);
  if (ad != null && bd != null) return ad - bd;

  const aa = parseMaybeAmount(av);
  const ba = parseMaybeAmount(bv);
  if (aa != null && ba != null) return aa - ba;

  return String(av ?? "").localeCompare(String(bv ?? ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

export function buildFormattedRows(rows = [], mapping = {}, formatHeaders = []) {
  return rows.map((r) => {
    const out = { __rowKey: r.row_index };

    for (const h of formatHeaders) {
      const src = mapping?.[h];
      out[h] = src ? (r?.data?.[src] ?? "") : "";
    }

    return out;
  });
}

export function getSavedPanel(importMeta, panelKey) {
  const arr = Array.isArray(importMeta?.savedMappings)
    ? importMeta.savedMappings
    : [];

  return arr.find((x) => x.panelKey === panelKey) || null;
}