/**
 * The trial provisioner's decisions, tested without a database.
 *
 * The validator check is the important one. The first version of the prompt read well and
 * would have produced a receptionist that discusses booking and never calls the tool — every
 * trial client, silently, with customers believing they had appointments.
 */
import assert from "node:assert/strict";
import { validateAssistant, promisedButMissing } from "../src/lib/assistant-validation";
import {
  TRIAL_TOOLS,
  TRIAL_VOICE_ID,
  assistantKeyCandidates,
  slugCandidates,
  trialAssistantCopy,
} from "../src/lib/provision";

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

const draftFor = (business: string, trade?: string | null) => {
  const c = trialAssistantCopy(business, trade);
  return {
    key: "k",
    greeting: c.greeting,
    systemPrompt: c.systemPrompt,
    recordingNotice: c.recordingNotice,
    recordsCall: true,
    announceRecording: true,
    voiceId: TRIAL_VOICE_ID,
    endCallPhrases: [] as string[],
    tools: [...TRIAL_TOOLS],
    transferTo: null,
    endCallMessage: c.endCallMessage,
    transferMessage: null,
    hasPrincipalContact: false,
    status: "PRODUCTION",
  };
};

// --- the assistant a trial actually gets --------------------------------------------------

t("the generated assistant passes the real validator", () => {
  assert.deepEqual(validateAssistant(draftFor("Acme Plumbing", "Plumbing")), []);
});

t("it passes for every trade the form offers, including none", () => {
  for (const trade of ["Plumbing", "HVAC", "Electrical", "Other business", null, ""]) {
    assert.deepEqual(
      validateAssistant(draftFor("Beta Co", trade)),
      [],
      `trade=${JSON.stringify(trade)}`,
    );
  }
});

t("the prompt promises nothing the tools cannot do", () => {
  const c = trialAssistantCopy("Acme Plumbing", "Plumbing");
  assert.deepEqual(promisedButMissing(c.systemPrompt, [...TRIAL_TOOLS]), []);
});

t("the prompt explicitly orders the model to call the booking tool", () => {
  // Without this the model talks about booking and never books. It is the one rule whose
  // absence produces a confident, wrong, silent failure.
  const { systemPrompt } = trialAssistantCopy("Acme", "Plumbing");
  assert.match(systemPrompt, /MUST call book_appointment/);
});

t("a trial is never offered a transfer it cannot perform", () => {
  assert.ok(!TRIAL_TOOLS.includes("transferCall" as never));
  assert.ok(!/transfer|put you through/i.test(trialAssistantCopy("Acme").systemPrompt));
});

t("the greeting names the business and carries the name tag", () => {
  const { greeting } = trialAssistantCopy("Bob's Heating & Air");
  assert.ok(greeting.includes("Bob's Heating & Air"));
  assert.ok(greeting.includes("#NAME#"));
});

t("the recording notice states a purpose, as the OPC asks", () => {
  const { recordingNotice } = trialAssistantCopy("Acme");
  assert.match(recordingNotice, /record/i);
  assert.match(recordingNotice, /accurate|quality|records/i);
});

// --- naming --------------------------------------------------------------------------------

t("a business name becomes a slug a human can say", () => {
  assert.equal(slugCandidates("Bob's Heating & Air")[0], "bob-s-heating-air");
  assert.equal(slugCandidates("  Acme  Plumbing  ")[0], "acme-plumbing");
});

t("an unusable name still yields a slug rather than an empty string", () => {
  assert.equal(slugCandidates("!!!")[0], "client");
  assert.equal(slugCandidates("")[0], "client");
});

t("collisions get readable suffixes, not random noise", () => {
  const c = slugCandidates("Acme");
  assert.deepEqual(c.slice(0, 3), ["acme", "acme-2", "acme-3"]);
  assert.ok(c.length > 10, "enough candidates to survive a run of same-named businesses");
});

t("a very long business name is truncated to a sane slug", () => {
  const s = slugCandidates("A".repeat(200))[0];
  assert.ok(s.length <= 40, `slug was ${s.length} chars`);
});

t("assistant keys follow the slug and stay unique-able", () => {
  assert.deepEqual(assistantKeyCandidates("acme").slice(0, 2), ["acme", "acme-2"]);
});

const pass = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
console.log(`\n${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
