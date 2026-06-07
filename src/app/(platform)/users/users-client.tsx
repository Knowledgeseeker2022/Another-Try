"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { UserPlus, Shield, ShieldCheck, Loader2, Mail, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DataTable } from "@/components/shared/data-table";
import { Modal } from "@/components/ui/modal";
import { formatRelativeTime } from "@/lib/utils";

interface RoleOption { id: string; name: string; }

interface UserRow {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  userRoles: { role: { id: string; name: string } }[];
}

function Avatar({ name, email }: { name: string | null; email: string }) {
  const label = name ?? email;
  const initials = label.split(/[\s@]/).filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
      {initials}
    </div>
  );
}

function InviteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (u: UserRow) => void }) {
  const [form, setForm] = useState({ email: "", name: "", password: "", roleId: "" });
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { id: string; name: string }[]) => setRoles(data.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email) return;
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, name: form.name || undefined, password: form.password || undefined, roleId: form.roleId || undefined }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? "Failed to create user");
        return;
      }
      const user = await res.json() as UserRow;
      toast.success(`User ${form.email} created.`);
      onCreated(user);
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
        <label className="text-xs font-medium text-foreground">Email address <span className="text-red-400">*</span></label>
        <input
          type="email" placeholder="user@yourcompany.com" value={form.email} required
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Full name <span className="text-muted-foreground font-normal">(optional)</span></label>
        <input
          type="text" placeholder="Jane Smith" value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Temporary Password <span className="text-red-400">*</span></label>
        <input
          type="password" placeholder="Min. 8 characters" value={form.password} required minLength={8}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-[11px] text-muted-foreground">The user will log in with this password.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Role <span className="text-muted-foreground font-normal">(optional)</span></label>
        <select
          value={form.roleId}
          onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">No role assigned</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/20 border border-border/50 text-xs text-muted-foreground">
        <Mail className="w-3.5 h-3.5 shrink-0" />
        User account is created immediately. Share the temporary password with them securely.
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Create User
        </button>
      </div>
    </form>
  );
}

function EditUserModal({ user, onClose, onSaved, onDeleted }: { user: UserRow; onClose: () => void; onSaved: (u: UserRow) => void; onDeleted: (id: string) => void }) {
  const [name, setName] = useState(user.name ?? "");
  const [isActive, setIsActive] = useState(user.isActive);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(user.userRoles.map((r) => r.role.id));
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/roles")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { id: string; name: string }[]) => setRoles(data.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => {});
  }, []);

  function toggleRole(id: string) {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  }

  async function handleDelete() {
    if (!confirm(`Delete user "${user.email}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? "Failed to delete");
        return;
      }
      toast.success("User deleted.");
      onDeleted(user.id);
      onClose();
    } catch {
      toast.error("Network error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, isActive, roleIds: selectedRoleIds }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? "Failed to save");
        return;
      }
      const updated = await res.json() as UserRow;
      toast.success("User updated.");
      onSaved(updated);
      onClose();
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <Avatar name={user.name} email={user.email} />
        <div>
          <p className="text-sm font-semibold text-foreground">{user.email}</p>
          <p className="text-xs text-muted-foreground">Joined {new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-foreground">Display Name</label>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith"
          className="h-9 px-3 rounded-lg bg-input border border-border text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Account Status</p>
          <p className="text-xs text-muted-foreground">Inactive users cannot log in</p>
        </div>
        <button
          type="button" onClick={() => setIsActive(!isActive)}
          className={`flex items-center gap-2 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${isActive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"}`}
        >
          {isActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
          {isActive ? "Active" : "Inactive"}
        </button>
      </div>

      <div>
        <p className="text-xs font-medium text-foreground mb-2">Assigned Roles</p>
        <div className="space-y-1.5">
          {roles.map((role) => {
            const selected = selectedRoleIds.includes(role.id);
            return (
              <button
                key={role.id} type="button" onClick={() => toggleRole(role.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${selected ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/10 border-border text-muted-foreground hover:border-border/80 hover:bg-muted/20"}`}
              >
                <span className="font-medium">{role.name}</span>
                {selected && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            );
          })}
          {roles.length === 0 && <p className="text-xs text-muted-foreground">Loading roles…</p>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {user.mfaEnabled ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Shield className="w-3.5 h-3.5" />}
          MFA {user.mfaEnabled ? "enabled" : "disabled"}
        </div>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-xs text-muted-foreground">Last active: {formatRelativeTime(user.lastLoginAt)}</span>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
        <button
          type="button" onClick={handleDelete} disabled={deleting || saving}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-500/30 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-60"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Delete User
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || deleting} className="flex items-center gap-1.5 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export function UsersClient({ initial }: { initial: UserRow[] }) {
  const [users, setUsers] = useState<UserRow[]>(initial);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserRow | null>(null);

  const active     = users.filter((u) => u.isActive).length;
  const mfaCount   = users.filter((u) => u.mfaEnabled).length;
  const adminCount = users.filter((u) => u.userRoles.some((r) => r.role.name.includes("Admin"))).length;

  const columns = [
    {
      key: "name", header: "User",
      render: (u: UserRow) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={u.name} email={u.email} />
          <div>
            <p className="text-sm font-medium text-foreground">{u.name ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role", header: "Roles",
      render: (u: UserRow) => (
        <div className="flex flex-wrap gap-1">
          {u.userRoles.length > 0 ? (
            u.userRoles.map((r) => (
              <span key={r.role.id} className="text-xs font-medium text-foreground bg-muted/40 border border-border/50 rounded px-2 py-0.5">
                {r.role.name}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No role</span>
          )}
        </div>
      ),
    },
    {
      key: "mfaEnabled", header: "MFA",
      render: (u: UserRow) =>
        u.mfaEnabled ? (
          <span className="flex items-center gap-1 text-xs text-emerald-400"><ShieldCheck className="w-3.5 h-3.5" /> Enabled</span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Shield className="w-3.5 h-3.5" /> Disabled</span>
        ),
    },
    {
      key: "status", header: "Status",
      render: (u: UserRow) => <StatusBadge status={u.isActive ? "active" : "inactive"} />,
    },
    {
      key: "lastLoginAt", header: "Last Active",
      render: (u: UserRow) => <span className="text-xs text-muted-foreground">{formatRelativeTime(u.lastLoginAt)}</span>,
    },
    {
      key: "createdAt", header: "Joined",
      render: (u: UserRow) => (
        <span className="text-xs text-muted-foreground">
          {new Date(u.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Users"
        subtitle={`${users.length} users · ${active} active`}
        actions={
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" /> Invite User
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Users",  value: users.length },
            { label: "Active",       value: active       },
            { label: "MFA Enabled",  value: mfaCount     },
            { label: "Admins",       value: adminCount   },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-xl font-bold text-foreground mt-1">{item.value}</p>
            </div>
          ))}
        </div>

        <DataTable
          columns={columns} data={users} keyField="id"
          emptyMessage="No users found."
          onRowClick={(u) => setEditUser(u)}
        />
        <p className="text-xs text-muted-foreground">Click a user row to edit details and manage roles.</p>
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite User" description="Create a new platform user and optionally assign a role." size="sm">
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onCreated={(u) => setUsers((prev) => [u, ...prev])}
        />
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Edit User" size="sm">
        {editUser && (
          <EditUserModal
            user={editUser}
            onClose={() => setEditUser(null)}
            onSaved={(updated) => {
              setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
              setEditUser(null);
            }}
            onDeleted={(id) => {
              setUsers((prev) => prev.filter((u) => u.id !== id));
              setEditUser(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
