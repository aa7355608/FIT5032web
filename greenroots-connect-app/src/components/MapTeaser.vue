<script setup>
defineProps({
  suburbs: { type: Array, default: () => [] },
});
</script>

<template>
  <section id="map" class="map-section">
    <div class="container map-inner">
      <div class="map-copy">
        <p class="eyebrow">Canopy coverage</p>
        <h2>Where we're planting this season</h2>
        <p>
          See every upcoming event on a map, search for a place to find the
          closest ones, and get walking, cycling or driving directions.
        </p>
        <router-link to="/map" class="btn btn-primary map-cta">Open the interactive map</router-link>
        <ul class="suburb-tags">
          <li v-for="s in suburbs" :key="s">{{ s }}</li>
        </ul>
      </div>
    </div>
  </section>

  <section id="about" class="about-section">
    <div class="container about-inner">
      <div>
        <p class="eyebrow">About the program</p>
        <h2>Community-led, council-supported.</h2>
        <p>
          GreenRoots Connect is run by local coordinators who know each site's
          soil, its history and the neighbours who've watched it change. The
          app you're using now exists to make it easier for more people to
          join them &mdash; whichever suburb, whichever Saturday.
        </p>
      </div>
      <dl class="mini-stats">
        <div><dt>Founded</dt><dd>2019</dd></div>
        <div><dt>Volunteer hours (2025)</dt><dd>3,420</dd></div>
        <div><dt>Partner schools</dt><dd>11</dd></div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.map-section {
  padding: 70px 0;
}

.map-inner {
  display: block;
}

.map-cta {
  margin-top: 6px;
  text-decoration: none;
}

.map-copy h2 {
  font-size: clamp(24px, 3vw, 30px);
  max-width: 16ch;
}

.map-copy p {
  color: var(--ink-soft);
  font-size: 14.5px;
  max-width: 42ch;
}

.suburb-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 18px 0 0;
}

.suburb-tags li {
  font-family: var(--font-mono);
  font-size: 12px;
  border: 1px solid var(--line);
  padding: 6px 12px;
  border-radius: 999px;
  color: var(--forest);
  background: var(--white);
}

.about-section {
  background: var(--forest-deep);
  color: var(--cream);
  padding: 70px 0;
}

.about-inner {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 40px;
  align-items: center;
}

.about-section h2 {
  color: var(--cream);
  font-size: clamp(24px, 3vw, 30px);
  max-width: 18ch;
}

.about-section p {
  color: #cfd8cc;
  font-size: 14.5px;
  max-width: 46ch;
}

.mini-stats {
  display: grid;
  gap: 18px;
  margin: 0;
}

.mini-stats > div {
  border-left: 2px solid var(--moss);
  padding-left: 16px;
}

.mini-stats dt {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--moss-light);
}

.mini-stats dd {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: 26px;
  color: var(--white);
}

@media (max-width: 860px) {
  .map-inner,
  .about-inner {
    grid-template-columns: 1fr;
  }
}
</style>
