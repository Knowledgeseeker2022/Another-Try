import { NextResponse } from "next/server";

// The single-tenant /api/sso endpoint was replaced in Phase 2 by the multi-tenant
// /api/sso/tenants routes. This stub returns a clear error so stale clients fail loudly.
export async function GET() {
  return NextResponse.json(
    { error: "Endpoint removed. Use /api/sso/tenants for multi-tenant SSO management." },
    { status: 410 },
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Endpoint removed. Use /api/sso/tenants/[id] for multi-tenant SSO management." },
    { status: 410 },
  );
}
