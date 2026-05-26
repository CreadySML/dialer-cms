"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export default function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="min-w-0 flex-1 overflow-hidden px-4 py-3 lg:px-6 lg:py-4">{children}</main>
      </div>
    </div>
  );
}
