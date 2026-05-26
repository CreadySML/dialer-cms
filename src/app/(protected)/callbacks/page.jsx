"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useCachedQuery, invalidateCache } from "@/lib/cache";
import { TableSkeleton, Spinner } from "@/components/Loader";
import { IconClock, IconPhone } from "@/components/icons";

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const formatINR = (v) => (v == null || v === "" ? "—" : `₹${INR.format(v)}`);

const STAGES = [
  "new",
  "contacted",
  "interested",
  "not_interested",
  "follow_up",
  "converted",
  "rejected",
];

const DISPOSITION_OPTIONS = [
  {
    group: "Connected",
    options: [
      { value: "interested", label: "Interested" },
      { value: "not_interested", label: "Not Interested" },
      { value: "callback", label: "Callback Requested" },
      { value: "already_taken", label: "Already Has Product" },
      { value: "wrong_person", label: "Wrong Person" },
    ],
  },
  {
    group: "Not Connected",
    options: [
      { value: "rnr", label: "RNR (Ring No Response)" },
      { value: "switched_off", label: "Switched Off" },
      { value: "busy", label: "Busy" },
      { value: "wrong_number", label: "Wrong Number" },
      { value: "invalid_number", label: "Invalid Number" },
    ],
  },
  {
    group: "Other",
    options: [
      { value: "language_barrier", label: "Language Barrier" },
      { value: "do_not_call", label: "Do Not Call (DNC)" },
    ],
  },
];

const DISPOSITION_LABELS = DISPOSITION_OPTIONS.reduce((acc, g) => {
  g.options.forEach((o) => { acc[o.value] = o.label; });
  return acc;
}, {});

const BUCKETS = [
  { key: "overdue", label: "Overdue", theme: { dot: "bg-rose-500", activeBg: "bg-rose-50 text-rose-800 ring-rose-300", count: "bg-rose-100 text-rose-700" } },
  { key: "today", label: "Today", theme: { dot: "bg-amber-500", activeBg: "bg-amber-50 text-amber-800 ring-amber-300", count: "bg-amber-100 text-amber-700" } },
  { key: "tomorrow", label: "Tomorrow", theme: { dot: "bg-blue-500", activeBg: "bg-blue-50 text-blue-800 ring-blue-300", count: "bg-blue-100 text-blue-700" } },
  { key: "upcoming", label: "Upcoming", theme: { dot: "bg-emerald-500", activeBg: "bg-emerald-50 text-emerald-800 ring-emerald-300", count: "bg-emerald-100 text-emerald-700" } },
  { key: "unscheduled", label: "Unscheduled", theme: { dot: "bg-slate-400", activeBg: "bg-slate-100 text-slate-800 ring-slate-300", count: "bg-slate-200 text-slate-700" } },
];

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function bucketOf(date) {
  if (!date) return "unscheduled";
  const due = new Date(date);
  const today = startOfDay(new Date());
  const tomorrow = startOfDay(new Date(today.getTime() + 86400000));
  const dayAfter = startOfDay(new Date(today.getTime() + 2 * 86400000));
  if (due < today) return "overdue";
  if (due < tomorrow) return "today";
  if (due < dayAfter) return "tomorrow";
  return "upcoming";
}

