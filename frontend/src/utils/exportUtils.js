import ExcelJS from "exceljs";
import { isFieldRequired } from "./compareUtils";

function getFieldValue(row, fieldName) {
  if (!row || !fieldName) return "";
  if (row.data?.[fieldName] !== undefined) return row.data[fieldName];
  if (row[fieldName] !== undefined) return row[fieldName];
  if (row.data) {
    const lower = fieldName.toLowerCase();
    const key = Object.keys(row.data).find(k => k.toLowerCase() === lower);
    if (key) return row.data[key];
  }
  return "";
}

// Mirrors getRowType in CompareResultsTable — only visible fields drive the verdict.
function getRowType(pair, visibleCompareFields) {
  const nameField = visibleCompareFields.find(f => f.label.toLowerCase().includes("name"));
  const nameDetail = nameField ? pair?.matchDetail?.[nameField.key] : null;
  const isEmployerFallback =
    nameDetail?.ok &&
    (nameDetail?.mode === "left_name_to_right_employer" ||
      nameDetail?.mode === "right_name_to_left_employer");
  const allMatch = visibleCompareFields.every(f => pair.matchDetail?.[f.key]?.ok);
  if (!allMatch) return "false";
  if (isEmployerFallback) return "conditional";
  return "truth";
}

function isSummaryRow(rowObj, headers) {
  if (!rowObj) return true;
  const data = rowObj.data || rowObj;
  for (const h of headers) {
    const val = data[h];
    if (val && String(val).toUpperCase().trim() === "TOTAL") return true;
  }
  let hasNonAmountData = false;
  let hasAmountData = false;
  for (const h of headers) {
    const val = data[h];
    const strVal = String(val ?? "").trim();
    if (strVal === "") continue;
    const isAmount = h.toLowerCase().includes("amount") || /^[\$,\d.]+$/.test(strVal);
    if (isAmount) hasAmountData = true;
    else hasNonAmountData = true;
  }
  return hasAmountData && !hasNonAmountData;
}

// Case-insensitive substring match against the left + right cell values that
// would render in the table. Mirrors rowMatchesSearch in CompareResultsTable.
function rowMatchesSearch(pair, leftHeaders, rightHeaders, q) {
  if (!q) return true;
  for (const h of leftHeaders) {
    if (String(getFieldValue(pair.leftRow, h)).toLowerCase().includes(q)) return true;
  }
  for (const h of rightHeaders) {
    if (String(getFieldValue(pair.rightRow, h)).toLowerCase().includes(q)) return true;
  }
  return false;
}

function unmatchedRowMatchesSearch(rowObj, headers, q) {
  if (!q) return true;
  for (const h of headers) {
    if (String(getFieldValue(rowObj, h)).toLowerCase().includes(q)) return true;
  }
  return false;
}

