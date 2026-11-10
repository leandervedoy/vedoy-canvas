import { randomUUID } from 'node:crypto'
import { AI_MAX_OUTPUT_TOKENS, AI_MAX_PROMPT_CHARS, coinsPerUsd, coinsForCost, costUsd, modelRate, quoteForPrompt } from '@/lib/canvas-ai-config'
import { authenticateCanvasAi, availableCanvasAiModels } from '@/lib/canvas-ai-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SYSTEM_INSTRUCTIONS = 'Du er Vedoy Infinite Canvas AI. Svar presist og konkret på brukerens språk. Du har ikke automatisk tilgang til brukerens dokumenter, nettverk eller GitHub. Ikke påstå at endringer er utført uten verktøykall.'

function extractText(value: unknown): string {
  if (!value || typeof value !== 'object' || !('output' in value) || !Array.isArray(value.output)) return ''
  return value.output.flatMap((part: unknown) => {
    if (!part || typeof part !== 'object' || !('content' in part) || !Array.isArray(part.content)) return []
    return part.content.flatMap((chunk: unknown) =>
      chunk && typeof chunk === 'object' && 'type' in chunk && chunk.type === 'output_text' && 'text' in chunk && typeof chunk.text === 'string' ? [chunk.text] : [])
  }).join('\n').trim()
}

export async function POST(request: Request) {
  const identity = await authenticateCanvasAi(request)
  if (identity instanceof Response) return identity

  const exchange = coinsPerUsd()
  const openAiKey = process.env.OPENAI_API_KEY
  if (!exchange || !openAiKey) {
    return Response.json({ error: 'Coin-kurs eller OpenAI API-nøkkel mangler. Ingen Coins er trukket.' }, { status: 503 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Ugyldig forespørsel.' }, { status: 400 })
  }
  const data = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const prompt = typeof data.prompt === 'string' ? data.prompt.trim() : ''
  const model = typeof data.model === 'string' ? modelRate(data.model) : undefined
  const acceptedMaximum = data.maxCoins
  if (!prompt || prompt.length > AI_MAX_PROMPT_CHARS || !model ||
      !Number.isInteger(acceptedMaximum) || (acceptedMaximum as number) < 1) {
    return Response.json({ error: 'Modell, tekst eller godkjent Coin-grense er ugyldig.' }, { status: 400 })
  }

  try {
    const available = await availableCanvasAiModels(openAiKey)
    if (!available.has(model.id)) {
      return Response.json({ error: 'Modellen er ikke tilgjengelig på denne kontoen.' }, { status: 400 })
    }
  } catch {
    return Response.json({ error: 'Kunne ikke bekrefte modelltilgang.' }, { status: 503 })
  }

  const quote = quoteForPrompt(model, prompt, exchange)
  if (quote.reservedCoins !== acceptedMaximum || quote.reservedCoins > 10000) {
    return Response.json({ error: 'Prisen er endret. Beregn ny pris før du godkjenner kjøpet.' }, { status: 409 })
  }

  const requestId = randomUUID()
  const { error: reserveError } = await identity.admin.rpc('canvas_ai_reserve', {
    p_user_id: identity.userId,
    p_request_id: requestId,
    p_model_id: model.id,
    p_coins: quote.reservedCoins,
  })
  if (reserveError) {
    const message = /INSUFFICIENT_COINS/.test(reserveError.message) ? 'Ikke nok Vedoy Coins.' :
      /AI_RATE_LIMIT/.test(reserveError.message) ? 'Maks fem AI-kall per minutt.' :
      'Kunne ikke reservere Vedoy Coins. Betalingsfunksjonen må aktiveres og testes.'
    return Response.json({ error: message }, { status: 402 })
  }

  const cancel = async () => {
    const result = await identity.admin.rpc('canvas_ai_cancel', { p_request_id: requestId })
    return !result.error
  }

  let provider: Response
  try {
    provider = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model.id, store: false, max_output_tokens: AI_MAX_OUTPUT_TOKENS,
        input: [
          { role: 'system', content: SYSTEM_INSTRUCTIONS },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(49000),
      cache: 'no-store',
    })
  } catch {
    const refunded = await cancel()
    return Response.json({ error: refunded
      ? 'OpenAI svarte ikke. Reserverte Coins er tilbakeført.'
      : 'OpenAI svarte ikke. Reservasjonen må kontrolleres manuelt.' }, { status: 502 })
  }

  if (!provider.ok) {
    const refunded = await cancel()
    return Response.json({ error: refunded
      ? 'OpenAI kunne ikke fullføre forespørselen. Coins er tilbakeført.'
      : 'OpenAI feilet. Kontroller Coin-reservasjonen.' }, { status: 502 })
  }

  let result: Record<string, unknown>
  try {
    result = await provider.json() as Record<string, unknown>
  } catch {
    const refunded = await cancel()
    return Response.json({ error: refunded
      ? 'Kunne ikke lese OpenAI-svaret. Coins er tilbakeført.'
      : 'Ugyldig svar fra OpenAI; reservasjonen må kontrolleres.' }, { status: 502 })
  }

  const answer = extractText(result)
  const usage = result.usage && typeof result.usage === 'object' ? result.usage as Record<string, unknown> : {}
  const inputTokens = typeof usage.input_tokens === 'number' ? usage.input_tokens : NaN
  const outputTokens = typeof usage.output_tokens === 'number' ? usage.output_tokens : NaN
  if (!answer || !Number.isFinite(inputTokens) || !Number.isFinite(outputTokens) || inputTokens < 0 || outputTokens < 0) {
    const refunded = await cancel()
    return Response.json({ error: refunded
      ? 'Ingen verifiserbar respons. Coins er tilbakeført.'
      : 'Svar mangler; reservasjonen må kontrolleres.' }, { status: 502 })
  }

  const actualUsd = costUsd(model, inputTokens, outputTokens)
  // Never charge more than the maximum the user explicitly approved.
  const actualCoins = Math.min(quote.reservedCoins, coinsForCost(actualUsd, exchange))
  const { error: settleError } = await identity.admin.rpc('canvas_ai_settle', {
    p_request_id: requestId,
    p_actual_coins: actualCoins,
  })
  if (settleError) {
    return Response.json({
      error: 'Svaret ble generert, men betalingen kunne ikke avstemmes. Reservasjonen må kontrolleres.',
      requestId,
    }, { status: 503 })
  }
  const { data: balance } = await identity.userClient.rpc('reward_get_balance')
  return Response.json({
    answer, model: model.id, requestId,
    chargedCoins: actualCoins, reservedCoins: quote.reservedCoins, balance: Number(balance ?? 0),
    inputTokens, outputTokens,
  })
}
