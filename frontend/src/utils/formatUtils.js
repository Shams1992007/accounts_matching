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

// Pick the format whose header set best overlaps the uploaded file's headers.
// Formats are keyed by file-shaped `headers` (e.g. LGL: "Gift date", QBO:
// "Transaction date"), so header overlap is a strong signal for which format a
// file actually is — regardless of which slot (A/B) it was uploaded into.
// Returns `fallbackKey` when no format overlaps meaningfully (>= 2 columns), and
// keeps `fallbackKey` when it ties the best score so we don't switch gratuitously.
export function detectFormatKey(sourceHeaders = [], formats = [], fallbackKey = "") {
  const src = new Set(sourceHeaders.map((h) => String(h).trim().toLowerCase()));

  const scoreOf = (f) =>
    (Array.isArray(f?.headers) ? f.headers : []).reduce(
      (n, h) => n + (src.has(String(h).trim().toLowerCase()) ? 1 : 0),
      0
    );

  let best = null;
  let bestScore = 0;
  for (const f of formats) {
    const score = scoreOf(f);
    if (score > bestScore) {
      bestScore = score;
      best = f.key;
    }
  }

  if (bestScore < 2) return fallbackKey;

  const fallback = formats.find((f) => f.key === fallbackKey);
  if (fallback && scoreOf(fallback) === bestScore) return fallbackKey;

  return best;
}

export function getSavedPanel(importMeta, panelKey) {
  const arr = Array.isArray(importMeta?.savedMappings)
    ? importMeta.savedMappings
    : [];

  return arr.find((x) => x.panelKey === panelKey) || null;
}