<script setup>
import { computed, ref, onMounted } from "vue";
import { useEvents } from "../composables/useEvents.js";
import { useAuth } from "../composables/useAuth.js";

const { events, isLoading, setEventStatus, deleteEvent } = useEvents();
const { currentUser, listUsers, updateUserRole } = useAuth();

const users = ref([]);
const usersError = ref("");

async function refreshUsers() {
  try {
    users.value = await listUsers();
    usersError.value = "";
  } catch {
    usersError.value = "Couldn't load users. Check the Firestore rules allow coordinators to read them.";
  }
}

async function handleRoleChange(userId, event) {
  try {
    await updateUserRole(userId, event.target.value);
  } catch {
    usersError.value = "Couldn't change that role.";
  }
  await refreshUsers();
}

onMounted(refreshUsers);

function averageRating(list) {
  if (!list.length) return null;
  return (list.reduce((sum, r) => sum + r, 0) / list.length).toFixed(1);
}

const totalVolunteers = computed(() => users.value.filter((u) => u.role === "volunteer").length);
const totalTrees = computed(() => events.value.reduce((sum, e) => sum + e.spotsTaken * 5, 0));
const overallAverage = computed(() => {
  const all = events.value.flatMap((e) => e.ratings);
  return averageRating(all) ?? "\u2014";
});

function handleDelete(eventId, title) {
  if (confirm(`Delete "${title}"? This cannot be undone.`)) {
    deleteEvent(eventId);
  }
}
</script>

<template>
  <section class="dash">
    <div class="container">
      <header class="dash-head">
        <div>
          <p class="eyebrow">Coordinator Portal</p>
          <h1>Welcome back, {{ currentUser?.name }}</h1>
        </div>
        <span class="role-badge">Role: Coordinator (elevated access &mdash; BR C.2)</span>
      </header>

      <div class="stat-grid">
        <div class="stat-card">
          <strong>{{ events.length }}</strong>
          <span>Total events</span>
        </div>
        <div class="stat-card">
          <strong>{{ totalVolunteers }}</strong>
          <span>Registered volunteers</span>
        </div>
        <div class="stat-card">
          <strong>{{ overallAverage }}</strong>
          <span>Avg. event rating</span>
        </div>
        <div class="stat-card">
          <strong>{{ totalTrees.toLocaleString() }}</strong>
          <span>Trees planted (est.)</span>
        </div>
      </div>

      <h2>Manage Events</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Date</th>
              <th>Registrations</th>
              <th>Avg rating</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in events" :key="e.id">
              <td>{{ e.title }}</td>
              <td>{{ e.date }}</td>
              <td>{{ e.spotsTaken }} / {{ e.spotsTotal }}</td>
              <td>{{ averageRating(e.ratings) ?? "\u2014" }}</td>
              <td>
                <select :value="e.status" @change="setEventStatus(e.id, $event.target.value)">
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </td>
              <td>
                <button class="link-action" type="button" @click="handleDelete(e.id, e.title)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Manage Users &amp; Roles</h2>
      <p v-if="usersError" class="users-error" role="alert">{{ usersError }}</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td>{{ u.name }}</td>
              <td>{{ u.email }}</td>
              <td>
                <select :value="u.role" @change="handleRoleChange(u.id, $event)">
                  <option value="volunteer">Volunteer</option>
                  <option value="coordinator">Coordinator</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="footnote">
        Volunteer-role accounts cannot reach this page &mdash; enforced via a role-based route guard, not just a hidden link (BR C.2).
      </p>
    </div>
  </section>
</template>

<style scoped>
.dash {
  padding: 48px 0 90px;
  min-height: 70vh;
}

.dash-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 28px;
  flex-wrap: wrap;
}

.dash-head h1 {
  font-size: clamp(22px, 3vw, 30px);
}

.role-badge {
  font-family: var(--font-mono);
  font-size: 11.5px;
  background: var(--forest);
  color: var(--white);
  padding: 6px 12px;
  border-radius: 999px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 40px;
}

.stat-card {
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: var(--shadow-card);
}

.stat-card strong {
  font-family: var(--font-display);
  font-size: 28px;
  color: var(--forest-deep);
}

.stat-card span {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-soft);
  text-transform: uppercase;
  margin-top: 6px;
}

h2 {
  font-size: 19px;
  margin: 32px 0 14px;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--white);
  box-shadow: var(--shadow-card);
}

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 560px;
}

th {
  text-align: left;
  font-family: var(--font-mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--white);
  background: var(--forest);
  padding: 12px 16px;
}

td {
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  font-size: 14px;
}

select {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 13px;
  background: var(--cream);
}

.link-action {
  background: none;
  border: none;
  color: var(--error);
  text-decoration: underline;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

.users-error {
  color: var(--error);
  font-size: 13px;
  margin: 0 0 10px;
}

.footnote {
  margin-top: 20px;
  font-size: 12.5px;
  color: var(--ink-soft);
  font-style: italic;
  text-align: center;
}

@media (max-width: 860px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
