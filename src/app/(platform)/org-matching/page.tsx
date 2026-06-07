"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Modal } from "@/components/ui/modal";
import {
  CheckCircle2, AlertCircle, Search, RefreshCw, Link2, Loader2, Building2,
} from "lucide-react";

interface OrgMapping {
  id: string;
  serviceSlug: string;
  externalId: string;
  externalName: string | null;
  confidence: number;
  isConfirmed: boolean;
}

interface Org {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: string;
  tier: string | null;
  mappings: OrgMapping[];
}

function ConfidencePill({ confidence }: { confidence: number }) {
  const color =
    confidence >= 95 ? "text-emerald-400" :
    confidence >= 80 ? "text-amber-400" : "text-red-400";
  return <span className={`text-xs font-medium tabular-nums ${color}`}>{confidence}%</span>;
}

function CreateOrgModal({ onClose, onCreated }: { onClose: () => void; onCreated: (org: Org) => void }) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [tier, setTier] = useState("Standard");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug, domain: domain.trim() || null, tier }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      const org = await res.json() as Org;
      toast.success(`Organization "${org.name}" created.`);
      onCreated({ ...org, mappings: [] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create organization.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Organization Name <span className="text-red-400">*</span></label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corporation"
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Primary Domain</label>
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com"
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Service Tier</label>
        <select value={tier} onChange={(e) => setTier(e.target.value)}
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          {["Standard", "Professional", "Enterprise"].map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create
        </button>
      </div>
    </form>
  );
}

export default function OrgMatchingPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [rematching, setRematching] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  async function loadOrgs() {
    setLoading(true);
    try {
      const res = await fetch("/api/orgs");
      if (res.ok) {
        const data = await res.json() as Org[];
        setOrgs(data);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadOrgs(); }, []);

  const filtered = useMemo(() => {
    return orgs.filter((org) => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        org.name.toLowerCase().includes(q) ||
        (org.domain ?? "").toLowerCase().includes(q) ||
        org.mappings.some((m) => (m.externalName ?? "").toLowerCase().includes(q));
      const allConfirmed = org.mappings.every((m) => m.isConfirmed);
      const matchesFilter =
        filter === "all" ||
        (filter === "confirmed" && allConfirmed) ||
        (filter === "unconfirmed" && !allConfirmed);
      return matchesSearch && matchesFilter;
    });
  }, [orgs, search, filter]);

  async function handleConfirm(orgId: string) {
    setConfirming(orgId);
    try {
      const res = await fetch(`/api/orgs/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmMappings: true }),
      });
      if (!res.ok) throw new Error();
      setOrgs((prev) =>
        prev.map((o) =>
          o.id === orgId
            ? { ...o, mappings: o.mappings.map((m) => ({ ...m, isConfirmed: true })) }
            : o
        )
      );
      toast.success("Mappings confirmed.");
    } catch {
      toast.error("Failed to confirm mappings.");
    } finally {
      setConfirming(null);
    }
  }

  async function handleRematchAll() {
    setRematching(true);
    await new Promise((r) => setTimeout(r, 800));
    toast.info("Re-match requires the sync worker to be running. Start it with: npm run worker");
    setRematching(false);
  }

  const confirmed = orgs.filter((o) => o.mappings.every((m) => m.isConfirmed)).length;
  const unconfirmed = orgs.filter((o) => o.mappings.some((m) => !m.isConfirmed)).length;
  const totalMappings = orgs.reduce((s, o) => s + o.mappings.length, 0);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Org Matching"
        subtitle="Map organizations across all integrated systems into normalized records"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleRematchAll}
              disabled={rematching}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors disabled:opacity-60"
            >
              {rematching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Re-match All
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Link2 className="w-3.5 h-3.5" /> Create Org
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Orgs",     value: orgs.length },
            { label: "Confirmed",      value: confirmed,    sub: "fully matched" },
            { label: "Unconfirmed",    value: unconfirmed,  sub: "needs review"  },
            { label: "Total Mappings", value: totalMappings },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
              {s.sub && <p className="text-[10px] text-muted-foreground">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/30 border border-border/50 flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none w-full"
              placeholder="Search organizations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 px-2 text-xs rounded-lg bg-muted/30 border border-border/50 text-foreground focus:outline-none"
          >
            <option value="all">All statuses</option>
            <option value="confirmed">Confirmed only</option>
            <option value="unconfirmed">Unconfirmed only</option>
          </select>
        </div>

        {/* Empty state */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <Building2 className="w-8 h-8 text-muted-foreground/40" />
            {orgs.length === 0 ? (
              <>
                <p className="text-sm text-muted-foreground">No organizations yet.</p>
                <p className="text-xs text-muted-foreground/70">Organizations are created automatically when HaloPSA or other PSA services sync. Or create one manually.</p>
                <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                  <Link2 className="w-3 h-3" /> Create Organization
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No organizations match your search.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((org) => {
              const allConfirmed = org.mappings.every((m) => m.isConfirmed);
              return (
                <div key={org.id} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-border/60">
                    <div className="flex items-center gap-3">
                      {allConfirmed
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{org.name}</h3>
                        <p className="text-xs text-muted-foreground">
                          {org.domain ?? "no domain"}{org.tier ? ` · ${org.tier}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={org.status.toLowerCase() as "active" | "pending"} />
                      {!allConfirmed && org.mappings.length > 0 && (
                        <button
                          onClick={() => handleConfirm(org.id)}
                          disabled={confirming === org.id}
                          className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
                        >
                          {confirming === org.id && <Loader2 className="w-3 h-3 animate-spin" />}
                          Confirm Match
                        </button>
                      )}
                    </div>
                  </div>

                  {org.mappings.length > 0 ? (
                    <div className="px-5 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                        System Mappings ({org.mappings.length})
                      </p>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                        {org.mappings.map((m) => (
                          <div key={m.id} className="rounded-lg bg-muted/20 border border-border/40 p-2.5">
                            <p className="text-[10px] font-semibold text-muted-foreground mb-1 capitalize">{m.serviceSlug}</p>
                            <p className="text-xs text-foreground font-medium truncate">{m.externalName ?? m.externalId}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-muted-foreground font-mono truncate">{m.externalId}</span>
                              <ConfidencePill confidence={m.confidence} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 py-3">
                      <p className="text-xs text-muted-foreground">No service mappings yet. Run a sync to link this org across systems.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Organization" description="Manually add an organization record to the data lake." size="sm">
        <CreateOrgModal
          onClose={() => setCreateOpen(false)}
          onCreated={(org) => setOrgs((prev) => [org, ...prev])}
        />
      </Modal>
    </div>
  );
}
