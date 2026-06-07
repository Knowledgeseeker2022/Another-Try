import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Database, Clock, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Zap, Server, HardDrive, Activity,
  Plug2, Building2, Users, Cpu,
} from "lucide-react";

function SeverityIcon({ severity }: { severity: "error" | "warning" }) {
  if (severity === "error") return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
  return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
}

type ServiceStatus = "connected" | "disconnected" | "error" | "pending" | "warning";

function statusToUI(s: string): ServiceStatus {
  const map: Record<string, ServiceStatus> = {
    CONNECTED: "connected", DISCONNECTED: "disconnected",
    ERROR: "error", PENDING: "pending", DISABLED: "disconnected",
  };
  return map[s] ?? "disconnected";
}

function MetricRow({
  label, value, pct, color, icon,
}: {
  label: string; value: string; pct: number; color: string; icon?: React.ReactNode;
}) {
  const barColor =
    color === "emerald" ? "bg-emerald-500" :
    color === "amber"   ? "bg-amber-500"   :
    color === "red"     ? "bg-red-500"     :
    color === "primary" ? "bg-primary"     : "bg-primary";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</span>
        <span className="text-xs font-medium text-foreground">{value}</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function getRedisInfo(): Promise<{
  connected: boolean; usedMemoryMb: number; maxMemoryMb: number; hitRate: number; uptimeSeconds: number;
}> {
  try {
    await redis.ping();
    const info = await redis.info("all");
    const get = (key: string) => {
      const m = info.match(new RegExp(`^${key}:(.*?)\\r?$`, "m"));
      return m ? m[1].trim() : "0";
    };
    const usedBytes   = parseInt(get("used_memory"), 10) || 0;
    const maxBytes    = parseInt(get("maxmemory"), 10) || 0;
    const hits        = parseInt(get("keyspace_hits"), 10) || 0;
    const misses      = parseInt(get("keyspace_misses"), 10) || 0;
    const uptimeSec   = parseInt(get("uptime_in_seconds"), 10) || 0;
    const total = hits + misses;
    return {
      connected: true,
      usedMemoryMb: Math.round(usedBytes / 1024 / 1024 * 10) / 10,
      maxMemoryMb:  maxBytes > 0 ? Math.round(maxBytes / 1024 / 1024) : 256,
      hitRate:      total > 0 ? Math.round((hits / total) * 100) : 0,
      uptimeSeconds: uptimeSec,
    };
  } catch {
    return { connected: false, usedMemoryMb: 0, maxMemoryMb: 256, hitRate: 0, uptimeSeconds: 0 };
  }
}

export default async function DashboardPage() {
  const [services, users, recentAudit, orgCount, auditCount, redisInfo, ticketCount, eventCount, cloudUserCount] = await Promise.all([
    db.service.findMany({ orderBy: { name: "asc" } }),
    db.user.findMany({ select: { isActive: true } }),
    db.auditLog.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    db.organization.count(),
    db.auditLog.count(),
    getRedisInfo(),
    db.ticket.count(),
    db.securityEvent.count(),
    db.cloudUser.count(),
  ]);

  const connected   = services.filter((s) => s.status === "CONNECTED").length;
  const errored     = services.filter((s) => s.status === "ERROR").length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const appUptime   = formatUptime(Math.floor(process.uptime()));

  const errorAlerts = services
    .filter((s) => s.status === "ERROR" && s.errorMessage)
    .map((s) => ({ id: s.id, message: s.errorMessage!, source: s.name, severity: "error" as const }));

  const auditErrors = recentAudit
    .filter((e) => e.action.includes("failed") || e.action.includes("error"))
    .slice(0, 3)
    .map((e) => ({ id: e.id, message: `${e.action} — ${e.resource}`, source: "system", severity: "warning" as const }));

  const allAlerts = [...errorAlerts, ...auditErrors].slice(0, 5);

  const memPct = redisInfo.maxMemoryMb > 0
    ? Math.round((redisInfo.usedMemoryMb / redisInfo.maxMemoryMb) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Dashboard"
        subtitle="Platform health, service status, and system metrics"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Services Online"
            value={`${connected}/${services.length}`}
            change={errored > 0 ? `${errored} in error state` : "All healthy"}
            changeType={errored > 0 ? "negative" : "positive"}
            icon={<Plug2 className="w-4 h-4" />}
          />
          <StatCard
            title="Organizations"
            value={String(orgCount)}
            change={orgCount === 0 ? "Sync HaloPSA to populate" : "in database"}
            changeType="neutral"
            icon={<Building2 className="w-4 h-4" />}
          />
          <StatCard
            title="Platform Users"
            value={String(users.length)}
            change={`${activeUsers} active`}
            changeType="positive"
            icon={<Users className="w-4 h-4" />}
          />
          <StatCard
            title="Data Records"
            value={String(ticketCount + eventCount + cloudUserCount)}
            change={`${ticketCount} tickets · ${eventCount} alerts · ${cloudUserCount} users`}
            changeType="neutral"
            icon={<Database className="w-4 h-4" />}
          />
        </div>

        {/* System health grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Database card — real counts */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" /> Database
              </h3>
              <StatusBadge status="healthy" />
            </div>
            <div className="space-y-3">
              <MetricRow label="Organizations" value={String(orgCount)} pct={Math.min((orgCount / 100) * 100, 100)} color="emerald" />
              <MetricRow label="Services registered" value={`${services.length} / 11`} pct={Math.round((services.length / 11) * 100)} color="primary" />
              <MetricRow label="Audit events" value={auditCount.toLocaleString()} pct={Math.min((auditCount / 10000) * 100, 100)} color="primary" />
              <MetricRow label="Data records" value={(ticketCount + eventCount + cloudUserCount).toLocaleString()} pct={Math.min(((ticketCount + eventCount + cloudUserCount) / 50000) * 100, 100)} color="emerald" />
            </div>
          </div>

          {/* Redis card — real info */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Redis / Cache
              </h3>
              <StatusBadge status={redisInfo.connected ? "healthy" : "error"} />
            </div>
            <div className="space-y-3">
              <MetricRow
                label="Connection"
                value={redisInfo.connected ? "Connected" : "Unreachable"}
                pct={redisInfo.connected ? 100 : 0}
                color={redisInfo.connected ? "emerald" : "red"}
              />
              <MetricRow
                label="Memory used"
                value={redisInfo.connected ? `${redisInfo.usedMemoryMb} MB / ${redisInfo.maxMemoryMb} MB` : "—"}
                pct={memPct}
                color={memPct > 80 ? "red" : memPct > 60 ? "amber" : "emerald"}
              />
              <MetricRow
                label="Cache hit rate"
                value={redisInfo.connected ? `${redisInfo.hitRate}%` : "—"}
                pct={redisInfo.hitRate}
                color={redisInfo.hitRate > 70 ? "emerald" : redisInfo.hitRate > 40 ? "amber" : "primary"}
              />
              <MetricRow
                label="Redis uptime"
                value={redisInfo.connected ? formatUptime(redisInfo.uptimeSeconds) : "—"}
                pct={100}
                color="primary"
              />
            </div>
          </div>

          {/* System card — real process info */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Server className="w-4 h-4 text-accent" /> System
              </h3>
              <StatusBadge status="healthy" />
            </div>
            <div className="space-y-3">
              <MetricRow label="App server" value="Next.js 15" pct={100} color="emerald" icon={<Cpu className="w-3 h-3" />} />
              <MetricRow label="Runtime" value={process.version} pct={100} color="primary" icon={<Server className="w-3 h-3" />} />
              <MetricRow label="Storage" value="PostgreSQL" pct={100} color="emerald" icon={<HardDrive className="w-3 h-3" />} />
              <MetricRow label="App uptime" value={appUptime} pct={100} color="emerald" icon={<Clock className="w-3 h-3" />} />
            </div>
          </div>
        </div>

        {/* Alerts */}
        {allAlerts.length > 0 && (
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Active Alerts
                <span className="text-xs bg-destructive/15 text-destructive border border-destructive/20 rounded-full px-2 py-0.5">
                  {allAlerts.length}
                </span>
              </h3>
            </div>
            <div className="divide-y divide-border/50">
              {allAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 px-5 py-3">
                  <SeverityIcon severity={alert.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Services summary */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Plug2 className="w-4 h-4 text-primary" /> Service Health
              </h3>
              <a href="/services" className="text-xs text-primary hover:underline">Manage</a>
            </div>
            <div className="divide-y divide-border/50">
              {services.map((svc) => (
                <div key={svc.slug} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{svc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {svc.lastSyncAt
                        ? `Last sync: ${new Date(svc.lastSyncAt).toLocaleTimeString()}`
                        : svc.status === "CONNECTED" ? "Awaiting first sync" : "Not connected"}
                    </p>
                  </div>
                  <StatusBadge status={statusToUI(svc.status)} />
                </div>
              ))}
            </div>
          </div>

          {/* Recent audit activity */}
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" /> Recent Activity
              </h3>
              <a href="/audit-log" className="text-xs text-primary hover:underline">View log</a>
            </div>
            <div className="divide-y divide-border/50">
              {recentAudit.length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-muted-foreground">No activity yet.</div>
              ) : (
                recentAudit.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground font-mono">{entry.action}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {entry.resource}{entry.resourceId ? ` · ${entry.resourceId.slice(0, 8)}` : ""}
                        {entry.user ? ` · ${entry.user.email}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>Dashboard data is live from the database · Refresh the page to update</span>
          <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-1" />
        </div>
      </div>
    </div>
  );
}
