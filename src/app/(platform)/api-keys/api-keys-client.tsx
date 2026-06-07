"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Copy, RotateCcw, Trash2, Key, Loader2, CheckCheck, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";
import { Modal } from "@/components/ui/modal";
import { formatRelativeTime } from "@/lib/utils";

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  scopes: string[];
  user: { name: string | null; email: string } | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

const AVAILABLE_SCOPES = [
  "read:tickets",
  "read:security-events",
  "read:cloud-users",
  "read:orgs", "write:orgs",
  "read:users", "write:users",
  "read:services", "write:services",
  "read:api-keys",
  "read:audit",
  "read:*",
];

function GenerateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (k: ApiKeyRow, raw: string) => void }) {
  const [form, setForm] = useState({ name: "", scopes: [] as string[], expiresAt: "" });
  const [saving, setSaving] = useState(false);

  function toggleScope(s: string) {
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(s) ? f.scopes.filter((x) => x !== s) : [...f.scopes, s],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { toast.error("Key name is required"); return; }
    if (form.scopes.length === 0) { toast.error("Select at least one scope"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          scopes: form.scopes,
          expiresAt: form.expiresAt || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to generate key");
        return;
      }
      const { rawKey, ...key } = await res.json();
      onCreated({ ...key, user: null }, rawKey);
      onClose();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Key name <span className="text-red-400">*</span></label>
        <input
          type="text"
          placeholder="e.g. Dashboard Production"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-foreground">Scopes <span className="text-red-400">*</span></label>
        <div className="grid grid-cols-2 gap-1.5">
          {AVAILABLE_SCOPES.map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={form.scopes.includes(s)}
                onChange={() => toggleScope(s)}
                className="rounded border-border bg-input accent-primary"
              />
              <span className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors">{s}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Expiry date <span className="text-muted-foreground font-normal">(optional)</span></label>
        <input
          type="date"
          value={form.expiresAt}
          onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-48"
        />
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-400">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        The full key is shown only once after creation. Store it securely.
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Generate Key
        </button>
      </div>
    </form>
  );
}

function NewKeyModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20 text-xs text-emerald-400">
        <CheckCheck className="w-4 h-4 shrink-0 mt-0.5" />
        Key generated successfully. This is the only time the full key is shown.
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Your API key</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-lg bg-muted/30 border border-border text-xs font-mono text-foreground break-all">
            {rawKey}
          </code>
          <button
            onClick={copy}
            className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
          >
            {copied ? <CheckCheck className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={onClose} className="h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
          Done
        </button>
      </div>
    </div>
  );
}

export function ApiKeysClient({ initial }: { initial: ApiKeyRow[] }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initial);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  function handleCreated(k: ApiKeyRow, raw: string) {
    setKeys((prev) => [k, ...prev]);
    setNewKey(raw);
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revoke key "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await fetch("/api/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setKeys((prev) => prev.map((k) => k.id === id ? { ...k, status: "REVOKED" as const } : k));
      toast.success(`Key "${name}" revoked`);
    } catch {
      toast.error("Failed to revoke key");
    } finally {
      setDeleting(null);
    }
  }

  const active  = keys.filter((k) => k.status === "ACTIVE").length;
  const revoked = keys.filter((k) => k.status === "REVOKED").length;

  const columns = [
    {
      key: "name",
      header: "Key",
      render: (k: ApiKeyRow) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Key className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{k.name}</p>
            <p className="text-xs font-mono text-muted-foreground">{k.keyPrefix}••••••••</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (k: ApiKeyRow) => (
        <StatusBadge status={k.status === "ACTIVE" ? "active" : "revoked"} />
      ),
    },
    {
      key: "scopes",
      header: "Scopes",
      render: (k: ApiKeyRow) => (
        <div className="flex flex-wrap gap-1">
          {k.scopes.map((s) => (
            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/50 text-muted-foreground font-mono">
              {s}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      render: (k: ApiKeyRow) => (
        <span className="text-xs text-foreground">{k.user?.name ?? k.user?.email ?? "System"}</span>
      ),
    },
    {
      key: "lastUsedAt",
      header: "Last Used",
      render: (k: ApiKeyRow) => (
        <span className="text-xs text-muted-foreground">{formatRelativeTime(k.lastUsedAt)}</span>
      ),
    },
    {
      key: "expiresAt",
      header: "Expires",
      render: (k: ApiKeyRow) => (
        <span className="text-xs text-muted-foreground">{k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : "Never"}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (k: ApiKeyRow) => (
        <div className="flex items-center gap-1.5 justify-end">
          {k.status === "ACTIVE" && (
            <button
              title="Rotate key"
              className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              onClick={() => toast.info("Key rotation: generate a new key and revoke this one.")}
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
          <button
            title={k.status === "ACTIVE" ? "Revoke" : "Delete"}
            disabled={deleting === k.id}
            onClick={() => handleRevoke(k.id, k.name)}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
          >
            {deleting === k.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="API Keys"
        subtitle="Manage API credentials and access scopes"
        actions={
          <button
            onClick={() => setGenerateOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Generate Key
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Keys", value: keys.length },
            { label: "Active",     value: active      },
            { label: "Revoked",    value: revoked     },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl font-bold text-foreground mt-1">{s.value}</p>
            </div>
          ))}
        </div>
        <DataTable columns={columns} data={keys} keyField="id" emptyMessage="No API keys found. Generate your first key." />
      </div>

      <Modal open={generateOpen} onClose={() => setGenerateOpen(false)} title="Generate API Key" description="Create a new API key with specific scopes." size="md">
        <GenerateModal onClose={() => setGenerateOpen(false)} onCreated={handleCreated} />
      </Modal>

      <Modal open={!!newKey} onClose={() => setNewKey(null)} title="Key Generated" size="md">
        {newKey && <NewKeyModal rawKey={newKey} onClose={() => setNewKey(null)} />}
      </Modal>
    </div>
  );
}
