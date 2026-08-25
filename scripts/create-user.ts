// Create (or reset the password of) a portal user and attach them to an org.
//
//   npm run user -- --email owner@acme.ca --password <pw> --org acme [--role OWNER]
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { MemberRole, PrismaClient } from "../src/generated/prisma/client";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const password = arg("password");
  const slug = arg("org");
  if (!email || !password || !slug) {
    console.error("required: --email, --password, --org");
    process.exit(1);
  }
  const role = (arg("role") ?? "OWNER") as MemberRole;

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const org = await prisma.org.findUnique({ where: { slug } });
  if (!org) {
    console.error(`no org with slug "${slug}"`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  });
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: user.id, orgId: org.id } },
    create: { userId: user.id, orgId: org.id, role },
    update: { role },
  });

  console.log(`user ${email} -> org ${org.slug} as ${role}`);
  await prisma.$disconnect();
}

main();
