import type { PrismaClient } from "@prisma/client";

export interface SyncResult {
  recordsIn: number;
  recordsOut: number;
  error?: string;
}

export interface Connector {
  readonly slug: string;
  sync(config: Record<string, string>, db: PrismaClient, lastSyncAt?: Date): Promise<SyncResult>;
}

// Paginate a Microsoft Graph or similar API that returns { value: T[], "@odata.nextLink"?: string }
export async function* graphPages<T>(
  firstUrl: string,
  headers: Record<string, string>
): AsyncGenerator<T[]> {
  let url: string | undefined = firstUrl;
  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const data = (await res.json()) as { value: T[]; "@odata.nextLink"?: string };
    yield data.value ?? [];
    url = data["@odata.nextLink"];
  }
}

// Paginate a HaloPSA-style API that returns { record_count: number, tickets: T[] }
export async function* haloPSAPages<T>(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
  key: string,
  pageSize = 100,
  extraParams?: Record<string, string>
): AsyncGenerator<T[]> {
  let page = 1;
  while (true) {
    const params = new URLSearchParams({
      page_size: String(pageSize),
      page_no: String(page),
      ...extraParams,
    });
    const url = `${baseUrl}${path}?${params}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status} from HaloPSA`);
    const data = (await res.json()) as Record<string, T[]>;
    const items: T[] = data[key] ?? [];
    if (items.length === 0) break;
    yield items;
    if (items.length < pageSize) break;
    page++;
  }
}
