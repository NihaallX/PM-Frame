import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, BriefcaseBusiness, FlaskConical, Route, ScanSearch } from "lucide-react"
import InputPanel from "./components/InputPanel"
import AssumptionsCard from "./components/AssumptionsCard"
import JTBDCard from "./components/JTBDCard"
import JourneyMapCard from "./components/JourneyMapCard"
import PRDCard from "./components/PRDCard"
import SkeletonCard from "./components/SkeletonCard"
import { scoreProblemStatement, streamPmAnalysis } from "./utils/groq"
import {
  buildAssumptionsMarkdown,
  buildJourneyMapMarkdown,
  buildJtbdMarkdown,
  buildPrdMarkdown,
  hasRenderableAnalysis,
  isRenderableAssumptions,
  isRenderableJourneyMap,
  isRenderableJtbd,
  isRenderablePrd,
} from "./utils/formatters"

const FRIENDLY_ERROR_MESSAGE = "Analysis could not be generated. Check your API key or try rephrasing the problem."
const REQUESTS_STORAGE_KEY = "pmframe_requests"
const MAX_ANALYSES_PER_HOUR = 10
const ONE_HOUR_MS = 60 * 60 * 1000

const emptyAnalysis = {
  jtbd: null,
  journeyMap: null,
  prd: null,
  assumptions: null,
}

const emptyModelMeta = {
  activeModel: "",
  candidateModels: [],
  availableModels: [],
}

const emptyTags = {
  industry: "",
  stage: "",
  userType: "",
}

const previewItems = [
  {
    label: "Framework 01",
    title: "JTBD",
    description: "Core job, supporting jobs, and underserved outcomes.",
  },
  {
    label: "Framework 02",
    title: "Journey Map",
    description: "Five stages of action, emotion, pain, and PM opportunity.",
  },
  {
    label: "Framework 03",
    title: "PRD Skeleton",
    description: "Problem, users, metrics, features, scope, and open questions.",
  },
  {
    label: "Framework 04",
    title: "Assumptions",
    description: "The highest-risk bets to test before the roadmap hardens.",
  },
]

function getStoredRequestTimestamps() {
  try {
    const raw = window.localStorage.getItem(REQUESTS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item) => Number.isFinite(item)).map((item) => Number(item))
      : []
  } catch {
    return []
  }
}

function buildRateLimitSnapshot(now = Date.now()) {
  const recent = getStoredRequestTimestamps()
    .filter((timestamp) => now - timestamp < ONE_HOUR_MS)
    .sort((left, right) => left - right)

  return {
    recent,
    remaining: Math.max(0, MAX_ANALYSES_PER_HOUR - recent.length),
    blocked: recent.length >= MAX_ANALYSES_PER_HOUR,
    resetMinutes:
      recent.length >= MAX_ANALYSES_PER_HOUR ? Math.max(1, Math.ceil((recent[0] + ONE_HOUR_MS - now) / 60000)) : 0,
  }
}

function persistRequestTimestamps(timestamps) {
  try {
    window.localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(timestamps))
  } catch {
    // Ignore storage failures in the browser and continue.
  }
}

function recordSuccessfulAnalysis(now = Date.now()) {
  const snapshot = buildRateLimitSnapshot(now)
  const next = [...snapshot.recent, now]
  persistRequestTimestamps(next)
  return buildRateLimitSnapshot(now)
}

function formatContextSummary(tags) {
  const items = []

  if (tags.industry) {
    items.push(`INDUSTRY: ${tags.industry}`)
  }
  if (tags.stage) {
    items.push(`STAGE: ${tags.stage}`)
  }
  if (tags.userType) {
    items.push(`USER TYPE: ${tags.userType}`)
  }

  return items.length ? items.join(" / ") : "NO CONTEXT TAGS"
}

