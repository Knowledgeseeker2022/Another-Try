import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await db.ssoConfig.findFirst({ orderBy: { createdAt: "desc" } });
  if (!config) return NextResponse.json(null);

  // Never return client secret
  const { clientSecret: _cs, ...safe } = config;
  return NextResponse.json({ ...safe, hasSecret: !!_cs });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const config = await db.ssoConfig.findFirst({ orderBy: { createdAt: "desc" } });

  if (!config) return NextResponse.json({ error: "No SSO config found. Use /sso-setup first." }, { status: 404 });

  const updated = await db.ssoConfig.update({
    where: { id: config.id },
    data: {
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : config.isEnabled,
      domains: body.domains !== undefined ? body.domains : config.domains,
      tenantId: body.tenantId !== undefined ? body.tenantId : config.tenantId,
      clientId: body.clientId !== undefined ? body.clientId : config.clientId,
      ...(body.clientSecret ? { clientSecret: body.clientSecret } : {}),
    },
  });

  await db.auditLog.create({
    data: {
      action: "sso.updated",
      resource: "SsoConfig",
      resourceId: config.id,
      userId: session.user?.id ?? null,
      metadata: { changes: Object.keys(body) },
    },
  });

  const { clientSecret: _cs, ...safe } = updated;
  return NextResponse.json({ ...safe, hasSecret: !!_cs });
}
