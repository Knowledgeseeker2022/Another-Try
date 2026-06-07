"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Modal } from "@/components/ui/modal";
import { Plus, Users2, Loader2, Trash2 } from "lucide-react";

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  roles: string[];
}

function NewGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (g: GroupRow) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      const created = await res.json() as { id: string; createdAt: string };
      toast.success(`Group "${name}" created.`);
      onCreated({ id: created.id, name: name.trim(), description: description.trim() || null, createdAt: created.createdAt, memberCount: 0, roles: [] });
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering Team"
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Internal engineering and technical staff."
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring" />
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


export function GroupsClient({ initial }: { initial: GroupRow[] }) {
  const [groups, setGroups] = useState<GroupRow[]>(initial);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const columns = [
    {
      key: "name",
      header: "Group",
      render: (g: GroupRow) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-secondary/15 border border-secondary/20 flex items-center justify-center">
            <Users2 className="w-3.5 h-3.5 text-secondary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{g.name}</p>
            {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
          </div>
        </div>
      ),
    },
    {
      key: "memberCount",
      header: "Members",
      render: (g: GroupRow) => <span className="text-sm text-foreground tabular-nums">{g.memberCount}</span>,
    },
    {
      key: "roles",
      header: "Assigned Roles",
      render: (g: GroupRow) => (
        <div className="flex flex-wrap gap-1">
          {g.roles.length > 0 ? (
            g.roles.map((r) => (
              <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">{r}</span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No roles</span>
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (g: GroupRow) => (
        <span className="text-xs text-muted-foreground">
          {new Date(g.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (g: GroupRow) => (
        <button
          onClick={() => handleDelete(g)}
          disabled={deleting === g.id}
          className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
        >
          {deleting === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      ),
    },
  ];

  async function handleDelete(g: GroupRow) {
    if (!confirm(`Delete group "${g.name}"?`)) return;
    setDeleting(g.id);
    try {
      const res = await fetch("/api/groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: g.id }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? "Failed to delete group");
        return;
      }
      setGroups((prev) => prev.filter((x) => x.id !== g.id));
      toast.success(`Group "${g.name}" deleted.`);
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Groups"
        subtitle={`${groups.length} group${groups.length !== 1 ? "s" : ""} · User grouping and permission assignment`}
        actions={
          <button
            onClick={() => setNewGroupOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Group
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <Users2 className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No groups yet.</p>
            <button onClick={() => setNewGroupOpen(true)} className="flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
              <Plus className="w-3 h-3" /> Create Group
            </button>
          </div>
        ) : (
          <DataTable columns={columns} data={groups} keyField="id" emptyMessage="No groups found." />
        )}
      </div>

      <Modal open={newGroupOpen} onClose={() => setNewGroupOpen(false)} title="New Group" description="Create a user group for organizing team members and assigning roles." size="sm">
        <NewGroupModal
          onClose={() => setNewGroupOpen(false)}
          onCreated={(g) => setGroups((prev) => [...prev, g])}
        />
      </Modal>
    </div>
  );
}
