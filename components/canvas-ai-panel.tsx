'use client'

import { useEffect, useState } from 'react'
import { Coins, LoaderCircle, Sparkles, X } from 'lucide-react'

type Model = {
  id: string
  created: number | null
  inputPerMillion: number
  outputPerMillion: number
}
type Quote = { model: string; reservedCoins: number; estimatedCoins: number; maximumCostUsd: number; estimatedCostUsd: number; markupPercent: number }
type ChatResult = { answer: string; model: string; chargedCoins: number; reservedCoins: number; balance: number }

async function getJson(response: Response) {
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object') throw new Error('Ugyldig svar fra tjenesten.')
  const body = data as Record<string, unknown>
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Forespørselen feilet.')
  return body
}

export function CanvasAiPanel({ getAccessToken, initialText, onClose }: {
  getAccessToken: () => Promise<string | null>
  initialText: string
  onClose: () => void
}) {
  const [models, setModels] = useState<Model[]>([])
  const [modelId, setModelId] = useState('')
  const [balance, setBalance] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const [warning, setWarning] = useState('')
  const [prompt, setPrompt] = useState(initialText)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState<'loading' | 'quote' | 'send' | null>('loading')
  const [error, setError] = useState('')

  async function authorizedFetch(path: string, options: RequestInit = {}) {
    const token = await getAccessToken()
    if (!token) throw new Error('Logg inn med Vedoy ID før du bruker AI.')
    return fetch(path, {
      ...options,
      cache: 'no-store',
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    })
  }

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const data = await getJson(await authorizedFetch('/api/ai/models'))
        if (!live) return
        const nextModels = Array.isArray(data.models) ? data.models as Model[] : []
        setModels(nextModels)
        setModelId(nextModels[0]?.id ?? '')
        setReady(data.billingReady === true)
        setBalance(typeof data.balance === 'number' ? data.balance : 0)
        setWarning(typeof data.warning === 'string' ? data.warning : '')
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Kunne ikke laste modeller.')
      } finally {
        if (live) setBusy(null)
      }
    })()
    return () => { live = false }
    // Stable getAccessToken supplied by CanvasWorkspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAccessToken])

  const calculateQuote = async () => {
    setBusy('quote'); setError(''); setQuote(null); setAnswer('')
    try {
      const data = await getJson(await authorizedFetch('/api/ai/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: modelId }),
      }))
      setQuote(data as Quote)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke beregne pris.')
    } finally { setBusy(null) }
  }

  const send = async () => {
    if (!quote || busy || quote.reservedCoins > (balance ?? 0)) return
    setBusy('send'); setError('')
    try {
      const data = await getJson(await authorizedFetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: modelId, maxCoins: quote.reservedCoins }),
      })) as ChatResult
      setAnswer(data.answer)
      setBalance(data.balance)
      setQuote(null)
      setWarning(`Betalt ${data.chargedCoins} Coins (maks ${data.reservedCoins} reserverte).`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke utføre AI-kallet.')
      setQuote(null)
    } finally { setBusy(null) }
  }

  return <aside className="absolute inset-x-2 bottom-2 top-[4.75rem] z-40 flex min-h-0 flex-col rounded-2xl border border-border bg-card p-4 shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-6 sm:w-[390px]" aria-label="Vedoy Canvas AI">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border pb-3">
      <div className="flex items-center gap-2"><Sparkles className="size-5 text-violet-500" /><div><strong className="text-sm">Canvas AI</strong><p className="text-[11px] text-muted-foreground">OpenAI · Vedoy Coins</p></div></div>
      <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-muted" aria-label="Lukk Canvas AI"><X className="size-4" /></button>
    </header>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4 text-sm">
      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5"><Coins className="size-4" />Vedoy Rewards-saldo</span>
        <strong>{balance === null ? '—' : balance + ' Coins'}</strong>
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-semibold">Velg OpenAI-modell · nyeste først</span>
        <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={modelId}
          disabled={busy !== null || models.length === 0}
          onChange={(e) => { setModelId(e.target.value); setQuote(null); setAnswer('') }}>
          {models.length === 0 ? <option value="">Ingen modeller tilgjengelig</option> : models.map((model) => <option key={model.id} value={model.id}>
            {model.id}{model.created ? ` · ${new Date(model.created * 1000).toLocaleDateString('nb-NO')}` : ''}
          </option>)}
        </select>
        {models.find(m => m.id === modelId) && <p className="text-[11px] text-muted-foreground">
          Input/output USD per 1 mill. tokens: {models.find(m => m.id === modelId)?.inputPerMillion} / {models.find(m => m.id === modelId)?.outputPerMillion}
        </p>}
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold">Spørsmål eller valgt innhold</span>
        <textarea className="min-h-36 w-full resize-y rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
          value={prompt} maxLength={6000} placeholder="Hva vil du at AI skal analysere eller skrive?"
          onChange={(e) => { setPrompt(e.target.value); setQuote(null); setAnswer('') }} />
        <p className="text-[11px] text-muted-foreground">{prompt.length}/6000 tegn. Bare denne teksten sendes til OpenAI.</p>
      </label>
      {warning && <p role="status" className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{warning}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">{error}</p>}
      {quote && <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-xs">
        <p><strong>Forventet pris:</strong> ca. {quote.estimatedCoins} Coins</p>
        <p><strong>Maksimal reservasjon:</strong> {quote.reservedCoins} Coins</p>
        <p>50 % påslag på API-kostnad, avrundet til hele Coins. Ubrukte reserverte Coins tilbakeføres.</p>
        {quote.reservedCoins > (balance ?? 0) && <p className="text-red-600">Utilstrekkelig saldo. Ingen belastning utføres.</p>}
      </div>}
      {answer && <div className="rounded-xl border border-border bg-background p-3">
        <strong className="block pb-2 text-xs">AI-svar</strong>
        <p className="whitespace-pre-wrap break-words text-sm leading-6">{answer}</p>
      </div>}
    </div>
    <div className="flex shrink-0 flex-col gap-2 border-t border-border pt-3">
      {!quote
        ? <button type="button" onClick={() => void calculateQuote()} disabled={!ready || busy !== null || !prompt.trim() || !modelId}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Coins className="size-4" />}Beregn pris i Coins</button>
        : <button type="button" onClick={() => void send()} disabled={busy !== null || quote.reservedCoins > (balance ?? 0)}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Godkjenn maks {quote.reservedCoins} Coins og kjør</button>}
      <p className="text-center text-[11px] text-muted-foreground">Forhåndspris kreves. Ingen automatisk belastning uten godkjenning.</p>
    </div>
  </aside>
}
