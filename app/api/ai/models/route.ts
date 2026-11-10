import { AI_MODEL_RATES, coinsPerUsd } from '@/lib/canvas-ai-config'
import { authenticateCanvasAi, availableCanvasAiModels } from '@/lib/canvas-ai-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const identity = await authenticateCanvasAi(request)
  if (identity instanceof Response) return identity

  const rate = coinsPerUsd()
  const { data: balance, error: balanceError } = await identity.userClient.rpc('reward_get_balance')
  if (balanceError) {
    return Response.json({ error: 'Vedoy Rewards-saldoen er ikke tilgjengelig.' }, { status: 503 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({
      models: [], balance: Number(balance ?? 0), billingReady: false,
      warning: 'OpenAI API-nøkkelen er ikke konfigurert.',
    })
  }

  try {
    const available = await availableCanvasAiModels(process.env.OPENAI_API_KEY)
    const models = AI_MODEL_RATES.filter((model) => available.has(model.id))
      .map((model) => ({ ...model, created: available.get(model.id) || null }))
      .sort((a, b) => (b.created ?? 0) - (a.created ?? 0))
    return Response.json({
      models, balance: Number(balance ?? 0),
      billingReady: rate !== null && models.length > 0,
      warning: rate === null
        ? 'Coin-kursen er ikke fastsatt. Betaling er deaktivert.'
        : models.length ? null : 'Ingen støttede og prisverifiserte modeller er tilgjengelige.',
    })
  } catch {
    return Response.json({
      models: [], balance: Number(balance ?? 0), billingReady: false,
      warning: 'OpenAI-modellkatalogen er midlertidig utilgjengelig.',
    }, { status: 503 })
  }
}
