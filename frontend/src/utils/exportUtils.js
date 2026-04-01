// src/utils/exportUtils.js
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

/**
 * Get field value - handles nested .data structure from FormatPanel
 */
function getFieldValue(row, fieldName) {
  if (!row || !fieldName) return "";
  // Primary: nested under .data
  if (row.data?.[fieldName] !== undefined) return row.data[fieldName];
  // Fallback: direct access
  if (row[fieldName] !== undefined) return row[fieldName];
  // Fallback: case-insensitive in .data
  if (row.data) {
    const lower = fieldName.toLowerCase();
    const key = Object.keys(row.data).find(k => k.toLowerCase() === lower);
    if (key) return row.data[key];
  }
  return "";
}

/**
 * Build export data with THREE labeled sections:
 * 1. Formatted Output 1 (File A)
 * 2. Formatted Output 2 (File B)
 * 3. Comparison Results
 * 
 * Filters out summary/total rows that only contain totals
 */
export function buildExportData(finalResult, compareFields, leftHeaders, rightHeaders) {
  const rows = [];
  const amountField = compareFields.find(f => f.key === "amount");

  // Helper: Check if row is a summary/total row (should be excluded)
  const isSummaryRow = (rowObj, headers) => {
    if (!rowObj) return true;
    
    // Get actual data from row (handle nested .data structure)
    const data = rowObj.data || rowObj;
    
    // Check if ANY field contains "TOTAL" (case-insensitive)
    for (const h of headers) {
      const val = data[h];
      if (val && String(val).toUpperCase().trim() === 'TOTAL') {
        return true;
      }
    }
    
    // Check if this row has ONLY amount values and everything else is empty
    // This catches rows like: "" | "" | "" | "" | "" | "$210.00"
    let hasNonAmountData = false;
    let hasAmountData = false;
    
    for (const h of headers) {
      const val = data[h];
      const strVal = String(val ?? '').trim();
      
      if (strVal === '') continue; // Skip empty fields
      
      // Check if this is an amount field (contains $, comma, or is purely numeric with decimals)
      const isAmount = h.toLowerCase().includes('amount') || 
                       /^[\$,\d.]+$/.test(strVal);
      
      if (isAmount) {
        hasAmountData = true;
      } else {
        hasNonAmountData = true;
      }
    }
    
    // If row has amounts but NO other data, it's a summary row
    if (hasAmountData && !hasNonAmountData) {
      return true;
    }
    
    return false;
  };

  // --- MATCHED ROWS ---
  finalResult.matchedRows?.forEach((match) => {
    // Skip if either side is a summary row
    const leftIsSummary = isSummaryRow(match.leftRow, leftHeaders);
    const rightIsSummary = isSummaryRow(match.rightRow, rightHeaders);
    
    if (leftIsSummary || rightIsSummary) {
      return; // Skip this row
    }
    
    const row = {};
    
    // === SECTION 1: Formatted Output 1 (File A) ===
    leftHeaders.forEach((h) => {
      row[`__A_${h}`] = getFieldValue(match.leftRow, h);
    });
    
    // === SECTION 2: Formatted Output 2 (File B) ===
    rightHeaders.forEach((h) => {
      row[`__B_${h}`] = getFieldValue(match.rightRow, h);
    });
    
    // === SECTION 3: Comparison Results ===
    compareFields.forEach((f) => {
      const matchResult = match.matchDetail?.[f.key];
      row[`__M_${f.label}`] = matchResult?.ok ? "TRUE" : "FALSE";
    });
    
    // Amount Difference
    const amountLeft = getFieldValue(match.leftRow, amountField?.leftField || "Amount");
    const amountRight = getFieldValue(match.rightRow, amountField?.rightField || "Amount");
    const a = Number(String(amountLeft).replace(/[$,]/g, ""));
    const b = Number(String(amountRight).replace(/[$,]/g, ""));
    row["__M_Amount Difference"] = (Number.isFinite(a) && Number.isFinite(b)) 
      ? (a - b).toFixed(2) 
      : "";
    
    rows.push(row);
  });

  // --- UNMATCHED LEFT (Only in File A) ---
  finalResult.unmatchedLeft?.forEach((rowObj) => {
    // Skip summary rows
    if (isSummaryRow(rowObj, leftHeaders)) return;
    
    const row = {};
    leftHeaders.forEach((h) => { row[`__A_${h}`] = getFieldValue(rowObj, h); });
    rightHeaders.forEach((h) => { row[`__B_${h}`] = ""; });
    compareFields.forEach((f) => { row[`__M_${f.label}`] = ""; });
    row["__M_Amount Difference"] = "";
    rows.push(row);
  });

  // --- UNMATCHED RIGHT (Only in File B) ---
  finalResult.unmatchedRight?.forEach((rowObj) => {
    // Skip summary rows
    if (isSummaryRow(rowObj, rightHeaders)) return;
    
    const row = {};
    leftHeaders.forEach((h) => { row[`__A_${h}`] = ""; });
    rightHeaders.forEach((h) => { row[`__B_${h}`] = getFieldValue(rowObj, h); });
    compareFields.forEach((f) => { row[`__M_${f.label}`] = ""; });
    row["__M_Amount Difference"] = "";
    rows.push(row);
  });

  return rows;
}

