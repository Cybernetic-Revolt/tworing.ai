// Seed (or refresh) the public demo org shown by the "View live demo" button.
//
//   npm run seed:demo
//
// All data here is SYNTHETIC — a fictional Calgary plumbing/HVAC company.
// The demo org is isolated so prospects never see a real tenant's calls.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CallStatus,
  LeadStatus,
  MemberRole,
  PrismaClient,
  Tier,
} from "../src/generated/prisma/client";

const DEMO_ORG_SLUG = "demo";
const DEMO_USER_EMAIL = "demo@tworing.app";

function ago(days: number, hours = 0, minutes = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours, d.getMinutes() - minutes, 0, 0);
  return d;
}

type Seed = {
  vapiCallId: string;
  callerName: string;
  callerNumber: string;
  startedAt: Date;
  durationSec: number;
  endedReason: string;
  summary: string;
  transcript: string;
  lead?: {
    jobType: string;
    address: string;
    urgency: string;
    email?: string;
    status: LeadStatus;
    notes?: string;
  };
};

const CALLS: Seed[] = [
  {
    vapiCallId: "demo-001",
    callerName: "Karen Whitfield",
    callerNumber: "+14035550182",
    startedAt: ago(0, 2, 14),
    durationSec: 142,
    endedReason: "customer-ended-call",
    summary:
      "Burst pipe under the kitchen sink, water actively leaking. Flagged URGENT and asked for a same-day visit. Booked for this afternoon.",
    transcript:
      "AI: Thanks for calling Foothills Plumbing & Heating, this is the automated assistant — calls are recorded. How can I help?\n" +
      "Caller: Hi, I've got water pouring out from under my kitchen sink, it won't stop.\n" +
      "AI: I'm sorry to hear that. Have you been able to shut off the water at the valve under the sink or the main?\n" +
      "Caller: I turned the little valve under the sink, it slowed down but it's still dripping.\n" +
      "AI: Good — that will hold it for now. Can I get your name and the service address?\n" +
      "Caller: Karen Whitfield, 88 Sienna Park Green Southwest.\n" +
      "AI: Got it. This is urgent, so I'll get a technician out today. Best callback number?\n" +
      "Caller: This one is fine.\n" +
      "AI: Perfect, you're on the schedule for this afternoon and the office will text a window shortly. Anything else?\n" +
      "Caller: No, thank you so much.",
    lead: {
      jobType: "Burst pipe / leak repair",
      address: "88 Sienna Park Green SW, Calgary",
      urgency: "Urgent — same day",
      status: LeadStatus.BOOKED,
      notes: "Shutoff valve holding. Bring 1/2\" supply lines.",
    },
  },
  {
    vapiCallId: "demo-002",
    callerName: "Devon Marsh",
    callerNumber: "+14035550147",
    startedAt: ago(0, 5, 2),
    durationSec: 98,
    endedReason: "customer-ended-call",
    summary:
      "Furnace not producing heat overnight, no error code visible. Wants a diagnostic. Quoted the $129 diagnostic fee, caller wants to confirm with spouse.",
    transcript:
      "AI: Foothills Plumbing & Heating, automated assistant speaking, this call is recorded. What can I do for you?\n" +
      "Caller: Our furnace ran all night but the house is freezing, it's blowing cold air.\n" +
      "AI: Understood. Is the thermostat set to heat and calling for a temperature above the current room temp?\n" +
      "Caller: Yeah, it's set to 21 and the house is at 16.\n" +
      "AI: Okay. A technician will need to diagnose it on-site — our diagnostic visit is $129, applied to the repair if you proceed. Shall I book it?\n" +
      "Caller: Let me check with my wife and call back.\n" +
      "AI: No problem. I'll note your details so it's quick when you call back.",
    lead: {
      jobType: "Furnace — no heat",
      address: "Coventry Hills, Calgary",
      urgency: "High — heating out",
      status: LeadStatus.QUOTED,
      notes: "Quoted $129 diagnostic. Awaiting callback.",
    },
  },
  {
    vapiCallId: "demo-003",
    callerName: "Priya Anand",
    callerNumber: "+14035550199",
    startedAt: ago(1, 3, 40),
    durationSec: 121,
    endedReason: "customer-ended-call",
    summary:
      "Annual furnace + hot water tank maintenance for a rental property. Flexible on timing. Booked for next week.",
    transcript:
      "AI: Thanks for calling Foothills Plumbing & Heating, this call is recorded. How can I help?\n" +
      "Caller: I'd like to book the yearly furnace tune-up, and can you look at the hot water tank while you're there?\n" +
      "AI: Absolutely, we can do both in one visit. Is this for your home or a rental?\n" +
      "Caller: It's a rental, the tenants are home most mornings.\n" +
      "AI: Great — what's the address and a good contact number for the tenants?\n" +
      "Caller: 215 Auburn Bay Avenue Southeast, tenants' number is best, I'll text it to your office.\n" +
      "AI: Perfect, I'll book a morning next week and the office will confirm the day. Anything else?\n" +
      "Caller: That's everything, thanks.",
    lead: {
      jobType: "Maintenance — furnace + water tank",
      address: "215 Auburn Bay Ave SE, Calgary",
      urgency: "Routine",
      email: "priya.anand@example.com",
      status: LeadStatus.BOOKED,
      notes: "Rental. Coordinate AM access with tenants.",
    },
  },
  {
    vapiCallId: "demo-004",
    callerName: "Unknown",
    callerNumber: "+14035550111",
    startedAt: ago(1, 6, 18),
    durationSec: 36,
    endedReason: "customer-ended-call",
    summary:
      "Caller asked whether the company services Airdrie. Confirmed yes with a travel surcharge; caller said they'd call back to book.",
    transcript:
      "AI: Foothills Plumbing & Heating, recorded line, how can I help?\n" +
      "Caller: Do you guys come out to Airdrie?\n" +
      "AI: We do — Airdrie has a small travel surcharge added to the service call. Would you like to book something?\n" +
      "Caller: Not yet, just checking. I'll call back.\n" +
      "AI: Sounds good, we're here 24/7.",
    lead: {
      jobType: "General inquiry — service area",
      address: "Airdrie",
      urgency: "Low",
      status: LeadStatus.NEW,
      notes: "Price-shopping Airdrie coverage.",
    },
  },
  {
    vapiCallId: "demo-005",
    callerName: "Marcus Lee",
    callerNumber: "+14035550173",
    startedAt: ago(2, 1, 5),
    durationSec: 167,
    endedReason: "customer-ended-call",
    summary:
      "Clogged main drain backing up into basement floor drain. Urgent. Booked emergency visit and advised to stop running water.",
    transcript:
      "AI: Foothills Plumbing & Heating, automated and recorded, what's going on?\n" +
      "Caller: My basement floor drain is backing up, there's sewage smell, it's bad.\n" +
      "AI: That sounds like a main line backup. Please stop running any water — no laundry, dishwasher, or showers until we clear it. Can I get your address?\n" +
      "Caller: 47 Tuscany Ravine Road Northwest.\n" +
      "AI: Thank you. This is an emergency call-out; a technician with a drain machine will be dispatched. Best number to reach you?\n" +
      "Caller: This number.\n" +
      "AI: You're booked for an emergency visit and the office will call with an ETA. Keep water use to zero until then.",
    lead: {
      jobType: "Main drain backup",
      address: "47 Tuscany Ravine Rd NW, Calgary",
      urgency: "Emergency",
      status: LeadStatus.DONE,
      notes: "Cleared 18m of main line. Roots — recommended camera inspection.",
    },
  },
  {
    vapiCallId: "demo-006",
    callerName: "Sandra Okafor",
    callerNumber: "+14035550120",
    startedAt: ago(3, 4, 22),
    durationSec: 84,
    endedReason: "customer-ended-call",
    summary:
      "Dripping bathroom faucet and a running toilet. Non-urgent. Wants a quote before booking.",
    transcript:
      "AI: Thanks for calling Foothills Plumbing & Heating, recorded line. How can I help?\n" +
      "Caller: My ensuite faucet drips and the toilet keeps running. Not an emergency.\n" +
      "AI: No problem. Those are common fixes — a technician can usually handle both in one visit. Would you like a quote or to book directly?\n" +
      "Caller: A quote first, please.\n" +
      "AI: I'll have the office send an estimate. What's the best email and your address?\n" +
      "Caller: sandra dot okafor at example dot com, 12 Evanston Hill Northwest.\n" +
      "AI: Got it, you'll have an estimate today.",
    lead: {
      jobType: "Faucet drip + running toilet",
      address: "12 Evanston Hill NW, Calgary",
      urgency: "Routine",
      email: "sandra.okafor@example.com",
      status: LeadStatus.CONTACTED,
      notes: "Estimate emailed. Follow up in 2 days.",
    },
  },
  {
    vapiCallId: "demo-007",
    callerName: "Telemarketer",
    callerNumber: "+18005550100",
    startedAt: ago(3, 7, 50),
    durationSec: 19,
    endedReason: "assistant-ended-call",
    summary:
      "Spam / solicitation call offering merchant services. No service request. Assistant ended the call.",
    transcript:
      "AI: Foothills Plumbing & Heating, recorded line, how can I help?\n" +
      "Caller: Hi, I'm calling about lowering your credit card processing fees—\n" +
      "AI: Thanks, but we're not interested in solicitations on this line. Have a good day.",
  },
  {
    vapiCallId: "demo-008",
    callerName: "Greg Halvorsen",
    callerNumber: "+14035550166",
    startedAt: ago(4, 2, 11),
    durationSec: 110,
    endedReason: "customer-ended-call",
    summary:
      "Wants a quote to replace a 15-year-old hot water tank with a tankless unit. Booked an in-home estimate.",
    transcript:
      "AI: Foothills Plumbing & Heating, automated and recorded. What can I do for you?\n" +
      "Caller: My hot water tank is 15 years old, I'm thinking of going tankless. Can someone quote it?\n" +
      "AI: Definitely — tankless conversions need an on-site look at venting and gas supply, so we do a free in-home estimate. Address and best time?\n" +
      "Caller: 9 Cougar Ridge Court Southwest, evenings are best.\n" +
      "AI: Perfect, I'll book an early-evening estimate and the office will confirm. Anything else?\n" +
      "Caller: Nope, thanks.",
    lead: {
      jobType: "Tankless water heater — estimate",
      address: "9 Cougar Ridge Ct SW, Calgary",
      urgency: "Routine",
      status: LeadStatus.QUOTED,
      notes: "Evening estimate booked. Check gas line sizing.",
    },
  },
];

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const org = await prisma.org.upsert({
    where: { slug: DEMO_ORG_SLUG },
    create: {
      slug: DEMO_ORG_SLUG,
      name: "Foothills Plumbing & Heating (Demo)",
      tier: Tier.OFFICE,
      timezone: "America/Edmonton",
      notifyEmail: DEMO_USER_EMAIL,
    },
    update: { name: "Foothills Plumbing & Heating (Demo)", tier: Tier.OFFICE },
  });

  // Demo user has no password — it can only be reached via the demo button,
  // never the password form (login() requires passwordHash != null).
  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    create: { email: DEMO_USER_EMAIL, name: "Demo User", passwordHash: null },
    update: { name: "Demo User" },
  });
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    create: { userId: user.id, orgId: org.id, role: MemberRole.OWNER },
    update: { role: MemberRole.OWNER },
  });

  // Idempotent refresh: clear prior demo calls/leads, then recreate.
  await prisma.lead.deleteMany({ where: { orgId: org.id } });
  await prisma.call.deleteMany({ where: { orgId: org.id } });

  const phone = await prisma.phoneNumber.upsert({
    where: { e164: "+14035559000" },
    create: {
      orgId: org.id,
      e164: "+14035559000",
      label: "Demo main line",
      provider: "demo",
    },
    update: { orgId: org.id },
  });

  for (const c of CALLS) {
    const endedAt = new Date(c.startedAt.getTime() + c.durationSec * 1000);
    const call = await prisma.call.create({
      data: {
        orgId: org.id,
        phoneNumberId: phone.id,
        vapiCallId: c.vapiCallId,
        callerName: c.callerName,
        callerNumber: c.callerNumber,
        status: CallStatus.COMPLETED,
        endedReason: c.endedReason,
        startedAt: c.startedAt,
        endedAt,
        durationSec: c.durationSec,
        summary: c.summary,
        transcript: c.transcript,
      },
    });
    if (c.lead) {
      const lead = await prisma.lead.upsert({
        where: { orgId_phone: { orgId: org.id, phone: c.callerNumber } },
        update: {},
        create: {
          orgId: org.id,
          name: c.callerName === "Unknown" ? null : c.callerName,
          phone: c.callerNumber,
          email: c.lead.email,
          jobType: c.lead.jobType,
          address: c.lead.address,
          urgency: c.lead.urgency,
          status: c.lead.status,
          notes: c.lead.notes,
          createdAt: c.startedAt,
        },
      });
      await prisma.call.update({
        where: { id: call.id },
        data: { leadId: lead.id },
      });
    }
  }

  console.log(
    `seeded demo org "${org.slug}" (${org.name}) with ${CALLS.length} calls`,
  );
  await prisma.$disconnect();
}

main();