export function buildExportData(finalResult, compareFields, leftHeaders, rightHeaders, rowEdits = {}, activeTab = "results", rowFilter = "all", opts = {}) {
  const { searchQuery = "", hideStandalone = false } = opts;
  const q = (searchQuery || "").trim().toLowerCase();
  const rows = [];
  const visibleCompareFields = compareFields.filter(isFieldRequired);
  const amountField = compareFields.find(f => f.key === "amount");

  if (activeTab === "unmatched") {
    finalResult.unmatchedLeft?.forEach(rowObj => {
      if (isSummaryRow(rowObj, leftHeaders)) return;
      if (!unmatchedRowMatchesSearch(rowObj, leftHeaders, q)) return;
      const row = { __rowType: "unmatched", __isEdited: false };
      leftHeaders.forEach(h => { row[`__A_${h}`] = getFieldValue(rowObj, h); });
      rightHeaders.forEach(h => { row[`__B_${h}`] = ""; });
      visibleCompareFields.forEach(f => { row[`__M_${f.label}`] = ""; });
      row["__M_Amount Diff"] = "";
      rows.push(row);
    });

    finalResult.unmatchedRight?.forEach(rowObj => {
      if (isSummaryRow(rowObj, rightHeaders)) return;
      if (!unmatchedRowMatchesSearch(rowObj, rightHeaders, q)) return;
      const row = { __rowType: "unmatched", __isEdited: false };
      leftHeaders.forEach(h => { row[`__A_${h}`] = ""; });
      rightHeaders.forEach(h => { row[`__B_${h}`] = getFieldValue(rowObj, h); });
      visibleCompareFields.forEach(f => { row[`__M_${f.label}`] = ""; });
      row["__M_Amount Diff"] = "";
      rows.push(row);
    });

    return rows;
  }

  // Results tab — respect active row filter, hide-standalone toggle, and search
  finalResult.matchedRows?.forEach((pair) => {
    if (isSummaryRow(pair.leftRow, leftHeaders) || isSummaryRow(pair.rightRow, rightHeaders)) return;
    if (hideStandalone && pair.isStandalone) return;

    const rowType = getRowType(pair, visibleCompareFields);
    if (rowFilter !== "all" && rowType !== rowFilter) return;
    if (!rowMatchesSearch(pair, leftHeaders, rightHeaders, q)) return;

    const isEdited = (rowEdits[pair.id]?.versions?.length || 0) > 1;
    const row = { __rowType: rowType, __isEdited: isEdited };

    leftHeaders.forEach(h => { row[`__A_${h}`] = getFieldValue(pair.leftRow, h); });
    rightHeaders.forEach(h => { row[`__B_${h}`] = getFieldValue(pair.rightRow, h); });
    visibleCompareFields.forEach(f => {
      row[`__M_${f.label}`] = pair.matchDetail?.[f.key]?.ok ? "TRUE" : "FALSE";
    });

    const al = Number(String(getFieldValue(pair.leftRow, amountField?.leftField || "Amount")).replace(/[$,]/g, ""));
    const ar = Number(String(getFieldValue(pair.rightRow, amountField?.rightField || "Amount")).replace(/[$,]/g, ""));
    row["__M_Amount Diff"] = (Number.isFinite(al) && Number.isFinite(ar)) ? (al - ar).toFixed(2) : "";

    rows.push(row);
  });

  return rows;
}

// Columns match the compare page table exactly: left headers, right headers,
// visible (Required) compare field labels, Amount Diff.
export function getColumnDefs(leftHeaders, rightHeaders, compareFields) {
  const visibleCompareFields = compareFields.filter(isFieldRequired);
  return [
    ...leftHeaders.map(h => ({ label: h, key: `__A_${h}` })),
    ...rightHeaders.map(h => ({ label: h, key: `__B_${h}` })),
    ...visibleCompareFields.map(f => ({ label: f.label, key: `__M_${f.label}` })),
    { label: "Amount Diff", key: "__M_Amount Diff" },
  ];
}

