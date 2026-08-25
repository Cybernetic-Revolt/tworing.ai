import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEngineer } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function RawCallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireEngineer();
  const { id } = await params;
  const call = await prisma.call.findFirst({
    where: { id, orgId: session.orgId },
    select: { id: true, vapiCallId: true, raw: true },
  });
  if (!call) notFound();

  return (
    <div>
      <Link href="/app/engineering" className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline">
        ← Engineering
      </Link>
      <h1 className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Raw end-of-call report
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Vapi call {call.vapiCallId}</p>
      <pre className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs leading-5 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
        {JSON.stringify(call.raw, null, 2)}
      </pre>
    </div>
  );
}
