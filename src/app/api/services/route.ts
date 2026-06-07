import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCached } from "@/lib/redis";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const services = await getCached(
    "services:all",
    () => db.service.findMany({
      include: { _count: { select: { syncLogs: true } } },
      orderBy: { name: "asc" },
    }),
    60
  );

  return NextResponse.json(services);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, name, category } = await req.json();
  if (!slug || !name) return NextResponse.json({ error: "slug and name required" }, { status: 400 });

  const service = await db.service.create({ data: { slug, name, category } });
  return NextResponse.json(service, { status: 201 });
}
