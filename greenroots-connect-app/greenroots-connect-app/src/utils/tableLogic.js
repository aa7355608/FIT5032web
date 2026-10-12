// Pure table logic (BR D.3): filtering, sorting and pagination.
// Kept free of Vue so it can be unit-tested (tests/table-logic.test.mjs).

const norm = (value) => String(value ?? "").toLowerCase();

// columnFilters: { [columnKey]: "text" } — every non-empty filter must match its
// own column (this is the "search by individual column" requirement).
// globalQuery: matches if ANY column contains the text.
export function filterRows(rows, columns, columnFilters = {}, globalQuery = "") {
  const global = norm(globalQuery).trim();
  return rows.filter((row) => {
    for (const col of columns) {
      const q = norm(columnFilters[col.key]).trim();
      if (q && !norm(row[col.key]).includes(q)) return false;
    }
    if (global) {
      return columns.some((col) => norm(row[col.key]).includes(global));
    }
    return true;
  });
}

// Returns a new sorted array; does not mutate the input. Numbers sort
// numerically ("9" before "10"), everything else alphabetically (ISO dates
// sort correctly as text).
export function sortRows(rows, column, direction = "asc") {
  if (!column) return rows;
  const factor = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = a[column.key];
    const y = b[column.key];
    if (column.type === "number") return (Number(x) - Number(y)) * factor;
    return String(x ?? "").localeCompare(String(y ?? ""), undefined, { sensitivity: "base" }) * factor;
  });
}

export function totalPages(totalRows, pageSize) {
  return Math.max(1, Math.ceil(totalRows / pageSize));
}

export function paginate(rows, page, pageSize) {
  const safePage = Math.min(Math.max(1, page), totalPages(rows.length, pageSize));
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
