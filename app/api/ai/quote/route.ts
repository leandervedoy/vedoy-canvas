import { AI_MAX_PROMPT_CHARS, coinsPerUsd, modelRate, quoteForPrompt } from '@/lib/canvas-ai-config'
import { authenticateCanvasAi, availableCanvasAiModels } from '@/lib/canvas-ai-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const identity = await authenticateCanvasAi(request)
  if (identity instanceof Response) return identity
  const exchange = coinsPerUsd()
  if (!exchange || !process.env.OPENAI_API_KEY) {
    return Response.json({ error: 'Betaling er deaktivert til Coin-kurs og API-nøkkel er konfigurert.' }, { status: 503 })
  }

  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: 'Ugyldig forespørsel.' }, { status: 400 })
  }
  const item = body && typeof body === 'object' ? body as Record<string, unknown> : {}
  const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : ''
  const model = typeof item.model === 'string' ? modelRate(item.model) : undefined
  if (!prompt || prompt.length > AI_MAX_PROMPT_CHARS || !model) {
    return Response.json({ error: 'Velg en støttet modell og skriv maks 6000 tegn.' }, { status: 400 })
  }
  try {
    const available = await availableCanvasAiModels(process.env.OPENAI_API_KEY)
    if (!available.has(model.id)) return Response.json({ error: 'Modellen er ikke tilgjengelig på API-kontoen.' }, { status: 400 })
    const quote = quoteForPrompt(model, prompt, exchange)
    if (quote.reservedCoins > 10000) return Response.json({ error: 'Forespørselen overskrider Coin-grensen.' }, { status: 400 })
    return Response.json({ ...quote, model: model.id, currency: 'VEDOY_COIN' })
  } catch {
    return Response.json({ error: 'Kunne ikke bekrefte modelltilgang.' }, { status: 503 })
  }
}
