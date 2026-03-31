"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Globe,
  Plane,
  Warehouse,
  Users,
  ArrowLeftRight,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "./theme-provider";

const NAV = [
  { href: "/network", label: "Network", icon: Globe },
  { href: "/operations", label: "Operations", icon: Plane },
  { href: "/ground", label: "Ground", icon: Warehouse },
  { href: "/workforce", label: "Workforce", icon: Users },
  { href: "/integration", label: "Integration", icon: ArrowLeftRight },
  { href: "/admin", label: "Admin", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggle } = useTheme();

  return (
    <aside
      className={`shrink-0 border-r border-hz-border bg-hz-card flex flex-col transition-all duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-hz-border">
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight text-hz-accent">
            Sky Hub
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-hz-text-secondary hover:bg-hz-border/50 transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                active
                  ? "bg-hz-accent-light text-hz-accent"
                  : "text-hz-text-secondary hover:bg-hz-border/50 hover:text-hz-text"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      {/* Dark mode toggle */}
      <div className="px-2 pb-3">
        <button
          onClick={toggle}
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-hz-text-secondary hover:bg-hz-border/50 hover:text-hz-text transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && (theme === "dark" ? "Light mode" : "Dark mode")}
        </button>
      </div>
    </aside>
  );
}