function whenLabel(date) {
  if (!date) return "Not scheduled";
  const due = new Date(date);
  const today = startOfDay(new Date());
  const dueDay = startOfDay(due);
  const diffDays = Math.round((dueDay - today) / 86400000);
  const time = due.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Tomorrow ${time}`;
  if (diffDays === -1) return `Yesterday ${time}`;
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays < 7) return `In ${diffDays} days, ${time}`;
  return due.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function nameInitial(name) {
  return name?.[0]?.toUpperCase() || "?";
}

function toLocalDatetimeInput(value) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CallbacksPage() {
  const { user } = useAuth();
  void user;
  const [activeBucket, setActiveBucket] = useState("overdue");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  const { data, loading, error: queryError, refetch } = useCachedQuery("/leads/callbacks");
  const items = data?.items || [];
  const displayedError = error || queryError?.message || "";

  const bucketed = useMemo(() => {
    const groups = { overdue: [], today: [], tomorrow: [], upcoming: [], unscheduled: [] };
    items.forEach((l) => {
      const b = bucketOf(l.nextFollowUpAt);
      groups[b].push(l);
    });
    return groups;
  }, [items]);

  // Auto-switch to a non-empty bucket on first load
  useEffect(() => {
    if (loading) return;
    if (bucketed[activeBucket]?.length > 0) return;
    const first = BUCKETS.find((b) => bucketed[b.key]?.length > 0);
    if (first) setActiveBucket(first.key);
  }, [loading, bucketed, activeBucket]);

  const current = bucketed[activeBucket] || [];

  function startEdit(lead) {
    setEditingId(lead.id);
    setEditForm({
      stage: lead.stage || "new",
      disposition: lead.disposition || "",
      nextFollowUpAt: toLocalDatetimeInput(lead.nextFollowUpAt),
    });
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setError("");
  }

  async function handleSave(leadId) {
    setSavingId(leadId);
    setError("");
    try {
      const payload = {
        stage: editForm.stage,
        disposition: editForm.disposition || null,
        nextFollowUpAt: editForm.nextFollowUpAt
          ? new Date(editForm.nextFollowUpAt).toISOString()
          : null,
      };
      await api.patch(`/leads/${leadId}/status`, payload);
      invalidateCache("/leads");
      setEditingId(null);
      setEditForm({});
      await refetch();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Callbacks</h1>
          <span className="brand-gradient rounded-full px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm shadow-indigo-500/30">
            {items.length}
          </span>
          <span className="hidden text-xs text-slate-500 sm:inline">
            — leads waiting for follow-up
          </span>
        </div>
        {bucketed.overdue.length > 0 && (
          <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            {bucketed.overdue.length} overdue
          </span>
        )}
      </div>

      {/* Bucket tabs */}
      <div className="mb-3 flex flex-shrink-0 flex-wrap items-center gap-2">
        {BUCKETS.map((b) => {
          const count = bucketed[b.key]?.length || 0;
          const active = activeBucket === b.key;
          return (
            <button
              key={b.key}
              onClick={() => setActiveBucket(b.key)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                active
                  ? `${b.theme.activeBg} ring-inset shadow-sm`
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${b.theme.dot}`} />
              {b.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active ? b.theme.count : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {displayedError && (
        <div className="mb-3 flex-shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {displayedError}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="relative flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-gradient-to-b from-slate-50 to-slate-100/60 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
              <tr>
                <th className="px-2.5 py-2.5">Name</th>
                <th className="px-2.5 py-2.5">Phone</th>
                <th className="px-2.5 py-2.5">Loan Purpose</th>
                <th className="px-2.5 py-2.5 text-right">Loan ₹</th>
                <th className="px-2.5 py-2.5">When</th>
                <th className="px-2.5 py-2.5">Stage</th>
                <th className="px-2.5 py-2.5">Agent</th>
                <th className="px-2.5 py-2.5">Disposition</th>
                <th className="px-2.5 py-2.5">Action</th>
              </tr>
            </thead>
            {loading && items.length === 0 ? (
              <TableSkeleton rows={6} cols={9} />
            ) : (
              <tbody className="divide-y divide-slate-100">
                {current.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <IconClock className="h-8 w-8 text-slate-300" />
                        <div className="text-sm">No callbacks in this bucket</div>
                      </div>
                    </td>
                  </tr>
                ) : current.map((l) => {
                  const overdue = bucketOf(l.nextFollowUpAt) === "overdue";
                  const isEditing = editingId === l.id;
                  const isSaving = savingId === l.id;
                  return (
                    <tr key={l.id} className={`transition ${isEditing ? "bg-indigo-50/40" : "hover:bg-slate-50/80"}`}>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="brand-gradient grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white shadow-sm">
                            {nameInitial(l.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900">{l.name}</div>
                            <div className="text-[10px] text-slate-400">#{l.id} · {l.pincode || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2.5 py-2 font-mono text-xs text-slate-600">
                        {l.phone ? (
                          <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 text-slate-700 hover:text-indigo-700">
                            <IconPhone className="h-3 w-3" />
                            {l.phone}
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-2.5 py-2 text-xs text-slate-700">{l.loanPurpose || "—"}</td>
                      <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs font-semibold text-indigo-700">{formatINR(l.loanAmount)}</td>
                      <td className="px-2.5 py-2">
                        {isEditing ? (
                          <input
                            type="datetime-local"
                            value={editForm.nextFollowUpAt || ""}
                            onChange={(e) => setEditForm({ ...editForm, nextFollowUpAt: e.target.value })}
                            className="w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-900"
                          />
                        ) : (
                          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            overdue ? "bg-rose-100 text-rose-700" :
                            bucketOf(l.nextFollowUpAt) === "today" ? "bg-amber-100 text-amber-700" :
                            bucketOf(l.nextFollowUpAt) === "tomorrow" ? "bg-blue-100 text-blue-700" :
                            bucketOf(l.nextFollowUpAt) === "upcoming" ? "bg-emerald-100 text-emerald-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            <IconClock className="h-3 w-3" />
                            {whenLabel(l.nextFollowUpAt)}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2">
                        {isEditing ? (
                          <select
                            value={editForm.stage}
                            onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}
                            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-900"
                          >
                            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                            {l.stage}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-xs text-slate-600">
                        {l.agent?.name || <span className="text-slate-400">Unassigned</span>}
                      </td>
                      <td className="px-2.5 py-2">
                        {isEditing ? (
                          <select
                            value={editForm.disposition || ""}
                            onChange={(e) => setEditForm({ ...editForm, disposition: e.target.value })}
                            className="w-full rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-900"
                          >
                            <option value="">— None —</option>
                            {DISPOSITION_OPTIONS.map((g) => (
                              <optgroup key={g.group} label={g.group}>
                                {g.options.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        ) : (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                            {DISPOSITION_LABELS[l.disposition] || l.disposition || "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleSave(l.id)}
                              disabled={isSaving}
                              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {isSaving && <Spinner className="h-3 w-3 text-white" />}
                              {isSaving ? "Saving…" : "Save"}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={isSaving}
                              className="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(l)}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            Update
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
