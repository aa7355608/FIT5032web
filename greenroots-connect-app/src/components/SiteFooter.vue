<script setup>
const year = new Date().getFullYear();
</script>

<template>
  <footer class="footer">
    <div class="container footer-inner">
      <p class="brand-line">GreenRoots Connect</p>
      <p class="fine-print">
        Prototype web application &middot; built with Vue 3 (Composition API) for
        FIT5120/FIT5122 &middot; &copy; {{ year }}
      </p>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  padding: 32px 0;
  border-top: 1px solid var(--line);
}

.footer-inner {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.brand-line {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--forest-deep);
  margin: 0;
}

.fine-print {
  font-size: 12.5px;
  color: var(--ink-soft);
  margin: 0;
}
</style>
