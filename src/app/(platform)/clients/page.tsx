"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Modal } from "@/components/ui/modal";
import {
  Building2, ChevronDown, ChevronUp, Plus, Search, Loader2,
  CheckCircle2, AlertTriangle, XCircle, Clock, Link2, Unlink2,
  ShieldCheck, Eye, Pencil, Trash2, ArrowRight,
} from "lucide-react";
import { SEGMENTS } from "@/lib/client-segments";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DomainAuth {
  id: string;
  domain: "IDENTITY" | "VULNERABILITY" | "COMPLIANCE" | "OPERATIONS";
  status: "UNKNOWN" | "AUTHORIZED" | "NOT_AUTHORIZED";
  authorizedAt: string | null;
  notes: string | null;
}

interface OrgMapping {
  id: string;
  serviceSlug: string;
  externalId: string;
  externalName: string | null;
  confidence: number;
  isConfirmed: boolean;
  matcherKey: string | null;
  wasAutoLinked: boolean;
}

interface Suggestion {
  id: string;
  externalId: string;
  externalName: string | null;
  serviceSlug: string;
  confidence: number;
  matcherKey: string;
  matchEvidence: Record<string, string> | null;
}

interface Client {
  id: string;
  name: string;
  slug: string;
  domains: string[];
  segment: string | null;
  industry: string | null;
  tier: string | null;
  status: string;
  notes: string | null;
  mappings: OrgMapping[];
  domainAuths: DomainAuth[];
  matchSuggestions: Suggestion[];
  orgGroups: { orgGroup: { id: string; name: string; color: string | null } }[];
  _count: { tickets: number; securityEvents: number; cloudUsers: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DOMAIN_LABELS: Record<string, string> = {
  IDENTITY: "Identity",
  VULNERABILITY: "Vulnerability",
  COMPLIANCE: "Compliance",
  OPERATIONS: "Operations",
};

const MATCHER_LABELS: Record<string, string> = {
  entra_tid: "Entra tenant ID",
  verified_domain: "Verified domain",
  domain: "Domain",
  name: "Name match",
  halopsa_source: "HaloPSA source",
  manual: "Manual",
};

function ConfidencePill({ value }: { value: number }) {
  const color = value >= 90 ? "text-emerald-400" : value >= 70 ? "text-amber-400" : "text-red-400";
  return <span className={`text-xs font-semibold tabular-nums ${color}`}>{value}%</span>;
}

function AuthStatusIcon({ status }: { status: DomainAuth["status"] }) {
  if (status === "AUTHORIZED") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
  if (status === "NOT_AUTHORIZED") return <XCircle className="w-3.5 h-3.5 text-red-500" />;
  return <Clock className="w-3.5 h-3.5 text-muted-foreground/50" />;
}

function authSummary(auths: DomainAuth[]) {
  const authorized = auths.filter((a) => a.status === "AUTHORIZED").length;
  const total = 4;
  return `${authorized}/${total}`;
}

// ─── Review Queue ─────────────────────────────────────────────────────────────

function SuggestionRow({
  suggestion,
  orgName,
  orgId,
  onConfirm,
  onReject,
}: {
  suggestion: Suggestion;
  orgName: string;
  orgId: string;
  onConfirm: (id: string, orgId: string) => Promise<void>;
  onReject: (id: string, orgId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);

  async function handle(action: "confirm" | "reject") {
    setBusy(action);
    try {
      if (action === "confirm") await onConfirm(suggestion.id, orgId);
      else await onReject(suggestion.id, orgId);
    } finally {
      setBusy(null);
    }
  }

  const evidence = suggestion.matchEvidence;
  const evidenceStr = evidence
    ? Object.entries(evidence).map(([k, v]) => `${k}: ${v}`).join(", ")
    : "";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground truncate">
            &ldquo;{suggestion.externalName ?? suggestion.externalId}&rdquo;
          </span>
          <span className="text-xs text-muted-foreground">in {suggestion.serviceSlug}</span>
          <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold text-foreground">{orgName}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <ConfidencePill value={suggestion.confidence} />
          <span className="text-[10px] text-muted-foreground">
            {MATCHER_LABELS[suggestion.matcherKey] ?? suggestion.matcherKey}
            {evidenceStr ? ` · ${evidenceStr}` : ""}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => handle("confirm")}
          disabled={busy !== null}
          className="flex items-center gap-1 h-7 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors disabled:opacity-60"
        >
          {busy === "confirm" ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
          Confirm
        </button>
        <button
          onClick={() => handle("reject")}
          disabled={busy !== null}
          className="flex items-center gap-1 h-7 px-3 rounded-md border border-border hover:bg-muted/40 text-foreground text-xs font-medium transition-colors disabled:opacity-60"
        >
          {busy === "reject" ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
          Reject
        </button>
      </div>
    </div>
  );
}

// ─── Domain Auth Grid ─────────────────────────────────────────────────────────

function DomainAuthGrid({
  auths,
  orgId,
  onUpdate,
}: {
  auths: DomainAuth[];
  orgId: string;
  onUpdate: (updated: DomainAuth) => void;
}) {
  const domains = ["IDENTITY", "VULNERABILITY", "COMPLIANCE", "OPERATIONS"] as const;

  async function cycle(auth: DomainAuth) {
    const next: DomainAuth["status"] =
      auth.status === "UNKNOWN" ? "AUTHORIZED" :
      auth.status === "AUTHORIZED" ? "NOT_AUTHORIZED" : "UNKNOWN";

    const res = await fetch(`/api/clients/${orgId}/domain-auth/${auth.domain}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const updated = await res.json() as DomainAuth;
      onUpdate(updated);
    } else {
      toast.error("Failed to update authorization status.");
    }
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {domains.map((domain) => {
        const auth = auths.find((a) => a.domain === domain) ?? {
          id: "", domain, status: "UNKNOWN" as const, authorizedAt: null, notes: null,
        };
        const bg =
          auth.status === "AUTHORIZED" ? "bg-emerald-950/30 border-emerald-800/40" :
          auth.status === "NOT_AUTHORIZED" ? "bg-red-950/30 border-red-800/40" :
          "bg-muted/20 border-border/40";
        const label =
          auth.status === "AUTHORIZED" ? "Authorized" :
          auth.status === "NOT_AUTHORIZED" ? "Not authorized" :
          "Awaiting auth";

        return (
          <button
            key={domain}
            onClick={() => cycle(auth)}
            className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-colors hover:brightness-110 ${bg}`}
            title="Click to cycle: Awaiting → Authorized → Not authorized"
          >
            <div>
              <p className="text-xs font-semibold text-foreground">{DOMAIN_LABELS[domain]}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
            <AuthStatusIcon status={auth.status} />
          </button>
        );
      })}
    </div>
  );
}

