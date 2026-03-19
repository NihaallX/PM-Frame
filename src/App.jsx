import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, BriefcaseBusiness, Route, ScanSearch } from "lucide-react"
import InputPanel from "./components/InputPanel"
import JTBDCard from "./components/JTBDCard"
import JourneyMapCard from "./components/JourneyMapCard"
import PRDCard from "./components/PRDCard"
import SkeletonCard from "./components/SkeletonCard"
import { streamPmAnalysis } from "./utils/groq"
import { hasRenderableAnalysis, isRenderableJourneyMap, isRenderableJtbd, isRenderablePrd } from "./utils/formatters"

const FRIENDLY_ERROR_MESSAGE = "Analysis could not be generated. Check your API key or try rephrasing the problem."

const emptyAnalysis = {
  jtbd: null,
  journeyMap: null,
  prd: null,
}

const emptyModelMeta = {
  activeModel: "",
  candidateModels: [],
  availableModels: [],
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
]

function formatMarkdownList(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None"
}

function buildJtbdMarkdown(data) {
  return [
    "# JTBD",
    "",
    "## Core Job",
    data.coreJob || "None",
    "",
    "## Functional Jobs",
    formatMarkdownList(data.functionalJobs),
    "",
    "## Emotional Jobs",
    formatMarkdownList(data.emotionalJobs),
    "",
    "## Social Jobs",
    formatMarkdownList(data.socialJobs),
    "",
    "## Underserved Outcomes",
    formatMarkdownList(data.underservedOutcomes),
  ].join("\n")
}

function buildJourneyMapMarkdown(data) {
  return [
    "# Journey Map",
    "",
    ...data.flatMap((stage, index) => [
      `## Stage ${index + 1}: ${stage.stage}`,
      `- Emotional State: ${stage.emotionalState || "Neutral"}`,
      `- User Action: ${stage.userAction || "None"}`,
      `- Pain Point: ${stage.painPoint || "None"}`,
      `- PM Opportunity: ${stage.opportunity || "None"}`,
      "",
    ]),
  ].join("\n")
}

function buildPrdMarkdown(data) {
  return [
    "# PRD Skeleton",
    "",
    "## Problem Statement",
    data.problemStatement || "None",
    "",
    "## Target Users",
    `- Primary: ${data.targetUsers.primary || "None"}`,
    `- Secondary: ${data.targetUsers.secondary || "None"}`,
    "",
    "## Success Metrics",
    `- North Star: ${data.successMetrics.northStar || "None"}`,
    "- Guardrails:",
    formatMarkdownList(data.successMetrics.guardrails),
    "",
    "## Must-Have Features",
    formatMarkdownList(data.mvpFeatures.mustHave),
    "",
    "## Nice-To-Have Features",
    formatMarkdownList(data.mvpFeatures.niceToHave),
    "",
    "## Out Of Scope",
    formatMarkdownList(data.outOfScope),
    "",
    "## Open Questions",
    formatMarkdownList(data.openQuestions),
  ].join("\n")
}

