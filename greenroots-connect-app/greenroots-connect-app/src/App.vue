<script setup>
import NavBar from "./components/NavBar.vue";
import SiteFooter from "./components/SiteFooter.vue";
</script>

<template>
  <NavBar />
  <main>
    <router-view />
  </main>
  <SiteFooter />
</template>
