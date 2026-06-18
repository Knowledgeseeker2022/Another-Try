"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Modal } from "@/components/ui/modal";
import {
  Fingerprint, ShieldCheck, Globe, Plus, Pencil, Trash2,
  Loader2, AlertTriangle, Link2, X, ChevronDown, ChevronUp,
  Building2, Users,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Org {
  id: string;
  name: string;
  slug: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
}

interface SsoGroupMapping {
  id: string;
  entraGroupId: string;
  entraGroupName: string | null;
  groupId: string;
  group: { id: string; name: string; description: string | null };
  createdAt: string;
}

interface SsoTenant {
  id: string;
  provider: string;
  name: string;
  tenantId: string;
  clientId: string | null;
  domains: string[];
  isEnabled: boolean;
  isDefault: boolean;
  orgId: string | null;
  hasSecret: boolean;
  organization: Org | null;
  _count: { groupMappings: number };
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function adminConsentUrl(tenantId: string, clientId: string | null): string | null {
  const appClientId = clientId || process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID;
  if (!tenantId || !appClientId) return null;
  const redirect = typeof window !== "undefined" ? `${window.location.origin}/api/auth/callback/microsoft-entra-id` : "";
  return `https://login.microsoftonline.com/${tenantId}/adminconsent?client_id=${appClientId}&redirect_uri=${encodeURIComponent(redirect)}`;
}

// ── Add/Edit Tenant Modal ─────────────────────────────────────────────────────

function TenantModal({
  tenant,
  orgs,
  onClose,
  onSaved,
}: {
  tenant: SsoTenant | null;
  orgs: Org[];
  onClose: () => void;
  onSaved: (t: SsoTenant) => void;
}) {
  const isEdit = !!tenant;
  const [form, setForm] = useState({
    name: tenant?.name ?? "",
    tenantId: tenant?.tenantId ?? "",
    clientId: tenant?.clientId ?? "",
    clientSecret: "",
    domains: tenant?.domains ?? [] as string[],
    isDefault: tenant?.isDefault ?? false,
    orgId: tenant?.orgId ?? "",
    isEnabled: tenant?.isEnabled ?? false,
  });
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);

  function addDomain() {
    const d = newDomain.trim().toLowerCase().replace(/^@/, "");
    if (!d || form.domains.includes(d)) return;
    setForm((f) => ({ ...f, domains: [...f.domains, d] }));
    setNewDomain("");
  }

  async function handleSave() {
    if (!form.name.trim() || !form.tenantId.trim()) {
      toast.error("Name and Tenant ID are required.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        tenantId: form.tenantId.trim(),
        clientId: form.clientId.trim() || null,
        domains: form.domains,
        isDefault: form.isDefault,
        orgId: form.orgId || null,
        isEnabled: form.isEnabled,
      };
      if (form.clientSecret) body.clientSecret = form.clientSecret;

      const url = isEdit ? `/api/sso/tenants/${tenant!.id}` : "/api/sso/tenants";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Request failed");
      }
      const saved = await res.json() as SsoTenant;
      toast.success(isEdit ? "Tenant updated." : "Tenant added.");
      onSaved(saved);
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "Failed to save tenant.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Display Name</label>
        <input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="QCT Internal"
          className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Tenant ID */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Entra Tenant ID (tid)</label>
        <p className="text-xs text-muted-foreground">The Azure AD tenant GUID — this is the verified trust anchor, not the email domain.</p>
        <input
          value={form.tenantId}
          onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Client ID / Secret (escape hatch — normally inherited from env vars) */}
      <details className="rounded-lg border border-border/60">
        <summary className="px-3 py-2.5 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
          Custom app credentials (leave blank to use shared QCT app)
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Client ID</label>
            <input
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              placeholder="Inherited from AUTH_MICROSOFT_ENTRA_ID_ID"
              className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Client Secret {isEdit && "(leave blank to keep existing)"}
            </label>
            <input
              type="password"
              value={form.clientSecret}
              onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
              placeholder={isEdit && tenant?.hasSecret ? "••••••••••••••••" : "Inherited from env var"}
              className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </details>

      {/* Domains */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Allowed Email Domains</label>
        <p className="text-xs text-muted-foreground">Secondary check only — the Entra tenant ID is the primary trust anchor.</p>
        <div className="space-y-1.5">
          {form.domains.map((d) => (
            <div key={d} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/20 border border-border/40">
              <span className="text-sm font-mono text-foreground">@{d}</span>
              <button onClick={() => setForm((f) => ({ ...f, domains: f.domains.filter((x) => x !== d) }))} className="text-muted-foreground hover:text-red-400 transition-colors">
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

      {/* Client org */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Client Organization</label>
        <p className="text-xs text-muted-foreground">Leave blank for QCT's own tenant. Set for a client tenant so their users scope to the right org.</p>
        <select
          value={form.orgId}
          onChange={(e) => setForm((f) => ({ ...f, orgId: e.target.value }))}
          className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">— None (QCT internal tenant) —</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {/* Flags */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isEnabled}
            onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))}
            className="rounded border-border text-primary"
          />
          <span className="text-sm text-foreground">Enabled</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
            className="rounded border-border text-primary"
          />
          <span className="text-sm text-foreground">Default tenant (QCT's own — only one allowed)</span>
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isEdit ? "Save Changes" : "Add Tenant"}
        </button>
      </div>
    </div>
  );
}

// ── Group Mapping Row ─────────────────────────────────────────────────────────

function MappingRow({
  tenantId,
  mapping,
  onDelete,
}: {
  tenantId: string;
  mapping: SsoGroupMapping;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Remove mapping for Entra group "${mapping.entraGroupName ?? mapping.entraGroupId}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sso/tenants/${tenantId}/mappings/${mapping.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDelete(mapping.id);
      toast.success("Mapping removed. Users will lose access on next login.");
    } catch {
      toast.error("Failed to remove mapping.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-muted/10 border border-border/40 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">
          {mapping.entraGroupName ?? <span className="font-mono text-muted-foreground">{mapping.entraGroupId}</span>}
        </p>
        {mapping.entraGroupName && (
          <p className="text-[10px] font-mono text-muted-foreground truncate">{mapping.entraGroupId}</p>
        )}
      </div>
      <div className="text-muted-foreground">→</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{mapping.group.name}</p>
        {mapping.group.description && (
          <p className="text-[10px] text-muted-foreground truncate">{mapping.group.description}</p>
        )}
      </div>
      <button onClick={handleDelete} disabled={deleting} className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40">
        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ── Add Mapping Modal ─────────────────────────────────────────────────────────

function AddMappingModal({
  tenantId,
  groups,
  onClose,
  onAdded,
}: {
  tenantId: string;
  groups: Group[];
  onClose: () => void;
  onAdded: (m: SsoGroupMapping) => void;
}) {
  const [entraGroupId, setEntraGroupId] = useState("");
  const [entraGroupName, setEntraGroupName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!entraGroupId.trim() || !groupId) {
      toast.error("Entra group ID and Lake Evendim group are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/sso/tenants/${tenantId}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entraGroupId: entraGroupId.trim(), entraGroupName: entraGroupName.trim() || null, groupId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? "Request failed");
      }
      const mapping = await res.json() as SsoGroupMapping;
      toast.success("Mapping added.");
      onAdded(mapping);
      onClose();
    } catch (e) {
      toast.error((e as Error).message || "Failed to add mapping.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Map an Entra group to a Lake Evendim group. Users in the Entra group will receive the permissions of the mapped Lake Evendim group on next login.
      </p>
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Entra Group Object ID</label>
        <p className="text-[11px] text-muted-foreground">Find this in Azure Portal → Groups → (your group) → Object ID</p>
        <input
          value={entraGroupId}
          onChange={(e) => setEntraGroupId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Entra Group Display Name (optional)</label>
        <input
          value={entraGroupName}
          onChange={(e) => setEntraGroupName(e.target.value)}
          placeholder="e.g. MSP-Technicians"
          className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Lake Evendim Group</label>
        <select
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          className="w-full h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">— Select a group —</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}{g.description ? ` — ${g.description}` : ""}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Add Mapping
        </button>
      </div>
    </div>
  );
}

// ── Tenant Card ───────────────────────────────────────────────────────────────

function TenantCard({
  tenant,
  orgs,
  groups,
  onEdit,
  onDelete,
  onToggle,
}: {
  tenant: SsoTenant;
  orgs: Org[];
  groups: Group[];
  onEdit: (t: SsoTenant) => void;
  onDelete: (id: string) => void;
  onToggle: (t: SsoTenant) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [mappings, setMappings] = useState<SsoGroupMapping[] | null>(null);
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [addMappingOpen, setAddMappingOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function loadMappings() {
    if (mappings !== null) return;
    setLoadingMappings(true);
    try {
      const res = await fetch(`/api/sso/tenants/${tenant.id}/mappings`);
      if (res.ok) setMappings(await res.json() as SsoGroupMapping[]);
    } finally {
      setLoadingMappings(false);
    }
  }

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next) await loadMappings();
  }

  async function handleDelete() {
    if (!confirm(`Delete tenant "${tenant.name}"? All group mappings and SSO-provisioned memberships will be removed.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sso/tenants/${tenant.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDelete(tenant.id);
      toast.success("Tenant deleted.");
    } catch {
      toast.error("Failed to delete tenant.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggle() {
    setToggling(true);
    try {
      const res = await fetch(`/api/sso/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEnabled: !tenant.isEnabled }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json() as SsoTenant;
      onToggle(updated);
      toast.success(updated.isEnabled ? "Tenant enabled." : "Tenant disabled.");
    } catch {
      toast.error("Failed to toggle tenant.");
    } finally {
      setToggling(false);
    }
  }

  const consentUrl = adminConsentUrl(tenant.tenantId, tenant.clientId);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${tenant.isEnabled ? "bg-emerald-500/10 border-emerald-500/20" : "bg-muted/20 border-border/60"}`}>
          <ShieldCheck className={`w-4 h-4 ${tenant.isEnabled ? "text-emerald-500" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{tenant.name}</p>
            {tenant.isDefault && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">QCT Default</span>
            )}
            {tenant.organization && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30 border border-border/40 text-muted-foreground flex items-center gap-1">
                <Building2 className="w-2.5 h-2.5" />{tenant.organization.name}
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">{tenant.tenantId}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`h-7 px-3 rounded-md text-xs font-medium transition-colors disabled:opacity-60 ${tenant.isEnabled ? "border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30" : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"}`}
          >
            {toggling ? <Loader2 className="w-3 h-3 animate-spin" /> : tenant.isEnabled ? "Disable" : "Enable"}
          </button>
          <button onClick={() => onEdit(tenant)} className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={handleDelete} disabled={deleting} className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30 transition-colors disabled:opacity-40">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleExpand} className="h-7 w-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Summary chips */}
      <div className="px-5 pb-3 flex items-center gap-3 flex-wrap">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Globe className="w-3 h-3" />
          {tenant.domains.length > 0 ? tenant.domains.map((d) => `@${d}`).join(", ") : "No domain restriction"}
        </span>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Users className="w-3 h-3" />
          {tenant._count.groupMappings} group mapping{tenant._count.groupMappings !== 1 ? "s" : ""}
        </span>
        {consentUrl && (
          <a
            href={consentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-primary hover:underline flex items-center gap-1"
          >
            <Link2 className="w-3 h-3" /> Admin consent URL
          </a>
        )}
        {!tenant.isEnabled && (
          <span className="text-[11px] text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Disabled — no SSO logins allowed
          </span>
        )}
      </div>

      {/* Expanded: group mappings */}
      {expanded && (
        <div className="border-t border-border/60 px-5 py-4 space-y-3 bg-muted/5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Group Mappings — Entra Group → Lake Evendim Group
            </p>
            <button
              onClick={() => setAddMappingOpen(true)}
              className="flex items-center gap-1 h-7 px-3 rounded-md bg-primary/10 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {loadingMappings && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingMappings && mappings?.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/60 p-4 text-center">
              <p className="text-xs text-muted-foreground">No group mappings yet.</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Without mappings, all SSO logins from this tenant will be <strong>denied</strong> (default-deny).
              </p>
            </div>
          )}

          {!loadingMappings && mappings && mappings.length > 0 && (
            <div className="space-y-1.5">
              {mappings.map((m) => (
                <MappingRow
                  key={m.id}
                  tenantId={tenant.id}
                  mapping={m}
                  onDelete={(id) => setMappings((prev) => prev?.filter((x) => x.id !== id) ?? null)}
                />
              ))}
            </div>
          )}

          {addMappingOpen && (
            <Modal
              open
              onClose={() => setAddMappingOpen(false)}
              title="Add Group Mapping"
              description={`Map an Entra group to a Lake Evendim group for tenant "${tenant.name}".`}
              size="sm"
            >
              <AddMappingModal
                tenantId={tenant.id}
                groups={groups}
                onClose={() => setAddMappingOpen(false)}
                onAdded={(m) => {
                  setMappings((prev) => [...(prev ?? []), m]);
                  setAddMappingOpen(false);
                }}
              />
            </Modal>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SSOPage() {
  const [tenants, setTenants] = useState<SsoTenant[] | "loading">("loading");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<SsoTenant | null>(null);

  const load = useCallback(async () => {
    const [tenantsRes, orgsRes, groupsRes] = await Promise.all([
      fetch("/api/sso/tenants"),
      fetch("/api/orgs"),
      fetch("/api/groups"),
    ]);
    setTenants(tenantsRes.ok ? await tenantsRes.json() as SsoTenant[] : []);
    setOrgs(orgsRes.ok ? (await orgsRes.json() as Org[]) : []);
    setGroups(groupsRes.ok ? (await groupsRes.json() as { id: string; name: string; description: string | null }[]) : []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const enabledCount = tenants === "loading" ? 0 : tenants.filter((t) => t.isEnabled).length;

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="SSO"
        subtitle="Microsoft Entra ID — multi-tenant single sign-on"
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Tenant
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Status banner */}
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${enabledCount > 0 ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
          <Fingerprint className={`w-5 h-5 shrink-0 ${enabledCount > 0 ? "text-emerald-500" : "text-amber-400"}`} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {enabledCount > 0 ? `SSO active — ${enabledCount} enabled tenant${enabledCount !== 1 ? "s" : ""}` : "SSO inactive"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {enabledCount > 0
                ? "Authenticated SSO users with no matching group mapping are denied by default."
                : "Add and enable at least one tenant to allow Microsoft sign-in."}
            </p>
          </div>
        </div>

        {/* Setup note if env creds are missing */}
        <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p><span className="font-medium text-foreground">Required: </span>Set <code className="bg-muted/40 px-1 rounded">AUTH_MICROSOFT_ENTRA_ID_ID</code> and <code className="bg-muted/40 px-1 rounded">AUTH_MICROSOFT_ENTRA_ID_SECRET</code> in your environment for the shared QCT Entra app. The app must be registered as multi-tenant ("Accounts in any organizational directory").</p>
            <p>Each client tenant&apos;s Azure AD admin must grant admin consent to your app before their users can sign in.</p>
            <p>Enable the <span className="font-medium text-foreground">groups claim</span> in your Azure app Token configuration, or ensure <code className="bg-muted/40 px-1 rounded">GroupMember.Read.All</code> is granted for Graph API fallback on overage.</p>
          </div>
        </div>

        {/* Tenant list */}
        {tenants === "loading" ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-10 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted/30 border border-border flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No SSO tenants configured</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first Entra tenant to enable single sign-on.</p>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Tenant
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tenants.map((t) => (
              <TenantCard
                key={t.id}
                tenant={t}
                orgs={orgs}
                groups={groups}
                onEdit={(updated) => setEditTenant(updated)}
                onDelete={(id) => setTenants((prev) => (prev === "loading" ? prev : prev.filter((x) => x.id !== id)))}
                onToggle={(updated) => setTenants((prev) => (prev === "loading" ? prev : prev.map((x) => (x.id === updated.id ? updated : x))))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add tenant modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add SSO Tenant"
        description="Configure an Entra ID tenant for single sign-on."
        size="md"
      >
        <TenantModal
          tenant={null}
          orgs={orgs}
          onClose={() => setAddOpen(false)}
          onSaved={(t) => {
            setTenants((prev) => (prev === "loading" ? [t] : [...prev, t]));
            setAddOpen(false);
          }}
        />
      </Modal>

      {/* Edit tenant modal */}
      {editTenant && (
        <Modal
          open
          onClose={() => setEditTenant(null)}
          title="Edit SSO Tenant"
          description={`Update configuration for "${editTenant.name}".`}
          size="md"
        >
          <TenantModal
            tenant={editTenant}
            orgs={orgs}
            onClose={() => setEditTenant(null)}
            onSaved={(updated) => {
              setTenants((prev) => (prev === "loading" ? prev : prev.map((x) => (x.id === updated.id ? updated : x))));
              setEditTenant(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
