import { nextTick } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "../composables/useAuth.js";

// The whole site sits behind login: every route requires an account except
// /login itself. `role` additionally restricts a route to one role (BR C.2).
const routes = [
  {
    path: "/",
    name: "home",
    component: () => import("../views/HomeView.vue"),
    meta: { requiresAuth: true, title: "Home" },
  },
  {
    path: "/data",
    name: "data",
    component: () => import("../views/DataView.vue"),
    meta: { requiresAuth: true, title: "Impact data" },
  },
  {
    path: "/map",
    name: "map",
    component: () => import("../views/MapView.vue"),
    meta: { requiresAuth: true, title: "Explore the map" },
  },
  {
    path: "/login",
    name: "auth",
    component: () => import("../views/AuthView.vue"),
    meta: { guestOnly: true, title: "Log in" },
  },
  {
    path: "/coordinator",
    name: "coordinator",
    component: () => import("../views/CoordinatorView.vue"),
    meta: { requiresAuth: true, role: "coordinator", title: "Coordinator portal" },
  },
  { path: "/:pathMatch(.*)*", redirect: { name: "home" } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: "smooth" };
    return { top: 0 };
  },
});

// Runs on every navigation — including typing a URL directly — so access
// control is enforced here, not just by hiding links.
router.beforeEach(async (to) => {
  const { isLoggedIn, isCoordinator, authReady } = useAuth();

  // Wait until the initial sign-in state is restored (Firebase is async),
  // otherwise a refresh would briefly look "logged out" and bounce the user.
  await authReady;

  if (to.meta.guestOnly && isLoggedIn.value) {
    return { name: "home" };
  }

  if (to.meta.requiresAuth && !isLoggedIn.value) {
    const redirect = to.fullPath !== "/" ? { redirect: to.fullPath } : undefined;
    return { name: "auth", query: redirect };
  }

  if (to.meta.role === "coordinator" && !isCoordinator.value) {
    return { name: "home" };
  }

  return true;
});

// Accessibility (WCAG 2.4.2 page titled, 2.4.3 focus order): give every page a
// descriptive title, and move keyboard/screen-reader focus to the main content
// after a navigation (a single-page app doesn't reload, so nothing else would).
router.afterEach((to, from) => {
  document.title = `${to.meta.title || "GreenRoots Connect"} \u2014 GreenRoots Connect`;
  const isFirstLoad = !from.name;
  if (!isFirstLoad && to.path !== from.path) {
    nextTick(() => document.getElementById("main")?.focus({ preventScroll: true }));
  }
});

export default router;
