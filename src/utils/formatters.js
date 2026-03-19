const DEFAULT_STAGES = ["Trigger", "Explore", "Decide", "Use", "Reflect"]

const STAGE_ALIASES = {
  trigger: "Trigger",
  awareness: "Trigger",
  discover: "Trigger",
  discovery: "Trigger",
  identify: "Trigger",
  explore: "Explore",
  research: "Explore",
  evaluate: "Explore",
  compare: "Explore",
  comparison: "Explore",
  decide: "Decide",
  choose: "Decide",
  select: "Decide",
  purchase: "Decide",
  convert: "Decide",
  use: "Use",
  onboard: "Use",
  activation: "Use",
  adopt: "Use",
  consume: "Use",
  reflect: "Reflect",
  retain: "Reflect",
  renewal: "Reflect",
  recommend: "Reflect",
  loyalty: "Reflect",
}

const PLACEHOLDER_PATTERNS = [
  /^none$/i,
  /^n\/a$/i,
  /^not provided yet\.?$/i,
  /^not provided\.?$/i,
  /^not available\.?$/i,
  /^waiting for this section/i,
  /^core job will appear/i,
  /^action details will appear/i,
  /^pain point details will appear/i,
  /^opportunity ideas will appear/i,
  /^problem statement framing will appear/i,
  /^no underserved outcomes yet\.?$/i,
  /^north star metric pending$/i,
]

function asString(value) {
  return typeof value === "string" ? value.trim() : ""
}

function isMeaningfulText(value) {
  const text = asString(value)
  if (!text) {
    return false
  }

  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text))
}

function normalizeStringArray(value) {
  const source = Array.isArray(value) ? value : []
  const seen = new Set()

  return source
    .map((item) => asString(item))
    .filter((item) => isMeaningfulText(item))
    .filter((item) => {
      const signature = item.toLowerCase()
      if (seen.has(signature)) {
        return false
      }
      seen.add(signature)
      return true
    })
}

function formatMarkdownList(items) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None"
}

export function cleanJsonBuffer(buffer) {
  const source = asString(buffer)
  if (!source) {
    return ""
  }

  const fencedMatch = source.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim()
  }

  const firstBrace = source.indexOf("{")
  const lastBrace = source.lastIndexOf("}")
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
    return source.slice(firstBrace, lastBrace + 1).trim()
  }

  return source
}

export function normalizeJtbd(value) {
  const source = value && typeof value === "object" ? value : {}

  return {
    coreJob: isMeaningfulText(source.coreJob) ? asString(source.coreJob) : "",
    functionalJobs: normalizeStringArray(source.functionalJobs),
    emotionalJobs: normalizeStringArray(source.emotionalJobs),
    socialJobs: normalizeStringArray(source.socialJobs),
    underservedOutcomes: normalizeStringArray(source.underservedOutcomes),
  }
}

export function isRenderableJtbd(value) {
  const jtbd = normalizeJtbd(value)
  return Boolean(
    jtbd.coreJob ||
      jtbd.functionalJobs.length ||
      jtbd.emotionalJobs.length ||
      jtbd.socialJobs.length ||
      jtbd.underservedOutcomes.length,
  )
}

function normalizeStageLabel(value, index) {
  const raw = asString(value)
  if (!raw) {
    return DEFAULT_STAGES[index] ?? `Stage ${index + 1}`
  }

  return STAGE_ALIASES[raw.toLowerCase()] || raw.toUpperCase()
}

function normalizeJourneyStage(value, index) {
  const source = value && typeof value === "object" ? value : {}

  return {
    stage: normalizeStageLabel(source.stage, index),
    userAction: isMeaningfulText(source.userAction) ? asString(source.userAction) : "",
    emotionalState: isMeaningfulText(source.emotionalState) ? asString(source.emotionalState) : "",
    painPoint: isMeaningfulText(source.painPoint) ? asString(source.painPoint) : "",
    opportunity: isMeaningfulText(source.opportunity) ? asString(source.opportunity) : "",
  }
}

export function normalizeJourneyMap(value) {
  const source = Array.isArray(value) ? value : []
  const seeded = DEFAULT_STAGES.map((stage) => ({
    stage,
    userAction: "",
    emotionalState: "",
    painPoint: "",
    opportunity: "",
  }))
  const unmatched = []

  source.forEach((item, index) => {
    const stage = normalizeJourneyStage(item, index)
    const canonicalIndex = DEFAULT_STAGES.findIndex((defaultStage) => defaultStage === stage.stage)

    if (canonicalIndex !== -1) {
      seeded[canonicalIndex] = { ...seeded[canonicalIndex], ...stage }
    } else if (
      stage.stage ||
      stage.userAction ||
      stage.emotionalState ||
      stage.painPoint ||
      stage.opportunity
    ) {
      unmatched.push(stage)
    }
  })

  unmatched.forEach((stage) => {
    const availableIndex = seeded.findIndex(
      (item) => !item.userAction && !item.emotionalState && !item.painPoint && !item.opportunity,
    )

    if (availableIndex !== -1) {
      seeded[availableIndex] = {
        ...seeded[availableIndex],
        ...stage,
        stage: DEFAULT_STAGES[availableIndex],
      }
    }
  })

  return seeded
}

export function isRenderableJourneyMap(value) {
  return normalizeJourneyMap(value).some(
    (stage) => stage.userAction || stage.emotionalState || stage.painPoint || stage.opportunity,
  )
}

