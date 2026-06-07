import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await db.setting.findMany();
  const map = Object.fromEntries(settings.map((s: { key: string; value: unknown }) => [s.key, s.value]));
  return NextResponse.json(map);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const updates: Record<string, unknown> = await req.json();

  await Promise.all(
    Object.entries(updates).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        create: { key, value: value as never },
        update: { value: value as never },
      })
    )
  );

  return NextResponse.json({ success: true });
}
