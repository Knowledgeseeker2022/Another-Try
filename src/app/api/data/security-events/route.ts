import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, hasScope } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasScope(auth, "read:security-events")) return NextResponse.json({ error: "Forbidden: requires read:security-events scope" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const orgId    = searchParams.get("orgId");
  const severity = searchParams.get("severity");
  const status   = searchParams.get("status");
  const service  = searchParams.get("service");
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get("pageSize") ?? "100", 10)));

  const where: Record<string, unknown> = {};
  if (orgId)    where.orgId       = orgId;
  if (severity) where.severity    = severity;
  if (status)   where.status      = status;
  if (service)  where.serviceSlug = service;

  const [events, total] = await Promise.all([
    db.securityEvent.findMany({
      where,
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { externalCreatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.securityEvent.count({ where }),
  ]);

  return NextResponse.json({
    data: events,
    meta: { total, page, pageSize, pages: Math.ceil(total / pageSize) },
  });
}
