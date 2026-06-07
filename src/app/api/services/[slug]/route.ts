import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { invalidateCache } from "@/lib/redis";
import { encryptConfig, encryptionAvailable } from "@/lib/crypto";
import { queueSync } from "@/lib/queue";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const service = await db.service.findUnique({
    where: { slug },
    include: { syncLogs: { take: 5, orderBy: { startedAt: "desc" } } },
  });

  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { config, ...rest } = service;
  return NextResponse.json({ ...rest, hasCredentials: !!config && Object.keys(config as object).length > 0 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const body = await req.json();
  const { config, pollInterval, syncMode } = body;

  const updateData: Record<string, unknown> = {};

  if (config !== undefined) {
    // Encrypt credentials if ENCRYPTION_KEY is set
    if (config && Object.keys(config as object).length > 0) {
      updateData.config = encryptionAvailable()
        ? encryptConfig(config as Record<string, unknown>)
        : config;
      updateData.status = "CONNECTED";
      updateData.errorMessage = null;
    }
  }

  if (pollInterval !== undefined) {
    updateData.pollInterval = Number(pollInterval) * 60; // store as seconds
  }

  if (syncMode === "POLLING" || syncMode === "WEBHOOK") {
    updateData.syncMode = syncMode;
  }

  const service = await db.service.update({ where: { slug }, data: updateData });

  await invalidateCache("services:*");

  await db.auditLog.create({
    data: {
      action: "service.configured",
      resource: "Service",
      resourceId: slug,
      userId: session.user?.id ?? null,
      metadata: {
        pollInterval,
        syncMode: syncMode ?? service.syncMode,
        encrypted: encryptionAvailable(),
      },
    },
  });

  const { config: _c, ...rest } = service;
  return NextResponse.json({ ...rest, hasCredentials: true });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { action } = await req.json();

  const service = await db.service.findUnique({ where: { slug } });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "disconnect") {
    await db.service.update({
      where: { slug },
      data: { status: "DISCONNECTED", config: Prisma.JsonNull, errorMessage: null },
    });
    await invalidateCache("services:*");
    await db.auditLog.create({
      data: {
        action: "service.disconnected",
        resource: "Service",
        resourceId: slug,
        userId: session.user?.id ?? null,
      },
    });
    return NextResponse.json({ success: true });
  }

  if (action === "sync") {
    if (!service.config) {
      return NextResponse.json({ error: "Service is not configured. Add credentials first." }, { status: 400 });
    }

    // Queue a real sync job via BullMQ
    let jobId: string;
    try {
      jobId = await queueSync(slug, session.user?.id ?? undefined);
    } catch (queueErr) {
      // Redis unavailable — log the attempt but don't fail silently
      console.error("[api] Failed to queue sync job:", queueErr);
      return NextResponse.json(
        { error: "Could not queue sync job. Ensure Redis is running and the worker is started." },
        { status: 503 }
      );
    }

    // Set service to PENDING so the UI shows activity
    await db.service.update({ where: { slug }, data: { status: "PENDING" } });
    await invalidateCache("services:*");

    await db.auditLog.create({
      data: {
        action: "service.sync.triggered",
        resource: "Service",
        resourceId: slug,
        userId: session.user?.id ?? null,
        metadata: { jobId },
      },
    });

    return NextResponse.json({
      success: true,
      jobId,
      message: `Sync queued for ${service.name}. Start the worker with \`npm run worker\` to process jobs.`,
    });
  }

  return NextResponse.json({ error: "Unknown action. Use 'sync' or 'disconnect'." }, { status: 400 });
}
