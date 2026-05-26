"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { IconBrand, IconCheck } from "@/components/icons";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@lms.local");
  const [password, setPassword] = useState("Admin@12345");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [user, loading, router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  const features = [
    "Smart lead distribution across teams",
    "Real-time agent disposition tracking",
    "Filter-based assignment & follow-ups",
    "Role-based access for managers & agents",
  ];

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="brand-gradient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-pink-400/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <IconBrand className="h-10 w-10" />
          <div>
            <div className="text-lg font-semibold">DialerOne</div>
            <div className="text-xs uppercase tracking-wider text-indigo-100/70">
              Lead Management Suite
            </div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight">
            Run your call center like a <span className="italic">pipeline.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-indigo-100/90">
            Distribute leads, track every conversation, and convert faster — all
            from one premium command center built for managers and agents.
          </p>

          <ul className="mt-8 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-indigo-50">
                <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-white/15">
                  <IconCheck className="h-3 w-3 text-white" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-indigo-100/60">
          © {new Date().getFullYear()} DialerOne · Built for modern call centers
        </div>
      </div>

      {/* Right form panel */}
      <div className="grid place-items-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <IconBrand className="h-9 w-9" />
            <div className="text-lg font-semibold text-slate-900">DialerOne</div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Sign in to access your dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Forgot?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="brand-gradient w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-500/40 disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in to dashboard"}
            </button>
          </form>

          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Demo super admin
            </div>
            <div className="mt-1 font-mono text-xs text-slate-700">
              admin@lms.local · Admin@12345
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
