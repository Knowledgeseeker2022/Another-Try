import type { PrismaClient } from "@prisma/client";
import { haloPSAPages, type Connector, type SyncResult } from "./base";

interface HaloTicket {
  id: number;
  summary: string;
  details: string | null;
  status_id: number;
  status: { name: string } | null;
  priority_id: number | null;
  priority: { name: string } | null;
  tickettype: { name: string } | null;
  agent: { name: string } | null;
  user: { name: string } | null;
  client_id: number | null;
  client: { name: string } | null;
  dateoccurred: string | null;
  lastupdated: string | null;
}

interface HaloClient {
  id: number;
  name: string;
  website: string | null;
}

async function getHaloToken(tenantUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`${tenantUrl}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "all",
    }).toString(),
  });
  if (!res.ok) throw new Error(`HaloPSA auth failed: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export class HaloPSAConnector implements Connector {
  readonly slug = "halopsa";

  async sync(config: Record<string, string>, db: PrismaClient): Promise<SyncResult> {
    const { tenantUrl, clientId, clientSecret } = config;
    if (!tenantUrl || !clientId || !clientSecret) {
      throw new Error("HaloPSA requires tenantUrl, clientId, and clientSecret.");
    }

    const base = tenantUrl.replace(/\/$/, "");
    const token = await getHaloToken(base, clientId, clientSecret);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

    // Sync clients → create OrgMappings + Organizations
    const clientMap = new Map<number, string>(); // halo client id → our orgId
    for await (const clients of haloPSAPages<HaloClient>(base, "/api/Client", headers, "clients")) {
      for (const c of clients) {
        // Upsert Organization
        const slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const org = await db.organization.upsert({
          where: { slug },
          create: { name: c.name, slug, domain: c.website ?? undefined },
          update: { name: c.name },
        });
        clientMap.set(c.id, org.id);

        // Upsert OrgMapping
        await db.orgMapping.upsert({
          where: { serviceSlug_externalId: { serviceSlug: "halopsa", externalId: String(c.id) } },
          create: {
            orgId: org.id,
            serviceSlug: "halopsa",
            externalId: String(c.id),
            externalName: c.name,
            confidence: 100,
            isConfirmed: true,
          },
          update: { externalName: c.name, orgId: org.id },
        });
      }
    }

    let recordsIn = 0;
    let recordsOut = 0;

    // Sync open + pending tickets
    for await (const tickets of haloPSAPages<HaloTicket>(base, "/api/Ticket", headers, "tickets")) {
      for (const t of tickets) {
        recordsIn++;
        const orgId = t.client_id != null ? (clientMap.get(t.client_id) ?? null) : null;

        await db.ticket.upsert({
          where: { serviceSlug_externalId: { serviceSlug: "halopsa", externalId: String(t.id) } },
          create: {
            serviceSlug: "halopsa",
            externalId: String(t.id),
            orgId,
            title: t.summary,
            description: t.details,
            status: t.status?.name ?? String(t.status_id),
            priority: t.priority?.name ?? null,
            type: t.tickettype?.name ?? null,
            assignee: t.agent?.name ?? null,
            requester: t.user?.name ?? null,
            externalCreatedAt: t.dateoccurred ? new Date(t.dateoccurred) : null,
            externalUpdatedAt: t.lastupdated ? new Date(t.lastupdated) : null,
            rawData: JSON.parse(JSON.stringify(t)),
          },
          update: {
            orgId,
            title: t.summary,
            description: t.details,
            status: t.status?.name ?? String(t.status_id),
            priority: t.priority?.name ?? null,
            assignee: t.agent?.name ?? null,
            requester: t.user?.name ?? null,
            externalUpdatedAt: t.lastupdated ? new Date(t.lastupdated) : null,
            rawData: JSON.parse(JSON.stringify(t)),
          },
        });
        recordsOut++;
      }
    }

    return { recordsIn, recordsOut };
  }
}
