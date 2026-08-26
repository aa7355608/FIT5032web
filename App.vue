<script setup>
import { ref } from "vue";
import NavBar from "./components/NavBar.vue";
import HeroSection from "./components/HeroSection.vue";
import EventList from "./components/EventList.vue";
import MapTeaser from "./components/MapTeaser.vue";
import VolunteerForm from "./components/VolunteerForm.vue";
import SiteFooter from "./components/SiteFooter.vue";
import { useEvents } from "./composables/useEvents.js";

const { events, isLoading, savedIds, suburbs, treesTotal, toggleSaved } = useEvents();

const preselectedEventId = ref("");

function handleSelectEvent(event) {
  preselectedEventId.value = event.id;
  document.getElementById("volunteer")?.scrollIntoView({ behavior: "smooth" });
}
</script>

<template>
  <NavBar />
  <main>
    <HeroSection :event-count="events.length" :trees-total="treesTotal" :suburb-count="suburbs.length" />
    <EventList
      :events="events"
      :is-loading="isLoading"
      :saved-ids="savedIds"
      :suburbs="suburbs"
      @toggle-save="toggleSaved"
      @select="handleSelectEvent"
    />
    <MapTeaser :suburbs="suburbs" />
    <VolunteerForm :events="events" :preselected-event-id="preselectedEventId" />
  </main>
  <SiteFooter />
</template>
