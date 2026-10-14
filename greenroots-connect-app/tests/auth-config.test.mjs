import test from "node:test";
import assert from "node:assert/strict";
import { normalisePersistence, AUTH_PERSISTENCE } from "../src/authConfig.js";

test("login is not remembered unless explicitly configured", () => {
  assert.equal(normalisePersistence(undefined), "none");
  assert.equal(normalisePersistence(""), "none");
  assert.equal(normalisePersistence("anything-else"), "none");
  assert.equal(AUTH_PERSISTENCE, "none"); // no env var in the test run
});

test("tab and browser can be chosen explicitly (case-insensitive)", () => {
  assert.equal(normalisePersistence("tab"), "tab");
  assert.equal(normalisePersistence(" Browser "), "browser");
});