// ─── Client Profile Drawer ────────────────────────────────────────────────────

function ClientProfile({
  client,
  onClose,
  onUpdated,
  onSplitMapping,
}: {
  client: Client;
  onClose: () => void;
  onUpdated: (c: Client) => void;
  onSplitMapping: (orgId: string, mappingId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: client.name,
    segment: client.segment ?? "",
    domains: client.domains.join(", "),
    tier: client.tier ?? "",
    industry: client.industry ?? "",
    notes: client.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [auths, setAuths] = useState(client.domainAuths);
  const [splitting, setSplitting] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          segment: form.segment.trim() || null,
          domains: form.domains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean),
          tier: form.tier.trim() || null,
          industry: form.industry.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json() as Client;
      onUpdated({ ...client, ...updated });
      setEditing(false);
      toast.success("Client updated.");
    } catch {
      toast.error("Failed to update client.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSplit(mappingId: string) {
    setSplitting(mappingId);
    await onSplitMapping(client.id, mappingId);
    setSplitting(null);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h2 className="text-base font-semibold text-foreground">{client.name}</h2>
          <p className="text-xs text-muted-foreground">{client.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={client.status.toLowerCase() as never} />
          {!editing && (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 h-7 px-3 rounded-md border border-border text-xs text-foreground hover:bg-muted/40 transition-colors">
              <Pencil className="w-3 h-3" /> Edit
            </button>
          )}
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-md border border-border hover:bg-muted/40 text-muted-foreground transition-colors text-lg leading-none">×</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Profile fields */}
        {editing ? (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Profile</h3>
            <div className="grid grid-cols-2 gap-3">
              {(["name", "domains", "tier", "industry"] as const).map((field) => (
                <div key={field} className={field === "name" ? "col-span-2" : ""}>
                  <label className="text-xs text-muted-foreground capitalize">{field === "domains" ? "Domains (comma-separated)" : field}</label>
                  <input
                    value={form[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="mt-1 w-full h-8 px-2 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground">Segment</label>
                <select
                  value={form.segment}
                  onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
                  className="mt-1 w-full h-8 px-2 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— None —</option>
                  {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full px-2 py-1.5 rounded-md bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="h-7 px-3 rounded-md border border-border text-xs text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 h-7 px-4 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} Save
              </button>
            </div>
          </section>
        ) : (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Profile</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {[
                ["Segment", client.segment],
                ["Industry", client.industry],
                ["Tier", client.tier],
                ["Domains", client.domains.join(", ") || "—"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-foreground font-medium">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {client.notes && <p className="text-xs text-muted-foreground mt-1">{client.notes}</p>}
          </section>
        )}

        {/* Record counts */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Ingested Records</h3>
          <div className="flex gap-3">
            {[
              { label: "Tickets", value: client._count.tickets },
              { label: "Security Events", value: client._count.securityEvents },
              { label: "Cloud Users", value: client._count.cloudUsers },
            ].map(({ label, value }) => (
              <div key={label} className="flex-1 rounded-lg bg-muted/20 border border-border/40 p-2.5 text-center">
                <p className="text-lg font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Domain authorization */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Data Domain Authorization</h3>
          <p className="text-[10px] text-muted-foreground mb-2">Click a domain to cycle: Awaiting → Authorized → Not authorized</p>
          <DomainAuthGrid
            auths={auths}
            orgId={client.id}
            onUpdate={(updated) => setAuths((prev) => prev.map((a) => (a.domain === updated.domain ? updated : a)))}
          />
        </section>

        {/* Service mappings */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Service Mappings ({client.mappings.length})
          </h3>
          {client.mappings.length === 0 ? (
            <p className="text-xs text-muted-foreground">No service mappings yet.</p>
          ) : (
            <div className="space-y-1.5">
              {client.mappings.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg bg-muted/20 border border-border/40 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground capitalize">{m.serviceSlug}</span>
                      <ConfidencePill value={m.confidence} />
                      {m.matcherKey && (
                        <span className="text-[10px] text-muted-foreground/60">
                          {MATCHER_LABELS[m.matcherKey] ?? m.matcherKey}
                        </span>
                      )}
                      {m.wasAutoLinked && (
                        <span className="text-[10px] bg-amber-950/40 text-amber-400 border border-amber-800/40 rounded px-1">auto</span>
                      )}
                    </div>
                    <p className="text-xs text-foreground truncate">{m.externalName ?? m.externalId}</p>
                  </div>
                  {m.wasAutoLinked && (
                    <button
                      onClick={() => handleSplit(m.id)}
                      disabled={splitting === m.id}
                      title="Split this auto-link"
                      className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-40"
                    >
                      {splitting === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink2 className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Create Client Modal ──────────────────────────────────────────────────────

function CreateClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: Client) => void;
}) {
  const [form, setForm] = useState({ name: "", segment: "", domains: "", tier: "Standard" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug,
          segment: form.segment.trim() || null,
          domains: form.domains.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean),
          tier: form.tier,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      const org = await res.json() as Client;
      toast.success(`Client "${org.name}" created.`);
      onCreated({ ...org, mappings: [], domainAuths: [], matchSuggestions: [], orgGroups: [], _count: { tickets: 0, securityEvents: 0, cloudUsers: 0 } });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {[
        { label: "Client Name", field: "name" as const, placeholder: "Acme Corporation", required: true },
        { label: "Domains (comma-separated)", field: "domains" as const, placeholder: "acme.com, acme.co.uk" },
      ].map(({ label, field, placeholder, required }) => (
        <div key={field} className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">
            {label}{required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <input
            value={form[field]}
            onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
            placeholder={placeholder}
            className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      ))}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Segment</label>
        <select
          value={form.segment}
          onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— None —</option>
          {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Service Tier</label>
        <select
          value={form.tier}
          onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {["Standard", "Professional", "Enterprise"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create Client
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [queueOpen, setQueueOpen] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeClient, setActiveClient] = useState<Client | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clients");
      if (res.ok) setClients(await res.json() as Client[]);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pendingSuggestions = useMemo(
    () => clients.flatMap((c) => c.matchSuggestions.map((s) => ({ ...s, orgName: c.name, orgId: c.id }))),
    [clients],
  );

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || c.domains.some((d) => d.includes(q)) || (c.segment ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || c.status.toLowerCase() === statusFilter;
      const matchesPending = !showPendingOnly || c.matchSuggestions.length > 0;
      return matchesSearch && matchesStatus && matchesPending;
    });
  }, [clients, search, statusFilter, showPendingOnly]);

  async function confirmSuggestion(id: string, orgId: string) {
    const res = await fetch(`/api/match-suggestions/${id}/confirm`, { method: "POST" });
    if (!res.ok) { toast.error("Failed to confirm."); return; }
    const data = await res.json() as { backfill: { tickets: number; securityEvents: number; cloudUsers: number } };
    const total = data.backfill.tickets + data.backfill.securityEvents + data.backfill.cloudUsers;
    toast.success(`Confirmed. ${total} record${total !== 1 ? "s" : ""} backfilled.`);
    // Reload to reflect the new OrgMapping and cleared suggestion
    await load();
    if (activeClient?.id === orgId) {
      const fresh = await fetch(`/api/clients/${orgId}`);
      if (fresh.ok) setActiveClient(await fresh.json() as Client);
    }
  }

  async function rejectSuggestion(id: string, orgId: string) {
    const res = await fetch(`/api/match-suggestions/${id}/reject`, { method: "POST" });
    if (!res.ok) { toast.error("Failed to reject."); return; }
    toast.success("Suggestion rejected — won't be re-suggested.");
    setClients((prev) =>
      prev.map((c) =>
        c.id === orgId
          ? { ...c, matchSuggestions: c.matchSuggestions.filter((s) => s.id !== id) }
          : c,
      ),
    );
  }

  async function splitMapping(orgId: string, mappingId: string) {
    const res = await fetch(`/api/clients/${orgId}/mappings/${mappingId}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to split mapping."); return; }
    const data = await res.json() as { reversed: { tickets: number; securityEvents: number; cloudUsers: number } };
    const total = data.reversed.tickets + data.reversed.securityEvents + data.reversed.cloudUsers;
    toast.success(`Mapping split. ${total} record${total !== 1 ? "s" : ""} unlinked.`);
    await load();
    if (activeClient?.id === orgId) {
      const fresh = await fetch(`/api/clients/${orgId}`);
      if (fresh.ok) setActiveClient(await fresh.json() as Client);
    }
  }

  const totalActive = clients.filter((c) => c.status === "ACTIVE").length;
  const totalMapped = clients.filter((c) => c.mappings.length > 0).length;

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 ${activeClient ? "mr-[440px]" : ""}`}>
        <PageHeader
          title="Clients"
          subtitle="Canonical client records — every external system maps to one record here"
          actions={
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Client
            </button>
          }
        />

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Clients", value: clients.length },
              { label: "Active", value: totalActive },
              { label: "Service-Mapped", value: totalMapped },
              { label: "Pending Review", value: pendingSuggestions.length, highlight: pendingSuggestions.length > 0 },
            ].map((s) => (
              <div key={s.label} className={`rounded-lg border p-4 ${s.highlight ? "border-amber-800/50 bg-amber-950/20" : "border-border bg-card"}`}>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-xl font-bold mt-1 ${s.highlight ? "text-amber-400" : "text-foreground"}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Review Queue */}
          {pendingSuggestions.length > 0 && (
            <div className="rounded-xl border border-amber-800/40 bg-amber-950/10 overflow-hidden">
              <button
                onClick={() => setQueueOpen((o) => !o)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-amber-300 hover:bg-amber-950/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Review Queue — {pendingSuggestions.length} pending match{pendingSuggestions.length !== 1 ? "es" : ""}
                </div>
                {queueOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {queueOpen && (
                <div className="px-5 pb-4">
                  {pendingSuggestions.map((s) => (
                    <SuggestionRow
                      key={s.id}
                      suggestion={s}
                      orgName={s.orgName}
                      orgId={s.orgId}
                      onConfirm={confirmSuggestion}
                      onReject={rejectSuggestion}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/30 border border-border/50 flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none w-full"
                placeholder="Search clients, domains, segments…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2 text-xs rounded-lg bg-muted/30 border border-border/50 text-foreground focus:outline-none"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="archived">Archived</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showPendingOnly}
                onChange={(e) => setShowPendingOnly(e.target.checked)}
                className="rounded"
              />
              Pending review only
            </label>
          </div>

          {/* Client list */}
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <Building2 className="w-8 h-8 text-muted-foreground/40" />
              {clients.length === 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">No clients yet.</p>
                  <p className="text-xs text-muted-foreground/70">Clients are created when connectors sync (e.g. HaloPSA), or add one manually.</p>
                  <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                    <Plus className="w-3 h-3" /> Add Client
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No clients match your filters.</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((client) => {
                const isActive = activeClient?.id === client.id;
                const pendingCount = client.matchSuggestions.length;
                const authCount = authSummary(client.domainAuths);

                return (
                  <div
                    key={client.id}
                    className={`rounded-xl border transition-colors cursor-pointer ${isActive ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:border-border/80 hover:bg-card/80"}`}
                    onClick={() => setActiveClient(isActive ? null : client)}
                  >
                    <div className="flex items-center gap-4 px-5 py-3.5">
                      <Building2 className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{client.name}</span>
                          {client.segment && (
                            <span className="text-[10px] bg-muted/40 text-muted-foreground rounded px-1.5 py-0.5">{client.segment}</span>
                          )}
                          {pendingCount > 0 && (
                            <span className="text-[10px] bg-amber-950/40 text-amber-400 border border-amber-800/40 rounded px-1.5 py-0.5">
                              {pendingCount} pending
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {client.domains.length > 0 ? client.domains.join(", ") : "no domains"}
                          {client.tier ? ` · ${client.tier}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                        <span title="Service mappings">
                          <Link2 className="w-3.5 h-3.5 inline mr-1 opacity-60" />{client.mappings.length}
                        </span>
                        <span title="Domain auth">
                          <ShieldCheck className="w-3.5 h-3.5 inline mr-1 opacity-60" />{authCount}
                        </span>
                        <StatusBadge status={client.status.toLowerCase() as never} />
                        <Eye className="w-3.5 h-3.5 opacity-40" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Client Profile Drawer */}
      {activeClient && (
        <div className="fixed right-0 top-0 bottom-0 w-[440px] bg-background border-l border-border shadow-2xl z-30 flex flex-col">
          <ClientProfile
            client={activeClient}
            onClose={() => setActiveClient(null)}
            onUpdated={(updated) => {
              setActiveClient(updated);
              setClients((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
            }}
            onSplitMapping={splitMapping}
          />
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Client" description="Create a canonical client record." size="sm">
        <CreateClientModal
          onClose={() => setCreateOpen(false)}
          onCreated={(c) => setClients((prev) => [c, ...prev])}
        />
      </Modal>
    </div>
  );
}
