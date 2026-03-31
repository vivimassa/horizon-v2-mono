"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Globe,
  Plane,
  Warehouse,
  Users,
  ArrowLeftRight,
  Settings,
} from "lucide-react";

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

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="px-5 py-5 border-b border-gray-200">
        <span className="text-lg font-bold tracking-tight text-blue-800">
          Horizon
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
