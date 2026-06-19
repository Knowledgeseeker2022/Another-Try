"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Modal } from "@/components/ui/modal";
import { Plus, FolderKanban, Loader2, Trash2, Pencil, Zap, Users } from "lucide-react";
import { SEGMENTS } from "@/lib/client-segments";

const COLORS = ["#3b82f6", "#10b981", "#a855f7", "#f59e0b", "#ef4444", "#0ea5e9", "#6b7280", "#ec4899"];

interface ClientGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  mode: "MANUAL" | "RULE_BASED";
  ruleAttribute: string | null;
  ruleValue: string | null;
  memberCount: number;
}

function ruleLabel(g: ClientGroup): string {
  if (g.mode !== "RULE_BASED" || !g.ruleAttribute || !g.ruleValue) return "";
  if (g.ruleAttribute === "segment") return `Segment is ${g.ruleValue}`;
  return `${g.ruleAttribute} = ${g.ruleValue}`;
}

// ─── Create modal ──────────────────────────────────────────────────────────────

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (g: ClientGroup) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [mode, setMode] = useState<"MANUAL" | "RULE_BASED">("MANUAL");
  const [segment, setSegment] = useState<string>(SEGMENTS[0]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name: name.trim(), description: description.trim() || null, color, mode };
      if (mode === "RULE_BASED") { body.ruleAttribute = "segment"; body.ruleValue = segment; }
      const res = await fetch("/api/client-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json() as { error?: string }; throw new Error(err.error ?? "Failed"); }
      const created = await res.json() as ClientGroup;
      toast.success(`"${created.name}" created.`);
      onCreated(created);
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Federal Clients"
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description"
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      {/* Mode toggle */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Membership Mode</label>
        <div className="grid grid-cols-2 gap-2">
          {(["MANUAL", "RULE_BASED"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-medium transition-colors
                ${mode === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-border/80"}`}
            >
              {m === "MANUAL" ? <Users className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              {m === "MANUAL" ? "Manual" : "Rule-based"}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {mode === "MANUAL"
            ? "Add members by hand. Membership is fully managed."
            : "Members are computed automatically from the rule below. Manual additions are blocked."}
        </p>
      </div>

      {/* Rule — only for RULE_BASED */}
      {mode === "RULE_BASED" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Segment Rule</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Segment is</span>
            <select
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Color */}
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

// ─── Edit modal ────────────────────────────────────────────────────────────────

function EditModal({
  group,
  onClose,
  onSaved,
}: {
  group: ClientGroup;
  onClose: () => void;
  onSaved: (g: ClientGroup) => void;
}) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [color, setColor] = useState(group.color ?? COLORS[0]);
  const [mode, setMode] = useState<"MANUAL" | "RULE_BASED">(group.mode);
  const [segment, setSegment] = useState<string>(
    group.ruleAttribute === "segment" && group.ruleValue ? group.ruleValue : SEGMENTS[0],
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { name: name.trim(), description: description.trim() || null, color, mode };
      if (mode === "RULE_BASED") { body.ruleAttribute = "segment"; body.ruleValue = segment; }
      else { body.ruleAttribute = null; body.ruleValue = null; }
      const res = await fetch(`/api/client-groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json() as { error?: string }; throw new Error(err.error ?? "Failed"); }
      const updated = await res.json() as ClientGroup;
      toast.success(`"${updated.name}" updated.`);
      onSaved({ ...updated, memberCount: group.memberCount });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update group.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Group Name <span className="text-red-400">*</span></label>
        <input value={name} onChange={(e) => setName(e.target.value)}
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)}
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Membership Mode</label>
        <div className="grid grid-cols-2 gap-2">
          {(["MANUAL", "RULE_BASED"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-xs font-medium transition-colors
                ${mode === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-border/80"}`}>
              {m === "MANUAL" ? <Users className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
              {m === "MANUAL" ? "Manual" : "Rule-based"}
            </button>
          ))}
        </div>
      </div>

      {mode === "RULE_BASED" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-foreground">Segment Rule</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Segment is</span>
            <select value={segment} onChange={(e) => setSegment(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

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
        <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Changes
        </button>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ClientGroupsPage() {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ClientGroup | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/client-groups")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setGroups(data as ClientGroup[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(group: ClientGroup) {
    if (!confirm(`Delete group "${group.name}"? This cannot be undone.`)) return;
    setDeleting(group.id);
    try {
      const res = await fetch(`/api/client-groups/${group.id}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json() as { error?: string }; toast.error(err.error ?? "Failed"); return; }
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      toast.success(`"${group.name}" deleted.`);
    } catch { toast.error("Network error"); }
    finally { setDeleting(null); }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Client Groups"
        subtitle={`${groups.length} group${groups.length !== 1 ? "s" : ""} · Organize clients into colored buckets for dashboard filtering`}
        actions={
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Group
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
            <p className="text-sm text-muted-foreground">No client groups yet.</p>
            <p className="text-xs text-muted-foreground/70">Groups let you slice dashboards by segment — create a Manual group to hand-pick members, or a Rule-based group to auto-populate by segment.</p>
            <button onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="w-3 h-3" /> Create Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((group) => {
              const color = group.color ?? "#6b7280";
              const label = ruleLabel(group);
              return (
                <div key={group.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-border/80 transition-colors">
                  <div className="h-1.5" style={{ backgroundColor: color }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
                          <FolderKanban className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
                          <div className="flex items-center gap-1 mt-0.5">
                            {group.mode === "RULE_BASED" ? (
                              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
                                <Zap className="w-2.5 h-2.5" /> Rule-based
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/40 border border-border/40 text-muted-foreground font-medium">
                                <Users className="w-2.5 h-2.5" /> Manual
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-lg font-bold tabular-nums" style={{ color }}>{group.memberCount}</span>
                        <button onClick={() => setEditing(group)}
                          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Edit group">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(group)} disabled={deleting === group.id}
                          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40" title="Delete group">
                          {deleting === group.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {group.description && (
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{group.description}</p>
                    )}

                    {label && (
                      <div className="rounded-md bg-amber-500/5 border border-amber-500/20 px-2.5 py-1.5 mb-2">
                        <p className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-wide mb-0.5">Auto-rule</p>
                        <p className="text-xs text-amber-300 font-medium">{label}</p>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {group.memberCount} client{group.memberCount !== 1 ? "s" : ""}
                      {group.mode === "RULE_BASED" ? " · computed on read" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Client Group" description="Create a group to organize clients. Choose Manual to hand-pick members or Rule-based to auto-populate by segment." size="sm">
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={(g) => setGroups((prev) => [...prev, g])}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing ? `Edit "${editing.name}"` : ""} description="Update the group name, color, or rule." size="sm">
        {editing && (
          <EditModal
            group={editing}
            onClose={() => setEditing(null)}
            onSaved={(g) => setGroups((prev) => prev.map((x) => (x.id === g.id ? g : x)))}
          />
        )}
      </Modal>
    </div>
  );
}
