import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const resource = searchParams.get("resource");
  const action = searchParams.get("action");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 500);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where: {
        ...(resource && { resource }),
        ...(action && { action: { contains: action } }),
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.auditLog.count({
      where: {
        ...(resource && { resource }),
        ...(action && { action: { contains: action } }),
      },
    }),
  ]);

  return NextResponse.json({ entries, total, limit, offset });
}

export async function POST(req: Request) {
  // Internal endpoint for writing audit events
  const session = await auth();
  const body = await req.json();
  const { action, resource, resourceId, metadata } = body;

  if (!action || !resource) {
    return NextResponse.json({ error: "action and resource required" }, { status: 400 });
  }

  const entry = await db.auditLog.create({
    data: {
      action,
      resource,
      resourceId,
      metadata,
      userId: session?.user?.id ?? null,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}
