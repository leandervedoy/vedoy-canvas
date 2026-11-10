// Server-maintained pricing catalogue. OpenAI /v1/models supplies availability and
// creation dates, but NOT prices. Check https://platform.openai.com/pricing
// before publishing a price change. Standard short-context text rates, USD/1M.
export const AI_MODEL_RATES = [
  { id: 'gpt-6.1-sol', inputPerMillion: 1, outputPerMillion: 5 },
  { id: 'gpt-6.1-terra', inputPerMillion: 0.5, outputPerMillion: 2.5 },
  { id: 'gpt-6-astra', inputPerMillion: 5, outputPerMillion: 25 },
  { id: 'gpt-6-luna', inputPerMillion: 0.05, outputPerMillion: 0.25 },
  { id: 'gpt-5.6-sol', inputPerMillion: 4, outputPerMillion: 20 },
] as const

export const AI_MAX_PROMPT_CHARS = 6000
export const AI_MAX_OUTPUT_TOKENS = 768
export type AiModelRate = (typeof AI_MODEL_RATES)[number]

export function modelRate(id: string): AiModelRate | undefined {
  return AI_MODEL_RATES.find((value) => value.id === id)
}

export function coinsPerUsd(): number | null {
  const value = Number(process.env.VEDOY_COINS_PER_USD)
  return process.env.VEDOY_COINS_PER_USD && Number.isFinite(value) && value > 0 && value <= 1000000 ? value : null
}

export function costUsd(model: AiModelRate, inputTokens: number, outputTokens: number): number {
  return (inputTokens * model.inputPerMillion + outputTokens * model.outputPerMillion) / 1000000
}

// 50% markup, NOT a 50% gross margin. Minimum 1 whole Coin per request.
export function coinsForCost(usd: number, rate: number): number {
  return Math.max(1, Math.ceil(usd * 1.5 * rate - 1e-10))
}

export function quoteForPrompt(model: AiModelRate, text: string, rate: number) {
  // Upper bound intended to cover UTF-8 input, instructions, and API framing.
  // No tools, attachments, conversation history, or regional processing in MVP.
  const maximumInputTokens = Buffer.byteLength(text, 'utf8') + 2048
  const maximumCostUsd = costUsd(model, maximumInputTokens, AI_MAX_OUTPUT_TOKENS)
  const reservedCoins = coinsForCost(maximumCostUsd, rate)
  const estimatedInputTokens = Math.max(1, Math.ceil(Buffer.byteLength(text, 'utf8') / 3))
  const estimatedCostUsd = costUsd(model, estimatedInputTokens, 256)
  return {
    maximumInputTokens,
    maximumOutputTokens: AI_MAX_OUTPUT_TOKENS,
    maximumCostUsd,
    reservedCoins,
    estimatedCostUsd,
    estimatedCoins: coinsForCost(estimatedCostUsd, rate),
    markupPercent: 50,
  }
}
