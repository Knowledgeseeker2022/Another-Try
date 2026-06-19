"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Modal } from "@/components/ui/modal";
import { GrantsEditor, type GrantDraft } from "@/components/shared/grants-editor";
import { Plus, Users2, Loader2, Trash2, Pencil } from "lucide-react";

interface Named { id: string; name: string; }
interface Member { id: string; name: string | null; email: string; }

interface GroupGrant {
  id: string;
  appId: string | null;
  scopeAllOrgs: boolean;
  role: { id: string; name: string };
  app: { id: string; name: string } | null;
  orgs: { orgId: string }[];
  orgGroups: { orgGroupId: string }[];
}

interface GroupRow {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  memberCount: number;
  members: Member[];
  grants: GroupGrant[];
}

interface RefData { roles: Named[]; apps: Named[]; orgs: Named[]; orgGroups: Named[]; }

async function loadRefData(): Promise<RefData> {
  const [roles, apps, orgs, orgGroups] = await Promise.all([
    fetch("/api/roles").then((r) => (r.ok ? r.json() : [])),
    fetch("/api/apps").then((r) => (r.ok ? r.json() : [])),
    fetch("/api/orgs").then((r) => (r.ok ? r.json() : [])),
    fetch("/api/client-groups").then((r) => (r.ok ? r.json() : [])),
  ]);
  const pick = (arr: { id: string; name: string }[]) => arr.map((x) => ({ id: x.id, name: x.name }));
  return { roles: pick(roles), apps: pick(apps), orgs: pick(orgs), orgGroups: pick(orgGroups) };
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
      const created = await res.json() as GroupRow;
      toast.success(`Group "${name}" created.`);
      onCreated({ ...created, createdAt: created.createdAt ?? new Date().toISOString(), members: created.members ?? [], grants: created.grants ?? [], memberCount: 0 });
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
      <p className="text-xs text-muted-foreground">Add members and role grants after creation via the group&apos;s Edit button.</p>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Create Group
        </button>
      </div>
    </form>
  );
}

function EditGroupModal({ group, onClose, onSaved }: { group: GroupRow; onClose: () => void; onSaved: (g: GroupRow) => void }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(group.members.map((m) => m.id));
  const [grants, setGrants] = useState<GrantDraft[]>(
    group.grants.map((gr) => ({
      roleId: gr.role.id,
      appId: gr.appId,
      scopeAllOrgs: gr.scopeAllOrgs,
      orgIds: gr.orgs.map((o) => o.orgId),
      orgGroupIds: gr.orgGroups.map((o) => o.orgGroupId),
    })),
  );
  const [allUsers, setAllUsers] = useState<Member[]>([]);
  const [ref, setRef] = useState<RefData>({ roles: [], apps: [], orgs: [], orgGroups: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRefData().then(setRef).catch(() => {});
    fetch("/api/users")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Member[]) => setAllUsers(data))
      .catch(() => {});
  }, []);

  function toggleMember(id: string) {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/groups/${group.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, memberIds, grants: grants.filter((g) => g.roleId) }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Failed");
      }
      const updated = await res.json() as { id: string; name: string; description: string | null; createdAt: string; _count: { userGroups: number }; userGroups: { user: Member }[]; groupRoles: GroupGrant[] };
      toast.success(`Group "${updated.name}" updated.`);
      onSaved({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        createdAt: group.createdAt,
        memberCount: updated._count.userGroups,
        members: updated.userGroups.map((ug) => ug.user),
        grants: updated.groupRoles,
      });
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
        <label className="text-xs font-medium text-foreground">Members <span className="text-muted-foreground font-normal">({memberIds.length} selected)</span></label>
        <div className="rounded-lg border border-border bg-input/40 p-2 max-h-40 overflow-y-auto">
          {allUsers.length === 0 && <p className="text-xs text-muted-foreground">Loading users…</p>}
          {allUsers.map((u) => (
            <label key={u.id} className="flex items-center gap-2 py-1 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={memberIds.includes(u.id)}
                onChange={() => toggleMember(u.id)}
                className="w-4 h-4 rounded border-border bg-input accent-primary"
              />
              <span>{u.name ?? u.email}</span>
              {u.name && <span className="text-xs text-muted-foreground">{u.email}</span>}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Role grants <span className="text-muted-foreground font-normal">(applied to every member)</span></label>
        <GrantsEditor {...ref} value={grants} onChange={setGrants} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Group
        </button>
      </div>
    </div>
  );
}

export function GroupsClient({ initial }: { initial: GroupRow[] }) {
  const [groups, setGroups] = useState<GroupRow[]>(initial);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [editing, setEditing] = useState<GroupRow | null>(null);
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
          {g.grants.length > 0 ? (
            g.grants.map((gr) => {
              const scoped = !gr.scopeAllOrgs || gr.appId !== null;
              return (
                <span key={gr.id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
                  {gr.role.name}{scoped && <span className="ml-1 text-amber-400" title="Scoped grant">●</span>}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground">No roles</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (g: GroupRow) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(g); }}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Edit group"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(g); }}
            disabled={deleting === g.id}
            className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
            title="Delete group"
          >
            {deleting === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          </button>
        </div>
      ),
    },
  ];

  async function handleDelete(g: GroupRow) {
    if (!confirm(`Delete group "${g.name}"?`)) return;
    setDeleting(g.id);
    try {
      const res = await fetch(`/api/groups/${g.id}`, { method: "DELETE" });
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
        subtitle={`${groups.length} group${groups.length !== 1 ? "s" : ""} · User grouping and scoped role assignment`}
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
          <DataTable columns={columns} data={groups} keyField="id" emptyMessage="No groups found." onRowClick={(g) => setEditing(g)} />
        )}
      </div>

      <Modal open={newGroupOpen} onClose={() => setNewGroupOpen(false)} title="New Group" description="Create a user group for organizing team members and assigning roles." size="sm">
        <NewGroupModal
          onClose={() => setNewGroupOpen(false)}
          onCreated={(g) => setGroups((prev) => [...prev, g])}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing ? `Edit "${editing.name}"` : ""} description="Manage members and scoped role grants. Roles attached here apply to every member." size="md">
        {editing && (
          <EditGroupModal
            group={editing}
            onClose={() => setEditing(null)}
            onSaved={(g) => setGroups((prev) => prev.map((x) => (x.id === g.id ? g : x)))}
          />
        )}
      </Modal>
    </div>
  );
}
