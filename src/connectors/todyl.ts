import type { PrismaClient } from "@prisma/client";
import { type Connector, type SyncResult } from "./base";

// Todyl REST API — https://developer.todyl.com/
// Auth: Bearer token via API key
const TODYL_API = "https://api.todyl.com/v1";

type TodylSeverity = "critical" | "high" | "medium" | "low" | "informational";

interface TodylAlert {
  id: string;
  title: string;
  description: string | null;
  severity: TodylSeverity;
  status: string;
  category: string | null;
  source_module: string | null;
  affected_asset: string | null;
  tenant_id: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
}

interface TodylListResponse {
  data: TodylAlert[];
  meta?: { total: number; page: number; per_page: number; last_page: number };
}

function normalizeSeverity(s: TodylSeverity | string): string {
  const m: Record<string, string> = {
    critical: "critical",
    high: "high",
    medium: "medium",
    low: "low",
    informational: "info",
    info: "info",
  };
  return m[s?.toLowerCase()] ?? "info";
}

export class TodylConnector implements Connector {
  readonly slug = "todyl";

  async sync(config: Record<string, string>, db: PrismaClient): Promise<SyncResult> {
    const { apiKey, orgId: todylOrgId } = config;
    if (!apiKey) throw new Error("Todyl requires an API key.");

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    let recordsIn = 0;
    let recordsOut = 0;
    let page = 1;

    while (true) {
      const params = new URLSearchParams({ page: String(page), per_page: "100" });
      if (todylOrgId) params.set("tenant_id", todylOrgId);

      const res = await fetch(`${TODYL_API}/alerts?${params}`, { headers });
      if (!res.ok) throw new Error(`Todyl API error ${res.status}: ${await res.text()}`);

      const body = (await res.json()) as TodylListResponse;
      const alerts = body.data ?? [];
      if (alerts.length === 0) break;

      for (const alert of alerts) {
        recordsIn++;

        // Attempt to match tenant to an Organization via OrgMapping
        let orgId: string | null = null;
        if (alert.tenant_id) {
          const mapping = await db.orgMapping.findUnique({
            where: { serviceSlug_externalId: { serviceSlug: "todyl", externalId: alert.tenant_id } },
          });
          orgId = mapping?.orgId ?? null;
        }

        await db.securityEvent.upsert({
          where: { serviceSlug_externalId: { serviceSlug: "todyl", externalId: alert.id } },
          create: {
            serviceSlug: "todyl",
            externalId: alert.id,
            orgId,
            type: "alert",
            severity: normalizeSeverity(alert.severity),
            title: alert.title,
            description: alert.description,
            status: alert.status ?? "open",
            source: alert.source_module ?? alert.category ?? null,
            affectedAsset: alert.affected_asset,
            resolvedAt: alert.resolved_at ? new Date(alert.resolved_at) : null,
            externalCreatedAt: alert.created_at ? new Date(alert.created_at) : null,
            rawData: JSON.parse(JSON.stringify(alert)),
          },
          update: {
            orgId,
            severity: normalizeSeverity(alert.severity),
            title: alert.title,
            description: alert.description,
            status: alert.status ?? "open",
            source: alert.source_module ?? alert.category ?? null,
            affectedAsset: alert.affected_asset,
            resolvedAt: alert.resolved_at ? new Date(alert.resolved_at) : null,
            rawData: JSON.parse(JSON.stringify(alert)),
          },
        });
        recordsOut++;
      }

      const meta = body.meta;
      if (!meta || page >= meta.last_page) break;
      page++;
    }

    return { recordsIn, recordsOut };
  }
}
