"use client";

import { useState, useCallback } from "react";
import { Download, Filter, Search, RefreshCw, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { toast } from "sonner";

type Severity = "info" | "warning" | "error" | "success";

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user: { name: string | null; email: string } | null;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  info:    "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  error:   "bg-red-500/10 text-red-400 border-red-500/20",
};

function deriveSeverity(action: string): Severity {
  if (action.includes("failed") || action.includes("error") || action.includes("expired")) return "error";
  if (action.includes("warning") || action.includes("revoked") || action.includes("updated")) return "warning";
  if (action.includes("created") || action.includes("completed") || action.includes("connected") || action.includes("enabled")) return "success";
  return "info";
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).replace(",", "");
}

export function AuditClient({
  initial,
  initialTotal,
}: {
  initial: AuditEntry[];
  initialTotal: number;
}) {
  const [entries, setEntries] = useState<AuditEntry[]>(initial);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState("");
  const [resource, setResource] = useState("");
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchEntries = useCallback(async (params: { search?: string; resource?: string; offset?: number }) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (params.resource) qs.set("resource", params.resource);
      if (params.search)   qs.set("action", params.search);
      qs.set("limit", String(limit));
      qs.set("offset", String(params.offset ?? 0));

      const res = await fetch(`/api/audit?${qs}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries);
      setTotal(data.total);
      setOffset(params.offset ?? 0);
    } catch {
      toast.error("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchEntries({ search, resource, offset: 0 });
  }

  function handleExport() {
    const csv = [
      ["Timestamp", "Severity", "Action", "Resource", "Actor", "IP"].join(","),
      ...entries.map((e) => [
        formatTs(e.createdAt),
        deriveSeverity(e.action),
        e.action,
        e.resource,
        e.user?.email ?? "system",
        e.ipAddress ?? "internal",
      ].map((v) => `"${v}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Audit Log"
        subtitle="Security, administrative, and synchronization activity"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchEntries({ search, resource, offset: 0 })}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Filter bar */}
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/30 border border-border/50 flex-1 min-w-48 max-w-sm">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none w-full"
              placeholder="Search by action…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={resource}
            onChange={(e) => { setResource(e.target.value); fetchEntries({ search, resource: e.target.value, offset: 0 }); }}
            className="h-8 px-2 text-xs rounded-lg bg-muted/30 border border-border/50 text-foreground focus:outline-none"
          >
            <option value="">All resources</option>
            <option value="User">User</option>
            <option value="Service">Service</option>
            <option value="Organization">Org</option>
            <option value="ApiKey">API Key</option>
            <option value="Role">Role</option>
            <option value="Settings">Settings</option>
          </select>
          <button
            type="submit"
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" /> Apply
          </button>
        </form>

        {/* Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Timestamp", "Severity", "Action", "Actor", "Resource", "IP"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No audit events found.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const sev = deriveSeverity(entry.action);
                  return (
                    <tr key={entry.id} className="border-b border-border/40 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {formatTs(entry.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-wide ${SEVERITY_COLORS[sev]}`}>
                          {sev}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-foreground whitespace-nowrap">
                        {entry.action}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-foreground whitespace-nowrap">
                        {entry.user?.email ?? "system"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {entry.resource}{entry.resourceId ? ` · ${entry.resourceId}` : ""}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground/60 whitespace-nowrap">
                        {entry.ipAddress ?? "internal"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {Math.min(offset + 1, total)}–{Math.min(offset + limit, total)} of {total.toLocaleString()} events
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchEntries({ search, resource, offset: Math.max(0, offset - limit) })}
              disabled={offset === 0 || loading}
              className="h-7 px-3 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => fetchEntries({ search, resource, offset: offset + limit })}
              disabled={offset + limit >= total || loading}
              className="h-7 px-3 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
