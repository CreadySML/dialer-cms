"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useCachedQuery, invalidateCache } from "@/lib/cache";
import { TableSkeleton } from "@/components/Loader";
import { IconClock, IconPhone, IconFilter, IconX, IconSearch } from "@/components/icons";
import LeadUpdateModal from "@/components/LeadUpdateModal";

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

const LOAN_PRESETS = [
  { label: "< 1L",      min: 0,       max: 100000 },
  { label: "1L – 5L",   min: 100000,  max: 500000 },
  { label: "5L – 10L",  min: 500000,  max: 1000000 },
  { label: "10L – 25L", min: 1000000, max: 2500000 },
  { label: "25L+",      min: 2500000, max: null },
];

const SALARY_PRESETS = [
  { label: "< 25k",     min: 0,      max: 25000 },
  { label: "25k – 50k", min: 25000,  max: 50000 },
  { label: "50k – 1L",  min: 50000,  max: 100000 },
  { label: "1L – 2L",   min: 100000, max: 200000 },
  { label: "2L+",       min: 200000, max: null },
];

function isPresetActive(currentMin, currentMax, preset) {
  const min = currentMin === "" || currentMin == null ? null : Number(currentMin);
  const max = currentMax === "" || currentMax == null ? null : Number(currentMax);
  return (min === preset.min || (preset.min === 0 && min == null)) && max === preset.max;
}

function activePresetLabel(min, max, presets) {
  const found = presets.find((p) => isPresetActive(min, max, p));
  return found ? found.label : "";
}

const EMPTY_FILTERS = {
  stage: "",
  disposition: "",
  assignedTo: "",
  pincode: "",
  loanPurpose: "",
  minLoanAmount: "",
  maxLoanAmount: "",
  minSalary: "",
  maxSalary: "",
};

function hasAnyFilter(f) {
  return Object.values(f).some((v) => v !== "" && v != null);
}

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
  const [activeBucket, setActiveBucket] = useState("overdue");
  const [modalLead, setModalLead] = useState(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const canAssign = user?.role === "superadmin" || user?.role === "manager";

  // Cache key includes filters so different filter combos cache independently
  const cacheKey = useMemo(() => {
    const qs = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== "" && v != null)
    ).toString();
    return `/leads/callbacks${qs ? `?${qs}` : ""}`;
  }, [filters]);

  const { data, loading, error: queryError, refetch } = useCachedQuery(cacheKey);
  const items = data?.items || [];
  const displayedError = error || queryError?.message || "";

  // Agents list for the Assigned filter
  const { data: agentsRes } = useCachedQuery(canAssign ? "/users?role=agent" : null, {
    staleTime: 5 * 60 * 1000,
  });
  const agents = agentsRes?.users || [];

  const filtered = hasAnyFilter(filters);
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v !== "" && v != null).length,
    [filters]
  );

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

  async function handleModalSaved() {
    invalidateCache("/leads");
    await refetch();
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

      {/* Filter bar */}
      <div className="mb-3 flex-shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconFilter className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Filters</span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                {activeFilterCount} active
              </span>
            )}
          </div>
          {filtered && (
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600"
            >
              <IconX className="h-3 w-3" /> Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Stage */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Stage</label>
            <select
              value={filters.stage}
              onChange={(e) => setFilters({ ...filters, stage: e.target.value })}
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
                filters.stage ? "border-indigo-300 bg-indigo-50/40 font-semibold" : "border-slate-300"
              }`}
            >
              <option value="">All stages</option>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Disposition */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Disposition</label>
            <select
              value={filters.disposition}
              onChange={(e) => setFilters({ ...filters, disposition: e.target.value })}
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
                filters.disposition ? "border-indigo-300 bg-indigo-50/40 font-semibold" : "border-slate-300"
              }`}
            >
              <option value="">All dispositions</option>
              {DISPOSITION_OPTIONS.map((g) => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Assigned agent */}
          {canAssign && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Assigned Agent</label>
              <select
                value={filters.assignedTo}
                onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })}
                className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
                  filters.assignedTo ? "border-indigo-300 bg-indigo-50/40 font-semibold" : "border-slate-300"
                }`}
              >
                <option value="">All agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Pincode */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pincode</label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="e.g. 400001"
                value={filters.pincode}
                onChange={(e) => setFilters({ ...filters, pincode: e.target.value })}
                className={`w-full rounded-md border bg-white py-1.5 pl-7 pr-7 text-xs text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
                  filters.pincode ? "border-indigo-300 bg-indigo-50/40" : "border-slate-300"
                }`}
              />
              {filters.pincode && (
                <button
                  onClick={() => setFilters({ ...filters, pincode: "" })}
                  className="absolute right-1.5 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear pincode"
                >
                  <IconX className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* Loan amount */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Loan Amount (₹)</label>
            <select
              value={activePresetLabel(filters.minLoanAmount, filters.maxLoanAmount, LOAN_PRESETS)}
              onChange={(e) => {
                const preset = LOAN_PRESETS.find((p) => p.label === e.target.value);
                setFilters({
                  ...filters,
                  minLoanAmount: preset ? String(preset.min) : "",
                  maxLoanAmount: preset && preset.max != null ? String(preset.max) : "",
                });
              }}
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
                (filters.minLoanAmount || filters.maxLoanAmount) ? "border-indigo-300 bg-indigo-50/40 font-semibold" : "border-slate-300"
              }`}
            >
              <option value="">All amounts</option>
              {LOAN_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>

          {/* Salary */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Salary (₹)</label>
            <select
              value={activePresetLabel(filters.minSalary, filters.maxSalary, SALARY_PRESETS)}
              onChange={(e) => {
                const preset = SALARY_PRESETS.find((p) => p.label === e.target.value);
                setFilters({
                  ...filters,
                  minSalary: preset ? String(preset.min) : "",
                  maxSalary: preset && preset.max != null ? String(preset.max) : "",
                });
              }}
              className={`w-full rounded-md border bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
                (filters.minSalary || filters.maxSalary) ? "border-indigo-300 bg-indigo-50/40 font-semibold" : "border-slate-300"
              }`}
            >
              <option value="">All salaries</option>
              {SALARY_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
            </select>
          </div>
        </div>
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
                  return (
                    <tr key={l.id} className="transition hover:bg-slate-50/80">
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
                      </td>
                      <td className="px-2.5 py-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                          {l.stage}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 text-xs text-slate-600">
                        {l.agent?.name || <span className="text-slate-400">Unassigned</span>}
                      </td>
                      <td className="px-2.5 py-2">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                          {DISPOSITION_LABELS[l.disposition] || l.disposition || "—"}
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        <button
                          onClick={() => setModalLead(l)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                        >
                          Update
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      </div>

      {modalLead && (
        <LeadUpdateModal
          lead={modalLead}
          onClose={() => setModalLead(null)}
          onSaved={handleModalSaved}
        />
      )}
    </div>
  );
}
