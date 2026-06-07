import type { PrismaClient } from "@prisma/client";
import { graphPages, type Connector, type SyncResult } from "./base";

const GRAPH = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

interface GraphUser {
  id: string;
  displayName: string | null;
  userPrincipalName: string | null;
  mail: string | null;
  jobTitle: string | null;
  department: string | null;
  accountEnabled: boolean | null;
  createdDateTime: string | null;
  assignedLicenses: { skuId: string }[];
}

interface SkuDetail {
  skuId: string;
  skuPartNumber: string;
}

async function getAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(TOKEN_URL(tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`M365 token error: ${err}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export class M365Connector implements Connector {
  readonly slug = "microsoft-365";

  async sync(config: Record<string, string>, db: PrismaClient): Promise<SyncResult> {
    const { tenantId, clientId, clientSecret } = config;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error("M365 requires tenantId, clientId, and clientSecret.");
    }

    const token = await getAccessToken(tenantId, clientId, clientSecret);
    const headers = { Authorization: `Bearer ${token}` };

    // Build SKU map: skuId → display name
    const skuMap = new Map<string, string>();
    const skuRes = await fetch(`${GRAPH}/subscribedSkus?$select=skuId,skuPartNumber`, { headers });
    if (skuRes.ok) {
      const skuData = (await skuRes.json()) as { value: SkuDetail[] };
      for (const sku of skuData.value ?? []) skuMap.set(sku.skuId, sku.skuPartNumber);
    }

    // Try to match tenant to an Organization via domain
    const domainRes = await fetch(`${GRAPH}/domains?$select=id,isDefault`, { headers });
    let orgId: string | null = null;
    if (domainRes.ok) {
      const domainData = (await domainRes.json()) as { value: { id: string; isDefault: boolean }[] };
      const defaultDomain = domainData.value?.find((d) => d.isDefault)?.id;
      if (defaultDomain) {
        const org = await db.organization.findFirst({ where: { domain: defaultDomain } });
        orgId = org?.id ?? null;
      }
    }

    let recordsIn = 0;
    let recordsOut = 0;

    // Fetch all users with their assigned licenses
    const userUrl =
      `${GRAPH}/users?$select=id,displayName,userPrincipalName,mail,jobTitle,department,` +
      `accountEnabled,createdDateTime,assignedLicenses&$top=999`;

    for await (const page of graphPages<GraphUser>(userUrl, headers)) {
      for (const u of page) {
        recordsIn++;
        const licenses = (u.assignedLicenses ?? [])
          .map((l) => skuMap.get(l.skuId) ?? l.skuId)
          .filter(Boolean);

        await db.cloudUser.upsert({
          where: { serviceSlug_externalId: { serviceSlug: "microsoft-365", externalId: u.id } },
          create: {
            serviceSlug: "microsoft-365",
            externalId: u.id,
            orgId,
            displayName: u.displayName,
            email: u.mail ?? u.userPrincipalName,
            jobTitle: u.jobTitle,
            department: u.department,
            isLicensed: licenses.length > 0,
            isEnabled: u.accountEnabled ?? true,
            licenses,
            externalCreatedAt: u.createdDateTime ? new Date(u.createdDateTime) : null,
            rawData: JSON.parse(JSON.stringify(u)),
          },
          update: {
            orgId,
            displayName: u.displayName,
            email: u.mail ?? u.userPrincipalName,
            jobTitle: u.jobTitle,
            department: u.department,
            isLicensed: licenses.length > 0,
            isEnabled: u.accountEnabled ?? true,
            licenses,
            rawData: JSON.parse(JSON.stringify(u)),
          },
        });
        recordsOut++;
      }
    }

    return { recordsIn, recordsOut };
  }
}
