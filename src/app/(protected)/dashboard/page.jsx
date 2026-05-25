"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ users: 0, leads: 0, assigned: 0, converted: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const promises = [api.get("/leads")];
        if (user.role !== "agent") promises.push(api.get("/users"));
        const [leadsRes, usersRes] = await Promise.all(promises);
        const leads = leadsRes.leads || [];
        setStats({
          users: usersRes?.count ?? 0,
          leads: leads.length,
          assigned: leads.filter((l) => l.assignedTo).length,
          converted: leads.filter((l) => l.stage === "converted").length,
        });
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [user]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">
        Welcome, {user.name}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Your role: <span className="font-medium capitalize">{user.role}</span>
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {user.role !== "agent" && (
          <StatCard label="Total Users" value={stats.users} hint="Users you manage" />
        )}
        <StatCard
          label={user.role === "agent" ? "My Leads" : "Total Leads"}
          value={stats.leads}
        />
        <StatCard label="Assigned" value={stats.assigned} />
        <StatCard label="Converted" value={stats.converted} />
      </div>

      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {user.role === "superadmin" && (
            <Link
              href="/users"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Create Manager
            </Link>
          )}
          {user.role === "manager" && (
            <>
              <Link
                href="/users"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Create Agent
              </Link>
              <Link
                href="/leads"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                + Create Lead
              </Link>
            </>
          )}
          <Link
            href="/leads"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            View Leads
          </Link>
        </div>
      </div>
    </div>
  );
}
