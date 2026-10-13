<script setup>
import NavBar from "./components/NavBar.vue";
import SiteFooter from "./components/SiteFooter.vue";
</script>

<template>
  <a href="#main" class="skip-link">Skip to main content</a>
  <NavBar />
  <main id="main" tabindex="-1">
    <router-view />
  </main>
  <SiteFooter />
</template>
