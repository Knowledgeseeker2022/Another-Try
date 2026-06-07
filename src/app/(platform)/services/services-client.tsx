"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  RefreshCw, Settings, AlertCircle, CheckCircle2, Clock,
  Plug, Database, ChevronRight, Unplug, Loader2, Link2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Modal } from "@/components/ui/modal";
import { SERVICE_META, type ServiceMeta } from "@/lib/service-config";
import { formatRelativeTime } from "@/lib/utils";

interface DbService {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR" | "PENDING" | "DISABLED";
  syncMode: "POLLING" | "WEBHOOK";
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  pollInterval: number | null;
  errorMessage: string | null;
  hasCredentials: boolean;
  _count?: { syncLogs: number };
}

type ModalMode = "connect" | "settings";

function statusToUI(s: DbService["status"]): "connected" | "disconnected" | "error" | "pending" | "warning" {
  const map: Record<string, "connected" | "disconnected" | "error" | "pending" | "warning"> = {
    CONNECTED: "connected",
    DISCONNECTED: "disconnected",
    ERROR: "error",
    PENDING: "pending",
    DISABLED: "disconnected",
  };
  return map[s] ?? "disconnected";
}

function CategoryBadge({ category }: { category: string }) {
  if (!category) return null;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/50 text-muted-foreground font-medium">
      {category}
    </span>
  );
}

// ── Connect / Settings Modal ──────────────────────────────────────────────────

