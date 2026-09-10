import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "../composables/useAuth.js";

const routes = [
  {
    path: "/",
    name: "home",
    component: () => import("../views/HomeView.vue"),
  },
  {
    path: "/login",
    name: "auth",
    component: () => import("../views/AuthView.vue"),
    meta: { guestOnly: true },
  },
  {
    path: "/coordinator",
    name: "coordinator",
    component: () => import("../views/CoordinatorView.vue"),
    meta: { requiresAuth: true, role: "coordinator" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: "smooth" };
    return { top: 0 };
  },
});

// Role-based route guard (BR C.2): a route flagged `requiresAuth` needs any
// logged-in user; a route flagged with a specific `role` is only reachable
// by a user holding that role. Anyone else is redirected — the Coordinator
// Portal simply does not exist for a Volunteer-role account, even if they
// type the URL directly.
router.beforeEach((to) => {
  const { isLoggedIn, isCoordinator } = useAuth();

  if (to.meta.guestOnly && isLoggedIn.value) {
    return { name: "home" };
  }

  if (to.meta.requiresAuth && !isLoggedIn.value) {
    return { name: "auth", query: { redirect: to.fullPath } };
  }

  if (to.meta.role === "coordinator" && !isCoordinator.value) {
    return { name: "home" };
  }

  return true;
});

export default router;
