import { useMemo, useState } from "react"
import { AlertCircle, ArrowRight, BriefcaseBusiness, Route, ScanSearch } from "lucide-react"
import InputPanel from "./components/InputPanel"
import JTBDCard from "./components/JTBDCard"
import JourneyMapCard from "./components/JourneyMapCard"
import PRDCard from "./components/PRDCard"
import SkeletonCard from "./components/SkeletonCard"
import { streamPmAnalysis } from "./utils/groq"
import { hasRenderableAnalysis, isRenderableJourneyMap, isRenderableJtbd, isRenderablePrd } from "./utils/formatters"

const emptyAnalysis = {
  jtbd: null,
  journeyMap: null,
  prd: null,
}

export default function App() {
  const [problemStatement, setProblemStatement] = useState("")
  const [status, setStatus] = useState("idle")
  const [error, setError] = useState("")
  const [rawJsonBuffer, setRawJsonBuffer] = useState("")
  const [analysis, setAnalysis] = useState(emptyAnalysis)
  const [modelMeta, setModelMeta] = useState({
    activeModel: "",
    candidateModels: [],
    availableModels: [],
  })

  const showResults = useMemo(
    () => status === "streaming" || status === "success" || status === "error",
    [status],
  )
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
      { id: "jtbd-panel", label: "Framework 01", title: "JTBD", ready: renderable.jtbd },
      { id: "journey-panel", label: "Framework 02", title: "Journey Map", ready: renderable.journeyMap },
      { id: "prd-panel", label: "Framework 03", title: "PRD Skeleton", ready: renderable.prd },
    ],
    [renderable],
  )
  const completedFrameworks = frameworkState.filter((framework) => framework.ready).length
  const availableTextModelCount = useMemo(
    () =>
      modelMeta.availableModels.filter(
        (modelId) => !/(whisper|prompt-guard|safeguard|orpheus|allam-2)/i.test(modelId),
      ).length,
    [modelMeta.availableModels],
  )

  async function handleAnalyze() {
    const trimmedStatement = problemStatement.trim()

    if (!trimmedStatement) {
      setStatus("error")
      setError("Add a product problem statement first so PMFrame has something concrete to analyze.")
      setAnalysis(emptyAnalysis)
      setRawJsonBuffer("")
      return
    }

    setStatus("streaming")
    setError("")
    setRawJsonBuffer("")
    setAnalysis(emptyAnalysis)
    setModelMeta({
      activeModel: "",
      candidateModels: [],
      availableModels: [],
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
      const fallbackMessage =
        "PMFrame could not finish the analysis just now. Please check your Groq key, then try again in a moment."

      setStatus("error")
      setError(streamError instanceof Error ? streamError.message || fallbackMessage : fallbackMessage)
    }
  }

  return (
    <main className="min-h-screen bg-white text-swiss-black">
      <section className="border-b border-black bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-4 pb-16 pt-8 md:px-8 md:pb-24 md:pt-10">
          <div className="col-span-12 flex items-center justify-between border-b border-black pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-black/60">PM Toolkit</p>
              <h1 className="mt-2 text-3xl font-black tracking-tighterest md:text-4xl">PMFRAME</h1>
            </div>
            <a
              href="#results"
              className="hidden text-sm uppercase tracking-[0.28em] text-black transition-colors hover:text-swiss-red md:inline-flex"
            >
              Analyze Problems
            </a>
          </div>

          <div className="col-span-12 md:col-span-7">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-black/60">Structured Thinking</p>
            <h2 className="mt-4 text-[3.2rem] font-black uppercase leading-[0.9] tracking-tighterest md:text-[6.8rem]">
              FRAME
              <br />
              THE
              <br />
              PROBLEM
            </h2>
            <p className="mt-8 max-w-xl text-lg leading-8 text-black/75 md:text-xl">
              Turn a vague product pain point into a sharp jobs-to-be-done view, a journey map, and a practical PRD
              skeleton in one streamed pass.
            </p>
          </div>

          <div className="col-span-12 md:col-span-5">
            <div className="relative aspect-square border border-black bg-swiss-red">
              <div className="absolute inset-6 border border-white/80" />
              <div className="absolute bottom-0 right-0 h-24 w-24 bg-black md:h-28 md:w-28" />
              <div className="absolute left-6 top-6 max-w-[12rem] text-sm font-semibold uppercase tracking-[0.3em] text-white">
                JTBD
                <br />
                JOURNEY
                <br />
                PRD
              </div>
              <div className="absolute bottom-8 left-6 flex items-center gap-3 text-white">
                <ArrowRight className="h-5 w-5" />
                <span className="text-xs uppercase tracking-[0.35em]">Single Prompt, Three Frames</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-black bg-black text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-4 py-12 md:px-8 md:py-16">
          <div className="col-span-12 md:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60">Workflow</p>
            <h3 className="mt-4 text-4xl font-black uppercase leading-none tracking-tighterest md:text-6xl">
              INPUT
            </h3>
          </div>
          <div className="col-span-12 md:col-span-9">
            <InputPanel
              problemStatement={problemStatement}
              onChange={setProblemStatement}
              onSubmit={handleAnalyze}
              isLoading={status === "streaming"}
            />
          </div>
        </div>
      </section>

      <section id="results" className="bg-swiss-paper">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
          <div className="mb-10 flex flex-col gap-4 border-b border-black pb-6 md:flex-row md:items-end md:justify-between">
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

          {modelMeta.activeModel && (
            <div className="mb-6 border border-black bg-white px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Model Routing</p>
              <p className="mt-2 text-sm leading-6 text-black/75">
                Using <span className="font-semibold">{modelMeta.activeModel}</span> with structured-output fallback.
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.22em] text-black/55">
                {availableTextModelCount} text-capable models available on this key
              </p>
              {modelMeta.candidateModels.length > 0 && (
                <p className="mt-2 text-xs leading-5 text-black/60">
                  Priority: {modelMeta.candidateModels.slice(0, 3).join(" -> ")}
                </p>
              )}
            </div>
          )}

          {!showResults && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="border border-black bg-white p-8 shadow-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-black/55">Ready</p>
                <h4 className="mt-4 text-3xl font-black uppercase tracking-tighterest">Start With A Sharp Problem</h4>
                <p className="mt-5 text-base leading-7 text-black/70">
                  Describe the user pain in plain language. PMFrame will translate it into the core strategic frames a
                  product manager needs to think clearly.
                </p>
              </div>
            </div>
          )}

          {status === "error" && !hasRenderableAnalysis(analysis) && (
            <div className="border border-black bg-white p-8 shadow-panel">
              <div className="flex items-start gap-4">
                <div className="mt-1 border border-black bg-swiss-red p-2 text-white">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-black/55">Analysis Unavailable</p>
                  <h4 className="mt-4 text-3xl font-black uppercase tracking-tighterest">Try The Request Again</h4>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-black/70">{error}</p>
                </div>
              </div>
            </div>
          )}

          {(status === "streaming" || status === "success" || hasRenderableAnalysis(analysis)) && (
            <>
              <div className="mb-8 grid gap-3 md:grid-cols-3">
                {frameworkState.map((framework) => (
                  <a
                    key={framework.id}
                    href={`#${framework.id}`}
                    className={`border px-4 py-4 transition-colors ${
                      framework.ready
                        ? "border-black bg-white text-black hover:border-swiss-red hover:text-swiss-red"
                        : "border-black/30 bg-white/70 text-black/55"
                    }`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.35em]">{framework.label}</p>
                    <p className="mt-3 text-xl font-black uppercase tracking-tighterest">{framework.title}</p>
                    <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.3em]">
                      {framework.ready ? "Ready" : "Streaming..."}
                    </p>
                  </a>
                ))}
              </div>

              {status === "streaming" && rawJsonBuffer && (
                <div
                  className="mb-6 flex flex-wrap items-center justify-between gap-2 border border-black bg-white px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55"
                  aria-live="polite"
                >
                  <span>Live stream active</span>
                  <span>{completedFrameworks}/3 frameworks ready</span>
                  <span>{rawJsonBuffer.length} chars received</span>
                </div>
              )}

              {status === "error" && hasRenderableAnalysis(analysis) && (
                <div className="mb-6 border border-black bg-white px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-black/55">Partial Response</p>
                  <p className="mt-2 text-sm leading-6 text-black/70">{error}</p>
                </div>
              )}

              <div className="grid gap-8 xl:grid-cols-[1.05fr_1.15fr_1.1fr]">
                <div id="jtbd-panel" className="fade-in-up" style={{ animationDelay: "0.04s" }}>
                  {renderable.jtbd ? (
                    <JTBDCard data={analysis.jtbd} />
                  ) : (
                    <SkeletonCard
                      label="Framework 01"
                      title="Jobs-To-Be-Done"
                      icon={<BriefcaseBusiness className="h-5 w-5" />}
                    />
                  )}
                </div>

                <div id="journey-panel" className="fade-in-up" style={{ animationDelay: "0.1s" }}>
                  {renderable.journeyMap ? (
                    <JourneyMapCard data={analysis.journeyMap} />
                  ) : (
                    <SkeletonCard
                      label="Framework 02"
                      title="Journey Map"
                      icon={<Route className="h-5 w-5" />}
                    />
                  )}
                </div>

                <div id="prd-panel" className="fade-in-up" style={{ animationDelay: "0.16s" }}>
                  {renderable.prd ? (
                    <PRDCard data={analysis.prd} />
                  ) : (
                    <SkeletonCard
                      label="Framework 03"
                      title="PRD Skeleton"
                      icon={<ScanSearch className="h-5 w-5" />}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <footer className="border-t border-black bg-white">
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
