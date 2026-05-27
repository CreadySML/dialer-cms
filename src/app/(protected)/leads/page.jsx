"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useCachedQuery, invalidateCache } from "@/lib/cache";
import { Spinner, TableSkeleton, OverlaySpinner } from "@/components/Loader";
import { IconFilter, IconX, IconSearch } from "@/components/icons";
import LeadUpdateModal from "@/components/LeadUpdateModal";

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

// Keep in sync with VALID_DISPOSITIONS in backend leadService.js
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

const DISPOSITION_COLORS = {
  interested: "bg-emerald-100 text-emerald-700",
  callback: "bg-blue-100 text-blue-700",
  not_interested: "bg-orange-100 text-orange-700",
  already_taken: "bg-slate-100 text-slate-700",
  wrong_person: "bg-slate-100 text-slate-700",
  rnr: "bg-amber-100 text-amber-700",
  switched_off: "bg-slate-100 text-slate-700",
  busy: "bg-amber-100 text-amber-700",
  wrong_number: "bg-rose-100 text-rose-700",
  invalid_number: "bg-rose-100 text-rose-700",
  language_barrier: "bg-purple-100 text-purple-700",
  do_not_call: "bg-rose-100 text-rose-700",
};

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const formatINR = (v) => (v == null || v === "" ? "—" : `₹${INR.format(v)}`);

