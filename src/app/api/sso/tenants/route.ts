import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { encryptString } from "@/lib/crypto";

// Shared shape returned for every tenant (clientSecret is never sent to the client)
export const tenantSelect = {
  id: true,
  provider: true,
  name: true,
  tenantId: true,
  clientId: true,
  domains: true,
  isEnabled: true,
  isDefault: true,
  orgId: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  organization: { select: { id: true, name: true, slug: true } },
  _count: { select: { groupMappings: true } },
  // hasSecret computed below — never expose clientSecret
} as const;

function sanitize(tenant: { clientSecret?: string | null; [k: string]: unknown }) {
  const { clientSecret: _cs, ...safe } = tenant;
  return { ...safe, hasSecret: !!_cs };
}

export async function GET() {
  const authz = await requirePermission("sso", "read");
  if (!authz.ok) return authz.response;

  const tenants = await db.ssoTenant.findMany({
    select: { ...tenantSelect, clientSecret: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(tenants.map(sanitize));
}

export async function POST(req: Request) {
  const authz = await requirePermission("sso", "write");
  if (!authz.ok) return authz.response;

  const body = (await req.json()) as {
    name: string;
    tenantId: string;
    clientId?: string;
    clientSecret?: string;
    domains?: string[];
    isDefault?: boolean;
    orgId?: string | null;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.tenantId?.trim()) {
    return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
  }

  // Enforce single isDefault tenant
  if (body.isDefault) {
    await db.ssoTenant.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }

  let encryptedSecret: string | undefined;
  if (body.clientSecret) {
    encryptedSecret = encryptString(body.clientSecret);
  }

  const tenant = await db.ssoTenant.create({
    data: {
      name: body.name.trim(),
      tenantId: body.tenantId.trim(),
      clientId: body.clientId?.trim() || null,
      clientSecret: encryptedSecret ?? null,
      domains: (body.domains ?? []).map((d) => d.toLowerCase().replace(/^@/, "")),
      isDefault: body.isDefault ?? false,
      orgId: body.orgId ?? null,
    },
    select: { ...tenantSelect, clientSecret: true },
  });

  await db.auditLog.create({
    data: {
      action: "sso.tenant.created",
      resource: "SsoTenant",
      resourceId: tenant.id,
      userId: authz.userId,
      metadata: { name: tenant.name, tenantId: tenant.tenantId },
    },
  });

  return NextResponse.json(sanitize(tenant), { status: 201 });
}
