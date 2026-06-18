import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Public endpoint — called by the login form (unauthenticated) to decide whether
// to show the "Continue with Microsoft" button.
// Requires BOTH an enabled SsoTenant AND the QCT Entra app env vars to be present.
export async function GET() {
  const hasEnvCreds =
    !!process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    !!process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;

  if (!hasEnvCreds) {
    return NextResponse.json({ ssoEnabled: false });
  }

  const tenant = await db.ssoTenant.findFirst({ where: { isEnabled: true } });
  return NextResponse.json({ ssoEnabled: !!tenant });
}
