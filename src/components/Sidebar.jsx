"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const NAV = [
  { href: "/dashboard", label: "Dashboard", roles: ["superadmin", "manager", "agent"] },
  { href: "/users", label: "Users", roles: ["superadmin", "manager"] },
  { href: "/leads", label: "Leads", roles: ["superadmin", "manager", "agent"] },
];

export default function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname();

  const visible = NAV.filter((n) => n.roles.includes(user?.role));

  return (
    <aside className="hidden w-60 flex-shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="text-lg font-bold text-slate-900">LMS Dialer</div>
        <div className="text-xs text-slate-500">Call center CRM</div>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {visible.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm transition ${
                active
                  ? "bg-blue-50 font-medium text-blue-700"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
        Role:{" "}
        <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
          {user?.role}
        </span>
      </div>
    </aside>
  );
}