export function normalizePrd(value) {
  const source = value && typeof value === "object" ? value : {}
  const targetUsers = source.targetUsers && typeof source.targetUsers === "object" ? source.targetUsers : {}
  const successMetrics =
    source.successMetrics && typeof source.successMetrics === "object" ? source.successMetrics : {}
  const mvpFeatures = source.mvpFeatures && typeof source.mvpFeatures === "object" ? source.mvpFeatures : {}

  return {
    problemStatement: isMeaningfulText(source.problemStatement) ? asString(source.problemStatement) : "",
    targetUsers: {
      primary: isMeaningfulText(targetUsers.primary) ? asString(targetUsers.primary) : "",
      secondary: isMeaningfulText(targetUsers.secondary) ? asString(targetUsers.secondary) : "",
    },
    successMetrics: {
      northStar: isMeaningfulText(successMetrics.northStar) ? asString(successMetrics.northStar) : "",
      guardrails: normalizeStringArray(successMetrics.guardrails),
    },
    mvpFeatures: {
      mustHave: normalizeStringArray(mvpFeatures.mustHave),
      niceToHave: normalizeStringArray(mvpFeatures.niceToHave),
    },
    outOfScope: normalizeStringArray(source.outOfScope),
    openQuestions: normalizeStringArray(source.openQuestions),
  }
}

export function isRenderablePrd(value) {
  const prd = normalizePrd(value)
  return Boolean(
    prd.problemStatement ||
      prd.targetUsers.primary ||
      prd.targetUsers.secondary ||
      prd.successMetrics.northStar ||
      prd.successMetrics.guardrails.length ||
      prd.mvpFeatures.mustHave.length ||
      prd.mvpFeatures.niceToHave.length ||
      prd.outOfScope.length ||
      prd.openQuestions.length,
  )
}

function normalizeRisk(value) {
  const normalized = asString(value).toUpperCase()
  if (normalized === "HIGH" || normalized === "MEDIUM" || normalized === "LOW") {
    return normalized
  }
  return "MEDIUM"
}

export function normalizeAssumptions(value) {
  const source = Array.isArray(value) ? value : []

  return source
    .map((item) => {
      const assumption = item && typeof item === "object" ? item : {}
      return {
        assumption: isMeaningfulText(assumption.assumption) ? asString(assumption.assumption) : "",
        risk: normalizeRisk(assumption.risk),
        validationMethod: isMeaningfulText(assumption.validationMethod) ? asString(assumption.validationMethod) : "",
      }
    })
    .filter((item) => item.assumption || item.validationMethod)
}

export function isRenderableAssumptions(value) {
  return normalizeAssumptions(value).length > 0
}

export function normalizeAnalysis(value) {
  const source = value && typeof value === "object" ? value : {}

  return {
    jtbd: normalizeJtbd(source.jtbd),
    journeyMap: normalizeJourneyMap(source.journeyMap),
    prd: normalizePrd(source.prd),
    assumptions: normalizeAssumptions(source.assumptions),
  }
}

export function hasRenderableAnalysis(value) {
  const analysis = normalizeAnalysis(value)
  return Boolean(
    isRenderableJtbd(analysis.jtbd) ||
      isRenderableJourneyMap(analysis.journeyMap) ||
      isRenderablePrd(analysis.prd) ||
      isRenderableAssumptions(analysis.assumptions),
  )
}

export function buildJtbdMarkdown(data) {
  const jtbd = normalizeJtbd(data)

  return [
    "# JTBD",
    "",
    "## Core Job",
    jtbd.coreJob || "None",
    "",
    "## Functional Jobs",
    formatMarkdownList(jtbd.functionalJobs),
    "",
    "## Emotional Jobs",
    formatMarkdownList(jtbd.emotionalJobs),
    "",
    "## Social Jobs",
    formatMarkdownList(jtbd.socialJobs),
    "",
    "## Underserved Outcomes",
    formatMarkdownList(jtbd.underservedOutcomes),
  ].join("\n")
}

export function buildJourneyMapMarkdown(data) {
  const journeyMap = normalizeJourneyMap(data)

  return [
    "# Journey Map",
    "",
    ...journeyMap.flatMap((stage, index) => [
      `## Stage ${index + 1}: ${stage.stage}`,
      `- Emotional State: ${stage.emotionalState || "Neutral"}`,
      `- User Action: ${stage.userAction || "None"}`,
      `- Pain Point: ${stage.painPoint || "None"}`,
      `- PM Opportunity: ${stage.opportunity || "None"}`,
      "",
    ]),
  ].join("\n")
}

export function buildPrdMarkdown(data) {
  const prd = normalizePrd(data)

  return [
    "# PRD Skeleton",
    "",
    "## Problem Statement",
    prd.problemStatement || "None",
    "",
    "## Target Users",
    `- Primary: ${prd.targetUsers.primary || "None"}`,
    `- Secondary: ${prd.targetUsers.secondary || "None"}`,
    "",
    "## Success Metrics",
    `- North Star: ${prd.successMetrics.northStar || "None"}`,
    "- Guardrails:",
    formatMarkdownList(prd.successMetrics.guardrails),
    "",
    "## Must-Have Features",
    formatMarkdownList(prd.mvpFeatures.mustHave),
    "",
    "## Nice-To-Have Features",
    formatMarkdownList(prd.mvpFeatures.niceToHave),
    "",
    "## Out Of Scope",
    formatMarkdownList(prd.outOfScope),
    "",
    "## Open Questions",
    formatMarkdownList(prd.openQuestions),
  ].join("\n")
}

export function buildAssumptionsMarkdown(data) {
  const assumptions = normalizeAssumptions(data)

  return [
    "# Assumptions To Test",
    "",
    ...(
      assumptions.length
        ? assumptions.flatMap((item, index) => [
            `## Assumption ${index + 1}`,
            item.assumption || "None",
            `- Risk: ${item.risk}`,
            `- Test: ${item.validationMethod || "None"}`,
            "",
          ])
        : ["- None", ""]
    ),
  ].join("\n")
}
