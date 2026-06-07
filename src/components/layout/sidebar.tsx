"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Shield,
  Users2,
  Plug2,
  Building2,
  FolderKanban,
  KeySquare,
  Key,
  AppWindow,
  Settings,
  ScrollText,
  BookOpen,
  BookMarked,
  Fingerprint,
  ChevronLeft,
  ChevronRight,
  Waves,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  group?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Platform
  { label: "Dashboard",    href: "/dashboard",    icon: LayoutDashboard, group: "Platform" },
  { label: "Settings",     href: "/settings",     icon: Settings,        group: "Platform" },
  // Identity
  { label: "Users",        href: "/users",        icon: Users,           group: "Identity" },
  { label: "Roles",        href: "/roles",        icon: Shield,          group: "Identity" },
  { label: "Groups",       href: "/groups",       icon: Users2,          group: "Identity" },
  { label: "SSO",          href: "/sso",          icon: Fingerprint,     group: "Identity" },
  // Integrations
  { label: "Services",     href: "/services",     icon: Plug2,           group: "Integrations" },
  { label: "API Keys",     href: "/api-keys",     icon: Key,             group: "Integrations" },
  { label: "Apps",         href: "/apps",         icon: AppWindow,       group: "Integrations" },
  // Organizations
  { label: "Org Matching", href: "/org-matching", icon: Building2,       group: "Organizations" },
  { label: "Org Groups",   href: "/org-groups",   icon: FolderKanban,    group: "Organizations" },
  // Security
  { label: "Audit Log",    href: "/audit-log",    icon: ScrollText,      group: "Security" },
  // Docs
  { label: "User Guide",   href: "/user-guide",   icon: BookOpen,        group: "Documentation" },
  { label: "Admin Guide",  href: "/admin-guide",  icon: BookMarked,      group: "Documentation" },
  { label: "SSO Setup",    href: "/sso-setup",    icon: KeySquare,       group: "Documentation" },
];

const GROUPS = ["Platform", "Identity", "Integrations", "Organizations", "Security", "Documentation"];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 h-16 border-b border-sidebar-border shrink-0",
        collapsed && "justify-center px-2"
      )}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
          <Waves className="w-4 h-4 text-primary" />
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-sidebar-accent-foreground truncate">Lake Evendim</span>
            <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Control Plane</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.group === group);
          return (
            <div key={group} className="mb-1">
              {!collapsed && (
                <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 select-none">
                  {group}
                </p>
              )}
              {collapsed && <div className="h-2" />}
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors group relative",
                      active
                        ? "bg-sidebar-accent text-primary font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                      collapsed && "justify-center"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground")} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-sidebar-border shrink-0">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-2 rounded-md text-xs text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}
