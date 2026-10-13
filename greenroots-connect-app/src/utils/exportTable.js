// Data export (BR E.4): CSV and PDF of a table's rows.
// CSV logic is pure and unit-tested (tests/export.test.mjs); the PDF library is
// loaded only when someone clicks "Export PDF", so it doesn't weigh down page load.

// --- CSV ---------------------------------------------------------------

// Spreadsheet apps run a cell that starts with = + - @ as a formula. If exported
// data ever contained attacker-typed text, that's "CSV injection" (OWASP), so
// such text cells get a leading apostrophe. Real numbers like -5 are left alone.
export function csvCell(value, { isNumber = false } = {}) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s) && !(isNumber && Number.isFinite(Number(s)))) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function columnHeading(col) {
  return col.suffix ? `${col.label} (${col.suffix})` : col.label;
}

export function toCsv(columns, rows) {
  const header = columns.map((c) => csvCell(columnHeading(c))).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => csvCell(row[c.key], { isNumber: c.type === "number" })).join(",")
  );
  return [header, ...lines].join("\r\n") + "\r\n";
}

export function exportFilename(base, ext, date = new Date()) {
  const slug = String(base).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug}-${date.toISOString().slice(0, 10)}.${ext}`;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv({ title, columns, rows }) {
  // The BOM makes Excel open the file as UTF-8 instead of guessing wrongly.
  const blob = new Blob(["\ufeff", toCsv(columns, rows)], { type: "text/csv;charset=utf-8" });
  saveBlob(blob, exportFilename(title, "csv"));
}

// --- PDF ---------------------------------------------------------------

export async function downloadPdf({ title, subtitle = "", columns, rows }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setProperties({ title: `${title} - GreenRoots Connect`, subject: "Table export", creator: "GreenRoots Connect" });

  doc.setFontSize(16);
  doc.text(title, 40, 44);
  doc.setFontSize(9);
  doc.setTextColor(90);
  const stamp = `Exported ${new Date().toLocaleString("en-AU")} - ${rows.length} row${rows.length === 1 ? "" : "s"}`;
  doc.text([stamp, subtitle].filter(Boolean), 40, 60);

  autoTable(doc, {
    startY: subtitle ? 86 : 74,
    head: [columns.map(columnHeading)],
    body: rows.map((r) => columns.map((c) => String(r[c.key] ?? ""))),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [31, 61, 43], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 244, 236] },
    columnStyles: Object.fromEntries(columns.map((c, i) => [i, c.type === "number" ? { halign: "right" } : {}])),
    margin: { left: 40, right: 40 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`Page ${i} of ${pages}`, doc.internal.pageSize.getWidth() - 40, doc.internal.pageSize.getHeight() - 20, {
      align: "right",
    });
  }
  doc.save(exportFilename(title, "pdf"));
}