export function exportCSV(finalResult, compareFields, leftPanel, rightPanel, rowEdits = {}, activeTab = "results", rowFilter = "all", filename = null, opts = {}) {
  try {
    const leftHeaders = leftPanel?.headers || [];
    const rightHeaders = rightPanel?.headers || [];
    const leftTitle = leftPanel?.title || "File A";
    const rightTitle = rightPanel?.title || "File B";

    const rows = buildExportData(finalResult, compareFields, leftHeaders, rightHeaders, rowEdits, activeTab, rowFilter, opts);
    if (!rows?.length) { alert("No data to export"); return; }

    const visibleCompareFields = compareFields.filter(isFieldRequired);
    const colDefs = getColumnDefs(leftHeaders, rightHeaders, compareFields);

    // Row 1: Section labels (mirrors compare page group headers)
    const sectionRow = [
      leftTitle,
      ...Array(leftHeaders.length - 1).fill(""),
      rightTitle,
      ...Array(rightHeaders.length - 1).fill(""),
      "Do the records match?",
      ...Array(visibleCompareFields.length).fill(""), // Amount Diff - 1
    ];

    // Row 2: Column headers
    const headerRow = colDefs.map(c => c.label);

    const csvRows = [
      sectionRow.map(h => h ? `"${h}"` : "").join(","),
      headerRow.map(h => h ? `"${h}"` : "").join(","),
    ];

    rows.forEach(row => {
      const values = colDefs.map(({ key }) => {
        const val = String(row[key] ?? "");
        const escaped = val.replace(/"/g, '""');
        return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
      });
      csvRows.push(values.join(","));
    });

    const csvContent = "﻿" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `comparison_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("CSV Export Error:", error);
    alert("Failed to export CSV: " + error.message);
  }
}

// Row fill colors match the compare page:
// Conditional Truth → light blue, False → light red, Edited→Truth → light green
const ROW_FILLS = {
  conditional: { type: "pattern", pattern: "solid", fgColor: { argb: "FFB3C6E7" } },
  false:       { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } },
  edited_truth:{ type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } },
  unmatched:   { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } },
};

export async function exportExcel(finalResult, compareFields, leftPanel, rightPanel, rowEdits = {}, activeTab = "results", rowFilter = "all", filename = null, opts = {}) {
  try {
    const leftHeaders = leftPanel?.headers || [];
    const rightHeaders = rightPanel?.headers || [];
    const leftTitle = leftPanel?.title || "File A";
    const rightTitle = rightPanel?.title || "File B";

    const rows = buildExportData(finalResult, compareFields, leftHeaders, rightHeaders, rowEdits, activeTab, rowFilter, opts);
    if (!rows?.length) { alert("No data to export"); return; }

    const visibleCompareFields = compareFields.filter(isFieldRequired);
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Comparison Report");

    const colDefs = getColumnDefs(leftHeaders, rightHeaders, compareFields);

    // === Row 1: Section group headers (mirrors compare page) ===
    let colIdx = 1;

    const addSectionHeader = (title, span) => {
      if (span > 1) sheet.mergeCells(1, colIdx, 1, colIdx + span - 1);
      const cell = sheet.getCell(1, colIdx);
      cell.value = title;
      cell.font = { bold: true, color: { argb: "FF1F4E78" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
      cell.alignment = { horizontal: "center" };
      colIdx += span;
    };

    addSectionHeader(leftTitle, leftHeaders.length);
    addSectionHeader(rightTitle, rightHeaders.length);
    // "Do the records match?" spans: visible compare fields + Amount Diff
    addSectionHeader("Do the records match?", visibleCompareFields.length + 1);

    // === Row 2: Column headers ===
    const headerRow = sheet.addRow(colDefs.map(c => c.label));
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };
    headerRow.eachCell(cell => {
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });

    // === Data rows ===
    // Compare field columns are at: leftHeaders.length + rightHeaders.length + 1 .. +compareFields.length (1-based)
    const matchColStart = leftHeaders.length + rightHeaders.length + 1;

    rows.forEach(rowData => {
      const dataRow = sheet.addRow(colDefs.map(({ key }) => rowData[key] ?? ""));

      // Row background by match type
      const rowType = rowData.__rowType;
      const isEdited = rowData.__isEdited;
      const rowFill =
        isEdited && rowType === "truth" ? ROW_FILLS.edited_truth :
        rowType === "conditional" ? ROW_FILLS.conditional :
        rowType === "false" ? ROW_FILLS.false :
        rowType === "unmatched" ? ROW_FILLS.unmatched :
        null;

      dataRow.eachCell({ includeEmpty: true }, cell => {
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        if (rowFill) cell.fill = rowFill;
      });

      // Override TRUE/FALSE cells in visible compare field columns with green/red
      visibleCompareFields.forEach((_, idx) => {
        const cell = dataRow.getCell(matchColStart + idx);
        if (cell.value === "TRUE") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
        } else if (cell.value === "FALSE") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
        }
      });
    });

    // === Auto-fit columns ===
    sheet.columns.forEach(col => {
      let maxLen = 10;
      col.eachCell({ includeEmpty: true }, cell => {
        const v = cell.value ? String(cell.value) : "";
        if (v.length > maxLen) maxLen = Math.min(v.length, 50);
      });
      col.width = maxLen + 2;
    });

    // === Freeze header rows ===
    sheet.views = [{ state: "frozen", ySplit: 2 }];

    // === Download ===
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `comparison_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Excel Export Error:", error);
    alert("Failed to export Excel: " + error.message);
  }
}
