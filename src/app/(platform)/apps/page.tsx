"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Modal } from "@/components/ui/modal";
import { Plus, AppWindow, ExternalLink, Loader2, Trash2 } from "lucide-react";

const AVAILABLE_SCOPES = [
  "read:orgs", "write:orgs", "read:services", "write:services",
  "read:users", "write:users", "read:audit", "read:api-keys", "read:*",
];

interface App {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  url: string | null;
  status: string;
  isInternal: boolean;
  scopes: string[];
  createdAt: string;
}

function AppTypeTag({ isInternal }: { isInternal: boolean }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${isInternal ? "bg-secondary/10 border-secondary/20 text-secondary" : "bg-accent/10 border-accent/20 text-accent"}`}>
      {isInternal ? "Internal" : "Client-Facing"}
    </span>
  );
}

function RegisterModal({ onClose, onCreated }: { onClose: () => void; onCreated: (a: App) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [scopes, setScopes] = useState<string[]>(["read:orgs"]);
  const [saving, setSaving] = useState(false);

  function toggleScope(s: string) {
    setScopes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug, description: description.trim() || null, url: url.trim() || null, scopes, isInternal }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      const app = await res.json() as App;
      toast.success(`App "${app.name}" registered.`);
      onCreated(app);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to register app.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">App Name <span className="text-red-400">*</span></label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Analytics App"
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">URL</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://myapp.example.com" type="url"
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description of what this app does."
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Type</label>
        <div className="grid grid-cols-2 gap-2">
          {[{ v: true, label: "Internal" }, { v: false, label: "Client-Facing" }].map(({ v, label }) => (
            <button key={label} type="button" onClick={() => setIsInternal(v)}
              className={`h-8 rounded-lg border text-xs font-medium transition-colors ${isInternal === v ? "border-primary/60 bg-primary/8 text-foreground" : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/40"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Scopes</label>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_SCOPES.map((s) => (
            <button key={s} type="button" onClick={() => toggleScope(s)}
              className={`text-[10px] px-2 py-1 rounded border font-mono transition-colors ${scopes.includes(s) ? "bg-primary/10 border-primary/40 text-primary" : "bg-muted/20 border-border/50 text-muted-foreground hover:bg-muted/40"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Register
        </button>
      </div>
    </form>
  );
}

export default function AppsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(app: App) {
    if (!confirm(`Delete app "${app.name}"? This cannot be undone.`)) return;
    setDeleting(app.id);
    try {
      const res = await fetch("/api/apps", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? "Failed to delete");
        return;
      }
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      toast.success(`"${app.name}" removed.`);
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => {
    fetch("/api/apps")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setApps(data as App[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Apps"
        subtitle="Application registry — internal and client-facing apps consuming Bedrock data"
        actions={
          <button onClick={() => setRegisterOpen(true)} className="flex items-center gap-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Register App
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <AppWindow className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No apps registered yet.</p>
            <p className="text-xs text-muted-foreground/70">Register internal tools or client-facing apps that consume Bedrock data via the API.</p>
            <button onClick={() => setRegisterOpen(true)} className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="w-3 h-3" /> Register App
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {apps.map((app) => (
              <div key={app.id} className={`rounded-xl border bg-card overflow-hidden transition-colors hover:border-border/80 ${app.status === "DEPRECATED" ? "opacity-60 border-border/40" : "border-border"}`}>
                <div className="px-4 py-4 border-b border-border/60 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <AppWindow className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{app.name}</p>
                      <AppTypeTag isInternal={app.isInternal} />
                    </div>
                  </div>
                  <StatusBadge status={app.status.toLowerCase() as "active" | "beta" | "inactive"} />
                </div>
                <div className="px-4 py-3">
                  {app.description && <p className="text-xs text-muted-foreground leading-relaxed mb-3">{app.description}</p>}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {app.scopes.map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30 border border-border/40 text-muted-foreground font-mono">{s}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-mono">{app.slug}</span>
                    <div className="flex items-center gap-2">
                      {app.url && (
                        <a href={app.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                          Open <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(app)}
                        disabled={deleting === app.id}
                        className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                        title="Delete app"
                      >
                        {deleting === app.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={registerOpen} onClose={() => setRegisterOpen(false)} title="Register Application" description="Add an app to the registry so it can access Bedrock data via the API." size="md">
        <RegisterModal onClose={() => setRegisterOpen(false)} onCreated={(a) => setApps((prev) => [...prev, a])} />
      </Modal>
    </div>
  );
}
