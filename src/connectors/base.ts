import type { PrismaClient } from "@prisma/client";

export interface SyncResult {
  recordsIn: number;
  recordsOut: number;
  error?: string;
}

export interface Connector {
  readonly slug: string;
  sync(config: Record<string, string>, db: PrismaClient): Promise<SyncResult>;
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
  pageSize = 100
): AsyncGenerator<T[]> {
  let page = 1;
  while (true) {
    const url = `${baseUrl}${path}?page_size=${pageSize}&page_no=${page}`;
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
