export default function SkeletonCard({ label, title, icon, state = "loading", message = "COULD NOT GENERATE" }) {
  const isMissing = state === "missing"

  return (
    <article className="analysis-card print-card flex h-full min-h-0 flex-col overflow-hidden border border-black bg-white shadow-panel">
      <div className="border-b border-black bg-swiss-cloud px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">{label}</p>
            <h4 className="mt-3 text-3xl font-black uppercase leading-none tracking-tighterest">{title}</h4>
          </div>
          <div className="border border-black p-3">{icon}</div>
        </div>
      </div>

      <div className="analysis-card-scroll flex-1 min-h-0 overflow-y-auto p-6">
        {isMissing ? (
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Status</p>
              <h5 className="mt-4 text-2xl font-black uppercase tracking-tighterest">{message}</h5>
              <p className="mt-5 max-w-sm text-sm leading-7 text-black/65">
                This framework could not be generated for the current response.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="skeleton-shimmer h-3 w-24 bg-black/10" />
            <div className="skeleton-shimmer h-10 w-full bg-black/10" />
            <div className="skeleton-shimmer h-3 w-32 bg-black/10" />
            <div className="space-y-3">
              <div className="skeleton-shimmer h-16 w-full bg-black/10" />
              <div className="skeleton-shimmer h-16 w-full bg-black/10" />
              <div className="skeleton-shimmer h-16 w-full bg-black/10" />
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
