"use client";

import { useAuth } from "@/lib/auth-context";
import { IconSearch, IconBell, IconLogout } from "./icons";

export default function TopBar() {
  const { user, logout } = useAuth();
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur">
      <div className="flex items-center gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-400">
            {greeting}
          </div>
          <div className="text-sm font-semibold text-slate-900">{user?.name}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search leads, users…"
            className="w-72 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <button className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
          <IconBell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
        </button>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        >
          <IconLogout className="h-4 w-4" />
          Logout
        </button>
      </div>
    </header>
  );
}
