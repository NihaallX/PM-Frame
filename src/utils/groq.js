import {
  cleanJsonBuffer,
  hasRenderableAnalysis,
  isRenderableAssumptions,
  isRenderableJourneyMap,
  isRenderableJtbd,
  isRenderablePrd,
  normalizeAnalysis,
} from "./formatters"

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL_ID = "llama-3.3-70b-versatile"
const RESPONSE_FORMAT_UNSUPPORTED_PATTERN = /(response_format|json_object|unsupported|invalid_request_error)/i

const SCORER_SYSTEM_PROMPT = `You are a PM coach. Evaluate the problem statement and return ONLY a JSON object with no markdown or explanation:
{
  score: 'strong' | 'weak' | 'moderate',
  missingElements: string[],
  improvedVersion: string,
  canProceed: boolean
}
Score as strong if it names a specific user, describes a concrete measurable pain, and has context (when/where). Score as weak if it is missing 2 or more of these. canProceed is true unless the statement is completely unusable (too vague, a feature request, or less than 8 words).`

const MAIN_SYSTEM_PROMPT = `You are a senior product manager. Given a product problem statement, return ONLY a JSON object with no markdown or explanation and exactly these top-level keys:
- jtbd: { coreJob, functionalJobs[], emotionalJobs[], socialJobs[], underservedOutcomes[] }
- journeyMap: array of 5 objects { stage, userAction, emotionalState, painPoint, opportunity }
- prd: { problemStatement, targetUsers: { primary, secondary }, successMetrics: { northStar, guardrails[] }, mvpFeatures: { mustHave[], niceToHave[] }, outOfScope[], openQuestions[] }
- assumptions: array of exactly 5 objects { assumption, risk, validationMethod }

For assumptions:
- risk must be one of HIGH, MEDIUM, LOW
- validationMethod must be a concrete way to test the assumption

Be specific, realistic, and actionable.`

function ensureApiKey() {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    throw new Error("Add VITE_GROQ_API_KEY to your environment before running an analysis.")
  }
  return apiKey
}

function shouldRetryWithoutResponseFormat(details) {
  return RESPONSE_FORMAT_UNSUPPORTED_PATTERN.test(String(details ?? ""))
}

function extractBalancedSegment(source, key, opener, closer) {
  const keyIndex = source.indexOf(`"${key}"`)
  if (keyIndex === -1) {
    return null
  }

  const colonIndex = source.indexOf(":", keyIndex)
  if (colonIndex === -1) {
    return null
  }

  const startIndex = source.indexOf(opener, colonIndex)
  if (startIndex === -1) {
    return null
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === "\\") {
        escaped = true
      } else if (character === '"') {
        inString = false
      }
      continue
    }

    if (character === '"') {
      inString = true
      continue
    }

    if (character === opener) {
      depth += 1
    } else if (character === closer) {
      depth -= 1
      if (depth === 0) {
        return source.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

function tryParseValue(segment) {
  if (!segment) {
    return null
  }

  try {
    return JSON.parse(segment)
  } catch {
    return null
  }
}

function normalizeScorerPayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {}
  const missingElements = Array.isArray(source.missingElements)
    ? source.missingElements.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : []
  const improvedVersion = typeof source.improvedVersion === "string" ? source.improvedVersion.trim() : ""
  const explicitScore = typeof source.score === "string" ? source.score.trim().toLowerCase() : ""
  const hasKnownScore = explicitScore === "strong" || explicitScore === "moderate" || explicitScore === "weak"
  const hasSignal =
    hasKnownScore || missingElements.length > 0 || improvedVersion.length > 0 || typeof source.canProceed === "boolean"

  if (!hasSignal) {
    throw new Error("Scorer returned an unusable payload.")
  }

  return {
    score: hasKnownScore ? explicitScore : "moderate",
    missingElements,
    improvedVersion,
    canProceed: source.canProceed !== false,
  }
}

function buildContextBlock(contextTags = {}) {
  const fields = []

  if (contextTags.industry) {
    fields.push(`Industry: ${contextTags.industry}`)
  }
  if (contextTags.stage) {
    fields.push(`Stage: ${contextTags.stage}`)
  }
  if (contextTags.userType) {
    fields.push(`User type: ${contextTags.userType}`)
  }

  if (!fields.length) {
    return ""
  }

  return `\n\nAdditional context: ${fields.join(", ")}. Calibrate your language, metrics, and feature suggestions accordingly. A B2B SaaS PRD looks very different from a consumer app PRD.`
}

function buildCompletionBody({ systemPrompt, userPrompt, stream, maxTokens, forceJsonObject }) {
  const body = {
    model: MODEL_ID,
    stream,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  }

  if (typeof maxTokens === "number") {
    body.max_tokens = maxTokens
  }

  if (forceJsonObject) {
    body.response_format = { type: "json_object" }
  }

  return body
}

async function startCompletionRequest({ apiKey, systemPrompt, userPrompt, stream, maxTokens }) {
  for (const forceJsonObject of [true, false]) {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(
        buildCompletionBody({
          systemPrompt,
          userPrompt,
          stream,
          maxTokens,
          forceJsonObject,
        }),
      ),
    })

    if (response.ok) {
      return response
    }

    const details = await response.text()
    if (forceJsonObject && shouldRetryWithoutResponseFormat(details)) {
      continue
    }

    throw new Error(details || `Groq returned an error while starting the analysis with model "${MODEL_ID}".`)
  }

  throw new Error(`Unable to start completion with model "${MODEL_ID}".`)
}

