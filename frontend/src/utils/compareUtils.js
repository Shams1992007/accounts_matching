function lower(v) {
  return String(v ?? "").trim().toLowerCase();
}

export function normalizeText(v) {
  return lower(v).replace(/\s+/g, " ");
}

export function normalizeDate(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";

  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m1) {
    const mm = Number(m1[1]);
    const dd = Number(m1[2]);
    const yy = Number(m1[3]);
    const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) {
    const mm = Number(m2[1]);
    const dd = Number(m2[2]);
    const yyyy = Number(m2[3]);
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }

  const t = Date.parse(s);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return normalizeText(s);
}

export function normalizeAmount(v) {
  const s = String(v ?? "").replace(/[$, ]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizeCategory(v) {
  let s = normalizeText(v);

  if (!s) return "";

  s = s
    .replace(/&/g, " and ")
    .replace(/-/g, " ")
    .replace(/\b\d{4}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // If category has colon-separated prefixes, keep the most meaningful tail
  // Example:
  // "Contributions:Individual Contributions:4007 Individuals - Recurring"
  // -> "Individuals - Recurring"
  if (s.includes(":")) {
    const parts = s
      .split(":")
      .map((x) => x.trim())
      .filter(Boolean);

    s = parts[parts.length - 1] || s;
  }

  // Remove leading numeric code if still present
  // Example: "4007 Individuals - Recurring" -> "Individuals - Recurring"
  s = s.replace(/^\d+\s+/, "").trim();

  // Normalize some common wording differences
  s = s
    .replace(/^individual contributions\s+/i, "")
    .replace(/^contributions\s+/i, "")
    .replace(/^peer to peer fundraising\s+/i, "")
    .replace(/^event income\s+/i, "")
    .replace(/^grants\s+/i, "")
    .replace(/^other operating income\s+/i, "")
    .trim();

  // Optional aliases for known business-equivalent labels
  const aliases = {
    "misc event income": "event income",
    "unrestricted grants": "unrestricted grants",
    "individuals - non-recurring": "individuals - non-recurring",
    "individuals - non-recurring ": "individuals - non-recurring",
  };

  return aliases[s] || s;
}

export function normalizeNameLike(v) {
  return normalizeText(v)
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function namesMatchWithFallback(rowA, rowB, leftField, rightField) {
  const leftName = normalizeNameLike(getFieldValue(rowA, leftField));
  const rightName = normalizeNameLike(getFieldValue(rowB, rightField));

  const rightEmployer = normalizeNameLike(getFieldValue(rowB, "Employer/Organization"));
  const leftEmployer = normalizeNameLike(getFieldValue(rowA, "Employer/Organization"));

  if (leftName && rightName && leftName === rightName) {
    return {
      ok: true,
      mode: "name_to_name",
      reason: "Exact name match",
    };
  }

  if (leftName && rightEmployer && leftName === rightEmployer) {
    return {
      ok: true,
      mode: "left_name_to_right_employer",
      reason: "Matched because left Name = right Employer/Organization",
    };
  }

  if (rightName && leftEmployer && rightName === leftEmployer) {
    return {
      ok: true,
      mode: "right_name_to_left_employer",
      reason: "Matched because right Name = left Employer/Organization",
    };
  }

  return {
    ok: false,
    mode: "no_match",
    reason: "Name did not match Name or Employer/Organization",
  };
}

export function valuesEqual(fieldType, a, b, options = {}) {
  const { rowA = null, rowB = null, leftField = "", rightField = "", label = "" } = options;

  if (fieldType === "date") {
    const ok = normalizeDate(a) === normalizeDate(b);
    return {
      ok,
      mode: ok ? "date_match" : "date_mismatch",
      reason: ok ? "Dates matched" : "Dates did not match",
    };
  }

  if (fieldType === "amount") {
    const aa = normalizeAmount(a);
    const bb = normalizeAmount(b);
    const ok = aa != null && bb != null && Math.abs(aa - bb) < 0.000001;

    return {
      ok,
      mode: ok ? "amount_match" : "amount_mismatch",
      reason: ok ? "Amounts matched" : "Amounts did not match",
    };
  }

  if (fieldType === "category") {
    const aa = normalizeCategory(a);
    const bb = normalizeCategory(b);

    if (!aa || !bb) {
      return {
        ok: false,
        mode: "category_mismatch",
        reason: "Category missing or not comparable",
      };
    }

    if (aa === bb || aa.includes(bb) || bb.includes(aa)) {
      return {
        ok: true,
        mode: "category_match",
        reason: "Categories matched after normalization",
      };
    }

    return {
      ok: false,
      mode: "category_mismatch",
      reason: "Categories did not match",
    };
  }

  if (lower(label) === "name" && rowA && rowB) {
    return namesMatchWithFallback(rowA, rowB, leftField, rightField);
  }

  const ok = normalizeText(a) === normalizeText(b);
  return {
    ok,
    mode: ok ? "text_match" : "text_mismatch",
    reason: ok ? "Texts matched" : "Texts did not match",
  };
}

export function getFieldValue(row, fieldName) {
  return row?.[fieldName] ?? "";
}

export function getComparisonFieldType(label = "") {
  const s = lower(label);

  if (s.includes("date")) return "date";
  if (s.includes("amount")) return "amount";
  if (s.includes("category")) return "category";
  return "text";
}

export function scorePair(rowA, rowB, compareFields) {
  let matches = 0;
  const detail = {};

  for (const f of compareFields) {
    const type = getComparisonFieldType(f.label);
    const a = getFieldValue(rowA, f.leftField);
    const b = getFieldValue(rowB, f.rightField);

    const result = valuesEqual(type, a, b, {
      rowA,
      rowB,
      leftField: f.leftField,
      rightField: f.rightField,
      label: f.label,
    });

    detail[f.key] = result;
    if (result.ok) matches += 1;
  }

  return { matches, detail };
}

export function amountDifference(rowA, rowB, amountLeftField, amountRightField) {
  const a = normalizeAmount(getFieldValue(rowA, amountLeftField));
  const b = normalizeAmount(getFieldValue(rowB, amountRightField));
  if (a == null || b == null) return "";
  return (a - b).toFixed(2);
}

export function buildCompareRows({
  leftRows = [],
  rightRows = [],
  compareFields = [],
  minimumMatchCount = 2,
}) {
  const results = [];
  const usedRight = new Set();

  for (const leftRow of leftRows) {
    let bestIndex = -1;
    let bestScore = -1;
    let bestDetail = null;

    rightRows.forEach((rightRow, idx) => {
      if (usedRight.has(idx)) return;

      const { matches, detail } = scorePair(leftRow, rightRow, compareFields);

      if (matches > bestScore) {
        bestScore = matches;
        bestIndex = idx;
        bestDetail = detail;
      }
    });

    if (bestIndex >= 0 && bestScore >= minimumMatchCount) {
      usedRight.add(bestIndex);

      results.push({
        id: `pair-${leftRow.__rowKey}-${rightRows[bestIndex].__rowKey}`,
        leftRow,
        rightRow: rightRows[bestIndex],
        matchDetail: bestDetail,
        matchedCount: bestScore,
        manualPair: false,
      });
    }
  }

  const unmatchedLeft = leftRows.filter(
    (l) => !results.some((x) => x.leftRow?.__rowKey === l.__rowKey)
  );

  const unmatchedRight = rightRows.filter(
    (r) => !results.some((x) => x.rightRow?.__rowKey === r.__rowKey)
  );

  return {
    matchedRows: results,
    unmatchedLeft,
    unmatchedRight,
  };
}

export function applyManualPairs({
  baseMatchedRows = [],
  unmatchedLeft = [],
  unmatchedRight = [],
  manualPairs = [],
  compareFields = [],
}) {
  const leftMap = new Map(unmatchedLeft.map((r) => [r.__rowKey, r]));
  const rightMap = new Map(unmatchedRight.map((r) => [r.__rowKey, r]));

  const usedLeft = new Set();
  const usedRight = new Set();
  const manualMatchedRows = [];

  for (const p of manualPairs) {
    const l = leftMap.get(p.leftRowKey);
    const r = rightMap.get(p.rightRowKey);
    if (!l || !r) continue;
    if (usedLeft.has(l.__rowKey) || usedRight.has(r.__rowKey)) continue;

    const { matches, detail } = scorePair(l, r, compareFields);

    manualMatchedRows.push({
      id: `manual-${l.__rowKey}-${r.__rowKey}`,
      leftRow: l,
      rightRow: r,
      matchDetail: detail,
      matchedCount: matches,
      manualPair: true,
    });

    usedLeft.add(l.__rowKey);
    usedRight.add(r.__rowKey);
  }

  const finalUnmatchedLeft = unmatchedLeft.filter((x) => !usedLeft.has(x.__rowKey));
  const finalUnmatchedRight = unmatchedRight.filter((x) => !usedRight.has(x.__rowKey));

  return {
    matchedRows: [...baseMatchedRows, ...manualMatchedRows],
    unmatchedLeft: finalUnmatchedLeft,
    unmatchedRight: finalUnmatchedRight,
  };
}

export function getDefaultCompareFields(leftHeaders = [], rightHeaders = []) {
  const fields = [];

  const dateLeft = leftHeaders.find((h) => lower(h).includes("date"));
  const dateRight = rightHeaders.find((h) => lower(h).includes("date"));
  if (dateLeft && dateRight) {
    fields.push({
      key: "date",
      label: "Date",
      leftField: dateLeft,
      rightField: dateRight,
    });
  }

  const nameLeft = leftHeaders.find((h) => lower(h) === "name" || lower(h).includes("name"));
  const nameRight = rightHeaders.find((h) => lower(h) === "name" || lower(h).includes("name"));
  if (nameLeft && nameRight) {
    fields.push({
      key: "name",
      label: "Name",
      leftField: nameLeft,
      rightField: nameRight,
    });
  }

  const categoryLeft = leftHeaders.find((h) => lower(h).includes("category"));
  const categoryRight = rightHeaders.find((h) => lower(h).includes("category"));
  if (categoryLeft && categoryRight) {
    fields.push({
      key: "category",
      label: "Category",
      leftField: categoryLeft,
      rightField: categoryRight,
    });
  }

  const amountLeft = leftHeaders.find((h) => lower(h).includes("amount"));
  const amountRight = rightHeaders.find((h) => lower(h).includes("amount"));
  if (amountLeft && amountRight) {
    fields.push({
      key: "amount",
      label: "Amount",
      leftField: amountLeft,
      rightField: amountRight,
    });
  }

  return fields;
}

export function compareBoolClass(v) {
  return v?.ok ? "compareTrue" : "compareFalse";
}