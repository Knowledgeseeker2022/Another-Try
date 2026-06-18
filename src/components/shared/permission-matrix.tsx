"use client";

// Resource × action permission grid. `value` holds "resource:action" keys.
interface Props {
  resources: string[];
  actions: string[];
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}

const key = (resource: string, action: string) => `${resource}:${action}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function PermissionMatrix({ resources, actions, value, onChange, disabled }: Props) {
  function toggle(k: string) {
    if (disabled) return;
    const next = new Set(value);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  }

  function toggleRow(resource: string, on: boolean) {
    if (disabled) return;
    const next = new Set(value);
    for (const a of actions) {
      const k = key(resource, a);
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(next);
  }

  function toggleCol(action: string, on: boolean) {
    if (disabled) return;
    const next = new Set(value);
    for (const r of resources) {
      const k = key(r, action);
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(next);
  }

  const rowAllOn = (resource: string) => actions.every((a) => value.has(key(resource, a)));
  const colAllOn = (action: string) => resources.every((r) => value.has(key(r, action)));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left font-medium text-xs text-muted-foreground px-3 py-2">Resource</th>
            {actions.map((a) => (
              <th key={a} className="px-3 py-2 text-center">
                <button
                  type="button"
                  onClick={() => toggleCol(a, !colAllOn(a))}
                  disabled={disabled}
                  className="text-xs font-medium text-foreground hover:text-primary transition-colors disabled:opacity-50"
                  title={`Toggle ${a} for all resources`}
                >
                  {cap(a)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => (
            <tr key={r} className="border-b border-border/50 last:border-0">
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleRow(r, !rowAllOn(r))}
                  disabled={disabled}
                  className="text-xs text-foreground hover:text-primary transition-colors disabled:opacity-50"
                  title={`Toggle all actions for ${r}`}
                >
                  {cap(r)}
                </button>
              </td>
              {actions.map((a) => {
                const k = key(r, a);
                return (
                  <td key={a} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={value.has(k)}
                      onChange={() => toggle(k)}
                      disabled={disabled}
                      className="w-4 h-4 rounded border-border bg-input accent-primary cursor-pointer disabled:cursor-not-allowed"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
