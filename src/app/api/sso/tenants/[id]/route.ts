import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/authz";
import { encryptString } from "@/lib/crypto";
import { tenantSelect } from "../route";

function sanitize(tenant: { clientSecret?: string | null; [k: string]: unknown }) {
  const { clientSecret: _cs, ...safe } = tenant;
  return { ...safe, hasSecret: !!_cs };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("sso", "read");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const tenant = await db.ssoTenant.findUnique({
    where: { id },
    select: { ...tenantSelect, clientSecret: true },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(sanitize(tenant));
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("sso", "write");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const existing = await db.ssoTenant.findUnique({
    where: { id },
    select: { id: true, name: true, isDefault: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as {
    name?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    domains?: string[];
    isEnabled?: boolean;
    isDefault?: boolean;
    orgId?: string | null;
  };

  // Enforce single isDefault
  if (body.isDefault && !existing.isDefault) {
    await db.ssoTenant.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.tenantId !== undefined) data.tenantId = body.tenantId.trim();
  if (body.clientId !== undefined) data.clientId = body.clientId.trim() || null;
  if (body.isEnabled !== undefined) data.isEnabled = body.isEnabled;
  if (body.isDefault !== undefined) data.isDefault = body.isDefault;
  if (body.orgId !== undefined) data.orgId = body.orgId;
  if (body.domains !== undefined) {
    data.domains = body.domains.map((d) => d.toLowerCase().replace(/^@/, ""));
  }
  if (body.clientSecret) {
    data.clientSecret = encryptString(body.clientSecret);
  }

  const updated = await db.ssoTenant.update({
    where: { id },
    data,
    select: { ...tenantSelect, clientSecret: true },
  });

  await db.auditLog.create({
    data: {
      action: "sso.tenant.updated",
      resource: "SsoTenant",
      resourceId: id,
      userId: authz.userId,
      metadata: { changes: Object.keys(body) },
    },
  });

  return NextResponse.json(sanitize(updated));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authz = await requirePermission("sso", "delete");
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const tenant = await db.ssoTenant.findUnique({
    where: { id },
    select: { name: true, tenantId: true },
  });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Deleting a tenant cascades to SsoGroupMapping. Clean up SSO-provisioned group
  // memberships that were assigned through this tenant.
  await db.userGroup.deleteMany({ where: { ssoTenantId: id, ssoProvisioned: true } });
  await db.ssoTenant.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      action: "sso.tenant.deleted",
      resource: "SsoTenant",
      resourceId: id,
      userId: authz.userId,
      metadata: { name: tenant.name, tenantId: tenant.tenantId },
    },
  });

  return NextResponse.json({ ok: true });
}

