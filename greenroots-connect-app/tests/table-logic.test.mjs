import test from "node:test";
import assert from "node:assert/strict";
import { filterRows, sortRows, paginate, totalPages } from "../src/utils/tableLogic.js";
import { plantingRecords } from "../src/data/plantingRecords.js";
import { volunteerActivity } from "../src/data/volunteerActivity.js";

const cols = [
  { key: "name" },
  { key: "city" },
  { key: "n", type: "number" },
];
const rows = [
  { id: 1, name: "Ann", city: "Sunshine", n: 9 },
  { id: 2, name: "Bob", city: "Footscray", n: 10 },
  { id: 3, name: "Cy", city: "Sunshine", n: 100 },
];

test("both tables have enough rows to need pagination", () => {
  assert.ok(plantingRecords.length > 10);
  assert.ok(volunteerActivity.length > 10);
});

test("per-column filter only matches its own column", () => {
  const r = filterRows(rows, cols, { city: "sun" });
  assert.deepEqual(r.map((x) => x.id), [1, 3]);
  // "Ann" appears in the name column only, so filtering the city column for it finds nothing
  assert.equal(filterRows(rows, cols, { city: "ann" }).length, 0);
});

test("multiple column filters combine with AND", () => {
  assert.deepEqual(filterRows(rows, cols, { city: "sun", name: "cy" }).map((x) => x.id), [3]);
});

test("global search matches any column, case-insensitively", () => {
  assert.deepEqual(filterRows(rows, cols, {}, "FOOT").map((x) => x.id), [2]);
});

test("numeric sort is numeric, not alphabetical (9 < 10 < 100)", () => {
  const asc = sortRows(rows, { key: "n", type: "number" }, "asc").map((x) => x.n);
  assert.deepEqual(asc, [9, 10, 100]);
  const desc = sortRows(rows, { key: "n", type: "number" }, "desc").map((x) => x.n);
  assert.deepEqual(desc, [100, 10, 9]);
});

test("text sort works and does not mutate the input", () => {
  const copy = [...rows];
  const sorted = sortRows(rows, { key: "name" }, "desc").map((x) => x.name);
  assert.deepEqual(sorted, ["Cy", "Bob", "Ann"]);
  assert.deepEqual(rows, copy);
});

test("pagination limits to 10 rows per page", () => {
  assert.equal(paginate(plantingRecords, 1, 10).length, 10);
  assert.equal(totalPages(48, 10), 5);
  assert.equal(paginate(plantingRecords, 5, 10).length, 8); // 48 rows -> last page has 8
  assert.equal(paginate(plantingRecords, 99, 10).length, 8); // out-of-range page clamps to the last page
});
