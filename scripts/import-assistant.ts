/**
 * Import an assistant from switchboard's catalog into the database.
 *
 *   npx tsx scripts/import-assistant.ts <catalog.md> --org <slug> [--principal +1587...]
 *
 * The catalog files are the record of what Vapi actually ran — exported rather than
 * rewritten, defects preserved. This brings one into the product so it can be edited here
 * instead of in a dashboard that is being switched off.
 *
 * Two things it deliberately does NOT carry across:
 *
 *   - Tool names that appear only in prose. Ada's prompt names eleven tools and has none
 *     attached; copying that into `tools` would claim capability the assistant does not
 *     have. The prompt is imported as written and `tools` reflects what is actually wired.
 *   - `[add number]` placeholders. Those become AssistantContact rows or nothing at all —
 *     a placeholder inside a prompt is a caller-identification failure waiting to happen.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type Front = Record<string, string | string[] | number | boolean>;

/** The catalog's frontmatter is TOML-ish: scalars, quoted strings, and string arrays. */
function parseFrontmatter(text: string): { front: Front; body: string } {
  const m = text.match(/^\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\r?\n([\s\S]*)$/);
  if (!m) throw new Error("no +++ frontmatter block found");
  const front: Front = {};
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (val.startsWith("[")) {
      front[key] = [...val.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => x[1]);
    } else if (val.startsWith('"')) {
      front[key] = val.slice(1, -1).replace(/\\"/g, '"');
    } else if (/^-?\d+$/.test(val)) {
      front[key] = Number(val);
    } else {
      front[key] = val;
    }
  }
  return { front, body: m[2].trim() };
}

const STATUS: Record<string, "PRODUCTION" | "TEMPLATE" | "RETIRED"> = {
  production: "PRODUCTION",
  template: "TEMPLATE",
  retired: "RETIRED",
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const file = process.argv[2];
  const orgSlug = arg("org");
  if (!file || !orgSlug) {
    console.error("usage: import-assistant.ts <catalog.md> --org <slug> [--principal +1...]");
    process.exit(64);
  }

  const { front, body } = parseFrontmatter(readFileSync(file, "utf8"));
  const key = String(front.key);
  const org = await prisma.org.findUnique({ where: { slug: orgSlug } });
  if (!org) throw new Error(`no org with slug ${orgSlug}`);

  const s = (k: string): string | null => (front[k] === undefined ? null : String(front[k]));
  const n = (k: string): number | null => (front[k] === undefined ? null : Number(front[k]));
  const a = (k: string): string[] => (Array.isArray(front[k]) ? (front[k] as string[]) : []);

  const data = {
    orgId: org.id,
    key,
    name: String(front.org ?? key),
    status: STATUS[String(front.status ?? "template")] ?? "TEMPLATE",
    greeting: String(front.first_message ?? ""),
    systemPrompt: body,
    // Whatever is actually wired, not what the prose claims.
    tools: a("tools"),
    endCallPhrases: a("end_call_phrases"),
    endCallMessage: s("end_call_message"),
    transferTo: s("transfer_to"),
    transferMessage: s("transfer_message"),
    // null stays null: no limit set is not the same as the default.
    silenceTimeoutSeconds: n("silence_timeout_seconds"),
    maxDurationSeconds: n("max_duration_seconds"),
    vapiAssistantId: s("vapi_assistant_id"),
    vapiModel: s("vapi_model"),
    vapiVoice: s("vapi_voice"),
    notes: s("notes"),
  };

  const assistant = await prisma.assistant.upsert({
    where: { key },
    create: data,
    update: data,
  });
  console.log(`${assistant.status.toLowerCase()} assistant "${key}" -> org ${orgSlug}`);

  const principal = arg("principal");
  if (principal) {
    await prisma.assistantContact.upsert({
      where: { assistantId_e164: { assistantId: assistant.id, e164: principal } },
      create: {
        assistantId: assistant.id,
        e164: principal,
        name: "Billy",
        relation: "PRINCIPAL",
        note: "Recognising this number is what stops the assistant screening its own owner.",
      },
      update: { relation: "PRINCIPAL" },
    });
    console.log(`  principal: ${principal}`);
  }

  // Say plainly what did not come across, rather than letting it look complete.
  const promised = [...body.matchAll(/\b([a-z_]{4,})\(/g)].map((x) => x[1]);
  const named = [...new Set(promised)].filter((t) => t.includes("_") && !data.tools.includes(t));
  if (named.length) {
    console.log(`  ⚠️  prompt names ${named.length} tool(s) that are NOT attached:`);
    console.log(`      ${named.join(", ")}`);
    console.log(`      The assistant will discuss these and silently never do them.`);
  }
  const placeholders = (body.match(/\[(?:add|ADD)[^\]]*\]/g) ?? []).length;
  if (placeholders) {
    console.log(`  ⚠️  ${placeholders} unfilled placeholder(s) remain in the prompt.`);
    console.log(`      Contacts belong in AssistantContact, not in prose.`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
