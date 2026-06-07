/**
 * Inbound webhook endpoint — external services push events here.
 * URL: POST /api/webhooks/{slug}
 *
 * Each service can deliver events via HTTP push instead of polling.
 * The service must be in WEBHOOK syncMode (set via the Services settings modal).
 *
 * Validation strategy per service:
 *   - Todyl: HMAC-SHA256 signature in X-Todyl-Signature header
 *   - HaloPSA: shared secret in X-HaloPSA-Secret header
 *   - Others: configurable in metadata.webhookSecret
 */
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { queueSync } from "@/lib/queue";

function verifyHmac(secret: string, body: string, signature: string): boolean {
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature.replace(/^sha256=/, ""), "hex"));
  } catch {
    return false;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const service = await db.service.findUnique({ where: { slug } });
  if (!service) return NextResponse.json({ error: "Unknown service" }, { status: 404 });

  if (service.syncMode !== "WEBHOOK") {
    return NextResponse.json(
      { error: "This service is not in webhook mode. Enable webhook sync in Settings." },
      { status: 409 }
    );
  }

  const bodyText = await req.text();

  // Validate signature if a webhook secret is configured
  const meta = service.metadata as Record<string, unknown> | null;
  const webhookSecret = meta?.webhookSecret as string | undefined;

  if (webhookSecret) {
    const sig =
      req.headers.get("x-todyl-signature") ||
      req.headers.get("x-halopsa-secret") ||
      req.headers.get("x-hub-signature-256") ||
      req.headers.get("x-signature") ||
      "";

    if (!sig || !verifyHmac(webhookSecret, bodyText, sig)) {
      await db.auditLog.create({
        data: {
          action: "webhook.rejected",
          resource: "Service",
          resourceId: slug,
          metadata: { reason: "invalid_signature" },
        },
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  // Parse the payload
  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    payload = bodyText;
  }

  // Log the inbound webhook event
  await db.auditLog.create({
    data: {
      action: "webhook.received",
      resource: "Service",
      resourceId: slug,
      ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? null,
      metadata: {
        payloadSize: bodyText.length,
        // Store a small preview of the payload
        preview: typeof payload === "object" ? JSON.stringify(payload).slice(0, 200) : String(payload).slice(0, 200),
      },
    },
  });

  // Queue a sync job so the connector can pull fresh data
  // (full sync on webhook is the safest default; streaming ingest can be added per-connector later)
  try {
    const jobId = await queueSync(slug);
    return NextResponse.json({ received: true, jobId });
  } catch {
    return NextResponse.json(
      { received: true, warning: "Event logged but sync could not be queued. Is the worker running?" },
      { status: 202 }
    );
  }
}

// Allow external systems to verify the webhook URL is reachable (GET challenge)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const service = await db.service.findUnique({ where: { slug }, select: { slug: true, name: true } });
  if (!service) return NextResponse.json({ error: "Unknown service" }, { status: 404 });

  // Echo challenge parameter (used by some platforms for webhook verification)
  const url = new URL(req.url);
  const challenge = url.searchParams.get("hub.challenge") ?? url.searchParams.get("challenge");
  if (challenge) return new Response(challenge, { status: 200 });

  return NextResponse.json({ webhook: "active", service: service.name });
}
