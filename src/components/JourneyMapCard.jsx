function asDisplayText(value, fallback) {
  return value ? value : fallback
}

export default function JourneyMapCard({ data, isCopied, onCopy }) {
  return (
    <article className="analysis-card print-card flex h-full min-h-0 flex-col overflow-hidden border border-black bg-black text-white shadow-panel">
      <div className="border-b border-white/20 px-6 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/60">Framework 02</p>
        <h4 className="mt-3 text-3xl font-black uppercase leading-none tracking-tighterest">Journey Map</h4>
      </div>

      <div className="analysis-card-scroll flex-1 min-h-0 overflow-y-auto">
        <div className="grid divide-y divide-white/15">
          {data.map((stage, index) => (
            <section key={`${stage.stage}-${index}`} className="grid gap-5 border-l-2 border-white/20 px-6 py-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">Stage {index + 1}</p>
                  <h5 className="mt-2 text-2xl font-black uppercase tracking-tighterest">{stage.stage}</h5>
                </div>
                <p className="border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white/80">
                  {asDisplayText(stage.emotionalState, "Neutral")}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">User Action</p>
                  <p className="mt-2 text-sm leading-6 text-white/75">
                    {asDisplayText(stage.userAction, "Action details will appear once generated.")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">Pain Point</p>
                  <p className="mt-2 text-sm leading-6 text-white/75">
                    {asDisplayText(stage.painPoint, "Pain point details will appear once generated.")}
                  </p>
                </div>
              </div>

              <div className="border border-white/20 bg-white/5 px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/50">PM Opportunity</p>
                <p className="mt-2 text-sm leading-6 text-white/80">
                  {asDisplayText(stage.opportunity, "Opportunity ideas will appear once generated.")}
                </p>
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="print-hide border-t border-white/20 px-6 py-4">
        <button
          type="button"
          onClick={onCopy}
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-white/75 transition-colors hover:text-white"
        >
          {isCopied ? "COPIED" : "COPY AS MARKDOWN"}
        </button>
      </div>
    </article>
  )
}
