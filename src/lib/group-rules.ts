import type { PrismaClient, OrgGroup, Organization } from "@prisma/client";

type OrgGroupWithRule = Pick<OrgGroup, "id" | "mode" | "ruleAttribute" | "ruleValue">;
type OrgWithSegment = Pick<Organization, "id" | "segment">;

// Returns true if org matches the group's rule.
// Only RULE_BASED groups with a valid ruleAttribute/ruleValue are ever evaluated;
// MANUAL groups always return false here (membership is stored in OrgGroupMember).
export function evaluateRule(org: OrgWithSegment, group: OrgGroupWithRule): boolean {
  if (group.mode !== "RULE_BASED" || !group.ruleAttribute || !group.ruleValue) return false;
  if (group.ruleAttribute === "segment") return org.segment === group.ruleValue;
  return false;
}

// Live member list for a RULE_BASED group — computed on read, never stale.
// For MANUAL groups, callers should query OrgGroupMember directly.
export async function getRuleGroupMembers(
  group: OrgGroupWithRule,
  db: PrismaClient,
): Promise<Pick<Organization, "id" | "name" | "segment" | "status">[]> {
  if (group.mode !== "RULE_BASED" || !group.ruleAttribute || !group.ruleValue) return [];
  if (group.ruleAttribute === "segment") {
    return db.organization.findMany({
      where: { segment: group.ruleValue },
      select: { id: true, name: true, segment: true, status: true },
      orderBy: { name: "asc" },
    });
  }
  return [];
}

// Live member count for a RULE_BASED group.
export async function getRuleGroupMemberCount(
  group: OrgGroupWithRule,
  db: PrismaClient,
): Promise<number> {
  if (group.mode !== "RULE_BASED" || !group.ruleAttribute || !group.ruleValue) return 0;
  if (group.ruleAttribute === "segment") {
    return db.organization.count({ where: { segment: group.ruleValue } });
  }
  return 0;
}

// All groups (MANUAL + RULE_BASED) that include the given org — used in client profile.
export async function getClientGroups(
  org: OrgWithSegment,
  db: PrismaClient,
): Promise<(OrgGroup & { membershipType: "MANUAL" | "RULE_BASED" })[]> {
  const [manualRows, ruleGroups] = await Promise.all([
    db.orgGroupMember.findMany({
      where: { orgId: org.id },
      include: { orgGroup: true },
    }),
    db.orgGroup.findMany({ where: { mode: "RULE_BASED" } }),
  ]);

  const manual = manualRows.map((r) => ({ ...r.orgGroup, membershipType: "MANUAL" as const }));
  const ruled = ruleGroups
    .filter((g) => evaluateRule(org, g))
    .map((g) => ({ ...g, membershipType: "RULE_BASED" as const }));

  return [...manual, ...ruled];
}
