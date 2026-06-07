import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await db.user.findMany({
    select: {
      id: true, name: true, email: true, isActive: true,
      mfaEnabled: true, lastLoginAt: true, createdAt: true,
      userRoles: { include: { role: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { email, name, password, roleId } = body;

  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  if (!password || (password as string).length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "User already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password as string, 10);
  const user = await db.user.create({ data: { email, name, password: passwordHash } });

  if (roleId) {
    await db.userRole.create({ data: { userId: user.id, roleId } });
  }

  await db.auditLog.create({
    data: {
      action: "user.created",
      resource: "User",
      resourceId: user.id,
      userId: session.user?.id ?? null,
      metadata: { email, name, roleId: roleId ?? null },
    },
  });

  const created = await db.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, name: true, email: true, isActive: true,
      mfaEnabled: true, lastLoginAt: true, createdAt: true,
      userRoles: { include: { role: { select: { id: true, name: true } } } },
    },
  });

  return NextResponse.json(created, { status: 201 });
}
