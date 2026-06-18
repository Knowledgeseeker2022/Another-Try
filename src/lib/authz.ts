// ─── Authorization (scoped RBAC enforcement) ─────────────────────────────────
// Resolves a user's effective grants — direct role assignments AND roles granted
// via group membership — and answers two questions every protected surface needs:
//
//   can(userId, resource, action, scope?)   → boolean  (may this user do this?)
//   accessibleOrgIds(userId, appId?)         → which client orgs may they see?
//
// A grant carries optional scope:
//   • appId       — null = all apps / Admin-wide; otherwise limited to one App.
//   • scopeAllOrgs / orgs / orgGroups — which client organizations it covers.
//
// This is the single primitive every future dashboard plugs into: adding a
// dashboard is a new `appId` scope value, never a new permission system.

import { NextResponse } from "next/server";
import { auth } from "./auth";
import { db } from "./db";

export type Action = "read" | "write" | "delete" | "admin";

export interface ScopeQuery {
  /** null/undefined = the Admin control plane (only globally-scoped grants apply). */
  appId?: string | null;
  /** Restrict the check to a specific client organization. */
  orgId?: string;
}

interface ResolvedGrant {
  permissions: Set<string>; // "resource:action"
  appId: string | null;
  scopeAllOrgs: boolean;
  orgIds: Set<string>;
  orgGroupIds: Set<string>;
}

const permKey = (resource: string, action: string) => `${resource}:${action}`;

// "admin" on a resource implies read/write/delete on that same resource.
function expandPermissions(perms: { resource: string; action: string }[]): Set<string> {
  const set = new Set<string>();
  for (const p of perms) {
    set.add(permKey(p.resource, p.action));
    if (p.action === "admin") {
      for (const a of ["read", "write", "delete"]) set.add(permKey(p.resource, a));
    }
  }
  return set;
}

const grantSelect = {
  appId: true,
  scopeAllOrgs: true,
  orgs: { select: { orgId: true } },
  orgGroups: { select: { orgGroupId: true } },
  role: {
    select: {
      permissions: { select: { permission: { select: { resource: true, action: true } } } },
    },
  },
} as const;

type RawGrant = {
  appId: string | null;
  scopeAllOrgs: boolean;
  orgs: { orgId: string }[];
  orgGroups: { orgGroupId: string }[];
  role: { permissions: { permission: { resource: string; action: string } }[] };
};

function toResolved(g: RawGrant): ResolvedGrant {
  return {
    permissions: expandPermissions(g.role.permissions.map((rp) => rp.permission)),
    appId: g.appId,
    scopeAllOrgs: g.scopeAllOrgs,
    orgIds: new Set(g.orgs.map((o) => o.orgId)),
    orgGroupIds: new Set(g.orgGroups.map((o) => o.orgGroupId)),
  };
}

/** All effective grants for a user (direct + via groups). Empty if inactive/missing. */
export async function resolveGrants(userId: string): Promise<ResolvedGrant[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      userRoles: { select: grantSelect },
      userGroups: {
        select: { group: { select: { groupRoles: { select: grantSelect } } } },
      },
    },
  });
  if (!user || !user.isActive) return [];

  const grants: ResolvedGrant[] = user.userRoles.map(toResolved);
  for (const ug of user.userGroups) {
    for (const gr of ug.group.groupRoles) grants.push(toResolved(gr));
  }
  return grants;
}

// Admin plane (query app null/undefined): only globally-scoped grants count.
// Dashboard app: globally-scoped grants OR grants scoped to that exact app.
function appMatches(grantAppId: string | null, queryAppId: string | null | undefined): boolean {
  if (queryAppId == null) return grantAppId === null;
  return grantAppId === null || grantAppId === queryAppId;
}

async function orgMatches(grant: ResolvedGrant, orgId: string | undefined): Promise<boolean> {
  if (orgId == null) return true; // not an org-scoped check
  if (grant.scopeAllOrgs) return true;
  if (grant.orgIds.has(orgId)) return true;
  if (grant.orgGroupIds.size === 0) return false;
  const count = await db.orgGroupMember.count({
    where: { orgId, orgGroupId: { in: [...grant.orgGroupIds] } },
  });
  return count > 0;
}

