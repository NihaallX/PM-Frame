function SectionList({ title, items }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item} className="border-l-2 border-black pl-4 text-sm leading-6 text-black/75">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 border border-black/15 bg-black/[0.02] px-4 py-3 text-sm text-black/45">Waiting for this section...</p>
      )}
    </div>
  )
}

export default function JTBDCard({ data, isCopied, onCopy }) {
  const jobsCount = data.functionalJobs.length + data.emotionalJobs.length + data.socialJobs.length

  return (
    <article className="analysis-card print-card flex h-full min-h-0 flex-col overflow-hidden border border-black bg-white shadow-panel">
      <div className="border-b border-black bg-swiss-red px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/80">Framework 01</p>
            <h4 className="mt-3 text-3xl font-black uppercase leading-none tracking-tighterest">JTBD</h4>
          </div>
          <p className="border border-white/40 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/90">
            {jobsCount} jobs
          </p>
        </div>
      </div>

      <div className="analysis-card-scroll flex-1 min-h-0 space-y-8 overflow-y-auto p-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Core Job</p>
          <p className="mt-4 text-lg leading-8 text-black/80">
            {data.coreJob || "Core job will appear as the stream fills in this framework."}
          </p>
        </div>

        <div className="grid gap-8">
          <SectionList title="Functional Jobs" items={data.functionalJobs} />
          <SectionList title="Emotional Jobs" items={data.emotionalJobs} />
          <SectionList title="Social Jobs" items={data.socialJobs} />
        </div>

        <div className="pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Underserved Outcomes</p>
          {data.underservedOutcomes.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {data.underservedOutcomes.map((item) => (
                <div key={item} className="border border-black bg-swiss-paper px-4 py-4 text-sm leading-6 text-black/75">
                  {item}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 border border-black/15 bg-black/[0.02] px-4 py-3 text-sm text-black/45">
              No underserved outcomes yet.
            </p>
          )}
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
