const journeyStageOrder = ["Trigger", "Explore", "Decide", "Use", "Reflect"]

const stageAliases = {
  trigger: "Trigger",
  awareness: "Trigger",
  explore: "Explore",
  discovery: "Explore",
  consider: "Decide",
  decision: "Decide",
  decide: "Decide",
  choose: "Decide",
  onboarding: "Use",
  use: "Use",
  adopt: "Use",
  retention: "Reflect",
  reflect: "Reflect",
  review: "Reflect",
}

const emotionLabelMap = [
  { match: /frustrat|stress|anxious|overwhelm|blocked|stuck/i, label: "Frustrated" },
  { match: /curious|interested|hopeful|optimistic/i, label: "Curious" },
  { match: /confident|certain|reassured|clear/i, label: "Confident" },
  { match: /happy|delighted|satisfied|positive/i, label: "Satisfied" },
  { match: /relieved|resolved|comforted/i, label: "Relieved" },
  { match: /confused|unsure|uncertain|lost/i, label: "Uncertain" },
]

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean).map(String) : []
}

function asText(value) {
  return typeof value === "string" ? value.trim() : ""
}

function toTitleCase(value) {
  return value
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatEmotionalState(value) {
  const cleaned = asText(value).replace(/^[^\p{L}\p{N}]+/u, "")
  if (!cleaned) {
    return "Neutral"
  }

  const mapped = emotionLabelMap.find((entry) => entry.match.test(cleaned))
  if (mapped) {
    return mapped.label
  }

  return toTitleCase(cleaned)
}

function normalizeStageName(stage) {
  const raw = asText(stage).toLowerCase()
  return stageAliases[raw] ?? journeyStageOrder.find((item) => item.toLowerCase() === raw) ?? ""
}

function normalizeJourneyStage(stage) {
  return {
    stage: normalizeStageName(stage?.stage),
    userAction: asText(stage?.userAction),
    emotionalState: formatEmotionalState(stage?.emotionalState),
    painPoint: asText(stage?.painPoint),
    opportunity: asText(stage?.opportunity),
  }
}

export function normalizeJtbd(jtbd) {
  if (!jtbd || typeof jtbd !== "object") {
    return null
  }

  return {
    coreJob: asText(jtbd.coreJob),
    functionalJobs: asArray(jtbd.functionalJobs),
    emotionalJobs: asArray(jtbd.emotionalJobs),
    socialJobs: asArray(jtbd.socialJobs),
    underservedOutcomes: asArray(jtbd.underservedOutcomes),
  }
}

export function normalizeJourneyMap(journeyMap) {
  if (!Array.isArray(journeyMap)) {
    return null
  }

  const byStage = new Map()
  journeyMap.forEach((entry) => {
    const normalized = normalizeJourneyStage(entry)
    if (normalized.stage) {
      byStage.set(normalized.stage, normalized)
    }
  })

  return journeyStageOrder.map((stage) => {
    if (byStage.has(stage)) {
      return byStage.get(stage)
    }

    return {
      stage,
      userAction: "",
      emotionalState: "Neutral",
      painPoint: "",
      opportunity: "",
    }
  })
}

export function normalizePrd(prd) {
  if (!prd || typeof prd !== "object") {
    return null
  }

  return {
    problemStatement: asText(prd.problemStatement),
    targetUsers: {
      primary: asText(prd?.targetUsers?.primary),
      secondary: asText(prd?.targetUsers?.secondary),
    },
    successMetrics: {
      northStar: asText(prd?.successMetrics?.northStar),
      guardrails: asArray(prd?.successMetrics?.guardrails),
    },
    mvpFeatures: {
      mustHave: asArray(prd?.mvpFeatures?.mustHave),
      niceToHave: asArray(prd?.mvpFeatures?.niceToHave),
    },
    outOfScope: asArray(prd?.outOfScope),
    openQuestions: asArray(prd?.openQuestions),
  }
}

export function normalizeAnalysis(data) {
  return {
    jtbd: normalizeJtbd(data?.jtbd),
    journeyMap: normalizeJourneyMap(data?.journeyMap),
    prd: normalizePrd(data?.prd),
  }
}

export function isRenderableJtbd(jtbd) {
  if (!jtbd) {
    return false
  }

  return Boolean(
    jtbd.coreJob ||
      jtbd.functionalJobs.length ||
      jtbd.emotionalJobs.length ||
      jtbd.socialJobs.length ||
      jtbd.underservedOutcomes.length,
  )
}

export function isRenderableJourneyMap(journeyMap) {
  if (!Array.isArray(journeyMap)) {
    return false
  }

  return journeyMap.some(
    (stage) =>
      Boolean(stage?.userAction) || Boolean(stage?.painPoint) || Boolean(stage?.opportunity) || stage?.emotionalState !== "Neutral",
  )
}

export function isRenderablePrd(prd) {
  if (!prd) {
    return false
  }

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

export function hasRenderableAnalysis(data) {
  return Boolean(
    isRenderableJtbd(data?.jtbd) || isRenderableJourneyMap(data?.journeyMap) || isRenderablePrd(data?.prd),
  )
}

export function cleanJsonBuffer(value) {
  return String(value ?? "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
}
