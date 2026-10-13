<script setup>
import { reactive, ref, computed, watch } from "vue";
import { filterRows, sortRows, paginate, totalPages } from "../utils/tableLogic.js";
import { downloadCsv, downloadPdf } from "../utils/exportTable.js";

// Interactive table (BR D.3): click-to-sort headers, a search box under every
// column (per-column search) plus a search-all box, and 10 rows per page.
// Everything is rendered with {{ }} (auto-escaped) — never v-html.
const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: "" },
  columns: { type: Array, required: true }, // { key, label, type?: "text"|"number", suffix? }
  rows: { type: Array, required: true },
  pageSize: { type: Number, default: 10 },
  tableId: { type: String, required: true },
});

const columnFilters = reactive(Object.fromEntries(props.columns.map((c) => [c.key, ""])));
const globalQuery = ref("");
const sortKey = ref("");
const sortDir = ref("asc");
const page = ref(1);

const sortColumn = computed(() => props.columns.find((c) => c.key === sortKey.value) || null);

const filtered = computed(() => filterRows(props.rows, props.columns, columnFilters, globalQuery.value));
const sorted = computed(() => sortRows(filtered.value, sortColumn.value, sortDir.value));
const pages = computed(() => totalPages(sorted.value.length, props.pageSize));
const visibleRows = computed(() => paginate(sorted.value, page.value, props.pageSize));

const rangeText = computed(() => {
  const total = sorted.value.length;
  if (total === 0) return "No matching entries";
  const from = (Math.min(page.value, pages.value) - 1) * props.pageSize + 1;
  const to = Math.min(from + props.pageSize - 1, total);
  const of = total === props.rows.length ? "" : ` (filtered from ${props.rows.length})`;
  return `Showing ${from}–${to} of ${total} entries${of}`;
});

// A short window of page numbers around the current page.
const pageNumbers = computed(() => {
  const span = 5;
  let start = Math.max(1, page.value - Math.floor(span / 2));
  const end = Math.min(pages.value, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});

const hasFilters = computed(
  () => globalQuery.value.trim() !== "" || Object.values(columnFilters).some((v) => v.trim() !== "")
);

// Any change to a search box returns to page 1 so results never look empty by accident.
watch([columnFilters, globalQuery], () => (page.value = 1));
watch(pages, (n) => {
  if (page.value > n) page.value = n;
});

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
  } else {
    sortKey.value = key;
    sortDir.value = "asc";
  }
  page.value = 1;
}

function ariaSort(key) {
  if (sortKey.value !== key) return "none";
  return sortDir.value === "asc" ? "ascending" : "descending";
}

function clearFilters() {
  globalQuery.value = "";
  for (const key of Object.keys(columnFilters)) columnFilters[key] = "";
}

// Exports cover EVERY row that matches the current search, in the current sort
// order — not just the page on screen.
const exportMessage = ref("");

const filterSummary = computed(() => {
  const parts = props.columns
    .filter((c) => columnFilters[c.key].trim())
    .map((c) => `${c.label} contains "${columnFilters[c.key].trim()}"`);
  if (globalQuery.value.trim()) parts.push(`any column contains "${globalQuery.value.trim()}"`);
  return parts.length ? `Filters: ${parts.join("; ")}` : "";
});

function exportCsv() {
  downloadCsv({ title: props.title, columns: props.columns, rows: sorted.value });
  exportMessage.value = `Downloaded ${sorted.value.length} rows as CSV.`;
}

const exportingPdf = ref(false);
async function exportPdf() {
  exportingPdf.value = true;
  exportMessage.value = "Preparing PDF…";
  try {
    await downloadPdf({ title: props.title, subtitle: filterSummary.value, columns: props.columns, rows: sorted.value });
    exportMessage.value = `Downloaded ${sorted.value.length} rows as PDF.`;
  } catch {
    exportMessage.value = "Couldn't create the PDF. Please try again, or use the CSV export.";
  } finally {
    exportingPdf.value = false;
  }
}

function display(row, col) {
  const v = row[col.key];
  return col.suffix ? `${v}${col.suffix}` : v;
}
</script>

