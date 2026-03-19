function BulletSection({ title, items, inverted = false }) {
  return (
    <div>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.35em] ${inverted ? "text-white/60" : "text-black/55"}`}>
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item}
              className={`text-sm leading-6 ${inverted ? "border-l-2 border-white pl-4 text-white/80" : "border-l-2 border-black pl-4 text-black/75"}`}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className={`mt-4 border px-4 py-3 text-sm ${inverted ? "border-white/20 bg-white/5 text-white/55" : "border-black/15 bg-black/[0.02] text-black/45"}`}>
          Waiting for this section...
        </p>
      )}
    </div>
  )
}

export default function PRDCard({ data, isCopied, onCopy }) {
  const mustHaveCount = data.mvpFeatures.mustHave.length
  const niceToHaveCount = data.mvpFeatures.niceToHave.length

  return (
    <article className="analysis-card print-card flex h-full min-h-0 flex-col overflow-hidden border border-black bg-white shadow-panel">
      <div className="border-b border-black px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Framework 03</p>
            <h4 className="mt-3 text-3xl font-black uppercase leading-none tracking-tighterest">PRD Skeleton</h4>
          </div>
          <p className="border border-black px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-black/80">
            {mustHaveCount + niceToHaveCount} features
          </p>
        </div>
      </div>

      <div className="analysis-card-scroll flex-1 min-h-0 space-y-8 overflow-y-auto p-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Problem Statement</p>
          <p className="mt-4 text-sm leading-7 text-black/75">
            {data.problemStatement || "Problem statement framing will appear as the stream completes."}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="border border-black bg-swiss-paper p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Primary User</p>
            <p className="mt-3 text-sm leading-6 text-black/75">{data.targetUsers.primary || "Not provided yet."}</p>
          </div>
          <div className="border border-black bg-swiss-paper p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Secondary User</p>
            <p className="mt-3 text-sm leading-6 text-black/75">{data.targetUsers.secondary || "Not provided yet."}</p>
          </div>
        </div>

        <div className="border border-black bg-black p-5 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/60">Success Metrics</p>
          <p className="mt-4 text-lg font-semibold uppercase tracking-[0.18em]">
            {data.successMetrics.northStar || "North star metric pending"}
          </p>
          <div className="mt-5">
            <BulletSection title="Guardrails" items={data.successMetrics.guardrails} inverted />
          </div>
        </div>

        <div className="grid gap-8 pb-1">
          <BulletSection title="Must-Have Features" items={data.mvpFeatures.mustHave} />
          <BulletSection title="Nice-To-Have Features" items={data.mvpFeatures.niceToHave} />
          <BulletSection title="Out Of Scope" items={data.outOfScope} />
          <BulletSection title="Open Questions" items={data.openQuestions} />
        </div>
      </div>

      <div className="print-hide border-t border-black px-6 py-4">
        <button
          type="button"
          onClick={onCopy}
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-black/70 transition-colors hover:text-swiss-red"
        >
          {isCopied ? "COPIED" : "COPY AS MARKDOWN"}
        </button>
      </div>
    </article>
  )
}
