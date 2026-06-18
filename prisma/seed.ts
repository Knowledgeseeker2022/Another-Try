import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const RESOURCES = ["users", "roles", "groups", "services", "orgs", "api-keys", "apps", "settings", "audit", "sso", "dashboard"];
const ACTIONS = ["read", "write", "delete", "admin"];

type Pair = { resource: string; action: string };

const all = (resource: string): Pair[] => ACTIONS.map((action) => ({ resource, action }));
const read = (resources: string[]): Pair[] => resources.map((resource) => ({ resource, action: "read" }));
const rw = (resources: string[]): Pair[] =>
  resources.flatMap((resource) => [{ resource, action: "read" }, { resource, action: "write" }]);

// Replace a role's entire permission set (idempotent reconcile).
async function setRolePerms(roleId: string, pairs: Pair[]) {
  const perms = pairs.length
    ? await db.permission.findMany({ where: { OR: pairs.map((p) => ({ resource: p.resource, action: p.action })) }, select: { id: true } })
    : [];
  await db.rolePermission.deleteMany({ where: { roleId } });
  if (perms.length) {
    await db.rolePermission.createMany({
      data: perms.map((p) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
}

async function main() {
  // ── Permissions catalog (resource × action) ───────────────────────────────
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      await db.permission.upsert({
        where: { resource_action: { resource, action } },
        create: { resource, action },
        update: {},
      });
    }
  }

  // ── Reconcile legacy role names → real role set ────────────────────────────
  // Admin → Operations Manager, Support → Technician (no-ops on a fresh DB).
  await db.role.updateMany({ where: { name: "Admin" }, data: { name: "Operations Manager" } });
  await db.role.updateMany({ where: { name: "Support" }, data: { name: "Technician" } });

  // System roles (built-in, cannot be deleted). Descriptions are kept current.
  const systemRoles: { name: string; description: string }[] = [
    { name: "Super Admin",        description: "Break-glass: full unrestricted access to every resource and client." },
    { name: "Operations Manager", description: "Full operational access to users, groups, services, orgs and apps — excludes role/permission management." },
    { name: "Compliance Lead",    description: "Read-only oversight of security events, audit log, services and organizations across all clients." },
    { name: "Technician",         description: "Operates service integrations (connect/sync) with read access to orgs, users and the dashboard." },
    { name: "Client Executive",   description: "Client-facing: read-only dashboard access, scoped to that client's organization(s)." },
    { name: "Read-Only",          description: "Internal read-only access to all resources across every client." },
  ];

  const roles: Record<string, string> = {};
  for (const r of systemRoles) {
    const role = await db.role.upsert({
      where: { name: r.name },
      create: { name: r.name, description: r.description, isSystem: true },
      update: { description: r.description, isSystem: true },
    });
    roles[r.name] = role.id;
  }

  // ── Assign least-privilege permission sets ─────────────────────────────────
  await setRolePerms(roles["Super Admin"], RESOURCES.flatMap(all));
  await setRolePerms(roles["Operations Manager"], [
    ...["users", "groups", "services", "orgs", "apps", "settings", "sso"].flatMap(all),
    ...read(["audit", "dashboard"]),
    { resource: "dashboard", action: "write" },
  ]);
  await setRolePerms(roles["Compliance Lead"], read(["audit", "services", "orgs", "dashboard", "apps"]));
  await setRolePerms(roles["Technician"], [
    ...rw(["services"]),
    ...read(["orgs", "users", "dashboard", "apps"]),
  ]);
  await setRolePerms(roles["Client Executive"], [{ resource: "dashboard", action: "read" }]);
  await setRolePerms(roles["Read-Only"], read(RESOURCES));

  // ── Default admin user (Super Admin, global) ───────────────────────────────
  const passwordHash = await bcrypt.hash("Admin1234!", 12);
  const adminUser = await db.user.upsert({
    where: { email: "admin@evendim.local" },
    create: { email: "admin@evendim.local", name: "Platform Admin", password: passwordHash, isActive: true },
    update: {},
  });

  const existingGrant = await db.userRole.findFirst({
    where: { userId: adminUser.id, roleId: roles["Super Admin"], appId: null },
  });
  if (!existingGrant) {
    await db.userRole.create({ data: { userId: adminUser.id, roleId: roles["Super Admin"] } });
  }

  // ── Services ───────────────────────────────────────────────────────────────
  const services = [
    { slug: "microsoft-365", name: "Microsoft 365",        category: "Identity / Licensing" },
    { slug: "halopsa",       name: "HaloPSA",               category: "PSA"                  },
    { slug: "ninjarmm",      name: "NinjaRMM",               category: "RMM"                  },
    { slug: "threatlocker",  name: "ThreatLocker",          category: "Security"             },
    { slug: "todyl",         name: "Todyl",                  category: "Security / SASE"      },
    { slug: "quickbooks",    name: "QuickBooks",             category: "Accounting"           },
    { slug: "pax8",          name: "Pax8",                   category: "Licensing"            },
    { slug: "datto",         name: "Datto BCDR",             category: "Backup / BDR"         },
    { slug: "auvik",         name: "Auvik",                  category: "Network Management"   },
    { slug: "pulseway",      name: "Pulseway",               category: "RMM / PSA"            },
    { slug: "cove",          name: "Cove Data Protection",   category: "Backup / Cloud"       },
  ];
  for (const svc of services) {
    await db.service.upsert({ where: { slug: svc.slug }, create: svc, update: {} });
  }

  // ── Default settings ─────────────────────────────────────────────────────
  const defaults: Record<string, unknown> = {
    "platform.name":           "Lake Evendim",
    "polling.defaultInterval": 15,
    "cache.ttl":               300,
    "security.sessionTimeout": 480,
    "audit.retentionDays":     90,
  };
  for (const [key, value] of Object.entries(defaults)) {
    await db.setting.upsert({ where: { key }, create: { key, value: value as never }, update: {} });
  }

  console.log("✅  Seed complete.");
  console.log("   Login: admin@evendim.local / Admin1234!");
  console.log("   Roles: Super Admin, Operations Manager, Compliance Lead, Technician, Client Executive, Read-Only");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
