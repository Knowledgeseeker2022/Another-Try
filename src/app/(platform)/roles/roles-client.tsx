"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Modal } from "@/components/ui/modal";
import { Plus, Lock, Loader2, Trash2 } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  "Super Admin": "text-red-400 bg-red-500/10 border-red-500/20",
  "Admin":       "text-primary bg-primary/10 border-primary/20",
  "Support":     "text-accent bg-accent/10 border-accent/20",
  "Read-Only":   "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  byResource: Record<string, string[]>;
  userCount: number;
}

function NewRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: (r: RoleRow) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      const created = await res.json() as { id: string };
      toast.success(`Role "${name}" created.`);
      onCreated({ id: created.id, name: name.trim(), description: description.trim() || null, isSystem: false, byResource: {}, userCount: 0 });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create role.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Role Name <span className="text-red-400">*</span></label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Billing Manager"
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Can manage billing and subscriptions."
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <p className="text-xs text-muted-foreground">Permissions can be assigned to the role after creation.</p>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create Role
        </button>
      </div>
    </form>
  );
}

export function RolesClient({ initial }: { initial: RoleRow[] }) {
  const [roles, setRoles] = useState<RoleRow[]>(initial);
  const [newRoleOpen, setNewRoleOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDeleteRole(role: RoleRow) {
    if (!confirm(`Delete role "${role.name}"? Users with this role will lose it.`)) return;
    setDeleting(role.id);
    try {
      const res = await fetch("/api/roles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: role.id }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? "Failed to delete role");
        return;
      }
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
      toast.success(`Role "${role.name}" deleted.`);
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Roles"
        subtitle={`${roles.length} roles · Role-based access control`}
        actions={
          <button
            onClick={() => setNewRoleOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Role
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {roles.map((role) => {
            const colorClass = ROLE_COLORS[role.name] ?? "text-muted-foreground bg-muted/10 border-border";
            const resources = Object.entries(role.byResource);
            return (
              <div key={role.id} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-foreground">{role.name}</h3>
                      {role.isSystem && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 border border-border/50 rounded px-1.5 py-0.5">
                          <Lock className="w-2.5 h-2.5" /> System
                        </span>
                      )}
                    </div>
                    {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${colorClass}`}>
                      {role.userCount} user{role.userCount !== 1 ? "s" : ""}
                    </span>
                    {!role.isSystem && (
                      <button
                        onClick={() => handleDeleteRole(role)}
                        disabled={deleting === role.id}
                        title="Delete role"
                        className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                      >
                        {deleting === role.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-5 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Permissions</p>
                  {resources.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No permissions assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {resources.slice(0, 8).map(([resource, actions]) => (
                        <div key={resource} className="flex items-center justify-between">
                          <span className="text-xs text-foreground">{resource}</span>
                          <div className="flex items-center gap-1">
                            {actions.map((action) => (
                              <span key={action} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/50 text-muted-foreground">{action}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                      {resources.length > 8 && <p className="text-xs text-muted-foreground">+{resources.length - 8} more resources</p>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={newRoleOpen} onClose={() => setNewRoleOpen(false)} title="New Role" description="Create a custom role. Assign permissions to it after creation." size="sm">
        <NewRoleModal
          onClose={() => setNewRoleOpen(false)}
          onCreated={(r) => setRoles((prev) => [...prev, r])}
        />
      </Modal>
    </div>
  );
}
