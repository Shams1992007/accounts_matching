export function lower(s) {
  return String(s ?? "").trim().toLowerCase();
}

export function isBlankHeaderKey(key) {
  const s = String(key ?? "").trim();
  return !s || /^__EMPTY(?:_\d+)?$/i.test(s);
}

export function getMissingHeaders(headers = []) {
  return headers.filter(isBlankHeaderKey);
}

export function findHeader(headers = [], candidates = []) {
  const map = new Map(headers.map((h) => [lower(h), h]));
  for (const c of candidates) {
    const hit = map.get(lower(c));
    if (hit) return hit;
  }
  return null;
}

export function getSortOptions(headers = []) {
  const opts = [];

  const dateHeader = findHeader(headers, [
    "Gift date",
    "Date",
    "Transaction Date",
    "Donation Date",
  ]);
  const nameHeader = findHeader(headers, ["Name", "Full Name"]);
  const amountHeader = findHeader(headers, ["Amount", "Gift Amount", "Total Amount"]);

  if (dateHeader) opts.push({ value: dateHeader, label: "Date" });
  if (nameHeader) opts.push({ value: nameHeader, label: "Name" });
  if (amountHeader) opts.push({ value: amountHeader, label: "Amount" });

  return opts;
}

export function parseMaybeDate(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    let yyyy = Number(m[3]);
    if (yyyy < 100) yyyy += 2000;
    return new Date(yyyy, mm - 1, dd).getTime();
  }

  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

export function parseMaybeAmount(v) {
  const s = String(v ?? "").replace(/[$, ]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function compareImportRows(a, b, field) {
  const av = a?.data?.[field];
  const bv = b?.data?.[field];

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