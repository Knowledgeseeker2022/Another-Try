import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, hasScope } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasScope(auth, "read:tickets")) return NextResponse.json({ error: "Forbidden: requires read:tickets scope" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const orgId      = searchParams.get("orgId");
  const status     = searchParams.get("status");
  const priority   = searchParams.get("priority");
  const service    = searchParams.get("service");
  const page       = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize   = Math.min(500, Math.max(1, parseInt(searchParams.get("pageSize") ?? "100", 10)));

  const where: Record<string, unknown> = {};
  if (orgId)    where.orgId       = orgId;
  if (status)   where.status      = status;
  if (priority) where.priority    = priority;
  if (service)  where.serviceSlug = service;

  const [tickets, total] = await Promise.all([
    db.ticket.findMany({
      where,
      include: { organization: { select: { id: true, name: true, slug: true } } },
      orderBy: { externalCreatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.ticket.count({ where }),
  ]);

  return NextResponse.json({
    data: tickets,
    meta: { total, page, pageSize, pages: Math.ceil(total / pageSize) },
  });
}
