import { findHeader, parseMaybeAmount, parseMaybeDate } from "./importUtils";

export const FORMATS = {
  QBO: {
    label: "QBO format",
    headers: [
      "Transaction date",
      "Name",
      "Line description",
      "Category",
      "Account",
      "Amount",
    ],
  },
  LGL: {
    label: "LGL format",
    headers: [
      "Gift date",
      "Name",
      "Employer/Organization",
      "Gift category",
      "Payment Type",
      "Amount",
    ],
  },
};

export function getFormatSortOptions(headers = []) {
  const opts = [];

  const dateHeader = findHeader(headers, ["Gift date", "Transaction date", "Date"]);
  const nameHeader = findHeader(headers, ["Name", "Full Name"]);
  const amountHeader = findHeader(headers, ["Amount"]);

  if (dateHeader) opts.push({ value: dateHeader, label: "Date" });
  if (nameHeader) opts.push({ value: nameHeader, label: "Name" });
  if (amountHeader) opts.push({ value: amountHeader, label: "Amount" });

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