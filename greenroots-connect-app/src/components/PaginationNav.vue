<script setup>
import { computed } from "vue";

// Accessible pagination bar. Renders nothing when everything fits on one page.
// Use with v-model:page — e.g. <PaginationNav v-model:page="page" :pages="pages" label="Events" />
const props = defineProps({
  page: { type: Number, required: true },
  pages: { type: Number, required: true },
  label: { type: String, default: "Results" },
});
const emit = defineEmits(["update:page"]);

// A window of up to 5 page numbers around the current page.
const numbers = computed(() => {
  const span = 5;
  let start = Math.max(1, props.page - Math.floor(span / 2));
  const end = Math.min(props.pages, start + span - 1);
  start = Math.max(1, end - span + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
});

function go(n) {
  emit("update:page", Math.min(Math.max(1, n), props.pages));
}
</script>

<template>
  <nav v-if="pages > 1" class="pager" :aria-label="`${label} pagination`">
    <button type="button" :disabled="page <= 1" @click="go(page - 1)">Previous</button>
    <button
      v-for="n in numbers"
      :key="n"
      type="button"
      :class="{ current: n === page }"
      :aria-current="n === page ? 'page' : undefined"
      :aria-label="`Page ${n}`"
      @click="go(n)"
    >
      {{ n }}
    </button>
    <button type="button" :disabled="page >= pages" @click="go(page + 1)">Next</button>
  </nav>
</template>

<style scoped>
.pager {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 22px;
}

.pager button {
  border: 1px solid var(--control-border);
  background: var(--white);
  color: var(--forest);
  border-radius: 6px;
  padding: 8px 14px;
  font-size: 14px;
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
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
