import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv, columnHeading, exportFilename } from "../src/utils/exportTable.js";

test("CSV quoting: commas, quotes and newlines are escaped", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell(null), "");
});

test("CSV injection: formula-looking TEXT is neutralised, real negative numbers are not", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://evil\")"), `"'=HYPERLINK(""http://evil"")"`);
  assert.equal(csvCell("+1+1"), "'+1+1");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell("-5", { isNumber: true }), "-5");
  assert.equal(csvCell("-5"), "'-5"); // same text in a non-numeric column is treated as suspicious
});

test("toCsv: header includes units, CRLF line endings, one line per row", () => {
  const cols = [{ key: "site", label: "Site" }, { key: "rate", label: "Survival", type: "number", suffix: "%" }];
  const rows = [{ site: "Sunshine, VIC", rate: 84 }, { site: "Footscray", rate: 62 }];
  assert.equal(columnHeading(cols[1]), "Survival (%)");
  assert.equal(toCsv(cols, rows), 'Site,Survival (%)\r\n"Sunshine, VIC",84\r\nFootscray,62\r\n');
});

test("export filenames are safe and dated", () => {
  assert.equal(exportFilename("Planting records", "csv", new Date("2026-10-12T00:00:00Z")), "planting-records-2026-10-12.csv");
  assert.equal(exportFilename("../../etc/passwd", "pdf", new Date("2026-10-12T00:00:00Z")), "etc-passwd-2026-10-12.pdf");
});
