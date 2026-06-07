import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apps = await db.app.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(apps);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, slug, description, url, scopes, isInternal } = await req.json();
  if (!name || !slug) return NextResponse.json({ error: "name and slug required" }, { status: 400 });

  const app = await db.app.create({
    data: { name, slug, description, url, scopes: scopes ?? [], isInternal: isInternal ?? true },
  });
  return NextResponse.json(app, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.app.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
