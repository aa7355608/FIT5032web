<script setup>
defineProps({
  eventCount: { type: Number, default: 0 },
  treesTotal: { type: Number, default: 0 },
  suburbCount: { type: Number, default: 0 },
});
</script>

<template>
  <section id="top" class="hero">
    <div class="hero-inner container">
      <div class="hero-copy">
        <p class="eyebrow">Melbourne &middot; Urban Greening &amp; Biodiversity</p>
        <h1>
          Every planting day<br />
          adds another ring.
        </h1>
        <p class="lede">
          GreenRoots Connect helps residents across Melbourne's west find local
          tree-planting and greening events, see who else is going, and track the
          canopy they've helped grow &mdash; one Saturday at a time.
        </p>
        <div class="hero-actions">
          <a href="#events" class="btn btn-primary">Find an event</a>
          <a href="#volunteer" class="btn btn-ghost">Register as a volunteer</a>
        </div>
      </div>

      <div class="hero-stats" role="group" aria-label="Live program statistics">
        <div class="ring-stat">
          <svg viewBox="0 0 120 120" width="96" height="96" aria-hidden="true">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#e4dfcc" stroke-width="8" />
            <circle cx="60" cy="60" r="40" fill="none" stroke="#d7cfae" stroke-width="6" />
            <circle cx="60" cy="60" r="28" fill="none" stroke="var(--moss)" stroke-width="5" />
          </svg>
          <div class="ring-stat-text">
            <strong>{{ eventCount }}</strong>
            <span>events fetched live</span>
          </div>
        </div>
        <dl class="stat-list">
          <div>
            <dt>Trees committed</dt>
            <dd>{{ treesTotal.toLocaleString() }}+</dd>
          </div>
          <div>
            <dt>Suburbs active</dt>
            <dd>{{ suburbCount }}</dd>
          </div>
        </dl>
      </div>
    </div>
    <svg class="root-line" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0,40 C 240,90 380,0 620,36 S 1040,86 1440,20"
        fill="none"
        stroke="var(--moss)"
        stroke-width="2"
        stroke-dasharray="1 9"
        stroke-linecap="round"
      />
    </svg>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  padding: 64px 0 40px;
  overflow: hidden;
}

.hero-inner {
  display: grid;
  grid-template-columns: 1.3fr 0.9fr;
  gap: 48px;
  align-items: center;
}

h1 {
  font-size: clamp(34px, 4.6vw, 56px);
  font-weight: 600;
  margin-top: 10px;
}

.lede {
  font-size: 17px;
  color: var(--ink-soft);
  max-width: 46ch;
  margin-top: 18px;
}

.hero-actions {
  display: flex;
  gap: 14px;
  margin-top: 28px;
  flex-wrap: wrap;
}

.hero-stats {
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 28px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.ring-stat {
  display: flex;
  align-items: center;
  gap: 18px;
}

.ring-stat-text {
  display: flex;
  flex-direction: column;
}

.ring-stat-text strong {
  font-family: var(--font-display);
  font-size: 32px;
  color: var(--forest-deep);
  line-height: 1;
}

.ring-stat-text span {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--moss);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-top: 6px;
}

.stat-list {
  margin: 0;
  border-top: 1px solid var(--line);
  padding-top: 18px;
  display: flex;
  justify-content: space-between;
}

.stat-list dt {
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
}

.stat-list dd {
  margin: 4px 0 0;
  font-family: var(--font-display);
  font-size: 22px;
  color: var(--forest-deep);
}

.root-line {
  display: block;
  width: 100%;
  height: 60px;
  margin-top: 20px;
}

@media (max-width: 860px) {
  .hero-inner {
    grid-template-columns: 1fr;
  }
}
</style>
