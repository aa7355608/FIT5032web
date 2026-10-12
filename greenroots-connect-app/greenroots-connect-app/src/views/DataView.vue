<script setup>
import DataTable from "../components/DataTable.vue";
import { plantingRecords } from "../data/plantingRecords.js";
import { volunteerActivity } from "../data/volunteerActivity.js";

const plantingColumns = [
  { key: "site", label: "Site" },
  { key: "suburb", label: "Suburb" },
  { key: "species", label: "Species" },
  { key: "treesPlanted", label: "Trees planted", type: "number" },
  { key: "survivalRate", label: "Survival", type: "number", suffix: "%" },
  { key: "datePlanted", label: "Date planted" },
];

const volunteerColumns = [
  { key: "volunteer", label: "Volunteer" },
  { key: "suburb", label: "Suburb" },
  { key: "eventsAttended", label: "Events", type: "number" },
  { key: "hours", label: "Hours", type: "number" },
  { key: "lastActive", label: "Last active" },
  { key: "tier", label: "Tier" },
];
</script>

<template>
  <section class="data-page">
    <div class="container">
      <p class="eyebrow">Impact data</p>
      <h1>What we've planted, and who made it happen</h1>
      <p class="intro">
        Sort any column by clicking its heading, narrow results with the search box under each
        column, or search everything at once. Tables show 10 rows per page.
      </p>

      <DataTable
        table-id="planting"
        title="Planting records"
        description="Every recorded planting, with how many trees survived to the latest check."
        :columns="plantingColumns"
        :rows="plantingRecords"
      />

      <DataTable
        table-id="volunteers"
        title="Volunteer activity"
        description="Events attended and hours contributed (names shortened to first name and initial)."
        :columns="volunteerColumns"
        :rows="volunteerActivity"
      />
    </div>
  </section>
</template>

<style scoped>
.data-page {
  padding: 56px 0 40px;
}

h1 {
  font-size: clamp(26px, 3.4vw, 38px);
  max-width: 24ch;
}

.intro {
  color: var(--ink-soft);
  max-width: 62ch;
  margin-bottom: 32px;
}
</style>
