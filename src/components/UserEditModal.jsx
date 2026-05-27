"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { Spinner } from "./Loader";
import { IconX } from "./icons";

function initial(name) {
  return name?.[0]?.toUpperCase() || "?";
}

const ROLE_COLORS = {
  superadmin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  agent: "bg-emerald-100 text-emerald-700",
};

/**
 * Edit user modal — name, phone, optional password reset, active toggle.
 *
 * Props:
 *   user      — user object to edit
 *   onClose() — close without changes
 *   onSaved() — after successful save (parent invalidates cache)
 */
export default function UserEditModal({ user, onClose, onSaved }) {
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    password: "",
    isActive: user?.isActive ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = (e) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, saving]);

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
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        isActive: form.isActive,
      };
      if (form.password) payload.password = form.password;
      await api.patch(`/users/${user.id}`, payload);
      if (onSaved) await onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!mounted || !user) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={() => !saving && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="brand-gradient flex items-center justify-between px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-white/20 text-sm font-bold ring-2 ring-white/30">
              {initial(user.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">Edit User</div>
              <div className="truncate text-xs text-indigo-100/90">
                {user.email}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="grid h-8 w-8 place-items-center rounded-full text-white/80 transition hover:bg-white/20 hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Role:</span>
            <span className={`rounded-full px-2 py-0.5 font-semibold capitalize ${ROLE_COLORS[user.role] || "bg-slate-100"}`}>
              {user.role}
            </span>
            <span>·</span>
            <span>ID #{user.id}</span>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="off"
              placeholder="user@company.com"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              User logs in with this email. Must be unique.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Phone
            </label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="10-digit mobile"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              New Password (optional)
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Leave blank to keep existing"
              autoComplete="new-password"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-[10px] text-slate-400">
              Only fill this if resetting the user&apos;s password.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium text-slate-900">Active</div>
              <div className="text-[11px] text-slate-500">
                {form.isActive ? "User can log in and receive leads" : "User is disabled, cannot log in"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${
                form.isActive ? "bg-emerald-500" : "bg-slate-300"
              }`}
              aria-label="Toggle active"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                  form.isActive ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

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
            disabled={saving || !form.name.trim()}
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
