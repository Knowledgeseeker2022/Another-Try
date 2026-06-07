import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  description?: string;
  className?: string;
}

export function StatCard({ title, value, change, changeType = "neutral", icon, description, className }: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 flex flex-col gap-3", className)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        {icon && <div className="text-muted-foreground/60">{icon}</div>}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
        {(change || description) && (
          <p className={cn(
            "text-xs mt-1",
            changeType === "positive" && "text-emerald-500",
            changeType === "negative" && "text-red-500",
            changeType === "neutral" && "text-muted-foreground"
          )}>
            {change ?? description}
          </p>
        )}
      </div>
    </div>
  );
}
