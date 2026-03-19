const TAG_GROUPS = [
  {
    key: "industry",
    label: "Industry",
    options: ["EDTECH", "HEALTHTECH", "FINTECH", "CONSUMER", "B2B SAAS", "OTHER"],
  },
  {
    key: "stage",
    label: "Stage",
    options: ["0-TO-1", "GROWTH", "MATURE"],
  },
  {
    key: "userType",
    label: "User Type",
    options: ["B2C", "B2B", "INTERNAL TOOL"],
  },
]

function FeedbackPanel({ feedback, onUseSuggested, onAnalyzeAnyway, onDismissBlocked }) {
  if (!feedback) {
    return null
  }

  if (feedback.mode === "blocked") {
    return (
      <div className="feedback-panel feedback-panel--weak mt-5">
        <p className="feedback-panel__label">Statement Gate</p>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-swiss-red">
          STATEMENT TOO VAGUE TO ANALYZE.
        </p>
        <p className="mt-3 text-sm leading-7 text-black/75">Try: '[Who] struggles with [pain] because [reason]'</p>
        <button type="button" onClick={onDismissBlocked} className="feedback-inline-action mt-5">
          DISMISS
        </button>
      </div>
    )
  }

  const toneClass = feedback.score === "weak" ? "feedback-panel--weak" : "feedback-panel--moderate"

  return (
    <div className={`feedback-panel ${toneClass} mt-5`}>
      <p className="feedback-panel__label">Statement Review</p>
      <p className="mt-3 text-sm font-semibold uppercase tracking-[0.16em] text-black">
        [STATEMENT QUALITY: {feedback.score.toUpperCase()}]
      </p>
      {feedback.missingElements.length > 0 && (
        <p className="mt-4 text-sm leading-7 text-black/75">
          <span className="font-semibold uppercase tracking-[0.16em] text-black">Missing:</span>{" "}
          {feedback.missingElements.join(", ")}
        </p>
      )}
      {feedback.improvedVersion && (
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/60">Suggested Improvement</p>
          <p className="mt-3 text-sm leading-7 text-black/75">"{feedback.improvedVersion}"</p>
        </div>
      )}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <button type="button" onClick={onUseSuggested} className="feedback-inline-action bg-black text-white">
          USE SUGGESTED {"\u2192"}
        </button>
        <button type="button" onClick={onAnalyzeAnyway} className="feedback-inline-action">
          ANALYZE ANYWAY {"\u2192"}
        </button>
      </div>
    </div>
  )
}

function TagGroup({ label, options, selectedValue, onToggle }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selectedValue === option

          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`tag-pill ${isSelected ? "tag-pill--selected" : ""}`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function InputPanel({
  problemStatement,
  inputError,
  onChange,
  onSubmit,
  isBusy,
  remainingAnalyses,
  rateLimitMessage,
  isEvaluating,
  scorerFeedback,
  scorerWarning,
  selectedTags,
  onTagToggle,
  onUseSuggested,
  onAnalyzeAnyway,
  onDismissBlocked,
}) {
  function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !isBusy) {
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

      <div className="mt-3 flex min-h-[1.5rem] flex-col gap-2">
        {inputError ? <p className="microcopy-error">{inputError}</p> : null}
        {rateLimitMessage ? <p className="microcopy-error">{rateLimitMessage}</p> : null}
        {isEvaluating ? <p className="microcopy-status">EVALUATING STATEMENT...</p> : null}
        {scorerWarning ? <p className="microcopy-status">{scorerWarning}</p> : null}
        {!inputError && !rateLimitMessage && !isEvaluating ? (
          <p className="microcopy-muted">{remainingAnalyses} / 10 ANALYSES REMAINING THIS HOUR</p>
        ) : null}
      </div>

      <FeedbackPanel
        feedback={scorerFeedback}
        onUseSuggested={onUseSuggested}
        onAnalyzeAnyway={onAnalyzeAnyway}
        onDismissBlocked={onDismissBlocked}
      />

      <div className="mt-6 grid gap-5">
        {TAG_GROUPS.map((group) => (
          <TagGroup
            key={group.key}
            label={group.label}
            options={group.options}
            selectedValue={selectedTags[group.key]}
            onToggle={(value) => onTagToggle(group.key, value)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isBusy}
        className="mt-6 inline-flex w-full items-center justify-center bg-black px-6 py-4 text-sm font-semibold uppercase tracking-[0.34em] text-white transition-colors hover:bg-swiss-red disabled:cursor-not-allowed disabled:bg-black/25 disabled:text-white/70"
      >
        {isBusy ? "ANALYZING..." : "ANALYZE \u2192"}
      </button>
    </div>
  )
}
