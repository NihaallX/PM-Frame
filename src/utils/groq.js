import {
  cleanJsonBuffer,
  isRenderableJourneyMap,
  isRenderableJtbd,
  isRenderablePrd,
  normalizeAnalysis,
} from "./formatters"

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"

const DEFAULT_TEXT_MODEL = "llama-3.3-70b-versatile"
const PREFERRED_TEXT_MODELS = [
  "llama-3.3-70b-versatile",
  "openai/gpt-oss-120b",
  "moonshotai/kimi-k2-instruct-0905",
  "qwen/qwen3-32b",
  "llama-3.1-8b-instant",
]

const NON_CHAT_MODEL_PATTERN = /(whisper|prompt-guard|safeguard|orpheus|allam-2)/i
const RESPONSE_FORMAT_UNSUPPORTED_PATTERN = /(response_format|json_object|unsupported|invalid_request_error)/i

const SYSTEM_PROMPT =
  'You are a senior product manager. Given a product problem statement, return ONLY a JSON object (no markdown, no explanation) with exactly these keys:\n- jtbd: { coreJob, functionalJobs[], emotionalJobs[], socialJobs[], underservedOutcomes[] }\n- journeyMap: array of 5 objects { stage, userAction, emotionalState, painPoint, opportunity }\n- prd: { problemStatement, targetUsers: {primary, secondary}, successMetrics: {northStar, guardrails[]}, mvpFeatures: {mustHave[], niceToHave[]}, outOfScope[], openQuestions[] }\nBe specific, realistic, and actionable.'

let cachedModelPlanPromise = null

function unique(items) {
  return [...new Set(items.filter(Boolean))]
}

function asModelList(value) {
  if (!value || typeof value !== "string") {
    return []
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function isLikelyChatModel(modelId) {
  return typeof modelId === "string" && !NON_CHAT_MODEL_PATTERN.test(modelId)
}

function hasCompleteAnalysis(analysis) {
  return Boolean(
    isRenderableJtbd(analysis?.jtbd) &&
      isRenderableJourneyMap(analysis?.journeyMap) &&
      isRenderablePrd(analysis?.prd),
  )
}

function ensureApiKey() {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey) {
    throw new Error("Add VITE_GROQ_API_KEY to your environment before running an analysis.")
  }
  return apiKey
}

async function listAvailableModels(apiKey) {
  try {
    const response = await fetch(GROQ_MODELS_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      return []
    }

    const payload = await response.json()
    return (payload?.data ?? [])
      .filter((model) => model?.active !== false)
      .map((model) => model?.id)
      .filter(Boolean)
      .sort()
  } catch {
    return []
  }
}

function buildModelCandidates(availableModels) {
  const availableSet = new Set(availableModels)
  const envModel = asModelList(import.meta.env.VITE_GROQ_MODEL)
  const envFallbackModels = asModelList(import.meta.env.VITE_GROQ_MODEL_FALLBACKS)

  const orderedPreference = unique([
    ...envModel,
    ...envFallbackModels,
    ...PREFERRED_TEXT_MODELS,
    DEFAULT_TEXT_MODEL,
  ])

  const preferredAvailable = orderedPreference.filter(
    (modelId) => (availableSet.size === 0 || availableSet.has(modelId)) && isLikelyChatModel(modelId),
  )

  const remainingChatModels = availableModels.filter(
    (modelId) => !preferredAvailable.includes(modelId) && isLikelyChatModel(modelId),
  )

  return unique([...preferredAvailable, ...remainingChatModels]).slice(0, 5)
}

async function getModelPlan(apiKey) {
  if (!cachedModelPlanPromise) {
    cachedModelPlanPromise = (async () => {
      const availableModels = await listAvailableModels(apiKey)
      const candidateModels = buildModelCandidates(availableModels)

      return {
        availableModels,
        candidateModels: candidateModels.length ? candidateModels : [DEFAULT_TEXT_MODEL],
      }
    })()
  }

  return cachedModelPlanPromise
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

function parsePartialAnalysis(buffer) {
  const cleanedBuffer = cleanJsonBuffer(buffer)
  const fullObject = tryParseValue(cleanedBuffer)

  if (fullObject && typeof fullObject === "object") {
    return normalizeAnalysis(fullObject)
  }

  const partialData = {
    jtbd: tryParseValue(extractBalancedSegment(cleanedBuffer, "jtbd", "{", "}")),
    journeyMap: tryParseValue(extractBalancedSegment(cleanedBuffer, "journeyMap", "[", "]")),
    prd: tryParseValue(extractBalancedSegment(cleanedBuffer, "prd", "{", "}")),
  }

  return normalizeAnalysis(partialData)
}

function shouldRetryWithoutResponseFormat(details) {
  return RESPONSE_FORMAT_UNSUPPORTED_PATTERN.test(String(details ?? ""))
}

function buildCompletionBody({ model, problemStatement, stream, forceJsonObject }) {
  const body = {
    model,
    stream,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: problemStatement },
    ],
  }

  if (forceJsonObject) {
    body.response_format = { type: "json_object" }
  }

  return body
}

