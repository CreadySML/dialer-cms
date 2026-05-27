"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { Spinner } from "./Loader";
import { IconX, IconPhone, IconClock } from "./icons";

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

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const formatINR = (v) => (v == null || v === "" ? "—" : `₹${INR.format(v)}`);

function toLocalDatetime(value) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initial(name) {
  return name?.[0]?.toUpperCase() || "?";
}

/**
 * Lead update modal — used by Leads and Callbacks pages.
 * Renders via portal so it overlays everything.
 *
 * Props:
 *   lead      — flattened lead object (with stage/disposition/remarks/etc.)
 *   onClose() — close without changes
 *   onSaved() — called AFTER successful save (parent invalidates cache)
 */
export default function LeadUpdateModal({ lead, onClose, onSaved }) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    stage: lead?.stage || "new",
    disposition: lead?.disposition || "",
    nextFollowUpAt: toLocalDatetime(lead?.nextFollowUpAt),
    remarks: lead?.remarks || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  // Close on Esc
  useEffect(() => {
    const handler = (e) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, saving]);

  // Lock body scroll while open
  useEffect(() => {
    const orig = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = orig;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await api.patch(`/leads/${lead.id}/status`, {
        stage: form.stage,
        disposition: form.disposition || null,
        nextFollowUpAt: form.nextFollowUpAt
          ? new Date(form.nextFollowUpAt).toISOString()
          : null,
        remarks: form.remarks || null,
      });
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!mounted || !lead) return null;

  const showFollowUp =
    form.disposition === "callback" || form.stage === "follow_up";

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !saving && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="brand-gradient flex items-center justify-between px-6 py-4 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-white/20 text-sm font-bold ring-2 ring-white/30">
              {initial(lead.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">{lead.name}</div>
              <div className="truncate text-xs text-indigo-100/90">
                #{lead.id} {lead.pincode ? `· ${lead.pincode}` : ""}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="grid max-h-[calc(90vh-140px)] gap-6 overflow-y-auto p-6 md:grid-cols-2">
          {/* Left: Lead details */}
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Contact
              </div>
              <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                {lead.phone ? (
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex items-center gap-2 font-mono text-slate-800 hover:text-indigo-700"
                  >
                    <IconPhone className="h-3.5 w-3.5 text-indigo-600" />
                    {lead.phone}
                  </a>
                ) : (
                  <div className="text-slate-400">No phone</div>
                )}
                {lead.email && (
                  <div className="truncate text-xs text-slate-600">{lead.email}</div>
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Loan
              </div>
              <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Purpose</span>
                  <span className="font-medium text-slate-900">{lead.loanPurpose || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-semibold text-indigo-700">{formatINR(lead.loanAmount)}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Profile
              </div>
              <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Monthly Income</span>
                  <span className="font-semibold text-emerald-700">{formatINR(lead.monthlyIncome)}</span>
                </div>
                {lead.profile && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Employment</span>
                    <span className="font-medium text-slate-900">{lead.profile}</span>
                  </div>
                )}
                {lead.gender && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gender</span>
                    <span className="font-medium text-slate-900 capitalize">{lead.gender}</span>
                  </div>
                )}
              </div>
            </div>

            {lead.agent && (
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Currently Assigned
                </div>
                <div className="rounded-lg bg-indigo-50 p-3 text-sm font-medium text-indigo-800">
                  {lead.agent.name}
                </div>
              </div>
            )}
          </div>

          {/* Right: Edit form */}
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Current Status
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_COLORS[lead.stage] || "bg-slate-100 text-slate-700"}`}>
                  {lead.stage || "new"}
                </span>
                {lead.disposition && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                    {lead.disposition}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Update Stage
              </label>
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Disposition
              </label>
              <select
                value={form.disposition}
                onChange={(e) => setForm({ ...form, disposition: e.target.value })}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
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
            </div>

            {showFollowUp && (
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <IconClock className="h-3 w-3" />
                  Follow-up at
                </label>
                <input
                  type="datetime-local"
                  value={form.nextFollowUpAt}
                  onChange={(e) => setForm({ ...form, nextFollowUpAt: e.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Remarks / Notes from call
              </label>
              <textarea
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                placeholder="e.g. Customer asked for callback tomorrow afternoon. Wants 15-year tenure quote via email."
                rows={4}
                className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-6 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="brand-gradient inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/30 transition hover:shadow-lg disabled:opacity-60"
          >
            {saving && <Spinner className="h-4 w-4 text-white" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
