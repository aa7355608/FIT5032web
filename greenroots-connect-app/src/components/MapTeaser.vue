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
          Every marker below represents an active or recently completed
          GreenRoots Connect event, drawn live from the same event data
          powering the list above.
        </p>
        <ul class="suburb-tags">
          <li v-for="s in suburbs" :key="s">{{ s }}</li>
        </ul>
      </div>
      <div class="map-visual" role="img" aria-label="Illustrative map of participating Melbourne suburbs">
        <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">
          <rect x="0" y="0" width="400" height="300" rx="16" fill="#eef0e2" />
          <g stroke="#c9d2b8" stroke-width="1">
            <line x1="0" y1="60" x2="400" y2="60" />
            <line x1="0" y1="120" x2="400" y2="120" />
            <line x1="0" y1="180" x2="400" y2="180" />
            <line x1="0" y1="240" x2="400" y2="240" />
            <line x1="80" y1="0" x2="80" y2="300" />
            <line x1="160" y1="0" x2="160" y2="300" />
            <line x1="240" y1="0" x2="240" y2="300" />
            <line x1="320" y1="0" x2="320" y2="300" />
          </g>
          <g fill="var(--moss)">
            <circle cx="90" cy="90" r="7" />
            <circle cx="180" cy="150" r="7" />
            <circle cx="260" cy="80" r="7" />
            <circle cx="140" cy="220" r="7" />
            <circle cx="320" cy="190" r="7" />
            <circle cx="230" cy="240" r="7" />
          </g>
        </svg>
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
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 48px;
  align-items: center;
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

.map-visual {
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
}

.map-visual svg {
  display: block;
  width: 100%;
  height: auto;
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