async function startCompletionRequest({ apiKey, model, problemStatement, stream }) {
  for (const forceJsonObject of [true, false]) {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildCompletionBody({ model, problemStatement, stream, forceJsonObject })),
    })

    if (response.ok) {
      return response
    }

    const details = await response.text()
    if (forceJsonObject && shouldRetryWithoutResponseFormat(details)) {
      continue
    }

    throw new Error(details || `Groq returned an error while starting the analysis with model "${model}".`)
  }

  throw new Error(`Unable to start completion with model "${model}".`)
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
        // Ignore malformed event lines and continue streaming.
      }
    })
  }

  const trailingLine = sseBuffer.trim()
  if (trailingLine.startsWith("data:")) {
    const payload = trailingLine.slice(5).trim()
    if (payload && payload !== "[DONE]") {
      try {
        const parsedLine = JSON.parse(payload)
        const delta = parsedLine?.choices?.[0]?.delta?.content
        if (delta) {
          contentBuffer += delta
          onBuffer?.(contentBuffer)
          onPartial?.(parsePartialAnalysis(contentBuffer))
        }
      } catch {
        // Ignore malformed trailing payloads.
      }
    }
  }

  return contentBuffer
}

function extractMessageContent(payload) {
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content === "string") {
    return content
  }

  if (content && typeof content === "object") {
    return JSON.stringify(content)
  }

  return ""
}

async function fetchRepairAnalysis({ apiKey, model, problemStatement }) {
  const response = await startCompletionRequest({
    apiKey,
    model,
    problemStatement,
    stream: false,
  })

  const payload = await response.json().catch(() => null)
  const content = extractMessageContent(payload)
  return parsePartialAnalysis(content)
}

export async function streamPmAnalysis(problemStatement, { onBuffer, onPartial, onMeta } = {}) {
  const apiKey = ensureApiKey()
  const { availableModels, candidateModels } = await getModelPlan(apiKey)

  let lastError = null

  for (const model of candidateModels.slice(0, 3)) {
    try {
      onMeta?.({
        activeModel: model,
        candidateModels,
        availableModels,
      })

      const streamResponse = await startCompletionRequest({
        apiKey,
        model,
        problemStatement,
        stream: true,
      })

      const contentBuffer = await streamContentFromResponse(streamResponse, { onBuffer, onPartial })
      const finalAnalysis = parsePartialAnalysis(contentBuffer)

      if (hasCompleteAnalysis(finalAnalysis)) {
        return finalAnalysis
      }

      const repairedAnalysis = await fetchRepairAnalysis({
        apiKey,
        model,
        problemStatement,
      })

      if (hasCompleteAnalysis(repairedAnalysis)) {
        onBuffer?.(JSON.stringify(repairedAnalysis))
        onPartial?.(repairedAnalysis)
        return repairedAnalysis
      }

      throw new Error(`Model "${model}" returned an incomplete structured response.`)
    } catch (error) {
      lastError = error
    }
  }

  const fallbackMessage =
    "PMFrame could not finish the analysis just now. Try again in a moment, or set VITE_GROQ_MODEL to a different text model."
  throw new Error(lastError instanceof Error ? lastError.message || fallbackMessage : fallbackMessage)
}