const EMPTY_FILTERS = {
  search: "",
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

// Range presets — Indian numbering (k / L / Cr)
const LOAN_PRESETS = [
  { label: "< 1L",     min: 0,       max: 100000 },
  { label: "1L – 5L",  min: 100000,  max: 500000 },
  { label: "5L – 10L", min: 500000,  max: 1000000 },
  { label: "10L – 25L",min: 1000000, max: 2500000 },
  { label: "25L+",     min: 2500000, max: null },
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

export default function LeadsPage() {
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalLead, setModalLead] = useState(null);
  const [searchInput, setSearchInput] = useState("");

  // Debounce search input → filters.search (350ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkAgentId, setBulkAgentId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const canAssign = user.role === "superadmin" || user.role === "manager";

  // Cached leads query — instant on revisit, background revalidate when stale
  const cacheKey = useMemo(() => {
    const params = { ...filters, page, pageSize };
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    ).toString();
    return `/leads${qs ? `?${qs}` : ""}`;
  }, [filters, page, pageSize]);

  const { data: leadsRes, loading, refetch: load } = useCachedQuery(cacheKey);
  const leads = leadsRes?.leads || [];
  const total = leadsRes?.total ?? 0;
  const totalPages = leadsRes?.totalPages ?? 1;
  const assignedToCounts = leadsRes?.assignedToCounts || {};

  // Cached agents list (rarely changes)
  const { data: agentsRes } = useCachedQuery(canAssign ? "/users?role=agent" : null, {
    staleTime: 5 * 60 * 1000,
  });
  const agents = agentsRes?.users || [];

  // Reset to page 1 + clear selection when filters or pageSize change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [filters, pageSize]);

  const visibleIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allVisibleSelected;
  const filtered = hasAnyFilter(filters);
  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => v !== "" && v != null).length,
    [filters]
  );

  function toggleOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Wipe cached lead pages + callbacks (mutation invalidates both)
  function invalidateLeadCaches() {
    invalidateCache("/leads");
  }

  async function handleAssignOne(leadId, agentId) {
    if (!agentId) return;
    try {
      await api.patch(`/leads/${leadId}/assign`, { agentId: Number(agentId) });
      invalidateLeadCaches();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleModalSaved() {
    invalidateLeadCaches();
    await load();
  }

  async function runBulk(payload) {
    setError("");
    setInfo("");
    setBulkBusy(true);
    try {
      const res = await api.post("/leads/bulk-assign", payload);
      const parts = [`${res.assigned} lead${res.assigned !== 1 ? "s" : ""} assigned`];
      if (payload.distribute) {
        const breakdown = Object.entries(res.distribution || {})
          .map(([id, n]) => {
            const a = agents.find((x) => String(x.id) === String(id));
            return `${a?.name || `Agent #${id}`}: ${n}`;
          })
          .join(", ");
        if (breakdown) parts.push(`Distribution → ${breakdown}`);
      }
      setInfo(parts.join(" · "));
      clearSelection();
      invalidateLeadCaches();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkBusy(false);
    }
  }

  function handleBulkAssign() {
    if (!bulkAgentId) { setError("Pick an agent first"); return; }
    runBulk({ leadIds: Array.from(selectedIds), agentId: Number(bulkAgentId) });
  }

  function handleBulkDistribute() {
    runBulk({ leadIds: Array.from(selectedIds), distribute: true });
  }

  // Distribute ALL leads matching current filters (across every page, not just current)
  function handleAssignAllFiltered() {
    if (!confirm(`Auto-distribute all ${total.toLocaleString("en-IN")} filtered leads across your team?`)) return;
    const activeFilters = Object.fromEntries(
      Object.entries(filters).filter(([, v]) => v !== "" && v != null)
    );
    runBulk({ filters: activeFilters, distribute: true });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Leads</h1>
          <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
            {total.toLocaleString("en-IN")}
          </span>
          <span className="hidden text-xs text-slate-500 sm:inline">
            {user.role === "agent"
              ? "— update stage after every call"
              : "— distribute to your agents"}
          </span>
        </div>
        <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
          Source: offerleads_fdw
        </span>
      </div>

      {error && (
        <div className="mb-3 flex-shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {info && (
        <div className="mb-3 flex-shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {info}
        </div>
      )}

      <div className="mb-3 flex-shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {/* Header row */}
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <IconFilter className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Filters
            </span>
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                {activeFilterCount} active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {filtered && (
              <button
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setSearchInput("");
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600"
              >
                <IconX className="h-3 w-3" /> Clear all
              </button>
            )}
            {canAssign && filtered && total > 0 && (
              <button
                onClick={handleAssignAllFiltered}
                disabled={bulkBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {bulkBusy ? (
                  <><Spinner className="h-3 w-3 text-white" /> Distributing…</>
                ) : (
                  <>⚡ Auto-distribute {total.toLocaleString("en-IN")}</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Search bar — searches name, phone, email */}
        <div className="mb-3">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or email…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className={`w-full rounded-lg border bg-white py-2 pl-10 pr-9 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
                searchInput ? "border-indigo-300" : "border-slate-300"
              }`}
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear search"
              >
                <IconX className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* All filters in one row on large screens */}
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
                  <option key={a.id} value={a.id}>
                    {a.name} ({assignedToCounts[a.id] || 0})
                  </option>
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

          {/* Loan purpose */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Loan Purpose</label>
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="e.g. home loan"
                value={filters.loanPurpose}
                onChange={(e) => setFilters({ ...filters, loanPurpose: e.target.value })}
                className={`w-full rounded-md border bg-white py-1.5 pl-7 pr-7 text-xs text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ${
                  filters.loanPurpose ? "border-indigo-300 bg-indigo-50/40" : "border-slate-300"
                }`}
              />
              {filters.loanPurpose && (
                <button
                  onClick={() => setFilters({ ...filters, loanPurpose: "" })}
                  className="absolute right-1.5 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Clear loan purpose"
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
              {LOAN_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
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
              {SALARY_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {canAssign && selectedIds.size > 0 && (
        <div className="mb-3 flex flex-shrink-0 flex-wrap items-center gap-3 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-3 shadow-sm">
          <div className="flex items-center gap-2 pl-1">
            <span className="brand-gradient grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white">
              {selectedIds.size}
            </span>
            <span className="text-sm font-semibold text-slate-900">selected</span>
          </div>

          <div className="mx-2 hidden h-6 w-px bg-indigo-200 sm:block" />

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkAgentId}
              onChange={(e) => setBulkAgentId(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900"
            >
              <option value="">— Pick agent —</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={bulkBusy || !bulkAgentId}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {bulkBusy ? (
                <><Spinner className="h-3 w-3 text-white" /> Assigning…</>
              ) : (
                "Assign to agent"
              )}
            </button>
          </div>

          <div className="mx-2 hidden h-6 w-px bg-indigo-200 sm:block" />

          <button
            onClick={handleBulkDistribute}
            disabled={bulkBusy || agents.length === 0}
            className="brand-gradient inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow disabled:opacity-50"
          >
            {bulkBusy ? (
              <><Spinner className="h-3 w-3 text-white" /> Distributing…</>
            ) : (
              <>⚡ Auto-distribute across team {agents.length > 0 && `(${agents.length} agents)`}</>
            )}
          </button>

          <button
            onClick={clearSelection}
            className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900"
          >
            Clear
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="relative flex-1 overflow-auto">
          {loading && leads.length > 0 && <OverlaySpinner message="Fetching…" />}
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
            <tr>
              {canAssign && (
                <th className="w-9 px-2.5 py-2.5">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleAllVisible}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 accent-indigo-600"
                  />
                </th>
              )}
              <th className="whitespace-nowrap px-2 py-2.5 text-slate-400">#</th>
              <th className="whitespace-nowrap px-2.5 py-2.5">Name</th>
              <th className="whitespace-nowrap px-2.5 py-2.5">Phone</th>
              <th className="whitespace-nowrap px-2.5 py-2.5">Pin</th>
              <th className="whitespace-nowrap px-2.5 py-2.5">Purpose</th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Loan ₹</th>
              <th className="whitespace-nowrap px-2.5 py-2.5 text-right">Salary ₹</th>
              <th className="whitespace-nowrap px-2.5 py-2.5">Stage</th>
              <th className="whitespace-nowrap px-2.5 py-2.5">Assigned</th>
              <th className="whitespace-nowrap px-2.5 py-2.5">Disposition</th>
              <th className="whitespace-nowrap px-2.5 py-2.5">Actions</th>
            </tr>
          </thead>
          {loading && leads.length === 0 ? (
            <TableSkeleton rows={8} cols={11} hasCheckbox={canAssign} />
          ) : (
          <tbody className="divide-y divide-slate-100">
            {leads.length === 0 ? (
              <tr><td colSpan={canAssign ? 12 : 11} className="px-3 py-10 text-center text-slate-400">No leads match the current filters</td></tr>
            ) : leads.map((l) => {
              const isSelected = selectedIds.has(l.id);
              return (
                <tr key={l.id} className={`transition ${isSelected ? "bg-indigo-50/40" : "hover:bg-slate-50/60"}`}>
                  {canAssign && (
                    <td className="px-2.5 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(l.id)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 accent-indigo-600"
                      />
                    </td>
                  )}
                  <td className="px-2 py-2 text-[11px] text-slate-400">#{l.id}</td>
                  <td className="px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <div className="brand-gradient-soft grid h-6 w-6 flex-shrink-0 place-items-center rounded-full text-[10px] font-semibold text-indigo-700">
                        {l.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">{l.name}</div>
                        {l.email && <div className="hidden truncate text-[10px] text-slate-400 xl:block">{l.email}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-xs text-slate-600">{l.phone || "—"}</td>
                  <td className="px-2.5 py-2 text-xs text-slate-600">{l.pincode || "—"}</td>
                  <td className="px-2.5 py-2 text-xs text-slate-600">{l.loanPurpose || "—"}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs font-medium text-slate-700">{formatINR(l.loanAmount)}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 text-right text-xs text-slate-600">{formatINR(l.monthlyIncome)}</td>
                  <td className="px-2.5 py-2">
                    <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_COLORS[l.stage]}`}>
                      {l.stage}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-slate-600">
                    {canAssign ? (
                      <select
                        value={l.assignedTo || ""}
                        onChange={(e) => handleAssignOne(l.id, e.target.value)}
                        className="max-w-[120px] rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-900"
                      >
                        <option value="">— Unassigned —</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    ) : <span className="text-xs">{l.agent ? l.agent.name : "—"}</span>}
                  </td>
                  <td className="px-2.5 py-2 text-slate-600">
                    {l.disposition ? (
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium ${DISPOSITION_COLORS[l.disposition] || "bg-slate-100 text-slate-700"}`}>
                        {DISPOSITION_LABELS[l.disposition] || l.disposition}
                      </span>
                    ) : <span className="text-xs">—</span>}
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

        {!loading && total > 0 && (
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm">
            <div className="text-slate-600">
              Showing{" "}
              <span className="font-semibold text-slate-900">
                {((page - 1) * pageSize + 1).toLocaleString("en-IN")}
              </span>
              {" – "}
              <span className="font-semibold text-slate-900">
                {Math.min(page * pageSize, total).toLocaleString("en-IN")}
              </span>
              {" of "}
              <span className="font-semibold text-slate-900">
                {total.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-slate-500">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900"
                >
                  {[10,25, 50, 100, 200, 500].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>

              <div className="mx-2 hidden h-5 w-px bg-slate-200 sm:block" />

              <button
                onClick={() => setPage(1)}
                disabled={page <= 1 || loading}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                « First
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹ Prev
              </button>

              <span className="px-2 text-xs text-slate-600">
                Page{" "}
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={page}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    if (!Number.isNaN(n)) setPage(Math.min(totalPages, Math.max(1, n)));
                  }}
                  className="w-14 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-center text-xs text-slate-900"
                />{" "}
                of <span className="font-medium text-slate-900">{totalPages.toLocaleString("en-IN")}</span> pages
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || loading}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Last »
              </button>
            </div>
          </div>
        )}
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
