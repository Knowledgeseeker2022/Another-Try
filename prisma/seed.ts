import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  // ── Permissions ──────────────────────────────────────────────────────────
  const resources = ["users", "roles", "groups", "services", "orgs", "api-keys", "apps", "settings", "audit", "dashboard"];
  const actions   = ["read", "write", "delete", "admin"];

  for (const resource of resources) {
    for (const action of actions) {
      await db.permission.upsert({
        where: { resource_action: { resource, action } },
        create: { resource, action },
        update: {},
      });
    }
  }

  // ── Roles ────────────────────────────────────────────────────────────────
  const superAdmin = await db.role.upsert({
    where: { name: "Super Admin" },
    create: { name: "Super Admin", description: "Full unrestricted access to all platform resources.", isSystem: true },
    update: {},
  });

  const admin = await db.role.upsert({
    where: { name: "Admin" },
    create: { name: "Admin", description: "Full access except role and permission management.", isSystem: true },
    update: {},
  });

  await db.role.upsert({
    where: { name: "Support" },
    create: { name: "Support", description: "Read access plus limited service interaction.", isSystem: true },
    update: {},
  });

  await db.role.upsert({
    where: { name: "Read-Only" },
    create: { name: "Read-Only", description: "Read-only access to all non-sensitive resources.", isSystem: true },
    update: {},
  });

  // Assign all permissions to Super Admin
  const allPerms = await db.permission.findMany();
  for (const perm of allPerms) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: perm.id } },
      create: { roleId: superAdmin.id, permissionId: perm.id },
      update: {},
    });
  }

  // ── Default admin user ────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Admin1234!", 12);

  const adminUser = await db.user.upsert({
    where: { email: "admin@evendim.local" },
    create: {
      email:    "admin@evendim.local",
      name:     "Platform Admin",
      password: passwordHash,
      isActive: true,
    },
    update: {},
  });

  await db.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: superAdmin.id } },
    create: { userId: adminUser.id, roleId: superAdmin.id },
    update: {},
  });

  // ── Services ─────────────────────────────────────────────────────────────
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
    await db.service.upsert({
      where: { slug: svc.slug },
      create: svc,
      update: {},
    });
  }

  // ── Default settings ─────────────────────────────────────────────────────
  const defaults: Record<string, unknown> = {
    "platform.name":          "Lake Evendim",
    "polling.defaultInterval": 15,
    "cache.ttl":              300,
    "security.sessionTimeout": 480,
    "audit.retentionDays":    90,
  };

  for (const [key, value] of Object.entries(defaults)) {
    await db.setting.upsert({
      where: { key },
      create: { key, value: value as never },
      update: {},
    });
  }

  console.log("✅  Seed complete.");
  console.log("   Login: admin@evendim.local / Admin1234!");
  console.log("   Roles: Super Admin, Admin, Support, Read-Only");
  console.log("   Services: 11 connectors registered (M365, HaloPSA, NinjaRMM, ThreatLocker, Todyl, QuickBooks, Pax8, Datto, Auvik, Pulseway, Cove)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
