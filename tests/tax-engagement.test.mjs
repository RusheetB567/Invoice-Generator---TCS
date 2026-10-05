import test from "node:test";
import assert from "node:assert/strict";
import { completeEntry, engagementKey, readEngagement, startVisit, INSIGHT_COUNT } from "../lib/tax/engagement.ts";
test("suggestions unlock after three completed entries and stay fixed within a visit", () => {
  let visit = startVisit(readEngagement(null));
  assert.equal(visit.insight, null);
  for (let entry = 1; entry <= 2; entry++) {
    visit = completeEntry(visit);
    assert.equal(visit.insight, null);
    assert.equal(startVisit(visit.engagement).insight, null);
  }
  visit = completeEntry(visit);
  assert.equal(visit.insight, 0);
  for (let entry = 0; entry < 8; entry++) {
    visit = completeEntry(visit);
    assert.equal(visit.insight, 0, "editing income must not cycle through a stream of tips");
  }
  assert.equal(startVisit(visit.engagement).insight, 1);
});
test("reload rotates exactly one suggestion and wraps without resetting eligibility", () => {
  let state = { version: 1, entries: 3, nextInsight: 0 };
  for (let index = 0; index < INSIGHT_COUNT * 3; index++) {
    const visit = startVisit(readEngagement(JSON.stringify(state)));
    assert.equal(visit.insight, index % INSIGHT_COUNT);
    assert.equal(visit.engagement.entries, 3);
    state = visit.engagement;
  }
});
test("engagement metadata is isolated by account and workspace", () => {
  assert.notEqual(engagementKey("user-a", "space-a"), engagementKey("user-b", "space-a"));
  assert.notEqual(engagementKey("user-a", "space-a"), engagementKey("user-a", "space-b"));
  assert.notEqual(engagementKey("a:b", "c"), engagementKey("a", "b:c"));
});
test("malformed or incompatible engagement data starts with a quiet calculator", () => {
  const invalid = [null, "broken", "null", "[]", "42", '{"version":2,"entries":3,"nextInsight":0}', '{"version":1,"entries":-1,"nextInsight":0}', '{"version":1,"entries":3.5,"nextInsight":0}', '{"version":1,"entries":3,"nextInsight":5}', '{"version":1,"entries":10001,"nextInsight":0}'];
  for (const raw of invalid) assert.deepEqual(startVisit(readEngagement(raw)), { engagement: { version: 1, entries: 0, nextInsight: 0 }, insight: null });
});
test("persisted metadata strips financial values and keeps the counter bounded", () => {
  const state = readEngagement(JSON.stringify({ version: 1, entries: 10000, nextInsight: 4, income: "90000", history: [80000], email: "private@example.test" }));
  assert.deepEqual(state, { version: 1, entries: 10000, nextInsight: 4 });
  assert.equal(completeEntry(startVisit(state)).engagement.entries, 10000);
  assert.deepEqual(Object.keys(state).sort(), ["entries", "nextInsight", "version"]);
});
