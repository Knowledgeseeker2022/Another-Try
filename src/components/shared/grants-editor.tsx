"use client";

import { Plus, X } from "lucide-react";

// A single role grant with optional scope. appId null = all apps (Admin-wide).
export interface GrantDraft {
  roleId: string;
  appId: string | null;
  scopeAllOrgs: boolean;
  orgIds: string[];
  orgGroupIds: string[];
}

interface Named {
  id: string;
  name: string;
}

interface Props {
  roles: Named[];
  apps: Named[];
  orgs: Named[];
  orgGroups: Named[];
  value: GrantDraft[];
  onChange: (next: GrantDraft[]) => void;
}

export function emptyGrant(roleId = ""): GrantDraft {
  return { roleId, appId: null, scopeAllOrgs: true, orgIds: [], orgGroupIds: [] };
}

const inputCls =
  "h-8 px-2 rounded-lg bg-input border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function GrantsEditor({ roles, apps, orgs, orgGroups, value, onChange }: Props) {
  function update(i: number, patch: Partial<GrantDraft>) {
    onChange(value.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function toggleId(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No roles granted — this user/group has no access until a role is added (least privilege).
        </p>
      )}

      {value.map((g, i) => (
        <div key={i} className="rounded-lg border border-border bg-card/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={g.roleId}
              onChange={(e) => update(i, { roleId: e.target.value })}
              className={`${inputCls} flex-1`}
            >
              <option value="">Select role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            <select
              value={g.appId ?? ""}
              onChange={(e) => update(i, { appId: e.target.value || null })}
              className={`${inputCls} flex-1`}
              title="Which app this role applies to"
            >
              <option value="">All apps (Admin-wide)</option>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => remove(i)}
              className="w-7 h-7 shrink-0 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Remove grant"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Clients:</span>
            <select
              value={g.scopeAllOrgs ? "all" : "specific"}
              onChange={(e) => update(i, { scopeAllOrgs: e.target.value === "all" })}
              className={inputCls}
            >
              <option value="all">All clients</option>
              <option value="specific">Specific clients</option>
            </select>
          </div>

          {!g.scopeAllOrgs && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-input/40 p-2 max-h-32 overflow-y-auto">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Organizations</p>
                {orgs.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
                {orgs.map((o) => (
                  <label key={o.id} className="flex items-center gap-1.5 py-0.5 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={g.orgIds.includes(o.id)}
                      onChange={() => update(i, { orgIds: toggleId(g.orgIds, o.id) })}
                      className="w-3.5 h-3.5 rounded border-border bg-input accent-primary"
                    />
                    {o.name}
                  </label>
                ))}
              </div>
              <div className="rounded-lg border border-border bg-input/40 p-2 max-h-32 overflow-y-auto">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Org Groups</p>
                {orgGroups.length === 0 && <p className="text-xs text-muted-foreground">None</p>}
                {orgGroups.map((o) => (
                  <label key={o.id} className="flex items-center gap-1.5 py-0.5 text-xs text-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={g.orgGroupIds.includes(o.id)}
                      onChange={() => update(i, { orgGroupIds: toggleId(g.orgGroupIds, o.id) })}
                      className="w-3.5 h-3.5 rounded border-border bg-input accent-primary"
                    />
                    {o.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, emptyGrant()])}
        className="flex items-center gap-1.5 h-7 px-3 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
      >
        <Plus className="w-3 h-3" /> Add role grant
      </button>
    </div>
  );
}
