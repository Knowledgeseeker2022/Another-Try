import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";

// The full permission catalog (resource × action), used to render the role
// permission-matrix editor.
export async function GET() {
  const authz = await requirePermission("roles", "read");
  if (!authz.ok) return authz.response;

  const permissions = await db.permission.findMany({
    orderBy: [{ resource: "asc" }, { action: "asc" }],
  });

  const resources = [...new Set(permissions.map((p) => p.resource))];
  const actions = [...new Set(permissions.map((p) => p.action))];

  return NextResponse.json({ permissions, resources, actions });
}
