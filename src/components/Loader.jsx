export function Spinner({ className = "h-5 w-5", brand = false }) {
  return (
    <svg
      className={`animate-spin ${className} ${brand ? "text-indigo-600" : "text-slate-400"}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TableSkeleton({ rows = 8, cols = 10, hasCheckbox = false }) {
  return (
    <tbody className="animate-pulse divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {hasCheckbox && (
            <td className="px-2.5 py-3">
              <div className="h-4 w-4 rounded bg-slate-200" />
            </td>
          )}
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-2.5 py-3">
              <div
                className="h-3 rounded bg-slate-200"
                style={{ width: `${50 + ((r * 13 + c * 7) % 50)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function CardSkeleton({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-xl border border-slate-200 bg-white p-5 ${className}`}>
      <div className="h-3 w-24 rounded bg-slate-200" />
      <div className="mt-3 h-7 w-20 rounded bg-slate-200" />
      <div className="mt-2 h-2.5 w-32 rounded bg-slate-200" />
    </div>
  );
}

export function OverlaySpinner({ message = "Loading…" }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-white/60 backdrop-blur-[1px]">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 shadow-lg">
        <Spinner brand className="h-4 w-4" />
        <span className="text-sm font-medium text-slate-700">{message}</span>
      </div>
    </div>
  );
}

export function PageLoader({ message = "Loading…" }) {
  return (
    <div className="grid place-items-center py-20">
      <div className="flex items-center gap-3 text-slate-500">
        <Spinner brand className="h-6 w-6" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
