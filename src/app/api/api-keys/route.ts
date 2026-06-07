import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createHash, randomBytes } from "crypto";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await db.apiKey.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(keys);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, scopes, expiresAt } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // Generate key: le_live_ + 32 random bytes base64url
  const rawKey = `le_live_${randomBytes(24).toString("base64url")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 10);

  const key = await db.apiKey.create({
    data: {
      name,
      keyHash,
      keyPrefix,
      scopes: scopes ?? [],
      userId: session.user?.id,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  // Return the raw key ONCE — never stored in plain text again
  return NextResponse.json({ ...key, rawKey }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  await db.apiKey.update({ where: { id }, data: { status: "REVOKED" } });
  return NextResponse.json({ success: true });
}
