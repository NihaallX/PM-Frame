import {
  cleanJsonBuffer,
  isRenderableJourneyMap,
  isRenderableJtbd,
  isRenderablePrd,
  normalizeAnalysis,
} from "./formatters"

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL_ID = "llama-3.3-70b-versatile"
const RESPONSE_FORMAT_UNSUPPORTED_PATTERN = /(response_format|json_object|unsupported|invalid_request_error)/i

const SYSTEM_PROMPT =
  'You are a senior product manager. Given a product problem statement, return ONLY a JSON object (no markdown, no explanation) with exactly these keys:\n- jtbd: { coreJob, functionalJobs[], emotionalJobs[], socialJobs[], underservedOutcomes[] }\n- journeyMap: array of 5 objects { stage, userAction, emotionalState, painPoint, opportunity }\n- prd: { problemStatement, targetUsers: {primary, secondary}, successMetrics: {northStar, guardrails[]}, mvpFeatures: {mustHave[], niceToHave[]}, outOfScope[], openQuestions[] }\nBe specific, realistic, and actionable.'

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

function buildCompletionBody({ problemStatement, stream, forceJsonObject }) {
  const body = {
    model: MODEL_ID,
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

async function startCompletionRequest({ apiKey, problemStatement, stream }) {
  for (const forceJsonObject of [true, false]) {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildCompletionBody({ problemStatement, stream, forceJsonObject })),
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

async function fetchRepairAnalysis({ apiKey, problemStatement }) {
  const response = await startCompletionRequest({
    apiKey,
    problemStatement,
    stream: false,
  })

  const payload = await response.json().catch(() => null)
  const content = extractMessageContent(payload)
  return parsePartialAnalysis(content)
}

export async function streamPmAnalysis(problemStatement, { onBuffer, onPartial, onMeta } = {}) {
  const apiKey = ensureApiKey()

  onMeta?.({
    activeModel: MODEL_ID,
    candidateModels: [MODEL_ID],
    availableModels: [MODEL_ID],
  })

  const streamResponse = await startCompletionRequest({
    apiKey,
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
    problemStatement,
  })

  if (hasCompleteAnalysis(repairedAnalysis)) {
    onBuffer?.(JSON.stringify(repairedAnalysis))
    onPartial?.(repairedAnalysis)
    return repairedAnalysis
  }

  throw new Error(`Model "${MODEL_ID}" returned an incomplete structured response.`)
}
