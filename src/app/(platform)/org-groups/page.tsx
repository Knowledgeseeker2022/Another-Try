"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Modal } from "@/components/ui/modal";
import { Plus, FolderKanban, Loader2, Trash2 } from "lucide-react";

interface OrgGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  criteria: Record<string, string> | null;
  _count: { members: number };
}

const COLORS = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ef4444", "#0ea5e9", "#6b7280", "#ec4899"];

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (g: OrgGroup) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [criteria, setCriteria] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/org-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, color, criteria: criteria.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      const group = await res.json() as OrgGroup;
      toast.success(`Org group "${group.name}" created.`);
      onCreated({ ...group, _count: { members: 0 } });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Group Name <span className="text-red-400">*</span></label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enterprise Clients"
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Large organizations on enterprise service plans."
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Filter Criteria</label>
        <input value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder='Tier = Enterprise'
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
        <p className="text-[11px] text-muted-foreground">Optional: expression used for auto-assignment.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Color</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? "border-white scale-125" : "border-transparent"}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create Group
        </button>
      </div>
    </form>
  );
}

export default function OrgGroupsPage() {
  const [groups, setGroups] = useState<OrgGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(group: OrgGroup) {
    if (!confirm(`Delete org group "${group.name}"?`)) return;
    setDeleting(group.id);
    try {
      const res = await fetch("/api/org-groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: group.id }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? "Failed to delete");
        return;
      }
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      toast.success(`"${group.name}" deleted.`);
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => {
    fetch("/api/org-groups")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setGroups(data as OrgGroup[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Org Groups"
        subtitle="Organize clients by tier, compliance, industry, and custom criteria"
        actions={
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Org Group
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <FolderKanban className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No org groups yet.</p>
            <p className="text-xs text-muted-foreground/70">Create a group to segment your client organizations by tier, industry, or compliance requirements.</p>
            <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="w-3 h-3" /> Create Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((group) => {
              const color = group.color ?? "#6b7280";
              const criteriaRule = group.criteria ? (group.criteria as Record<string, string>).rule ?? JSON.stringify(group.criteria) : null;
              return (
                <div key={group.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-border/80 transition-colors">
                  <div className="h-1.5" style={{ backgroundColor: color }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
                          <FolderKanban className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold tabular-nums" style={{ color }}>{group._count.members}</span>
                        <button
                          onClick={() => handleDelete(group)}
                          disabled={deleting === group.id}
                          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                        >
                          {deleting === group.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    {group.description && (
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{group.description}</p>
                    )}
                    {criteriaRule && (
                      <div className="rounded-md bg-muted/20 border border-border/40 px-2.5 py-1.5 mb-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Filter Criteria</p>
                        <code className="text-xs text-primary font-mono">{criteriaRule}</code>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{group._count.members} organization{group._count.members !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Org Group" description="Create a group to organize client organizations." size="sm">
        <CreateGroupModal
          onClose={() => setCreateOpen(false)}
          onCreated={(g) => setGroups((prev) => [...prev, g])}
        />
      </Modal>
    </div>
  );
}
