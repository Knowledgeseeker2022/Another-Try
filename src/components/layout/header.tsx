"use client";

import { useSession, signOut } from "next-auth/react";
import { Bell, Search, LogOut, User, Settings, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <header className="h-16 border-b border-border bg-card/30 backdrop-blur-sm flex items-center px-6 gap-4 shrink-0">
      {/* Title */}
      <div className="flex-1 min-w-0">
        {title && (
          <h1 className="text-base font-semibold text-foreground truncate">{title}</h1>
        )}
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button className="flex items-center gap-2 h-8 px-3 rounded-md bg-muted/30 border border-border/50 text-muted-foreground text-xs hover:bg-muted/60 transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden sm:inline text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono">⌘K</kbd>
        </button>

        {/* Notifications */}
        <button className="relative w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-destructive" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-2 h-8 px-2 rounded-md hover:bg-muted/40 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[10px] font-bold text-primary">
              {initials}
            </div>
            <span className="hidden sm:inline text-xs text-foreground max-w-28 truncate">
              {session?.user?.name ?? session?.user?.email}
            </span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-20 w-52 bg-card border border-border rounded-xl shadow-xl shadow-black/30 py-1 overflow-hidden">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-foreground truncate">{session?.user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
                </div>
                <MenuItem icon={User} label="Profile" onClick={() => setUserMenuOpen(false)} />
                <MenuItem icon={Settings} label="Settings" href="/settings" onClick={() => setUserMenuOpen(false)} />
                <div className="border-t border-border mt-1 pt-1">
                  <MenuItem
                    icon={LogOut}
                    label="Sign out"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    danger
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onClick,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const className = cn(
    "flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors",
    danger
      ? "text-destructive hover:bg-destructive/10"
      : "text-foreground hover:bg-muted/50"
  );

  if (href) {
    return (
      <a href={href} className={className} onClick={onClick}>
        <Icon className="w-4 h-4" />
        {label}
      </a>
    );
  }

  return (
    <button className={className} onClick={onClick}>
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
