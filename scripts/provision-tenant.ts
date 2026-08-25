// Provision a tenant: Org + ingest key, optionally a Vapi assistant wired to
// the platform ingest endpoint, optionally a PhoneNumber record.
//
//   npm run provision -- --name "Acme Plumbing" --slug acme \
//     --email owner@acme.ca [--tier ANSWER] [--number +14035551234] \
//     [--assistant <existing-vapi-assistant-id> | --create-assistant]
//
// Deliberately never modifies an existing Vapi assistant: repointing a live
// assistant's server.url cuts n8n out of the loop, which is a manual cutover
// decision.
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Tier } from "../src/generated/prisma/client";
import { createAssistant, platformServerConfig } from "../src/lib/vapi";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const name = arg("name");
  const slug = arg("slug");
  const email = arg("email");
  if (!name || !slug || !email) {
    console.error("required: --name, --slug, --email");
    process.exit(1);
  }
  const tier = (arg("tier") ?? "ANSWER") as Tier;

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  const prisma = new PrismaClient({ adapter });

  const rawKey = `blk_${randomBytes(24).toString("base64url")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const org = await prisma.org.create({
    data: {
      name,
      slug,
      tier,
      notifyEmail: email,
      ingestKeys: { create: { keyHash, label: "vapi-webhook" } },
    },
  });
  console.log(`org created: ${org.id} (${org.slug}, ${org.tier})`);

  let assistantId = arg("assistant");
  if (!assistantId && flag("create-assistant")) {
    const assistant = await createAssistant({
      name: `${name} Receptionist`,
      model: {
        provider: "openai",
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              `You are the phone receptionist for ${name}. ` +
              `Start by disclosing you are an AI assistant and that the call ` +
              `is recorded. Collect the caller's name, phone number, address, ` +
              `what they need done, and how urgent it is. Offer to book an ` +
              `appointment. Be brief and warm; never invent prices.`,
          },
        ],
      },
      analysisPlan: {
        structuredDataPlan: {
          enabled: true,
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              phone: { type: "string" },
              email: { type: "string" },
              job_type: { type: "string" },
              address: { type: "string" },
              urgency: { type: "string" },
              notes: { type: "string" },
            },
          },
        },
      },
      ...platformServerConfig(rawKey),
    });
    assistantId = assistant.id;
    console.log(`vapi assistant created: ${assistantId}`);
  }

  const number = arg("number");
  if (number) {
    await prisma.phoneNumber.create({
      data: {
        orgId: org.id,
        e164: number,
        vapiAssistantId: assistantId,
      },
    });
    console.log(`phone number recorded: ${number}`);
  }

  console.log("");
  console.log("ingest key (shown once, store it now):");
  console.log(`  ${rawKey}`);
  console.log(
    "use as X-Bilco-Ingest-Key (n8n forwarding) or assistant server.secret (Vapi direct)",
  );

  await prisma.$disconnect();
}

main();
