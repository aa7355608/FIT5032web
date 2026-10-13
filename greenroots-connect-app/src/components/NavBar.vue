<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth.js";

const isOpen = ref(false);
const router = useRouter();
const { currentUser, isLoggedIn, isCoordinator, logout } = useAuth();

function toggleMenu() {
  isOpen.value = !isOpen.value;
}

function closeMenu() {
  isOpen.value = false;
}

async function handleLogout() {
  await logout();
  closeMenu();
  router.push("/login");
}
</script>

<template>
  <header class="nav">
    <div class="nav-inner container">
      <router-link to="/" class="brand" @click="closeMenu">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M12 2c3 3 5 6 5 9.5A5 5 0 0 1 7 11.5C7 8 9 5 12 2Z" fill="currentColor" />
            <path d="M12 12v10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </span>
        GreenRoots Connect
      </router-link>

      <button
        class="menu-toggle"
        type="button"
        :aria-expanded="isOpen"
        aria-controls="primary-nav"
        @click="toggleMenu"
      >
        <span class="visually-hidden">{{ isOpen ? "Close menu" : "Open menu" }}</span>
        <span class="bar" :class="{ open: isOpen }"></span>
      </button>

      <nav id="primary-nav" class="links" :class="{ open: isOpen }" aria-label="Primary">
        <template v-if="isLoggedIn">
          <router-link to="/#events" @click="closeMenu">Events</router-link>
          <router-link to="/map" @click="closeMenu">Explore Map</router-link>
          <router-link to="/#volunteer" @click="closeMenu">Register interest</router-link>
          <router-link to="/data" @click="closeMenu">Impact data</router-link>
          <router-link v-if="isCoordinator" to="/coordinator" @click="closeMenu">Coordinator Portal</router-link>
        </template>

        <div class="auth-slot">
          <template v-if="isLoggedIn">
            <span class="user-chip">{{ currentUser?.name }} &middot; {{ currentUser?.role }}</span>
            <button type="button" class="btn btn-ghost small" @click="handleLogout">Log out</button>
          </template>
          <router-link v-else to="/login" class="btn btn-primary small" @click="closeMenu">
            Login / Register
          </router-link>
        </div>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(246, 244, 236, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
}

.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 68px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 19px;
  color: var(--forest-deep);
}

.brand-mark {
  display: inline-flex;
  color: var(--moss);
}

.links {
  display: flex;
  align-items: center;
  gap: 28px;
}

.links a {
  text-decoration: none;
  font-size: 14.5px;
  font-weight: 500;
  color: var(--ink-soft);
  position: relative;
  padding: 4px 0;
  white-space: nowrap;
}

.links a:hover {
  color: var(--forest);
}

.links a.router-link-exact-active:not(.btn) {
  color: var(--forest-deep);
  font-weight: 600;
}

.links a::after {
  content: "";
  position: absolute;
  left: 0;
  right: 100%;
  bottom: -2px;
  height: 2px;
  background: var(--ochre);
  transition: right 0.2s ease;
}

.links a:hover::after {
  right: 0;
}

.auth-slot {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 8px;
  padding-left: 20px;
  border-left: 1px solid var(--line);
}

.user-chip {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--forest);
  white-space: nowrap;
}

.btn.small {
  padding: 8px 16px;
  font-size: 13px;
}

/* `.links a` (grey text) would otherwise win over the button's white text */
.links a.btn-primary {
  color: var(--white);
}

.links a.btn-primary::after {
  display: none;
}

.menu-toggle {
  display: none;
  background: none;
  border: none;
  width: 40px;
  height: 40px;
  cursor: pointer;
  position: relative;
}

.bar,
.bar::before,
.bar::after {
  content: "";
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--forest-deep);
  transition: transform 0.2s ease, opacity 0.2s ease, top 0.2s ease;
}

.bar {
  top: 19px;
}

.bar::before {
  top: -7px;
}

.bar::after {
  top: 7px;
}

.bar.open {
  background: transparent;
}

.bar.open::before {
  top: 0;
  transform: rotate(45deg);
}

.bar.open::after {
  top: 0;
  transform: rotate(-45deg);
}

@media (max-width: 1060px) {
  .menu-toggle {
    display: block;
  }

  .links {
    position: absolute;
    top: 68px;
    left: 0;
    right: 0;
    background: var(--white);
    border-bottom: 1px solid var(--line);
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
  }

  .links.open {
    max-height: 420px;
  }

  .links a {
    width: 100%;
    padding: 14px 24px;
    border-bottom: 1px solid var(--line);
  }

  .links a::after {
    display: none;
  }

  .auth-slot {
    width: 100%;
    border-left: none;
    border-top: 1px solid var(--line);
    padding: 14px 24px;
    margin-left: 0;
    justify-content: space-between;
  }
}
</style>
