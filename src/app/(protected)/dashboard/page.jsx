"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useCachedQuery } from "@/lib/cache";
import { IconUsers, IconPhone, IconTarget, IconTrendUp, IconPlus } from "@/components/icons";
import { CardSkeleton, Spinner } from "@/components/Loader";

function StatCard({ label, value, hint, icon: Icon, accent = "indigo" }) {
  const accents = {
    indigo: "from-indigo-500 to-violet-500",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-500 to-pink-500",
  };
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${accents[accent]} opacity-10 transition group-hover:opacity-20`} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br ${accents[accent]} text-white shadow-md`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  // Cached fetches — shared with /leads and /users pages (same cache keys)
  const { data: leadsRes, loading: leadsLoading, error: leadsError } = useCachedQuery(
    "/leads?pageSize=5"
  );
  const { data: usersRes, loading: usersLoading } = useCachedQuery(
    user.role !== "agent" ? "/users" : null,
    { staleTime: 5 * 60 * 1000 }
  );

  const recentLeads = (leadsRes?.leads || []).slice(0, 5);
  const totalLeads = leadsRes?.total ?? recentLeads.length;
  const assignedCount = recentLeads.filter((l) => l.assignedTo).length;
  const convertedCount = recentLeads.filter((l) => l.stage === "converted").length;
  const stats = {
    users: usersRes?.count ?? 0,
    leads: totalLeads,
    assigned: assignedCount,
    converted: convertedCount,
  };
  const loading = leadsLoading || usersLoading;
  const error = leadsError?.message || "";

  const conversionRate = stats.leads
    ? Math.round((stats.converted / stats.leads) * 100)
    : 0;

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s what&apos;s happening with your leads today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === "superadmin" && (
            <Link
              href="/users"
              className="brand-gradient inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:shadow-lg"
            >
              <IconPlus className="h-4 w-4" /> Create manager
            </Link>
          )}
          {user.role === "manager" && (
            <>
              <Link
                href="/users"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <IconPlus className="h-4 w-4" /> New agent
              </Link>
              <Link
                href="/leads"
                className="brand-gradient inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:shadow-lg"
              >
                Distribute leads
              </Link>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            {user.role !== "agent" && (
              <StatCard label="Team Members" value={stats.users} hint="Active users in your scope" icon={IconUsers} accent="indigo" />
            )}
            <StatCard
              label={user.role === "agent" ? "My Leads" : "Total Leads"}
              value={stats.leads.toLocaleString("en-IN")}
              hint="In the pipeline"
              icon={IconPhone}
              accent="amber"
            />
            <StatCard label="Assigned" value={stats.assigned} hint={`${stats.leads ? Math.round((stats.assigned / stats.leads) * 100) : 0}% of leads`} icon={IconTarget} accent="rose" />
            <StatCard label="Converted" value={stats.converted} hint={`${conversionRate}% conversion rate`} icon={IconTrendUp} accent="emerald" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent leads</h2>
              <p className="text-xs text-slate-500">Latest entries in the pipeline</p>
            </div>
            <Link href="/leads" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                <Spinner brand className="h-4 w-4" /> Loading recent leads…
              </div>
            ) : recentLeads.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">
                No leads yet
              </div>
            ) : recentLeads.map((l) => (
              <div key={l.id} className="flex items-center gap-4 px-5 py-3">
                <div className="brand-gradient-soft grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-indigo-700">
                  {l.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-900">{l.name}</div>
                  <div className="text-xs text-slate-500">{l.phone} · {l.city || "—"}</div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  l.stage === "converted" ? "bg-emerald-100 text-emerald-700" :
                  l.stage === "contacted" ? "bg-blue-100 text-blue-700" :
                  l.stage === "interested" ? "bg-amber-100 text-amber-700" :
                  "bg-slate-100 text-slate-600"
                }`}>{l.stage}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Quick guide</h2>
          <p className="mt-1 text-xs text-slate-500">Get the most out of DialerOne</p>
          <ol className="mt-4 space-y-3 text-sm">
            {[
              user.role === "superadmin"
                ? "Create managers to lead each calling team"
                : user.role === "manager"
                ? "Add agents to your team from the Team page"
                : "Open the Leads page to see your assigned calls",
              user.role === "agent"
                ? "Update stage + disposition after every call"
                : "Assign leads from the pool to your agents",
              "Track conversion progress from this dashboard",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="brand-gradient grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