<template>
  <section class="dt" :aria-labelledby="`${tableId}-title`">
    <div class="dt-head">
      <div>
        <h2 :id="`${tableId}-title`">{{ title }}</h2>
        <p v-if="description" class="dt-desc">{{ description }}</p>
      </div>
      <div class="dt-tools">
        <label :for="`${tableId}-search`" class="visually-hidden">Search all columns</label>
        <input
          :id="`${tableId}-search`"
          v-model="globalQuery"
          type="search"
          placeholder="Search all columns…"
          autocomplete="off"
        />
        <button type="button" class="btn btn-ghost small" :disabled="!hasFilters" @click="clearFilters">
          Clear filters
        </button>
      </div>
    </div>

    <div class="dt-export">
      <span class="dt-export-label">Export {{ sorted.length }} matching row{{ sorted.length === 1 ? "" : "s" }}:</span>
      <button
        type="button"
        class="btn btn-ghost small"
        :disabled="sorted.length === 0"
        :aria-label="`Export ${sorted.length} matching rows of ${title} as CSV`"
        @click="exportCsv"
      >
        CSV
      </button>
      <button
        type="button"
        class="btn btn-ghost small"
        :disabled="sorted.length === 0 || exportingPdf"
        :aria-label="`Export ${sorted.length} matching rows of ${title} as PDF`"
        @click="exportPdf"
      >
        PDF
      </button>
      <span class="visually-hidden" role="status">{{ exportMessage }}</span>
    </div>

    <div class="table-scroll">
      <table :data-table="tableId">
        <caption class="visually-hidden">
          {{ title }}. {{ description }} Column headings are buttons that sort the table; the row of boxes under them filters each column.
        </caption>
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :aria-sort="ariaSort(col.key)"
              :class="{ num: col.type === 'number' }"
            >
              <button type="button" class="sort-btn" @click="toggleSort(col.key)">
                {{ col.label }}
                <span class="arrow" aria-hidden="true">
                  {{ sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : "↕" }}
                </span>
              </button>
            </th>
          </tr>
          <tr class="filter-row">
            <th v-for="col in columns" :key="col.key" scope="col">
              <input
                v-model="columnFilters[col.key]"
                type="search"
                class="col-filter"
                :placeholder="`Search ${col.label.toLowerCase()}`"
                :aria-label="`Filter by ${col.label}`"
                autocomplete="off"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleRows" :key="row.id">
            <td v-for="col in columns" :key="col.key" :class="{ num: col.type === 'number' }">
              {{ display(row, col) }}
            </td>
          </tr>
          <tr v-if="visibleRows.length === 0">
            <td :colspan="columns.length" class="empty">No entries match your search.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="dt-foot">
      <p class="range" role="status">{{ rangeText }}</p>
      <nav class="pager" :aria-label="`${title} pagination`">
        <button type="button" :disabled="page <= 1" @click="page--">Prev</button>
        <button
          v-for="n in pageNumbers"
          :key="n"
          type="button"
          :class="{ current: n === page }"
          :aria-current="n === page ? 'page' : undefined"
          @click="page = n"
        >
          {{ n }}
        </button>
        <button type="button" :disabled="page >= pages" @click="page++">Next</button>
      </nav>
    </div>
  </section>
</template>

<style scoped>
.dt {
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: 22px;
  margin-bottom: 40px;
}

.dt-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.dt-head h2 {
  font-size: 21px;
  margin-bottom: 4px;
}

.dt-desc {
  font-size: 13.5px;
  color: var(--ink-soft);
  margin: 0;
  max-width: 56ch;
}

.dt-tools {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.dt-tools input {
  min-width: 210px;
}

input[type="search"] {
  border: 1px solid var(--control-border);
  border-radius: var(--radius-sm);
  padding: 9px 11px;
  font-size: 13.5px;
  background: var(--cream);
  color: var(--ink);
  font-family: var(--font-body);
}

input[type="search"]:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.btn.small {
  padding: 8px 14px;
  font-size: 13px;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.dt-export {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.dt-export-label {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink-soft);
}

.table-scroll {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 680px;
}

thead th {
  background: var(--forest);
  color: var(--white);
  text-align: left;
  padding: 0;
  font-weight: 500;
}

.sort-btn {
  width: 100%;
  background: none;
  border: none;
  color: inherit;
  text-align: inherit;
  cursor: pointer;
  padding: 12px 14px;
  font-family: var(--font-mono);
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.sort-btn:hover {
  background: var(--forest-deep);
}

.sort-btn:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}

.arrow {
  opacity: 0.8;
  font-size: 10px;
}

.filter-row th {
  background: var(--cream-deep);
  padding: 8px;
}

.col-filter {
  width: 100%;
  font-size: 12.5px;
  padding: 7px 9px;
}

tbody td {
  padding: 11px 14px;
  border-top: 1px solid var(--line);
  font-size: 14px;
}

tbody tr:nth-child(even) td {
  background: #fbf9f2;
}

.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

thead th.num .sort-btn {
  justify-content: flex-end;
}

.empty {
  text-align: center;
  color: var(--ink-soft);
  padding: 28px;
}

.dt-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 14px;
}

.range {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--moss);
  margin: 0;
}

.pager {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.pager button {
  border: 1px solid var(--line);
  background: var(--cream);
  color: var(--forest);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}

.pager button:hover:not(:disabled) {
  background: var(--cream-deep);
}

.pager button.current {
  background: var(--forest);
  color: var(--white);
  border-color: var(--forest);
}

.pager button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pager button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}
</style>
