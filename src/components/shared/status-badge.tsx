import { cn } from "@/lib/utils";

type Status = "healthy" | "warning" | "error" | "offline" | "active" | "inactive" | "connected" | "disconnected" | "pending" | "beta" | "deprecated" | "revoked";

const STYLES: Record<Status, string> = {
  healthy:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  active:       "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  connected:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  warning:      "bg-amber-500/15 text-amber-400 border-amber-500/20",
  pending:      "bg-amber-500/15 text-amber-400 border-amber-500/20",
  error:        "bg-red-500/15 text-red-400 border-red-500/20",
  offline:      "bg-slate-500/15 text-slate-400 border-slate-500/20",
  inactive:     "bg-slate-500/15 text-slate-400 border-slate-500/20",
  disconnected: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  revoked:      "bg-slate-500/15 text-slate-400 border-slate-500/20",
  beta:         "bg-violet-500/15 text-violet-400 border-violet-500/20",
  deprecated:   "bg-orange-500/15 text-orange-400 border-orange-500/20",
};

const DOT_STYLES: Record<Status, string> = {
  healthy:      "bg-emerald-500 status-online",
  active:       "bg-emerald-500 status-online",
  connected:    "bg-emerald-500 status-online",
  warning:      "bg-amber-500",
  pending:      "bg-amber-500",
  error:        "bg-red-500",
  offline:      "bg-slate-500",
  inactive:     "bg-slate-500",
  disconnected: "bg-slate-500",
  revoked:      "bg-slate-500",
  beta:         "bg-violet-500",
  deprecated:   "bg-orange-500",
};

interface StatusBadgeProps {
  status: Status;
  label?: string;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, label, showDot = true, className }: StatusBadgeProps) {
  const displayLabel = label ?? status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border",
      STYLES[status],
      className
    )}>
      {showDot && <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DOT_STYLES[status])} />}
      {displayLabel}
    </span>
  );
}
