import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OpenRouter er ikke satt opp ennå. Legg OPENROUTER_API_KEY til i Vercel-miljøvariablene.' }, { status: 503 })

  const authorization = request.headers.get('authorization')
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  const vedoyLoginUrl = (process.env.VEDOY_LOGIN_URL ?? process.env.NEXT_PUBLIC_VEDOY_LOGIN_URL ?? 'https://vedoy-login.vercel.app').replace(/\/$/, '')
  if (!accessToken) return NextResponse.json({ error: 'Logg inn for å bruke OpenRouter.' }, { status: 401 })

  const authResponse = await fetch(`${vedoyLoginUrl}/api/auth/oauth2/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' })
  if (!authResponse.ok) return NextResponse.json({ error: 'Logg inn for å bruke OpenRouter.' }, { status: 401 })
  const account = await authResponse.json() as { plan?: string }
  if (!['supporter', 'supporter_plus'].includes(account.plan ?? '')) return NextResponse.json({ error: 'Supporter-abonnement kreves for å lage nettsider.' }, { status: 403 })

  const body = await request.json().catch(() => null) as { prompt?: unknown; title?: unknown } | null
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 120) : 'Nettside'
  if (!prompt || prompt.length > 3000) return NextResponse.json({ error: 'Beskriv nettsiden med opptil 3000 tegn.' }, { status: 400 })

  const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vedoy-canvas.vercel.app',
      'X-Title': 'Vedoy Canvas',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-5-mini',
      max_tokens: 5000,
      temperature: 0.45,
      messages: [
        { role: 'system', content: 'Du lager komplette, selvstendige nettsider. Returner kun et HTML-dokument med CSS inni <style>. Skriv innholdet på samme språk som brukerens instruksjon. Bruk semantisk HTML, responsiv stil, god kontrast og ingen eksterne skript. Ikke inkluder markdown-kodegjerder.' },
        { role: 'user', content: `Nettsidetittel: ${title}\n\nØnsket nettside eller endring:\n${prompt}` },
      ],
    }),
    cache: 'no-store',
  })

  const completion = await openRouterResponse.json().catch(() => null) as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>; error?: { message?: string } } | null
  if (!openRouterResponse.ok) {
    return NextResponse.json({ error: openRouterResponse.status === 401 ? 'OpenRouter-nøkkelen på Vercel er ugyldig.' : completion?.error?.message || 'OpenRouter kunne ikke lage nettsiden nå.' }, { status: openRouterResponse.status === 429 ? 429 : 502 })
  }
  const content = completion?.choices?.[0]?.message?.content
  const text = typeof content === 'string' ? content : content?.map((part) => part.text ?? '').join('')
  const html = text?.replace(/^\s*```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  if (!html || html.length > 100_000) return NextResponse.json({ error: 'OpenRouter returnerte ikke en gyldig nettside.' }, { status: 502 })
  return NextResponse.json({ html })
}
