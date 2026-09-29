/**
 * The rule that decides whether a client's phone still answers.
 *
 * Run: npm test
 *
 * Every case here is a real account state. The ones that matter most are the two that must
 * NOT stop the line: a paying client over their minutes, and any error in the check itself.
 * Cutting off a paying plumber's phone is how you lose the plumber.
 */
import assert from "node:assert/strict";
import {
  TRIAL_MINUTES,
  entitlementFor,
  monthStart,
  trialEndedGreeting,
} from "../src/lib/entitlement";

const results: { name: string; ok: boolean }[] = [];
const t = (name: string, fn: () => void) => {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    console.error(`\n  ${name}\n   `, (e as Error).message.split("\n")[0]);
    results.push({ name, ok: false });
  }
};

const NOW = new Date("2026-09-29T12:00:00Z");
const sub = (status: string) => ({ status });
const DAY = 86_400_000;
/** Defaults describe a hand-provisioned org: no trial marker, not a demo, no subscription. */
const call = (over: Partial<Parameters<typeof entitlementFor>[0]> = {}) =>
  entitlementFor({
    trialEndsAt: null,
    isDemoOrg: false,
    subscription: null,
    tier: "ANSWER",
    usedMinutes: 0,
    now: NOW,
    ...over,
  });

// --- the regression that would have taken production down --------------------------------

t("a hand-provisioned org with NO subscription and heavy use keeps answering", () => {
  // bilco's own org: no Stripe row, 65 minutes used, six live numbers. The first version of
  // this rule read "no subscription" as "trial" and would have stopped all six.
  assert.deepEqual(call({ usedMinutes: 65 }), { state: "ok" });
});

t("a demo org is never stopped", () => {
  assert.deepEqual(
    call({ isDemoOrg: true, usedMinutes: 99999, trialEndsAt: new Date(NOW.getTime() - DAY) }),
    { state: "ok" },
  );
});

// --- paying accounts are never stopped ---------------------------------------------------

t("an active client under their cap is fine", () => {
  assert.deepEqual(call({ subscription: sub("ACTIVE"), usedMinutes: 100 }), { state: "ok" });
});

t("an active client OVER their cap keeps answering, flagged not stopped", () => {
  const e = call({ subscription: sub("ACTIVE"), usedMinutes: 500 });
  assert.equal(e.state, "over_soft");
});

t("past due keeps answering — billing is not the caller's problem", () => {
  assert.equal(call({ subscription: sub("PAST_DUE"), usedMinutes: 500 }).state, "over_soft");
});

t("paying outranks a lapsed trial marker", () => {
  // Signed up self-serve, then paid. The trial window lapsing must not stop them.
  assert.equal(
    call({
      subscription: sub("ACTIVE"),
      trialEndsAt: new Date(NOW.getTime() - 30 * DAY),
      usedMinutes: 10,
    }).state,
    "ok",
  );
});

t("CUSTOM tier has no cap and never trips the soft limit", () => {
  assert.equal(call({ subscription: sub("ACTIVE"), tier: "CUSTOM", usedMinutes: 99999 }).state, "ok");
});

// --- self-serve trials stop, because we are paying for them --------------------------------

const trial = (over = {}) => call({ trialEndsAt: new Date(NOW.getTime() + 7 * DAY), ...over });

t("a fresh self-serve trial answers", () => {
  assert.deepEqual(trial({ usedMinutes: 5 }), { state: "ok" });
});

t("a trial that burns its minutes stops", () => {
  const e = trial({ usedMinutes: TRIAL_MINUTES });
  assert.equal(e.state, "trial_ended");
  assert.equal(e.state === "trial_ended" && e.reason, "minutes");
});

t("one minute short of the trial cap still answers", () => {
  assert.equal(trial({ usedMinutes: TRIAL_MINUTES - 1 }).state, "ok");
});

t("a trial past its end date stops even with minutes left", () => {
  const e = call({ trialEndsAt: new Date(NOW.getTime() - DAY), usedMinutes: 0 });
  assert.equal(e.state, "trial_ended");
  assert.equal(e.state === "trial_ended" && e.reason, "expired");
});

t("a trial ending later today still answers", () => {
  assert.equal(call({ trialEndsAt: new Date(NOW.getTime() + 3600_000) }).state, "ok");
});

t("a cancelled trial stops", () => {
  assert.equal(
    call({ subscription: sub("CANCELED"), trialEndsAt: new Date(NOW.getTime() + 7 * DAY) }).state,
    "trial_ended",
  );
});

t("a cancelled HAND-PROVISIONED org is not silenced by this rule", () => {
  // Deliberate: stopping a managed client's phone is a decision for a person, not a webhook.
  assert.equal(call({ subscription: sub("CANCELED") }).state, "ok");
});

// --- the words the caller hears -----------------------------------------------------------

t("the wind-down greeting names the business and does not promise a callback", () => {
  const g = trialEndedGreeting("Acme Plumbing");
  assert.ok(g.includes("Acme Plumbing"));
  assert.ok(!/call you back|leave a message|take a message/i.test(g));
});

// --- usage windows -------------------------------------------------------------------------

t("the managed window starts at the org's own local month, not UTC", () => {
  const ms = monthStart("America/Edmonton", new Date("2026-09-15T12:00:00Z"));
  assert.equal(ms.toISOString(), "2026-09-01T06:00:00.000Z");
});

const pass = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
