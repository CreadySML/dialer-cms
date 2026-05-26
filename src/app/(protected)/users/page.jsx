"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useCachedQuery, invalidateCache } from "@/lib/cache";
import { TableSkeleton, Spinner } from "@/components/Loader";

const ROLE_OPTIONS = {
  superadmin: ["manager", "agent"],
  manager: ["agent"],
};

export default function UsersPage() {
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: ROLE_OPTIONS[user?.role]?.[0] || "agent",
  });
  const [submitting, setSubmitting] = useState(false);

  const { data, loading, refetch: load } = useCachedQuery("/users", {
    staleTime: 5 * 60 * 1000,
  });
  const users = data?.users || [];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/users", form);
      setForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        role: ROLE_OPTIONS[user.role][0],
      });
      setShowForm(false);
      invalidateCache("/users");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canCreate = ROLE_OPTIONS[user?.role]?.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user.role === "superadmin"
              ? "Manage every user across the workspace"
              : "Agents working under you"}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              showForm
                ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                : "brand-gradient text-white shadow-md shadow-indigo-500/30 hover:shadow-lg"
            }`}
          >
            {showForm ? "Cancel" : `+ New ${ROLE_OPTIONS[user.role][0]}`}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          autoComplete="off"
          className="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2"
        >
          <Field
            label="Name"
            placeholder="e.g. Rahul Sharma"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
            autoComplete="off"
          />
          <Field
            label="Email"
            type="email"
            placeholder="rahul@company.com"
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
            required
            autoComplete="off"
          />
          <Field
            label="Password"
            type="password"
            placeholder="Min 6 characters"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
            required
            autoComplete="new-password"
          />
          <Field
            label="Phone"
            placeholder="10-digit mobile"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            autoComplete="off"
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {ROLE_OPTIONS[user.role].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end sm:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting && <Spinner className="h-4 w-4 text-white" />}
              {submitting ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          {loading && users.length === 0 ? (
            <TableSkeleton rows={5} cols={6} />
          ) : (
          <tbody className="divide-y divide-slate-100">
            {users.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No users yet</td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-3 text-slate-400">#{u.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="brand-gradient-soft grid h-8 w-8 place-items-center rounded-full text-xs font-semibold text-indigo-700">
                        {u.name?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                      u.role === "superadmin" ? "bg-purple-100 text-purple-700" :
                      u.role === "manager" ? "bg-blue-100 text-blue-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.phone || "—"}</td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="text-emerald-600">● Active</span>
                    ) : (
                      <span className="text-slate-400">● Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          )}
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, autoComplete, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}
