"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { IconDashboard, IconUsers, IconPhone, IconBrand, IconCalendar } from "./icons";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconDashboard, roles: ["superadmin", "manager", "agent"] },
  { href: "/users", label: "Team", icon: IconUsers, roles: ["superadmin", "manager"] },
  { href: "/leads", label: "Leads", icon: IconPhone, roles: ["superadmin", "manager", "agent"] },
  { href: "/callbacks", label: "Callbacks", icon: IconCalendar, roles: ["superadmin", "manager", "agent"] },
];

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export default function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();

  const visible = NAV.filter((n) => n.roles.includes(user?.role));

  return (
    <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-slate-800/50 bg-slate-950 md:flex">
      <div className="flex items-center gap-3 border-b border-slate-800/50 px-5 py-5">
        <IconBrand className="h-9 w-9" />
        <div>
          <div className="text-base font-semibold tracking-tight text-white">Cready LMS</div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Lead Management</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <div className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Workspace
        </div>
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-indigo-500/10 text-white shadow-[inset_0_0_0_1px_rgba(99,102,241,0.3)]"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
              }`}
            >
              <Icon className={`h-4.5 w-4.5 transition ${active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"}`} style={{ width: "18px", height: "18px" }} />
              <span className="font-medium">{item.label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800/50 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-900/50 p-3">
          <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white shadow-lg shadow-indigo-500/20">
            {initials(user?.name) || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{user?.name}</div>
            <div className="truncate text-[11px] capitalize text-slate-500">{user?.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
