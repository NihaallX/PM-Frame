export default function InputPanel({ problemStatement, error, onChange, onSubmit, isLoading }) {
  const canSubmit = !isLoading

  function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canSubmit) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="mt-8 max-w-2xl">
      <label className="block">
        <span className="sr-only">Problem statement</span>
        <textarea
          value={problemStatement}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. College students waste 20 minutes in canteen queues every day"
          className="min-h-[132px] w-full resize-none border border-black bg-swiss-paper px-5 py-5 text-base leading-7 text-black outline-none transition-colors placeholder:text-black/35 focus:border-black md:min-h-[150px] md:text-lg md:leading-8"
        />
      </label>

      <div className="mt-3 min-h-[1.5rem]">
        {error ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-swiss-red">{error}</p>
        ) : (
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/45">Ctrl/Cmd + Enter</p>
        )}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center bg-black px-6 py-4 text-sm font-semibold uppercase tracking-[0.34em] text-white transition-colors hover:bg-swiss-red disabled:cursor-not-allowed disabled:bg-black/25 disabled:text-white/70 md:w-auto md:min-w-[260px]"
      >
        {isLoading ? "ANALYZING..." : "ANALYZE \u2192"}
      </button>
    </div>
  )
}
