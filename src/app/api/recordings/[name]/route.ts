import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Serve a call recording to someone entitled to hear it.
 *
 * The recordings bucket blocks public access on all four flags, so the browser cannot fetch
 * the object and no public URL exists to leak. The engine uploads and reports a URL pointing
 * here; this route is the only way in.
 *
 * Authorisation is the point of the route, not a formality. A recording is the most
 * sensitive artifact the product holds — a stranger's voice, their address, sometimes their
 * card number read aloud — so entitlement is proved against the database on every request:
 * the caller must have a session, and the recording must belong to a call in *their* org.
 * Platform staff may hear any of them; that is what being staff means, and it is logged.
 *
 * The unguessable filename is defence in depth, not the control. Naming files after the
 * call id alone made every customer's recording enumerable from one guessed id, whatever
 * fronts them.
 */

const BUCKET = process.env.RECORDINGS_BUCKET ?? "";

// Names come from `_unguessable_name`: "<safe-call-id>-<32 hex>.wav". Anything else is not
// one of ours, and matching strictly keeps traversal and injection out of the S3 key.
const NAME = /^[A-Za-z0-9._-]{1,200}\.wav$/;

let client: S3Client | null = null;
function s3(): S3Client {
  // Credentials come from the instance role; no keys are configured here.
  client ??= new S3Client({});
  return client;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  const session = await getSession();
  // 404 rather than 401 for an anonymous request: whether a given recording exists is
  // itself information, and this endpoint should not answer that for strangers.
  if (!session) return new NextResponse(null, { status: 404 });

  const { name } = await params;
  if (!NAME.test(name)) return new NextResponse(null, { status: 404 });
  if (!BUCKET) {
    console.error("RECORDINGS_BUCKET is not set; cannot serve recordings");
    return new NextResponse(null, { status: 503 });
  }

  // The URL stored on the Call row is the entitlement check. Matching on the suffix rather
  // than reconstructing the URL means a change to the public base (a CDN, a new hostname)
  // does not silently orphan every existing recording.
  const call = await prisma.call.findFirst({
    where: {
      recordingUrl: { endsWith: `/${name}` },
      ...(session.engineer ? {} : { orgId: session.orgId }),
    },
    select: { id: true, orgId: true },
  });
  if (!call) return new NextResponse(null, { status: 404 });

  try {
    const obj = await s3().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: `recordings/${name}` }),
    );
    if (!obj.Body) return new NextResponse(null, { status: 404 });

    return new NextResponse(obj.Body.transformToWebStream(), {
      headers: {
        "Content-Type": "audio/wav",
        ...(obj.ContentLength ? { "Content-Length": String(obj.ContentLength) } : {}),
        // Private: this is one customer's call, and a shared cache holding it would hand it
        // to the next person through the same proxy.
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${name}"`,
      },
    });
  } catch (err) {
    // A missing object is the normal case for a call whose recording expired under the
    // 180-day rule while its transcript and summary remain. Not an error worth alarming on.
    console.warn("recording %s unavailable: %s", name, err);
    return new NextResponse(null, { status: 404 });
  }
}
