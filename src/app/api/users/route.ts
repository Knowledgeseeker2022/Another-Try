import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { requirePermission, setUserGrants, type GrantInput } from "@/lib/authz";

// Shared shape returned to the UI: roles plus their scope (app + client orgs).
export const userSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  mfaEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  userRoles: {
    select: {
      id: true,
      appId: true,
      scopeAllOrgs: true,
      role: { select: { id: true, name: true } },
      app: { select: { id: true, name: true } },
      orgs: { select: { orgId: true } },
      orgGroups: { select: { orgGroupId: true } },
    },
  },
} as const;

export async function GET() {
  const authz = await requirePermission("users", "read");
  if (!authz.ok) return authz.response;

  const users = await db.user.findMany({
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const authz = await requirePermission("users", "write");
  if (!authz.ok) return authz.response;

  const body = await req.json();
  const { email, name, password, roleId, grants } = body as {
    email?: string;
    name?: string;
    password?: string;
    roleId?: string;
    grants?: GrantInput[];
  };

  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "User already exists" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({ data: { email, name, password: passwordHash } });

  // Least privilege: a new user has no access unless grants are supplied.
  const initialGrants: GrantInput[] = grants ?? (roleId ? [{ roleId, scopeAllOrgs: true }] : []);
  if (initialGrants.length > 0) {
    await setUserGrants(user.id, initialGrants);
  }

  await db.auditLog.create({
    data: {
      action: "user.created",
      resource: "User",
      resourceId: user.id,
      userId: authz.userId,
      metadata: { email, name: name ?? null, grants: initialGrants as unknown as Prisma.InputJsonValue },
    },
  });

  const created = await db.user.findUnique({ where: { id: user.id }, select: userSelect });
  return NextResponse.json(created, { status: 201 });
}