function ConnectModal({
  service,
  meta,
  mode,
  onClose,
  onSaved,
}: {
  service: DbService;
  meta: ServiceMeta;
  mode: ModalMode;
  onClose: () => void;
  onSaved: (updated: DbService) => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pollInterval, setPollInterval] = useState(meta.pollIntervalMinutes);
  const [syncMode, setSyncMode] = useState<"POLLING" | "WEBHOOK">(service.syncMode ?? "POLLING");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  function setField(key: string, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const missing = meta.credentialFields.filter((f) => f.required && !fields[f.key]?.trim());
    if (missing.length > 0) {
      toast.error(`Required: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/services/${service.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: fields, pollInterval, syncMode }),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      toast.success(`${service.name} connected successfully`);
      onSaved(updated);
      onClose();
    } catch {
      toast.error("Failed to save credentials. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${service.name}? Stored credentials will be removed.`)) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/services/${service.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${service.name} disconnected`);
      onSaved({ ...service, status: "DISCONNECTED", hasCredentials: false });
      onClose();
    } catch {
      toast.error("Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  }

  const authBadge: Record<string, string> = {
    "oauth2": "OAuth 2.0",
    "api-key": "API Key",
    "basic": "Basic Auth",
    "token": "Token",
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {/* Service header */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
          style={{ backgroundColor: `${meta.color}20`, borderColor: `${meta.color}30` }}
        >
          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: meta.color }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{meta.name}</p>
          <p className="text-xs text-muted-foreground">{meta.category} · {authBadge[meta.authType] ?? meta.authType}</p>
        </div>
        {service.status === "CONNECTED" && (
          <StatusBadge status="connected" />
        )}
      </div>

      <p className="text-xs text-muted-foreground">{meta.description}</p>

      {/* Credential fields */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {mode === "settings" && service.hasCredentials ? "Update Credentials" : "API Credentials"}
        </p>
        {mode === "settings" && service.hasCredentials && (
          <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Credentials are stored. Fill fields below to replace them.
          </div>
        )}
        {meta.credentialFields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground flex items-center gap-1">
              {field.label}
              {field.required && <span className="text-red-400">*</span>}
            </label>
            {field.help && <p className="text-[11px] text-muted-foreground">{field.help}</p>}
            <input
              type={field.type === "password" ? "password" : field.type === "url" ? "url" : "text"}
              placeholder={field.placeholder}
              value={fields[field.key] ?? ""}
              onChange={(e) => setField(field.key, e.target.value)}
              autoComplete="off"
              className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>
        ))}
      </div>

      {/* Sync mode toggle */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Sync Mode</p>
        <div className="grid grid-cols-2 gap-2">
          {(["POLLING", "WEBHOOK"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSyncMode(mode)}
              className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-colors ${
                syncMode === mode
                  ? "border-primary/60 bg-primary/8 text-foreground"
                  : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <span className="text-xs font-semibold">{mode === "POLLING" ? "Polling" : "Webhook"}</span>
              <span className="text-[10px] leading-snug">
                {mode === "POLLING"
                  ? "Worker pulls data on a schedule"
                  : `Push to /api/webhooks/${service.slug}`}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Poll interval — only shown in polling mode */}
      {syncMode === "POLLING" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Sync Interval (minutes)</label>
          <input
            type="number"
            min={1}
            max={1440}
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
            className="h-9 w-32 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
        </div>
      )}

      {/* Webhook info */}
      {syncMode === "WEBHOOK" && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-muted/20 border border-border/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Webhook URL</p>
          <code className="text-xs text-foreground font-mono break-all select-all">
            {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/{service.slug}
          </code>
          <p className="text-[11px] text-muted-foreground mt-1">
            Point your {meta.name} webhook settings to this URL. Only POST requests with a valid signature are accepted.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        {service.status === "CONNECTED" ? (
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-60"
          >
            {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
            Disconnect
          </button>
        ) : <div />}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {service.status === "CONNECTED" ? "Update" : "Connect"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Service Card ──────────────────────────────────────────────────────────────

function ServiceCard({
  service,
  onOpenModal,
  onSync,
}: {
  service: DbService;
  onOpenModal: (svc: DbService, mode: ModalMode) => void;
  onSync: (svc: DbService) => void;
}) {
  const meta = SERVICE_META[service.slug];
  const uiStatus = statusToUI(service.status);
  const color = meta?.color ?? "#6b7280";

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden transition-colors ${
        service.status === "ERROR" ? "border-red-500/30" :
        service.status === "CONNECTED" ? "border-emerald-500/20" :
        "border-border"
      }`}
    >
      {/* Header */}
      <div className="px-4 py-4 border-b border-border/60">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${color}20`, borderColor: `${color}30` }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{service.name}</h3>
              <CategoryBadge category={service.category} />
            </div>
          </div>
          <StatusBadge status={uiStatus} />
        </div>
      </div>

      {/* Description */}
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {meta?.description ?? `${service.name} integration`}
        </p>
      </div>

      {/* Error */}
      {service.errorMessage && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-md bg-red-500/8 border border-red-500/20 px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-400">{service.errorMessage}</p>
        </div>
      )}

      {/* Stats (connected only) */}
      {service.status === "CONNECTED" && (
        <div className="px-4 pb-3 grid grid-cols-2 gap-2">
          {service.lastSyncAt && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>{formatRelativeTime(service.lastSyncAt)}</span>
            </div>
          )}
          {service.pollInterval && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Every {Math.round(service.pollInterval / 60)}m</span>
            </div>
          )}
          {service._count?.syncLogs !== undefined && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Database className="w-3 h-3" />
              <span>{service._count.syncLogs} sync runs</span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between">
        {service.status === "DISCONNECTED" || service.status === "PENDING" ? (
          <button
            onClick={() => onOpenModal(service, "connect")}
            className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Link2 className="w-3 h-3" />
            Connect
          </button>
        ) : service.status === "ERROR" ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenModal(service, "connect")}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              Reconnect
            </button>
            <button
              onClick={() => onSync(service)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Retry Sync
            </button>
          </div>
        ) : (
          <button
            onClick={() => onSync(service)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Sync Now
          </button>
        )}

        {(service.status === "CONNECTED" || service.status === "ERROR") && (
          <button
            onClick={() => onOpenModal(service, "settings")}
            className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            title="Service settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Future slot card ──────────────────────────────────────────────────────────

function FutureCard() {
  return (
    <div className="rounded-xl border border-dashed border-border/50 bg-card/40 overflow-hidden flex flex-col items-center justify-center text-center p-8 gap-3 min-h-[200px]">
      <div className="w-10 h-10 rounded-full bg-muted/30 border border-border flex items-center justify-center">
        <Plug className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">Future Integration</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Additional connector slots available</p>
      </div>
      <button className="flex items-center gap-1 text-xs text-primary hover:underline">
        Request Integration <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ServicesClient({ initial }: { initial: DbService[] }) {
  const [services, setServices] = useState<DbService[]>(initial);
  const [modalService, setModalService] = useState<DbService | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("connect");
  const [syncing, setSyncing] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const res = await fetch("/api/services");
    if (res.ok) {
      const data = await res.json();
      setServices(data);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refetch, 30_000);
    return () => clearInterval(id);
  }, [refetch]);

  function openModal(svc: DbService, mode: ModalMode) {
    setModalService(svc);
    setModalMode(mode);
  }

  function handleSaved(updated: DbService) {
    setServices((prev) => prev.map((s) => (s.slug === updated.slug ? { ...s, ...updated } : s)));
  }

  async function handleSync(svc: DbService) {
    setSyncing(svc.slug);
    try {
      const res = await fetch(`/api/services/${svc.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message ?? `${svc.name} sync triggered`);
        await refetch();
      } else {
        toast.error(data.error ?? "Sync failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSyncing(null);
    }
  }

  const connected = services.filter((s) => s.status === "CONNECTED").length;
  const errored   = services.filter((s) => s.status === "ERROR").length;
  const warned    = services.filter((s) => s.status === "PENDING").length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Services"
        subtitle="Integration and connector management"
        actions={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Connected",     value: connected,              color: "text-emerald-400" },
            { label: "Errors",        value: errored,                color: "text-red-400"     },
            { label: "Not Connected", value: services.length - connected - errored, color: "text-muted-foreground" },
            { label: "Total Services",value: services.length,        color: "text-primary"     },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`text-xl font-bold mt-1 ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Error banner */}
        {errored > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-400">Action required on {errored} integration{errored > 1 ? "s" : ""}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Services in error state are not syncing. Click Reconnect to restore data flow.</p>
            </div>
          </div>
        )}

        {/* Warning: nothing connected yet */}
        {connected === 0 && errored === 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <Plug className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">No services connected yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click <strong>Connect</strong> on any service card to enter your API credentials and begin syncing data.</p>
            </div>
          </div>
        )}

        {/* Service grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((svc) => (
            <div key={svc.slug} className={syncing === svc.slug ? "opacity-70 pointer-events-none" : ""}>
              <ServiceCard
                service={svc}
                onOpenModal={openModal}
                onSync={handleSync}
              />
            </div>
          ))}
          <FutureCard />
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <RefreshCw className="w-3 h-3" />
          Status auto-refreshes every 30 seconds
        </p>
      </div>

      {/* Connect / Settings Modal */}
      {modalService && SERVICE_META[modalService.slug] && (
        <Modal
          open={!!modalService}
          onClose={() => setModalService(null)}
          title={modalMode === "connect" ? `Connect ${modalService.name}` : `${modalService.name} Settings`}
          description={
            modalMode === "connect"
              ? "Enter your API credentials to begin syncing data into Bedrock."
              : "Update credentials or adjust sync settings."
          }
          size="md"
        >
          <ConnectModal
            service={modalService}
            meta={SERVICE_META[modalService.slug]}
            mode={modalMode}
            onClose={() => setModalService(null)}
            onSaved={handleSaved}
          />
        </Modal>
      )}
    </div>
  );
}
