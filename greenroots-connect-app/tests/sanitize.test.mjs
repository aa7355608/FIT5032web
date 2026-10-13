import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeText, normalizeEmail } from "../src/utils/sanitize.js";

test("script tags are stripped", () => {
  const out = sanitizeText("<script>window.__xss=true</script>Mallory");
  assert.ok(!out.includes("<") && !out.includes(">"));
  assert.ok(out.endsWith("Mallory"));
});

test("inline event handlers and javascript: URLs are removed", () => {
  assert.ok(!/onerror\s*=/i.test(sanitizeText('<img src=x onerror=alert(1)>hi')));
  assert.ok(!/javascript:/i.test(sanitizeText("javascript:alert(1)")));
});

test("length is capped and non-strings are rejected", () => {
  assert.equal(sanitizeText("a".repeat(500), { maxLength: 80 }).length, 80);
  assert.equal(sanitizeText(null), "");
});

test("emails are trimmed and lower-cased", () => {
  assert.equal(normalizeEmail("  Priya@Example.COM "), "priya@example.com");
});