export default function App() {
  const [problemStatement, setProblemStatement] = useState("")
  const [inputError, setInputError] = useState("")
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState("")
  const [rawJsonBuffer, setRawJsonBuffer] = useState("")
  const [analysis, setAnalysis] = useState(emptyAnalysis)
  const [modelMeta, setModelMeta] = useState(emptyModelMeta)
  const [lastSubmittedProblem, setLastSubmittedProblem] = useState("")
  const [copiedCardId, setCopiedCardId] = useState("")
  const copyResetRef = useRef(null)

  useEffect(() => {
    return () => {
      if (copyResetRef.current) {
        window.clearTimeout(copyResetRef.current)
      }
    }
  }, [])

  const shouldShowResults = status !== "idle" || hasRenderableAnalysis(analysis)
  const renderable = useMemo(
    () => ({
      jtbd: isRenderableJtbd(analysis.jtbd),
      journeyMap: isRenderableJourneyMap(analysis.journeyMap),
      prd: isRenderablePrd(analysis.prd),
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
    ],
    [renderable],
  )

  const completedFrameworks = frameworkState.filter((framework) => framework.ready).length

  const markdownContent = useMemo(
    () => ({
      jtbd: renderable.jtbd ? buildJtbdMarkdown(analysis.jtbd) : "",
      journeyMap: renderable.journeyMap ? buildJourneyMapMarkdown(analysis.journeyMap) : "",
      prd: renderable.prd ? buildPrdMarkdown(analysis.prd) : "",
    }),
    [analysis, renderable],
  )

  async function handleAnalyze(submittedProblem = problemStatement) {
    const trimmedStatement = submittedProblem.trim()

    if (!trimmedStatement) {
      setInputError("ENTER A PROBLEM STATEMENT")
      return
    }

    setInputError("")
    setProblemStatement(trimmedStatement)
    setLastSubmittedProblem(trimmedStatement)
    setStatus("streaming")
    setError("")
    setRawJsonBuffer("")
    setAnalysis(emptyAnalysis)
    setModelMeta(emptyModelMeta)

    window.requestAnimationFrame(() => {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })

    try {
      const finalAnalysis = await streamPmAnalysis(trimmedStatement, {
        onBuffer: setRawJsonBuffer,
        onPartial: (partialAnalysis) => {
          setAnalysis((current) => ({
            jtbd: partialAnalysis.jtbd ?? current.jtbd,
            journeyMap: partialAnalysis.journeyMap ?? current.journeyMap,
            prd: partialAnalysis.prd ?? current.prd,
          }))
        },
        onMeta: setModelMeta,
      })

      setAnalysis(finalAnalysis)
      setStatus("success")
    } catch (streamError) {
      console.error(streamError)
      setStatus("error")
      setError(FRIENDLY_ERROR_MESSAGE)
    }
  }

  function handleReset() {
    setProblemStatement("")
    setInputError("")
    setStatus("idle")
    setError("")
    setRawJsonBuffer("")
    setAnalysis(emptyAnalysis)
    setModelMeta(emptyModelMeta)
    setLastSubmittedProblem("")
    setCopiedCardId("")
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
              error={inputError}
              onChange={(value) => {
                setProblemStatement(value)
                if (inputError && value.trim()) {
                  setInputError("")
                }
              }}
              onSubmit={() => void handleAnalyze()}
              isLoading={status === "streaming"}
            />
          </div>

          <div className="col-span-12 md:col-span-5">
            <div className="relative border border-black bg-swiss-red px-6 py-6 text-white md:min-h-[44rem] md:px-8 md:py-8">
              <div className="absolute inset-6 border border-white/80" />
              <div className="relative z-10 flex h-full flex-col justify-between gap-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/80">What You Get</p>
                  <h3 className="mt-4 text-4xl font-black uppercase leading-none tracking-tighterest md:text-5xl">
                    Three
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
                One response. Three PM lenses. Faster problem framing with less blank-page thrash.
              </p>
            </div>

            <div className="mb-6 flex items-center justify-start">
              <button
                type="button"
                onClick={handleReset}
                className="print-hide text-xs font-semibold uppercase tracking-[0.32em] text-black/65 transition-colors hover:text-swiss-red"
              >
                ← New Analysis
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
                    RETRY →
                  </button>
                </div>
              </div>
            )}

            <div className="mb-8 grid gap-3 md:grid-cols-3">
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
                <span>{completedFrameworks}/3 frameworks ready</span>
                <span>{rawJsonBuffer.length} chars received</span>
              </div>
            )}

            <div className="grid gap-8 md:grid-cols-3 md:items-stretch">
              {frameworkState.map((framework, index) => (
                <div
                  key={framework.id}
                  id={framework.id}
                  className="fade-in-up md:h-[66rem] lg:h-[70rem]"
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
                EXPORT AS PDF →
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