/**
 * Get CSV columns with section headers + 2 empty separator columns between sections
 */
export function getCSVColumns(leftHeaders, rightHeaders, compareFields) {
  return {
    // Section headers row (with empty strings for separator columns)
    sectionHeaders: [
      "=== Formatted Output 1 (File A) ===",
      ...Array(leftHeaders.length - 1).fill(""),
      "", "", // === SEPARATOR (2 empty columns) ===
      "=== Formatted Output 2 (File B) ===",
      ...Array(rightHeaders.length - 1).fill(""),
      "", "", // === SEPARATOR (2 empty columns) ===
      "=== Comparison Results ===",
      ...Array(compareFields.length).fill(""),
      "" // Amount Difference
    ],
    // Actual data columns with 2 empty separators between sections
    dataColumns: [
      ...leftHeaders,
      "", "", // === SEPARATOR (2 empty columns) ===
      ...rightHeaders,
      "", "", // === SEPARATOR (2 empty columns) ===
      ...compareFields.map(f => `${f.label} Match`),
      "Amount Difference"
    ]
  };
}

/**
 * CSV Export - Three labeled sections with 2 empty columns between each
 */
export function exportCSV(finalResult, compareFields, leftHeaders, rightHeaders, filename = null) {
  try {
    const rows = buildExportData(finalResult, compareFields, leftHeaders, rightHeaders);
    if (!rows?.length) { alert("No data to export"); return; }

    const { sectionHeaders, dataColumns } = getCSVColumns(leftHeaders, rightHeaders, compareFields);
    
    // Row 1: Section labels
    const csvRows = [sectionHeaders.map(h => h ? `"${h}"` : "").join(",")];
    
    // Row 2: Column headers
    csvRows.push(dataColumns.map(c => c ? `"${c}"` : "").join(","));
    
    // Row 3: Visual separator (blank row)
    csvRows.push(dataColumns.map(() => "").join(","));
    
    // Data rows
    rows.forEach((row) => {
      const values = dataColumns.map((col) => {
        // Handle separator columns (empty strings)
        if (col === "") return "";
        
        // Map display column name to internal key
        let internalKey;
        if (leftHeaders.includes(col)) {
          internalKey = `__A_${col}`;
        } else if (rightHeaders.includes(col)) {
          internalKey = `__B_${col}`;
        } else if (col === "Amount Difference") {
          internalKey = "__M_Amount Difference";
        } else {
          // Match column like "Date Match" -> __M_Date
          const matchLabel = col.replace(" Match", "");
          internalKey = `__M_${matchLabel}`;
        }
        const val = String(row[internalKey] ?? "");
        const escaped = val.replace(/"/g, '""');
        return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
      });
      csvRows.push(values.join(","));
    });

    const csvContent = "\uFEFF" + csvRows.join("\n"); // UTF-8 BOM for Excel/Google Sheets
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

/**
 * Excel Export - Three styled sections with 2 empty separator columns between each
 */
export async function exportExcel(finalResult, compareFields, leftHeaders, rightHeaders, filename = null) {
  try {
    const rows = buildExportData(finalResult, compareFields, leftHeaders, rightHeaders);
    if (!rows?.length) { alert("No data to export"); return; }

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Comparison Report");

    const { sectionHeaders, dataColumns } = getCSVColumns(leftHeaders, rightHeaders, compareFields);
    
    // === Row 1: Section labels with merged cells ===
    let colIndex = 1;
    
    // Section 1 header (File A)
    sheet.mergeCells(1, colIndex, 1, colIndex + leftHeaders.length - 1);
    const sec1Cell = sheet.getCell(1, colIndex);
    sec1Cell.value = "=== Formatted Output 1 (File A) ===";
    sec1Cell.font = { bold: true, color: { argb: "FF1F4E78" } };
    sec1Cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
    sec1Cell.alignment = { horizontal: "center" };
    colIndex += leftHeaders.length;
    
    // === Separator columns (2 empty) ===
    colIndex += 2; // Skip 2 columns for visual separation
    
    // Section 2 header (File B)
    sheet.mergeCells(1, colIndex, 1, colIndex + rightHeaders.length - 1);
    const sec2Cell = sheet.getCell(1, colIndex);
    sec2Cell.value = "=== Formatted Output 2 (File B) ===";
    sec2Cell.font = { bold: true, color: { argb: "FF1F4E78" } };
    sec2Cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
    sec2Cell.alignment = { horizontal: "center" };
    colIndex += rightHeaders.length;
    
    // === Separator columns (2 empty) ===
    colIndex += 2; // Skip 2 columns for visual separation
    
    // Section 3 header (Comparison)
    sheet.mergeCells(1, colIndex, 1, colIndex + compareFields.length);
    const sec3Cell = sheet.getCell(1, colIndex);
    sec3Cell.value = "=== Comparison Results ===";
    sec3Cell.font = { bold: true, color: { argb: "FF1F4E78" } };
    sec3Cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
    sec3Cell.alignment = { horizontal: "center" };
    
    // === Row 2: Column headers ===
    const headerRow = sheet.addRow(dataColumns.map(c => c || ""));
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F81BD" } };
    headerRow.eachCell((cell) => {
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      // Style separator columns with light gray background
      if (!cell.value) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } };
      }
    });
    
    // === Row 3: Visual separator (blank row with bottom border) ===
    const sepRow = sheet.addRow(dataColumns.map(() => ""));
    sepRow.eachCell((cell) => {
      cell.border = { bottom: { style: "double", color: { argb: "FF4F81BD" } } };
      cell.height = 5;
      // Style separator columns
      if (!cell.value) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8E8E8" } };
      }
    });
    
    // === Data rows ===
    rows.forEach((rowData) => {
      const row = sheet.addRow(dataColumns.map((col) => {
        // Separator columns stay empty
        if (col === "") return "";
        
        // Map column name to internal key
        let internalKey;
        if (leftHeaders.includes(col)) internalKey = `__A_${col}`;
        else if (rightHeaders.includes(col)) internalKey = `__B_${col}`;
        else if (col === "Amount Difference") internalKey = "__M_Amount Difference";
        else {
          const matchLabel = col.replace(" Match", "");
          internalKey = `__M_${matchLabel}`;
        }
        return rowData[internalKey] ?? "";
      }));
      
      // Color code Match columns (TRUE=green, FALSE=red)
      compareFields.forEach((_, idx) => {
        // Calculate position of match columns (after File A + separators + File B + separators)
        const matchColStart = leftHeaders.length + 2 + rightHeaders.length + 2;
        const matchColIdx = matchColStart + idx + 1; // +1 for 1-based Excel indexing
        const cell = row.getCell(matchColIdx);
        
        if (cell.value === "TRUE") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
        } else if (cell.value === "FALSE") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
        }
      });
      
      // Add borders to all cells, style separator columns
      row.eachCell((cell) => {
        cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        // Style separator columns with light gray
        if (!cell.value) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F8F8" } };
        }
      });
    });
    
    // === Auto-fit columns ===
    sheet.columns.forEach((col) => {
      // Separator columns: fixed narrow width
      const colNum = col.number;
      const isAfterFileA = colNum > leftHeaders.length && colNum <= leftHeaders.length + 2;
      const isAfterFileB = colNum > leftHeaders.length + 2 + rightHeaders.length && 
                          colNum <= leftHeaders.length + 2 + rightHeaders.length + 2;
      
      if (isAfterFileA || isAfterFileB) {
        col.width = 3; // Narrow separator columns
      } else {
        // Regular columns: auto-fit based on content
        let maxLen = 15;
        col.eachCell({ includeEmpty: true }, (cell) => {
          if (cell.value && String(cell.value).length > maxLen) {
            maxLen = Math.min(String(cell.value).length, 50);
          }
        });
        col.width = maxLen + 2;
      }
    });
    
    // === Freeze header rows ===
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    
    // === Add vertical divider lines between sections ===
    const dividerColor = { argb: "FFCCCCCC" };
    
    // Divider after File A section (after the 2 separator columns)
    const divider1Col = leftHeaders.length + 2;
    for (let rowIdx = 1; rowIdx <= sheet.rowCount; rowIdx++) {
      const cell = sheet.getCell(rowIdx, divider1Col);
      cell.border = { ...cell.border, right: { style: "thin", color: dividerColor } };
    }
    
    // Divider after File B section (after the 2 separator columns)
    const divider2Col = leftHeaders.length + 2 + rightHeaders.length + 2;
    for (let rowIdx = 1; rowIdx <= sheet.rowCount; rowIdx++) {
      const cell = sheet.getCell(rowIdx, divider2Col);
      cell.border = { ...cell.border, right: { style: "thin", color: dividerColor } };
    }
    
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