export default function App() {
  const [problemStatement, setProblemStatement] = useState("")
  const [inputError, setInputError] = useState("")
  const [status, setStatus] = useState("idle")
  const [scorerStatus, setScorerStatus] = useState("idle")
  const [error, setError] = useState("")
  const [rawJsonBuffer, setRawJsonBuffer] = useState("")
  const [analysis, setAnalysis] = useState(emptyAnalysis)
  const [modelMeta, setModelMeta] = useState(emptyModelMeta)
  const [lastSubmittedProblem, setLastSubmittedProblem] = useState("")
  const [pendingProblem, setPendingProblem] = useState("")
  const [copiedCardId, setCopiedCardId] = useState("")
  const [rateLimit, setRateLimit] = useState({ remaining: MAX_ANALYSES_PER_HOUR, blocked: false, resetMinutes: 0 })
  const [rateLimitNotice, setRateLimitNotice] = useState("")
  const [statementQuality, setStatementQuality] = useState("unknown")
  const [scorerFeedback, setScorerFeedback] = useState(null)
  const [scorerWarning, setScorerWarning] = useState("")
  const [selectedTags, setSelectedTags] = useState(emptyTags)
  const [submittedTags, setSubmittedTags] = useState(emptyTags)
  const copyResetRef = useRef(null)

  useEffect(() => {
    setRateLimit(buildRateLimitSnapshot())

    const intervalId = window.setInterval(() => {
      setRateLimit(buildRateLimitSnapshot())
    }, 60000)

    return () => {
      if (copyResetRef.current) {
        window.clearTimeout(copyResetRef.current)
      }
      window.clearInterval(intervalId)
    }
  }, [])

  const shouldShowResults = ["streaming", "success", "error"].includes(status) || hasRenderableAnalysis(analysis)

  const renderable = useMemo(
    () => ({
      jtbd: isRenderableJtbd(analysis.jtbd),
      journeyMap: isRenderableJourneyMap(analysis.journeyMap),
      prd: isRenderablePrd(analysis.prd),
      assumptions: isRenderableAssumptions(analysis.assumptions),
    }),
    [analysis],
  )

  const frameworkState = useMemo(
    () => [
      {
        key: "jtbd",
        id: "jtbd-panel",
        label: "Framework 01",
        title: "JTBD",
        icon: <BriefcaseBusiness className="h-5 w-5" />,
        ready: renderable.jtbd,
      },
      {
        key: "journeyMap",
        id: "journey-panel",
        label: "Framework 02",
        title: "Journey Map",
        icon: <Route className="h-5 w-5" />,
        ready: renderable.journeyMap,
      },
      {
        key: "prd",
        id: "prd-panel",
        label: "Framework 03",
        title: "PRD Skeleton",
        icon: <ScanSearch className="h-5 w-5" />,
        ready: renderable.prd,
      },
      {
        key: "assumptions",
        id: "assumptions-panel",
        label: "Framework 04",
        title: "Assumptions",
        icon: <FlaskConical className="h-5 w-5" />,
        ready: renderable.assumptions,
      },
    ],
    [renderable],
  )

  const completedFrameworks = frameworkState.filter((framework) => framework.ready).length
  const metadataContextSummary = useMemo(() => formatContextSummary(submittedTags), [submittedTags])

  const markdownContent = useMemo(
    () => ({
      jtbd: renderable.jtbd ? buildJtbdMarkdown(analysis.jtbd) : "",
      journeyMap: renderable.journeyMap ? buildJourneyMapMarkdown(analysis.journeyMap) : "",
      prd: renderable.prd ? buildPrdMarkdown(analysis.prd) : "",
      assumptions: renderable.assumptions ? buildAssumptionsMarkdown(analysis.assumptions) : "",
    }),
    [analysis, renderable],
  )

  async function runMainAnalysis(statement, quality) {
    const trimmedStatement = statement.trim()
    const contextTags = { ...selectedTags }

    setProblemStatement(trimmedStatement)
    setLastSubmittedProblem(trimmedStatement)
    setPendingProblem("")
    setStatus("streaming")
    setScorerStatus("idle")
    setError("")
    setRawJsonBuffer("")
    setAnalysis(emptyAnalysis)
    setModelMeta(emptyModelMeta)
    setStatementQuality(quality)
    setSubmittedTags(contextTags)
    setRateLimitNotice("")

    window.requestAnimationFrame(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })

    try {
      const finalAnalysis = await streamPmAnalysis(trimmedStatement, {
        contextTags,
        onBuffer: setRawJsonBuffer,
        onPartial: (partialAnalysis) => {
          setAnalysis((current) => ({
            jtbd: partialAnalysis.jtbd ?? current.jtbd,
            journeyMap: partialAnalysis.journeyMap ?? current.journeyMap,
            prd: partialAnalysis.prd ?? current.prd,
            assumptions: partialAnalysis.assumptions ?? current.assumptions,
          }))
        },
        onMeta: setModelMeta,
      })

      setAnalysis(finalAnalysis)
      setStatus("success")
      setRateLimit(recordSuccessfulAnalysis())
    } catch (streamError) {
      console.error(streamError)
      setStatus("error")
      setError(FRIENDLY_ERROR_MESSAGE)
      setRateLimit(buildRateLimitSnapshot())
    }
  }

  async function handleAnalyze(submittedProblem = problemStatement) {
    const trimmedStatement = submittedProblem.trim()

    if (!trimmedStatement) {
      setInputError("ENTER A PROBLEM STATEMENT")
      return
    }

    const nextRateLimit = buildRateLimitSnapshot()
    setRateLimit(nextRateLimit)

    if (nextRateLimit.blocked) {
      setRateLimitNotice(`RATE LIMIT REACHED. RESETS IN ${nextRateLimit.resetMinutes} MIN`)
      return
    }

    setInputError("")
    setRateLimitNotice("")
    setScorerWarning("")
    setScorerFeedback(null)
    setPendingProblem(trimmedStatement)
    setScorerStatus("evaluating")
    setStatementQuality("unknown")

    try {
      const score = await scoreProblemStatement(trimmedStatement)

      if (!score.canProceed) {
        setStatementQuality(score.score)
        setScorerStatus("blocked")
        setScorerFeedback({ mode: "blocked" })
        return
      }

      if (score.score === "strong") {
        await runMainAnalysis(trimmedStatement, score.score)
        return
      }

      setStatementQuality(score.score)
      setScorerStatus("feedback")
      setScorerFeedback({
        mode: "feedback",
        score: score.score,
        missingElements: score.missingElements,
        improvedVersion: score.improvedVersion,
      })
    } catch (scoreError) {
      console.error(scoreError)
      setScorerWarning("STATEMENT CHECK UNAVAILABLE. CONTINUING WITH ANALYSIS.")
      await runMainAnalysis(trimmedStatement, "unknown")
    }
  }

  function handleReset() {
    setProblemStatement("")
    setInputError("")
    setStatus("idle")
    setScorerStatus("idle")
    setError("")
    setRawJsonBuffer("")
    setAnalysis(emptyAnalysis)
    setModelMeta(emptyModelMeta)
    setLastSubmittedProblem("")
    setPendingProblem("")
    setCopiedCardId("")
    setRateLimit(buildRateLimitSnapshot())
    setRateLimitNotice("")
    setStatementQuality("unknown")
    setScorerFeedback(null)
    setScorerWarning("")
    setSelectedTags(emptyTags)
    setSubmittedTags(emptyTags)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleRetry() {
    if (!lastSubmittedProblem) {
      return
    }

    void handleAnalyze(lastSubmittedProblem)
  }

  async function handleCopy(cardKey) {
    const markdown = markdownContent[cardKey]
    if (!markdown) {
      return
    }

    try {
      await navigator.clipboard.writeText(markdown)
      setCopiedCardId(cardKey)

      if (copyResetRef.current) {
        window.clearTimeout(copyResetRef.current)
      }

      copyResetRef.current = window.setTimeout(() => {
        setCopiedCardId("")
      }, 1500)
    } catch (copyError) {
      console.error(copyError)
    }
  }

  function handleTagToggle(groupKey, value) {
    setSelectedTags((current) => ({
      ...current,
      [groupKey]: current[groupKey] === value ? "" : value,
    }))
  }

  function handleDismissBlocked() {
    setScorerStatus("idle")
    setScorerFeedback(null)
  }

  function handleAnalyzeAnyway() {
    if (!pendingProblem) {
      return
    }

    setScorerFeedback(null)
    void runMainAnalysis(pendingProblem, statementQuality)
  }

  function handleUseSuggested() {
    const improvedVersion = scorerFeedback?.improvedVersion?.trim()
    if (!improvedVersion) {
      return
    }

    setProblemStatement(improvedVersion)
    setScorerFeedback(null)
    void runMainAnalysis(improvedVersion, statementQuality)
  }

  function renderFrameworkCard(framework) {
    if (framework.key === "jtbd" && renderable.jtbd) {
      return <JTBDCard data={analysis.jtbd} isCopied={copiedCardId === "jtbd"} onCopy={() => handleCopy("jtbd")} />
    }

    if (framework.key === "journeyMap" && renderable.journeyMap) {
      return (
        <JourneyMapCard
          data={analysis.journeyMap}
          isCopied={copiedCardId === "journeyMap"}
          onCopy={() => handleCopy("journeyMap")}
        />
      )
    }

    if (framework.key === "prd" && renderable.prd) {
      return <PRDCard data={analysis.prd} isCopied={copiedCardId === "prd"} onCopy={() => handleCopy("prd")} />
    }

    if (framework.key === "assumptions" && renderable.assumptions) {
      return (
        <AssumptionsCard
          data={analysis.assumptions}
          isCopied={copiedCardId === "assumptions"}
          onCopy={() => handleCopy("assumptions")}
        />
      )
    }

    return (
      <SkeletonCard
        label={framework.label}
        title={framework.title}
        icon={framework.icon}
        state={status === "streaming" ? "loading" : "missing"}
        message="COULD NOT GENERATE"
      />
    )
  }

  return (
    <main className="min-h-screen bg-white text-swiss-black">
      <section className="border-b border-black bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-4 pb-10 pt-8 md:px-8 md:pb-14 md:pt-10">
          <div className="col-span-12 flex items-center justify-between border-b border-black pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-black/60">PM Toolkit</p>
              <h1 className="mt-2 text-3xl font-black tracking-tighterest md:text-4xl">PMFRAME</h1>
            </div>
            {shouldShowResults && (
              <a
                href="#results"
                className="hidden text-sm uppercase tracking-[0.28em] text-black transition-colors hover:text-swiss-red md:inline-flex"
              >
                Analyze Problems
              </a>
            )}
          </div>

          <div className="col-span-12 md:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-black/60">Structured Thinking</p>
            <h2 className="mt-4 text-[3.2rem] font-black uppercase leading-[0.9] tracking-tighterest md:text-[5.8rem]">
              FRAME
              <br />
              THE
              <br />
              PROBLEM
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-black/75 md:text-xl">
              Turn a vague product pain point into a sharp jobs-to-be-done view, a journey map, and a practical PRD
              skeleton in one streamed pass.
            </p>

            <InputPanel
              problemStatement={problemStatement}
              inputError={inputError}
              onChange={(value) => {
                setProblemStatement(value)
                if (inputError && value.trim()) {
                  setInputError("")
                }
                if (rateLimitNotice) {
                  setRateLimitNotice("")
                }
                if (scorerStatus !== "idle" && status !== "streaming") {
                  setScorerStatus("idle")
                  setScorerFeedback(null)
                  setScorerWarning("")
                }
              }}
              onSubmit={() => void handleAnalyze()}
              isBusy={status === "streaming" || scorerStatus === "evaluating"}
              remainingAnalyses={rateLimit.remaining}
              rateLimitMessage={rateLimitNotice}
              isEvaluating={scorerStatus === "evaluating"}
              scorerFeedback={scorerFeedback}
              scorerWarning={scorerWarning}
              selectedTags={selectedTags}
              onTagToggle={handleTagToggle}
              onUseSuggested={handleUseSuggested}
              onAnalyzeAnyway={handleAnalyzeAnyway}
              onDismissBlocked={handleDismissBlocked}
            />
          </div>

          <div className="col-span-12 md:col-span-5">
            <div className="relative border border-black bg-swiss-red px-6 py-6 text-white md:min-h-[44rem] md:px-8 md:py-8">
              <div className="absolute inset-6 border border-white/80" />
              <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/80">What You Get</p>
                  <h3 className="mt-4 text-4xl font-black uppercase leading-none tracking-tighterest md:text-5xl">
                    Four
                    <br />
                    PM Frames
                  </h3>
                </div>

                <div className="grid gap-4">
                  {previewItems.map((item) => (
                    <div key={item.title} className="border border-white/60 bg-white/[0.06] px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/80">{item.label}</p>
                      <p className="mt-3 text-2xl font-black uppercase leading-none tracking-tighterest">{item.title}</p>
                      <p className="mt-4 text-sm leading-6 text-white/85">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {shouldShowResults && (
        <section id="results" className="bg-swiss-paper">
          <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
            <div className="mb-6 flex flex-col gap-4 border-b border-black pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-black/60">Outputs</p>
                <h3 className="mt-3 text-4xl font-black uppercase leading-none tracking-tighterest md:text-6xl">
                  ANALYSIS
                </h3>
              </div>
              <p className="max-w-xl text-sm uppercase tracking-[0.22em] text-black/55">
                One response. Four PM lenses. Faster framing, clearer tradeoffs, fewer blind spots.
              </p>
            </div>

            <div className="mb-6 flex items-center justify-start">
              <button
                type="button"
                onClick={handleReset}
                className="print-hide text-xs font-semibold uppercase tracking-[0.32em] text-black/65 transition-colors hover:text-swiss-red"
              >
                {"\u2190"} New Analysis
              </button>
            </div>

            {modelMeta.activeModel && (
              <div className="mb-6 border border-black bg-white px-4 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Model Routing</p>
                <p className="mt-2 text-sm leading-6 text-black/75">
                  Using locked model: <span className="font-semibold">{modelMeta.activeModel}</span>.
                </p>
              </div>
            )}

            <div className="metadata-strip mb-6">
              ANALYZED WITH: {metadataContextSummary} {"\u00b7"} STATEMENT QUALITY: {statementQuality.toUpperCase()}
            </div>

            {status === "error" && (
              <div className="mb-6 border border-black bg-white p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 border border-black bg-swiss-red p-2 text-white">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Analysis Issue</p>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-black/75">{error || FRIENDLY_ERROR_MESSAGE}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="print-hide inline-flex items-center justify-center border border-black bg-black px-5 py-3 text-xs font-semibold uppercase tracking-[0.32em] text-white transition-colors hover:bg-swiss-red"
                  >
                    RETRY {"\u2192"}
                  </button>
                </div>
              </div>
            )}

            <div className="mb-8 grid gap-3 md:grid-cols-4">
              {frameworkState.map((framework) => (
                <div
                  key={framework.id}
                  className={`border px-4 py-4 ${
                    framework.ready ? "border-black bg-white text-black" : "border-black/30 bg-white/70 text-black/55"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.35em]">{framework.label}</p>
                  <p className="mt-3 text-xl font-black uppercase tracking-tighterest">{framework.title}</p>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.3em]">
                    {framework.ready ? "Ready" : status === "streaming" ? "Streaming..." : "Could Not Generate"}
                  </p>
                </div>
              ))}
            </div>

            {status === "streaming" && rawJsonBuffer && (
              <div
                className="mb-6 flex flex-wrap items-center justify-between gap-2 border border-black bg-white px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55 print-hide"
                aria-live="polite"
              >
                <span>Live stream active</span>
                <span>{completedFrameworks}/4 frameworks ready</span>
                <span>{rawJsonBuffer.length} chars received</span>
              </div>
            )}

            <div className="output-grid">
              {frameworkState.map((framework, index) => (
                <div
                  key={framework.id}
                  id={framework.id}
                  className="output-card-shell fade-in-up"
                  style={{ animationDelay: `${0.04 + index * 0.06}s` }}
                >
                  {renderFrameworkCard(framework)}
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => window.print()}
                className="print-hide inline-flex items-center justify-center border border-black bg-black px-6 py-4 text-sm font-semibold uppercase tracking-[0.34em] text-white transition-colors hover:bg-swiss-red"
              >
                EXPORT AS PDF {"\u2192"}
              </button>
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-black bg-white print-hide">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-sm uppercase tracking-[0.25em] text-black/65 md:flex-row md:items-center md:justify-between md:px-8">
          <p>PMFrame for product problem framing</p>
          <a
            href="https://www.linkedin.com/in/nihaallp/"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-swiss-red"
          >
            Built by Nihal Pardeshi
          </a>
        </div>
      </footer>
    </main>
  )
}
