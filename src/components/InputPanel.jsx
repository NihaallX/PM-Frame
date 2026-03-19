const examples = [
  "College students waste 20 minutes in canteen queues every day.",
  "First-time EV buyers get overwhelmed comparing charging networks and plans.",
  "Remote teams forget customer insights because feedback lives across too many tools.",
]

export default function InputPanel({ problemStatement, onChange, onSubmit, isLoading }) {
  const characterCount = problemStatement.trim().length
  const canSubmit = !isLoading && characterCount > 0

  function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canSubmit) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="border border-white bg-white text-swiss-black shadow-soft">
      <div className="grid gap-6 p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-black/55">Problem Statement</p>
            <h3 className="mt-3 text-3xl font-black uppercase leading-none tracking-tighterest md:text-5xl">
              DEFINE THE PAIN
            </h3>
          </div>
          <p className="max-w-md text-sm leading-6 text-black/65">
            Write the user problem like you would in a product kickoff. Be concrete about who is blocked and why.
          </p>
        </div>

        <label className="block">
          <span className="sr-only">Problem statement</span>
          <textarea
            value={problemStatement}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="College students waste 20 minutes in canteen queues every day."
            className="min-h-[220px] w-full resize-none border border-black bg-swiss-paper px-5 py-5 text-lg leading-8 text-black outline-none transition-colors placeholder:text-black/35 focus:border-swiss-red"
          />
        </label>

        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-black/55">Examples</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-black/45">
                {characterCount} chars
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-black/45">Ctrl/Cmd + Enter</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => onChange(example)}
                  className="border border-black px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.22em] transition-colors hover:border-swiss-red hover:text-swiss-red"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="inline-flex min-w-[190px] items-center justify-center border border-white bg-swiss-red px-6 py-4 text-sm font-semibold uppercase tracking-[0.35em] text-white transition-colors hover:bg-white hover:text-swiss-red disabled:cursor-not-allowed disabled:border-black/10 disabled:bg-black/20 disabled:text-white/70"
            >
              {isLoading ? "Analyzing..." : "Analyze"}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={isLoading || !problemStatement}
              className="inline-flex min-w-[190px] items-center justify-center border border-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-black/70 transition-colors hover:border-swiss-red hover:text-swiss-red disabled:cursor-not-allowed disabled:border-black/15 disabled:text-black/30"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
