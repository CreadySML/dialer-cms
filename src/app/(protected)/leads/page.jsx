"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

const STAGES = [
  "new",
  "contacted",
  "interested",
  "not_interested",
  "follow_up",
  "converted",
  "rejected",
];

const STAGE_COLORS = {
  new: "bg-slate-100 text-slate-700",
  contacted: "bg-blue-100 text-blue-700",
  interested: "bg-amber-100 text-amber-700",
  not_interested: "bg-orange-100 text-orange-700",
  follow_up: "bg-purple-100 text-purple-700",
  converted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

export default function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ stage: "", city: "", product: "" });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    product: "",
    source: "",
    amount: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const canCreate = user.role === "superadmin" || user.role === "manager";
  const canAssign = canCreate;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(
        Object.entries(filters).filter(([, v]) => v)
      ).toString();
      const { leads } = await api.get(`/leads${qs ? `?${qs}` : ""}`);
      setLeads(leads);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canAssign) return;
    api
      .get("/users?role=agent")
      .then((d) => setAgents(d.users || []))
      .catch(() => {});
  }, [canAssign]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/leads", {
        ...form,
        amount: form.amount ? Number(form.amount) : null,
      });
      setForm({ name: "", phone: "", email: "", city: "", product: "", source: "", amount: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAssign(leadId, agentId) {
    if (!agentId) return;
    try {
      await api.patch(`/leads/${leadId}/assign`, { agentId: Number(agentId) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleStatusSave(leadId) {
    try {
      await api.patch(`/leads/${leadId}/status`, editForm);
      setEditingId(null);
      setEditForm({});
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">
            {user.role === "agent"
              ? "Leads assigned to you"
              : "Manage leads and assignments"}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            {showForm ? "Cancel" : "+ Create Lead"}
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
          onSubmit={handleCreate}
          className="mb-6 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-3"
        >
          <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Field label="Phone *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
          <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <Field label="Product" value={form.product} onChange={(v) => setForm({ ...form, product: v })} />
          <Field label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} />
          <Field label="Amount" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
          <div className="flex items-end sm:col-span-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save lead"}
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <select
          value={filters.stage}
          onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          placeholder="City filter"
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <input
          placeholder="Product filter"
          value={filters.product}
          onChange={(e) => setFilters({ ...filters, product: e.target.value })}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        {(filters.stage || filters.city || filters.product) && (
          <button
            onClick={() => setFilters({ stage: "", city: "", product: "" })}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-3">ID</th>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">City</th>
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">Stage</th>
              <th className="px-3 py-3">Assigned</th>
              <th className="px-3 py-3">Disposition</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">Loading…</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-400">No leads yet</td></tr>
            ) : leads.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-3 text-slate-500">{l.id}</td>
                <td className="px-3 py-3 font-medium text-slate-900">{l.name}</td>
                <td className="px-3 py-3 text-slate-600">{l.phone}</td>
                <td className="px-3 py-3 text-slate-600">{l.city || "—"}</td>
                <td className="px-3 py-3 text-slate-600">{l.product || "—"}</td>
                <td className="px-3 py-3">
                  {editingId === l.id ? (
                    <select
                      value={editForm.stage ?? l.stage}
                      onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[l.stage]}`}>
                      {l.stage}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {canAssign ? (
                    <select
                      value={l.assignedTo || ""}
                      onChange={(e) => handleAssign(l.id, e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="">— Unassigned —</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  ) : l.agent ? l.agent.name : "—"}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {editingId === l.id ? (
                    <input
                      placeholder="Disposition"
                      value={editForm.disposition ?? l.disposition ?? ""}
                      onChange={(e) => setEditForm({ ...editForm, disposition: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  ) : l.disposition || "—"}
                </td>
                <td className="px-3 py-3">
                  {editingId === l.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleStatusSave(l.id)}
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                      >Save</button>
                      <button
                        onClick={() => { setEditingId(null); setEditForm({}); }}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(l.id); setEditForm({}); }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >Update</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
    </div>
  );
}