/** Core check: may `userId` perform `action` on `resource` within `scope`? */
export async function can(
  userId: string,
  resource: string,
  action: Action,
  scope: ScopeQuery = {},
): Promise<boolean> {
  const grants = await resolveGrants(userId);
  const need = permKey(resource, action);
  for (const g of grants) {
    if (!g.permissions.has(need)) continue;
    if (!appMatches(g.appId, scope.appId)) continue;
    if (await orgMatches(g, scope.orgId)) return true;
  }
  return false;
}

/**
 * Which client organizations may this user see in the given app context?
 * `{ all: true }` = every org (internal/all-orgs grant). Otherwise the explicit
 * union of scoped orgs + orgs expanded from scoped org groups. This is what
 * dashboard data queries filter on ("who can see which clients").
 */
export async function accessibleOrgIds(
  userId: string,
  appId?: string | null,
): Promise<{ all: true } | { all: false; orgIds: string[] }> {
  const grants = (await resolveGrants(userId)).filter(
    (g) =>
      appMatches(g.appId, appId ?? null) &&
      [...g.permissions].some((p) => p.endsWith(":read")),
  );

  if (grants.some((g) => g.scopeAllOrgs)) return { all: true };

  const orgIds = new Set<string>();
  const orgGroupIds = new Set<string>();
  for (const g of grants) {
    g.orgIds.forEach((id) => orgIds.add(id));
    g.orgGroupIds.forEach((id) => orgGroupIds.add(id));
  }
  if (orgGroupIds.size > 0) {
    const members = await db.orgGroupMember.findMany({
      where: { orgGroupId: { in: [...orgGroupIds] } },
      select: { orgId: true },
    });
    members.forEach((m) => orgIds.add(m.orgId));
  }
  return { all: false, orgIds: [...orgIds] };
}

// ─── Writing grants ──────────────────────────────────────────────────────────

export interface GrantInput {
  roleId: string;
  /** null = all apps / Admin-wide. */
  appId?: string | null;
  /** Default true = every client org. */
  scopeAllOrgs?: boolean;
  orgIds?: string[];
  orgGroupIds?: string[];
}

// Collapse duplicates by (roleId, appId) so we never violate the unique index.
function dedupeGrants(grants: GrantInput[]): GrantInput[] {
  const byKey = new Map<string, GrantInput>();
  for (const g of grants) {
    if (!g.roleId) continue;
    byKey.set(`${g.roleId}::${g.appId ?? ""}`, g);
  }
  return [...byKey.values()];
}

function nestedScope(g: GrantInput) {
  const scopeAllOrgs = g.scopeAllOrgs ?? true;
  return {
    appId: g.appId ?? null,
    scopeAllOrgs,
    orgs:
      !scopeAllOrgs && g.orgIds?.length
        ? { create: [...new Set(g.orgIds)].map((orgId) => ({ orgId })) }
        : undefined,
    orgGroups:
      !scopeAllOrgs && g.orgGroupIds?.length
        ? { create: [...new Set(g.orgGroupIds)].map((orgGroupId) => ({ orgGroupId })) }
        : undefined,
  };
}

/** Replace a user's entire set of role grants (with scope). */
export async function setUserGrants(userId: string, grants: GrantInput[]): Promise<void> {
  const clean = dedupeGrants(grants);
  await db.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId } });
    for (const g of clean) {
      await tx.userRole.create({ data: { userId, roleId: g.roleId, ...nestedScope(g) } });
    }
  });
}

/** Replace a group's entire set of role grants (with scope). */
export async function setGroupGrants(groupId: string, grants: GrantInput[]): Promise<void> {
  const clean = dedupeGrants(grants);
  await db.$transaction(async (tx) => {
    await tx.groupRole.deleteMany({ where: { groupId } });
    for (const g of clean) {
      await tx.groupRole.create({ data: { groupId, roleId: g.roleId, ...nestedScope(g) } });
    }
  });
}

/**
 * Route guard. Returns `{ ok: true, userId }` when authorized, or
 * `{ ok: false, response }` carrying a 401/403 to return directly:
 *
 *   const authz = await requirePermission("users", "read");
 *   if (!authz.ok) return authz.response;
 */
export async function requirePermission(
  resource: string,
  action: Action,
  scope: ScopeQuery = {},
): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await can(userId, resource, action, scope))) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, userId };
}
