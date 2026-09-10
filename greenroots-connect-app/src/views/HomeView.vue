<script setup>
import { ref } from "vue";
import HeroSection from "../components/HeroSection.vue";
import EventList from "../components/EventList.vue";
import MapTeaser from "../components/MapTeaser.vue";
import VolunteerForm from "../components/VolunteerForm.vue";
import { useEvents } from "../composables/useEvents.js";
import { useAuth } from "../composables/useAuth.js";

const { publishedEvents, isLoading, savedIds, suburbs, treesTotal, toggleSaved, submitRating, hasUserRated } =
  useEvents();
const { currentUser, isLoggedIn } = useAuth();

const preselectedEventId = ref("");
const ratingNotice = ref("");

function handleSelectEvent(event) {
  preselectedEventId.value = event.id;
  document.getElementById("volunteer")?.scrollIntoView({ behavior: "smooth" });
}

function handleRate({ eventId, value }) {
  const result = submitRating(eventId, value, currentUser.value?.id);
  ratingNotice.value = result.ok ? "Thanks — your rating has been added." : result.reason;
  setTimeout(() => (ratingNotice.value = ""), 3500);
}
</script>

<template>
  <HeroSection :event-count="publishedEvents.length" :trees-total="treesTotal" :suburb-count="suburbs.length" />

    <div v-if="ratingNotice" class="rating-toast container" role="status">{{ ratingNotice }}</div>

    <EventList
      :events="publishedEvents"
      :is-loading="isLoading"
      :saved-ids="savedIds"
      :suburbs="suburbs"
      :is-logged-in="isLoggedIn"
      :current-user-id="currentUser?.id"
      :has-user-rated="hasUserRated"
      @toggle-save="toggleSaved"
      @select="handleSelectEvent"
      @rate="handleRate"
    />
    <MapTeaser :suburbs="suburbs" />
    <VolunteerForm :events="publishedEvents" :preselected-event-id="preselectedEventId" />
</template>

<style scoped>
.rating-toast {
  max-width: 1180px;
  margin: 0 auto;
  padding: 10px 24px;
  color: var(--moss);
  font-family: var(--font-mono);
  font-size: 12.5px;
}
</style>
