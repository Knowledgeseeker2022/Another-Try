import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCached } from "@/lib/redis";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unconfirmedOnly = searchParams.get("unconfirmed") === "true";

  const orgs = await getCached(
    `orgs:${unconfirmedOnly}`,
    () => db.organization.findMany({
      include: {
        mappings: true,
        orgGroups: { include: { orgGroup: true } },
      },
      where: unconfirmedOnly
        ? { mappings: { some: { isConfirmed: false } } }
        : undefined,
      orderBy: { name: "asc" },
    }),
    120
  );

  return NextResponse.json(orgs);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, slug, domain, industry, tier } = await req.json();
  if (!name || !slug) return NextResponse.json({ error: "name and slug required" }, { status: 400 });

  const org = await db.organization.create({ data: { name, slug, domain, industry, tier } });

  await db.auditLog.create({
    data: {
      action: "org.created",
      resource: "Organization",
      resourceId: org.id,
      userId: session.user?.id ?? null,
      metadata: { name, slug, domain, industry, tier },
    },
  });

  return NextResponse.json(org, { status: 201 });
}
