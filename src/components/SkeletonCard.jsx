export default function SkeletonCard({ label, title, icon }) {
  return (
    <article className="overflow-hidden border border-black bg-white shadow-panel">
      <div className="border-b border-black bg-swiss-cloud px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">{label}</p>
            <h4 className="mt-3 text-3xl font-black uppercase leading-none tracking-tighterest">{title}</h4>
          </div>
          <div className="border border-black p-3">{icon}</div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        <div className="skeleton-shimmer h-3 w-24 bg-black/10" />
        <div className="skeleton-shimmer h-10 w-full bg-black/10" />
        <div className="skeleton-shimmer h-3 w-32 bg-black/10" />
        <div className="space-y-3">
          <div className="skeleton-shimmer h-16 w-full bg-black/10" />
          <div className="skeleton-shimmer h-16 w-full bg-black/10" />
          <div className="skeleton-shimmer h-16 w-full bg-black/10" />
        </div>
      </div>
    </article>
  )
}