function parsePartialAnalysis(buffer) {
  const cleanedBuffer = cleanJsonBuffer(buffer)
  const fullObject = tryParseValue(cleanedBuffer)

  if (fullObject && typeof fullObject === "object") {
    return normalizeAnalysis(fullObject)
  }

  return normalizeAnalysis({
    jtbd: tryParseValue(extractBalancedSegment(cleanedBuffer, "jtbd", "{", "}")),
    journeyMap: tryParseValue(extractBalancedSegment(cleanedBuffer, "journeyMap", "[", "]")),
    prd: tryParseValue(extractBalancedSegment(cleanedBuffer, "prd", "{", "}")),
    assumptions: tryParseValue(extractBalancedSegment(cleanedBuffer, "assumptions", "[", "]")),
  })
}

function extractMessageContent(payload) {
  const content = payload?.choices?.[0]?.message?.content

  if (typeof content === "string") {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("")
      .trim()
  }

  if (content && typeof content === "object") {
    return JSON.stringify(content)
  }

  return ""
}

function countRenderableSections(analysis) {
  return [
    isRenderableJtbd(analysis?.jtbd),
    isRenderableJourneyMap(analysis?.journeyMap),
    isRenderablePrd(analysis?.prd),
    isRenderableAssumptions(analysis?.assumptions),
  ].filter(Boolean).length
}

function hasCompleteAnalysis(analysis) {
  return countRenderableSections(analysis) === 4
}

function mergeAnalyses(primary, secondary) {
  return normalizeAnalysis({
    jtbd: isRenderableJtbd(primary?.jtbd) ? primary.jtbd : secondary?.jtbd,
    journeyMap: isRenderableJourneyMap(primary?.journeyMap) ? primary.journeyMap : secondary?.journeyMap,
    prd: isRenderablePrd(primary?.prd) ? primary.prd : secondary?.prd,
    assumptions: isRenderableAssumptions(primary?.assumptions) ? primary.assumptions : secondary?.assumptions,
  })
}

async function streamContentFromResponse(response, { onBuffer, onPartial } = {}) {
  if (!response.body) {
    throw new Error("Streaming is unavailable in this browser session.")
  }

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let sseBuffer = ""
  let contentBuffer = ""
  let lastPartialSignature = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    sseBuffer += decoder.decode(value, { stream: true })
    const lines = sseBuffer.split("\n")
    sseBuffer = lines.pop() ?? ""

    lines.forEach((line) => {
      const trimmedLine = line.trim()
      if (!trimmedLine.startsWith("data:")) {
        return
      }

      const payload = trimmedLine.slice(5).trim()
      if (!payload || payload === "[DONE]") {
        return
      }

      try {
        const parsedLine = JSON.parse(payload)
        const delta = parsedLine?.choices?.[0]?.delta?.content
        if (!delta) {
          return
        }

        contentBuffer += delta
        onBuffer?.(contentBuffer)

        const partial = parsePartialAnalysis(contentBuffer)
        const signature = JSON.stringify(partial)
        if (signature !== lastPartialSignature) {
          lastPartialSignature = signature
          onPartial?.(partial)
        }
      } catch {
        // Ignore malformed SSE lines and continue streaming.
      }
    })
  }

  return contentBuffer
}

async function fetchRepairAnalysis({ apiKey, problemStatement, contextTags }) {
  const response = await startCompletionRequest({
    apiKey,
    systemPrompt: `${MAIN_SYSTEM_PROMPT}${buildContextBlock(contextTags)}`,
    userPrompt: problemStatement,
    stream: false,
  })

  const payload = await response.json().catch(() => null)
  const content = extractMessageContent(payload)
  return parsePartialAnalysis(content)
}

export async function scoreProblemStatement(problemStatement) {
  const apiKey = ensureApiKey()
  const response = await startCompletionRequest({
    apiKey,
    systemPrompt: SCORER_SYSTEM_PROMPT,
    userPrompt: problemStatement,
    stream: false,
    maxTokens: 300,
  })

  const payload = await response.json().catch(() => null)
  const content = extractMessageContent(payload)
  const parsed = tryParseValue(cleanJsonBuffer(content))

  return normalizeScorerPayload(parsed)
}

export async function streamPmAnalysis(problemStatement, { onBuffer, onPartial, onMeta, contextTags } = {}) {
  const apiKey = ensureApiKey()

  onMeta?.({
    activeModel: MODEL_ID,
    candidateModels: [MODEL_ID],
    availableModels: [MODEL_ID],
  })

  const streamResponse = await startCompletionRequest({
    apiKey,
    systemPrompt: `${MAIN_SYSTEM_PROMPT}${buildContextBlock(contextTags)}`,
    userPrompt: problemStatement,
    stream: true,
  })

  const contentBuffer = await streamContentFromResponse(streamResponse, { onBuffer, onPartial })
  const streamedAnalysis = parsePartialAnalysis(contentBuffer)

  if (hasCompleteAnalysis(streamedAnalysis)) {
    return streamedAnalysis
  }

  try {
    const repairedAnalysis = await fetchRepairAnalysis({
      apiKey,
      problemStatement,
      contextTags,
    })

    const merged = mergeAnalyses(repairedAnalysis, streamedAnalysis)
    if (hasRenderableAnalysis(merged)) {
      onBuffer?.(JSON.stringify(merged))
      onPartial?.(merged)
      return merged
    }
  } catch (repairError) {
    if (!hasRenderableAnalysis(streamedAnalysis)) {
      throw repairError
    }
  }

  if (hasRenderableAnalysis(streamedAnalysis)) {
    return streamedAnalysis
  }

  throw new Error(`Model "${MODEL_ID}" returned an incomplete structured response.`)
}
