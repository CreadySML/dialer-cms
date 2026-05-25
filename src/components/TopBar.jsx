"use client";

import { useAuth } from "@/lib/auth-context";

export default function TopBar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="text-sm text-slate-500">
        Signed in as <span className="font-medium text-slate-800">{user?.name}</span>
        <span className="ml-2 text-xs text-slate-400">({user?.email})</span>
      </div>
      <button
        onClick={logout}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Logout
      </button>
    </header>
  );
}
