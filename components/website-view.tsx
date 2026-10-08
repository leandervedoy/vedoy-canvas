'use client'

import { useEffect, useState } from 'react'
import { Globe2, LoaderCircle, Plus, Sparkles } from 'lucide-react'
import type { Note } from '@/lib/notebook'

const emptyWebsite = '<!doctype html><html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Min nettside</title></head><body><main><h1>Min nettside</h1><p>Beskriv nettsiden i feltet, eller rediger HTML-koden.</p></main></body></html>'

export function starterWebsiteHtml(title: string) {
  return emptyWebsite.replaceAll('Min nettside', title.replace(/[&<>"']/g, ''))
}

export function WebsiteView({ websites, activeWebsiteId, canGenerate, onSelect, onCreate, onUpdate, onGetAccessToken, onNotify }: {
  websites: Note[]
  activeWebsiteId?: string
  canGenerate: boolean
  onSelect: (id: string) => void
  onCreate: () => void
  onUpdate: (id: string, changes: Partial<Note>) => void
  onGetAccessToken: () => Promise<string | null>
  onNotify: (message: string) => void
}) {
  const activeWebsite = websites.find((website) => website.id === activeWebsiteId) ?? websites[0]
  const [prompt, setPrompt] = useState('')
  const [codeOpen, setCodeOpen] = useState(false)
  const [htmlDraft, setHtmlDraft] = useState('')
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    setPrompt(activeWebsite?.websitePrompt ?? '')
    setHtmlDraft(activeWebsite?.websiteHtml ?? '')
    setCodeOpen(false)
  }, [activeWebsite?.id, activeWebsite?.websiteHtml, activeWebsite?.websitePrompt])

  const generate = async () => {
    if (!activeWebsite || !prompt.trim()) return
    const token = await onGetAccessToken()
    if (!token) {
      onNotify('Logg inn for å lage nettsider med OpenRouter')
      return
    }
    setGenerating(true)
    try {
      const response = await fetch('/api/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: prompt.trim(), title: activeWebsite.title }),
      })
      const result = await response.json() as { html?: string; error?: string }
      if (!response.ok || !result.html) throw new Error(result.error || 'Nettsiden kunne ikke lages')
      setHtmlDraft(result.html)
      onUpdate(activeWebsite.id, { websiteHtml: result.html, websitePrompt: prompt.trim() })
      onNotify('Nettsiden er oppdatert')
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Nettsiden kunne ikke lages')
    } finally {
      setGenerating(false)
    }
  }

  return <section className="absolute inset-0 flex min-h-0 flex-col bg-[#f5f3ee] pt-[4.75rem] text-[#27251f] dark:bg-[#151515] dark:text-[#f5f3ee]" aria-label="Nettsider">
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-black/10 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5 md:w-64 md:border-b-0 md:border-r md:p-4">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40 dark:text-white/40">Vedøy</p><h1 className="mt-1 text-lg font-semibold">Nettsider</h1></div>
          <button type="button" onClick={onCreate} className="flex size-9 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-700" aria-label="Ny nettside"><Plus className="size-4" /></button>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto md:flex-col md:overflow-y-auto">
          {websites.map((website) => <button key={website.id} type="button" onClick={() => onSelect(website.id)} className={`flex min-w-40 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs md:min-w-0 ${website.id === activeWebsite?.id ? 'bg-violet-600 text-white' : 'bg-black/5 text-black/65 hover:bg-black/10 dark:bg-white/8 dark:text-white/65'}`}><Globe2 className="size-4 shrink-0" /><span className="truncate">{website.title}</span></button>)}
          {websites.length === 0 && <p className="py-2 text-xs text-black/45 dark:text-white/45">Ingen nettsider ennå. Opprett en fra plussknappen.</p>}
        </div>
      </aside>

      {activeWebsite ? <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4 md:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1 text-xs font-medium text-black/55 dark:text-white/55">Navn på nettsiden
            <input value={activeWebsite.title} onChange={(event) => onUpdate(activeWebsite.id, { title: event.target.value })} className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm text-black outline-none focus:border-violet-500 dark:border-white/10 dark:bg-black/20 dark:text-white" aria-label="Navn på nettsiden" />
          </label>
          <span className="rounded-full bg-white/70 px-3 py-2 text-[11px] text-black/45 dark:bg-white/5 dark:text-white/45">Nettside · separat fra bøker</span>
        </div>
        <div className="grid min-h-52 flex-1 gap-4 xl:grid-cols-[minmax(16rem,0.8fr)_minmax(24rem,1.2fr)]">
          <div className="flex min-h-0 flex-col rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#202020]">
            <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-violet-600" />Lag med OpenRouter</div>
            <p className="mt-1 text-xs leading-5 text-black/50 dark:text-white/50">Beskriv siden du vil lage eller endringen du ønsker.</p>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} onBlur={() => onUpdate(activeWebsite.id, { websitePrompt: prompt })} placeholder="For eksempel: Lag en rolig porteføljeside for en keramiker …" className="mt-3 min-h-28 flex-1 resize-y rounded-lg border border-black/10 bg-[#faf9f6] p-3 text-sm outline-none focus:border-violet-500 dark:border-white/10 dark:bg-black/20" />
            <button type="button" disabled={!canGenerate || generating || !prompt.trim()} onClick={() => void generate()} className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-45">{generating ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{generating ? 'Lager nettside …' : canGenerate ? 'Generer / oppdater' : 'Logg inn for OpenRouter'}</button>
            {!canGenerate && <p className="mt-2 text-[11px] text-black/45 dark:text-white/45">Logg inn for å bruke OpenRouter. API-nøkkelen lagres på serveren.</p>}
            <details className="mt-3 rounded-lg border border-black/10 p-3 dark:border-white/10" open={codeOpen} onToggle={(event) => setCodeOpen(event.currentTarget.open)}>
              <summary className="cursor-pointer text-xs font-medium">Rediger HTML direkte</summary>
              <textarea value={htmlDraft} onChange={(event) => setHtmlDraft(event.target.value)} className="mt-3 min-h-48 w-full rounded-lg border border-black/10 bg-[#faf9f6] p-3 font-mono text-[11px] leading-5 outline-none focus:border-violet-500 dark:border-white/10 dark:bg-black/20" aria-label="Nettsidens HTML" />
              <button type="button" onClick={() => onUpdate(activeWebsite.id, { websiteHtml: htmlDraft })} className="mt-2 rounded-md bg-black/5 px-3 py-2 text-xs hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15">Lagre HTML</button>
            </details>
          </div>

          <div className="flex min-h-64 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#202020]">
            <div className="flex items-center gap-2 border-b border-black/10 px-4 py-2.5 text-xs text-black/45 dark:border-white/10 dark:text-white/45"><span className="size-2 rounded-full bg-emerald-500" />Forhåndsvisning</div>
            <iframe key={`${activeWebsite.id}-${activeWebsite.websiteHtml ?? ''}`} title={`Forhåndsvisning av ${activeWebsite.title}`} srcDoc={activeWebsite.websiteHtml || htmlDraft} sandbox="allow-scripts" className="min-h-0 flex-1 bg-white" />
          </div>
        </div>
      </div> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><Globe2 className="size-9 text-violet-500" /><h2 className="mt-3 text-base font-semibold">Lag din første nettside</h2><p className="mt-1 max-w-sm text-xs leading-5 text-black/50 dark:text-white/50">Nettsidene lever i sin egen visning og kan ikke dras inn i en bok.</p><button type="button" onClick={onCreate} className="mt-4 rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-violet-700">Opprett nettside</button></div>}
    </div>
  </section>
}
