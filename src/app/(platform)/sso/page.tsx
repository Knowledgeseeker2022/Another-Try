"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Fingerprint, ShieldCheck, Users, Globe, Settings,
  AlertTriangle, Loader2, X, Plus, ExternalLink,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface SsoConfig {
  id: string;
  provider: string;
  tenantId: string | null;
  clientId: string | null;
  domains: string[];
  isEnabled: boolean;
  isDefault: boolean;
  hasSecret: boolean;
}

function ConfigureModal({
  config,
  onClose,
  onSaved,
}: {
  config: SsoConfig;
  onClose: () => void;
  onSaved: (c: SsoConfig) => void;
}) {
  const [domains, setDomains] = useState<string[]>(config.domains);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/sso", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as SsoConfig;
      toast.success("SSO settings updated.");
      onSaved(updated);
      onClose();
    } catch {
      toast.error("Failed to update SSO settings.");
    } finally {
      setSaving(false);
    }
  }

  function addDomain() {
    const d = newDomain.trim().toLowerCase().replace(/^@/, "");
    if (!d || domains.includes(d)) return;
    setDomains((prev) => [...prev, d]);
    setNewDomain("");
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Allowed Domains</p>
        <p className="text-xs text-muted-foreground">Only users with these email domains can sign in via SSO.</p>
        <div className="space-y-2">
          {domains.map((d) => (
            <div key={d} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/20 border border-border/40">
              <span className="text-sm font-mono text-foreground">@{d}</span>
              <button onClick={() => setDomains((prev) => prev.filter((x) => x !== d))} className="text-muted-foreground hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDomain()}
            placeholder="company.com"
            className="flex-1 h-8 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={addDomain} className="flex items-center gap-1 h-8 px-3 rounded-lg bg-muted/40 border border-border text-xs font-medium text-foreground hover:bg-muted/70 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}

export default function SSOPage() {
  const [config, setConfig] = useState<SsoConfig | null | "loading">("loading");
  const [configureOpen, setConfigureOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    fetch("/api/sso")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setConfig(data as SsoConfig | null))
      .catch(() => setConfig(null));
  }, []);

  async function handleToggle() {
    if (!config || config === "loading") return;
    setToggling(true);
    try {
      const res = await fetch("/api/sso", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !config.isEnabled }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as SsoConfig;
      setConfig(updated);
      toast.success(updated.isEnabled ? "SSO enabled." : "SSO disabled.");
    } catch {
      toast.error("Failed to update SSO status.");
    } finally {
      setToggling(false);
    }
  }

  if (config === "loading") {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="SSO" subtitle="Microsoft Entra ID single sign-on management" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader title="SSO" subtitle="Microsoft Entra ID single sign-on management" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-10 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted/30 border border-border flex items-center justify-center">
              <Fingerprint className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">SSO not configured</p>
              <p className="text-xs text-muted-foreground mt-1">Set up Microsoft Entra ID to allow your team to sign in with their Microsoft accounts.</p>
            </div>
            <a
              href="/sso-setup"
              className="flex items-center gap-2 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" /> Configure SSO
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="SSO"
        subtitle="Microsoft Entra ID single sign-on management"
        actions={
          <button
            onClick={() => setConfigureOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" /> Configure
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Status banner */}
        <div className={`rounded-xl border p-5 flex items-start gap-4 ${config.isEnabled ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
          <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${config.isEnabled ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
            <ShieldCheck className={`w-5 h-5 ${config.isEnabled ? "text-emerald-500" : "text-amber-400"}`} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {config.isEnabled ? "SSO Active" : "SSO Disabled"} — {config.provider}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {config.isEnabled
                ? "Single sign-on is enabled. Users can authenticate via Microsoft Entra ID."
                : "SSO is configured but currently disabled. Enable to allow Microsoft login."}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`shrink-0 flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-colors ${
              config.isEnabled
                ? "border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            } disabled:opacity-60`}
          >
            {toggling && <Loader2 className="w-3 h-3 animate-spin" />}
            {config.isEnabled ? "Disable" : "Enable"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Provider config */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-primary" /> Identity Provider
            </h3>
            <div className="space-y-3">
              {[
                { label: "Provider",   value: config.provider },
                { label: "Tenant ID",  value: config.tenantId ? `${config.tenantId.slice(0, 8)}…${config.tenantId.slice(-4)}` : "—", mono: true },
                { label: "Client ID",  value: config.clientId ? `${config.clientId.slice(0, 8)}…${config.clientId.slice(-4)}` : "—", mono: true },
                { label: "Secret",     value: config.hasSecret ? "Configured ✓" : "Not set", mono: false },
                { label: "Status",     value: config.isDefault ? "Active (Default)" : "Active" },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4">
                  <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
                  <span className={`text-xs text-foreground text-right break-all ${row.mono ? "font-mono" : "font-medium"}`}>{row.value}</span>
                </div>
              ))}
            </div>
            <a href="/sso-setup" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Edit credentials <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Domains */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-accent" /> Allowed Domains
            </h3>
            <div className="space-y-2">
              {config.domains.length === 0 ? (
                <p className="text-xs text-muted-foreground">No domains configured. Add a domain to restrict SSO access.</p>
              ) : (
                config.domains.map((domain) => (
                  <div key={domain} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 border border-border/40">
                    <span className="text-sm font-mono text-foreground">@{domain}</span>
                    <StatusBadge status="active" label="Allowed" />
                  </div>
                ))
              )}
              <button
                onClick={() => setConfigureOpen(true)}
                className="w-full py-2 px-3 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
              >
                + Add domain
              </button>
            </div>
          </div>

          {/* Usage */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-secondary" /> SSO Usage
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Allowed Domains", value: String(config.domains.length) },
                { label: "Auth Method",     value: "OAuth 2.0 / PKCE" },
                { label: "Default IdP",     value: config.isDefault ? "Yes" : "No" },
                { label: "Provider",        value: config.provider },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-muted/20 border border-border/40 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm font-semibold text-foreground mt-1">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Warning if SSO disabled */}
          {!config.isEnabled && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-4">
              <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-400">SSO is configured but not enabled</p>
                <p className="text-xs text-muted-foreground mt-0.5">Users are currently logging in with local passwords only. Enable SSO above to allow Microsoft sign-in.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={configureOpen}
        onClose={() => setConfigureOpen(false)}
        title="Configure SSO Domains"
        description="Manage which email domains are allowed to sign in via SSO."
        size="sm"
      >
        <ConfigureModal
          config={config}
          onClose={() => setConfigureOpen(false)}
          onSaved={(updated) => setConfig(updated)}
        />
      </Modal>
    </div>
  );
}
