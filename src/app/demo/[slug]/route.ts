import { startDemoSession } from "@/lib/demo";

// One-click entry into a specific demo company's portal.
// Linked with plain <a> tags only — a Next <Link> would prefetch this
// handler and silently set the demo session cookie.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const ok = await startDemoSession(slug);
  return new Response(null, {
    status: 303,
    headers: { Location: ok ? "/app" : "/demo" },
  });
}
