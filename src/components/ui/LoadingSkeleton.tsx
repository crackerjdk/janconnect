export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-xl border border-[#E2E6EC] bg-white p-5">
          <div className="h-3.5 w-40 rounded bg-gray-200 animate-pulse" />
          <div className="mt-3 h-5 w-3/4 rounded bg-gray-200 animate-pulse" />
          <div className="mt-2 h-4 w-full rounded bg-gray-100 animate-pulse" />
          <div className="mt-1.5 h-4 w-2/3 rounded bg-gray-100 animate-pulse" />
        </div>
      ))}
    </div>
  );
}
