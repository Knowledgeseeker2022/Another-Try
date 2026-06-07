import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groups = await db.orgGroup.findMany({
    include: { _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, color, criteria } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const group = await db.orgGroup.create({
    data: {
      name,
      description: description ?? null,
      color: color ?? "#6b7280",
      criteria: criteria ? { rule: criteria } : undefined,
    },
  });

  await db.auditLog.create({
    data: {
      action: "org_group.created",
      resource: "OrgGroup",
      resourceId: group.id,
      userId: session.user?.id ?? null,
    },
  });

  return NextResponse.json(group, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.orgGroup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
