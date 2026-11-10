import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type AiIdentity = { userId: string; userClient: SupabaseClient; admin: SupabaseClient }

export async function authenticateCanvasAi(request: Request): Promise<AiIdentity | Response> {
  const header = request.headers.get('authorization') || ''
  const token = /^Bearer ([-\w.]+)$/.exec(header)?.[1]
  if (!token) return Response.json({ error: 'Du må logge inn med Vedoy ID.' }, { status: 401 })

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !publishableKey || !adminKey) {
    return Response.json({ error: 'Canvas AI mangler sikker serverkonfigurasjon.' }, { status: 503 })
  }

  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  const userClient = createClient(url, publishableKey, {
    ...options,
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: identity, error: authError } = await userClient.auth.getUser(token)
  if (authError || !identity.user) {
    return Response.json({ error: 'Innloggingen må fornyes.' }, { status: 401 })
  }

  const admin = createClient(url, adminKey, options)
  const { data: membership, error: membershipError } = await admin.from('canvas_internal_members')
    .select('active').eq('user_id', identity.user.id).maybeSingle()
  if (membershipError || !membership?.active) {
    return Response.json({ error: 'Du har ikke tilgang til intern Canvas AI.' }, { status: 403 })
  }

  return { userId: identity.user.id, userClient, admin }
}

export async function availableCanvasAiModels(apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error(`OPENAI_MODELS_${response.status}`)
  const json: unknown = await response.json()
  if (!json || typeof json !== 'object' || !('data' in json) || !Array.isArray(json.data)) {
    throw new Error('OPENAI_MODELS_INVALID')
  }
  const byId = new Map<string, number>()
  for (const item of json.data) {
    if (item && typeof item === 'object' && typeof item.id === 'string') {
      byId.set(item.id, typeof item.created === 'number' ? item.created : 0)
    }
  }
  return byId
}
