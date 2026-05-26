"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useCachedQuery } from "@/lib/cache";
import { IconBell, IconLogout, IconClock } from "./icons";

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
  if (due < today) return "overdue";
  if (due < tomorrow) return "today";
  return "upcoming";
}

function whenLabel(date) {
  if (!date) return "Not scheduled";
  const due = new Date(date);
  const today = startOfDay(new Date());
  const diffDays = Math.round((startOfDay(due) - today) / 86400000);
  const time = due.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === -1) return `Yesterday ${time}`;
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  return time;
}

// Persistent read tracking — survives page reloads.
// Identifier ties lead id + its current followUp date, so a rescheduled
// lead becomes "unread" again automatically.
const SEEN_KEY = "lms_notifications_seen";
const ackId = (l) => `${l.id}::${l.nextFollowUpAt || ""}`;

function loadSeen() {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveSeen(set) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
  } catch {}
}

export default function TopBar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);
  const [seen, setSeen] = useState(() => new Set());
  const buttonRef = useRef(null);

  // Hydrate localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    setMounted(true);
    setSeen(loadSeen());
  }, []);

  // Poll callbacks every 60s for fresh notification state
  const { data, loading } = useCachedQuery("/leads/callbacks", { staleTime: 60000 });
  const items = data?.items || [];

  // Urgent = overdue + today (sorted earliest first)
  const urgent = useMemo(() => {
    return items
      .filter((l) => {
        if (!l.nextFollowUpAt) return false;
        const b = bucketOf(l.nextFollowUpAt);
        return b === "overdue" || b === "today";
      })
      .sort((a, b) => new Date(a.nextFollowUpAt) - new Date(b.nextFollowUpAt));
  }, [items]);

  const overdueCount = useMemo(
    () => urgent.filter((l) => bucketOf(l.nextFollowUpAt) === "overdue").length,
    [urgent]
  );

  const isUnread = (l) => !seen.has(ackId(l));
  const unreadCount = useMemo(() => urgent.filter(isUnread).length, [urgent, seen]);

  // Mark visible urgent items as seen when dropdown opens
  useEffect(() => {
    if (!open || urgent.length === 0) return;
    setSeen((prev) => {
      const next = new Set(prev);
      let added = false;
      urgent.forEach((l) => {
        const id = ackId(l);
        if (!next.has(id)) {
          next.add(id);
          added = true;
        }
      });
      if (added) saveSeen(next);
      return added ? next : prev;
    });
  }, [open, urgent]);

  // Compute dropdown coords from bell button rect, re-compute on resize
  useEffect(() => {
    if (!open) return;
    function update() {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    function handleEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const dropdown = open && mounted ? createPortal(
    <>
      {/* Click-anywhere scrim to close */}
      <div
        className="fixed inset-0 z-[9998]"
        onClick={() => setOpen(false)}
      />

      <div
        style={{ top: coords.top, right: coords.right }}
        className="fixed z-[9999] flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold text-slate-900">Notifications</div>
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
              {overdueCount} overdue
            </span>
          )}
        </div>

        <div className="max-h-[60vh] flex-1 overflow-y-auto">
          {loading && urgent.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-400">
              Loading…
            </div>
          ) : urgent.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-slate-400">
              <IconBell className="h-8 w-8 text-slate-300" />
              <div className="text-sm">All caught up</div>
              <div className="text-[11px]">No urgent callbacks right now</div>
            </div>
          ) : (
            urgent.slice(0, 10).map((l) => {
              const b = bucketOf(l.nextFollowUpAt);
              const unread = isUnread(l);
              const dotClass = unread
                ? b === "overdue"
                  ? "bg-rose-500"
                  : "bg-amber-500"
                : "bg-slate-300";
              return (
                <Link
                  key={l.id}
                  href="/callbacks"
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 border-b border-slate-100 px-4 py-3 transition last:border-b-0 hover:bg-slate-50 ${
                    unread ? "bg-indigo-50/30" : ""
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${dotClass}`} />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-sm ${
                        unread ? "font-semibold text-slate-900" : "font-medium text-slate-500"
                      }`}
                    >
                      {l.name}
                    </div>
                    <div
                      className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] ${
                        unread ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <IconClock className="h-3 w-3" />
                        <span
                          className={
                            unread && b === "overdue"
                              ? "font-semibold text-rose-600"
                              : ""
                          }
                        >
                          {whenLabel(l.nextFollowUpAt)}
                        </span>
                      </span>
                      {l.phone && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="truncate font-mono">{l.phone}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {unread && (
                    <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                  )}
                </Link>
              );
            })
          )}
        </div>

        <Link
          href="/callbacks"
          onClick={() => setOpen(false)}
          className="flex-shrink-0 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-center text-xs font-semibold text-indigo-600 transition hover:bg-slate-100"
        >
          View all callbacks →
        </Link>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur">
      <div className="flex items-center gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-400">
            {greeting}
          </div>
          <div className="text-sm font-semibold text-slate-900">{user?.name}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          ref={buttonRef}
          onClick={() => setOpen((o) => !o)}
          className="relative grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          aria-label="Notifications"
        >
          <IconBell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {dropdown}

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
        >
          <IconLogout className="h-4 w-4" />
          Logout
        </button>
      </div>
    </header>
  );
}
