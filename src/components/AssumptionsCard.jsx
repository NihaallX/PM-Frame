function RiskBadge({ risk }) {
  const classes =
    risk === "HIGH"
      ? "border-swiss-red text-swiss-red"
      : risk === "LOW"
        ? "border-black/25 text-black/45"
        : "border-black text-black"

  return (
    <span className={`inline-flex border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] ${classes}`}>
      {risk}
    </span>
  )
}

export default function AssumptionsCard({ data, isCopied, onCopy }) {
  return (
    <article className="analysis-card print-card flex h-full min-h-0 flex-col overflow-hidden border border-black bg-white shadow-panel">
      <div className="border-b border-black bg-[#6b531f] px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/75">Framework 04</p>
            <h4 className="mt-3 text-3xl font-black uppercase leading-none tracking-tighterest">Assumptions</h4>
          </div>
          <p className="border border-white/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/90">
            {data.length} tests
          </p>
        </div>
      </div>

      <div className="analysis-card-scroll flex-1 min-h-0 space-y-4 overflow-y-auto p-6">
        {data.map((item, index) => (
          <section key={`${item.assumption}-${index}`} className="border border-black bg-swiss-paper p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Assumption {index + 1}</p>
            <p className="mt-3 text-sm leading-7 text-black/80">{item.assumption}</p>

            <div className="mt-5 flex items-center gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Risk</p>
              <RiskBadge risk={item.risk} />
            </div>

            <div className="mt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Test</p>
              <p className="mt-3 text-sm leading-7 text-black/75">{item.validationMethod || "Validation path not provided."}</p>
            </div>
          </section>
        ))}
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