/**
 * PDF Export - SINGLE table with all columns side-by-side + section headers
 * Matches the UI layout: File A | File B | Comparison Results (all in one row)
 */
export function exportPDF(finalResult, compareFields, leftHeaders, rightHeaders, filename = null) {
  try {
    const rows = buildExportData(finalResult, compareFields, leftHeaders, rightHeaders);
    if (!rows?.length) { alert("No data to export"); return; }

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const { dataColumns } = getCSVColumns(leftHeaders, rightHeaders, compareFields);
    
    // Build body data
    const body = rows.map((row) => 
      dataColumns.map((col) => {
        let internalKey;
        if (leftHeaders.includes(col)) internalKey = `__A_${col}`;
        else if (rightHeaders.includes(col)) internalKey = `__B_${col}`;
        else if (col === "Amount Difference") internalKey = "__M_Amount Difference";
        else {
          const matchLabel = col.replace(" Match", "");
          internalKey = `__M_${matchLabel}`;
        }
        return String(row[internalKey] ?? "");
      })
    );

    // === Build TWO-ROW HEADER ===
    // Row 1: Section labels (with empty strings for visual grouping)
    const sectionHeaderRow = [];
    
    // Section 1 label (span File A columns)
    sectionHeaderRow.push("=== File A ===");
    for (let i = 1; i < leftHeaders.length; i++) sectionHeaderRow.push("");
    
    // Add 2 empty columns for separator (visual only in header)
    sectionHeaderRow.push("");
    sectionHeaderRow.push("");
    
    // Section 2 label (span File B columns)
    sectionHeaderRow.push("=== File B ===");
    for (let i = 1; i < rightHeaders.length; i++) sectionHeaderRow.push("");
    
    // Add 2 empty columns for separator
    sectionHeaderRow.push("");
    sectionHeaderRow.push("");
    
    // Section 3 label (span Comparison columns)
    sectionHeaderRow.push("=== Comparison ===");
    for (let i = 1; i < compareFields.length; i++) sectionHeaderRow.push("");
    sectionHeaderRow.push(""); // Amount Difference
    
    // Row 2: Actual column headers (includes the separator columns as empty)
    const columnHeaderRow = [
      ...leftHeaders,
      "", "", // 2 separator columns
      ...rightHeaders,
      "", "", // 2 separator columns
      ...compareFields.map(f => `${f.label} Match`),
      "Amount Difference"
    ];
    
    // Title and metadata
    doc.setFontSize(14);
    doc.text("Comparison Report", 14, 12);
    doc.setFontSize(9);
    doc.text(`Generated: ${new Date().toLocaleString()} | Records: ${rows.length}`, 14, 19);
    
    // Stats summary
    const matchedCount = rows.filter((r) => {
      const matchColIdx = leftHeaders.length + 2 + rightHeaders.length + 2;
      const firstMatchVal = r[`__M_${compareFields[0]?.label}`];
      return firstMatchVal === "TRUE";
    }).length;
    
    doc.text(`Matched: ${matchedCount} | Unmatched A: ${finalResult.unmatchedLeft?.length || 0} | Unmatched B: ${finalResult.unmatchedRight?.length || 0}`, 14, 25);

    // === SINGLE TABLE with two header rows + separator columns ===
    autoTable(doc, {
      startY: 32,
      head: [sectionHeaderRow, columnHeaderRow],
      body: body.map((row) => [
        ...row.slice(0, leftHeaders.length),
        "", "", // 2 empty separator columns
        ...row.slice(leftHeaders.length, leftHeaders.length + rightHeaders.length),
        "", "", // 2 empty separator columns
        ...row.slice(leftHeaders.length + rightHeaders.length)
      ]),
      theme: "grid",
      styles: { 
        fontSize: 6, 
        cellPadding: 1,
        overflow: "linebreak",
        cellWidth: "wrap",
        halign: "left"
      },
      headStyles: { 
        fillColor: [79, 129, 189],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7,
        halign: "center"
      },
      columnStyles: {
        // Style separator columns with light gray background in header
        [leftHeaders.length]: { fillColor: [240, 240, 240], cellWidth: 5 },
        [leftHeaders.length + 1]: { fillColor: [240, 240, 240], cellWidth: 5 },
        [leftHeaders.length + 2 + rightHeaders.length]: { fillColor: [240, 240, 240], cellWidth: 5 },
        [leftHeaders.length + 2 + rightHeaders.length + 1]: { fillColor: [240, 240, 240], cellWidth: 5 }
      },
      didParseCell: (data) => {
        // First header row = section labels (row.index === 0)
        if (data.row.index === 0) {
          data.cell.styles.fillColor = [46, 92, 138];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fontSize = 8;
          
          // Only show text in first column of each section
          const isSectionStart = 
            data.column.index === 0 || // File A start
            data.column.index === leftHeaders.length + 2 || // File B start (after 2 separators)
            data.column.index === leftHeaders.length + 2 + rightHeaders.length + 2; // Comparison start
          
          if (!isSectionStart) {
            data.cell.styles.textColor = [46, 92, 138];
            data.cell.content = "";
          }
        }
        
        // Color code TRUE/FALSE in Match columns (data rows only)
        if (data.row.index >= 2) { // Skip header rows
          const matchColStart = leftHeaders.length + 2 + rightHeaders.length + 2;
          if (data.column.index >= matchColStart && data.column.index < matchColStart + compareFields.length) {
            if (data.cell.raw === "TRUE") {
              data.cell.styles.fillColor = [198, 239, 206];
              data.cell.styles.textColor = [0, 0, 0];
            } else if (data.cell.raw === "FALSE") {
              data.cell.styles.fillColor = [255, 199, 206];
              data.cell.styles.textColor = [0, 0, 0];
            }
          }
        }
      },
      didDrawCell: (data) => {
        // Draw vertical divider lines between sections
        if (data.column.index === leftHeaders.length + 1 || // After File A + 2 separators
            data.column.index === leftHeaders.length + 2 + rightHeaders.length + 1) { // After File B + 2 separators
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
        }
      },
      margin: { left: 8, right: 8, top: 10 },
      pageBreak: "auto",
      tableWidth: "auto"
    });

    doc.save(filename || `comparison_export_${new Date().toISOString().slice(0, 10)}.pdf`);
    
  } catch (error) {
    console.error("PDF Export Error:", error);
    alert("Failed to export PDF: " + error.message);
  }
}