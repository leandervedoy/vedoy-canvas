'use client'

import { Boxes, Globe2, Layers3, PackagePlus, X } from 'lucide-react'

export type VedoyLibraryItem = {
  id: string
  owner_id: string
  project_id: string | null
  name: string
  description: string
  kind: string
  visibility: 'personal' | 'project' | 'public'
  content: Record<string, unknown>
  compatibility: string[]
  tags: string[]
  version: number
  price_coins: number
  source_key: string | null
  updated_at: string
}

export function MyLibraryPanel({
  open,
  items,
  marketplaceItems,
  projectName,
  onClose,
  onUse,
  onPublish,
  onAddFromMarketplace,
}: {
  open: boolean
  items: VedoyLibraryItem[]
  marketplaceItems: VedoyLibraryItem[]
  projectName?: string | null
  onClose: () => void
  onUse: (item: VedoyLibraryItem) => void
  onPublish: (item: VedoyLibraryItem) => void
  onAddFromMarketplace: (item: VedoyLibraryItem) => void
}) {
  if (!open) return null

  return <aside className="absolute right-4 top-[4.75rem] z-40 flex max-h-[calc(100vh-6rem)] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-2xl backdrop-blur-md sm:right-6" aria-label="My Library">
    <div className="flex items-start justify-between gap-3 border-b border-border/70 p-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">Vedøy Core</p>
        <h2 className="mt-1 text-lg font-semibold">My Library</h2>
        <p className="mt-1 text-xs text-muted-foreground">{projectName ? `Project: ${projectName}` : 'Personal library across Vedøy services'}</p>
      </div>
      <button type="button" onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close My Library"><X className="size-4" /></button>
    </div>
    <div className="overflow-y-auto p-3">
      <section>
        <div className="flex items-center gap-2 px-1 py-2"><Layers3 className="size-4 text-violet-600" /><h3 className="text-xs font-semibold">Your assets</h3></div>
        {items.length ? <div className="grid gap-2">{items.map((item) => <article key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-3">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm">{item.name}</strong><span className="mt-1 block text-[10px] uppercase tracking-wide text-muted-foreground">{item.kind} · {item.visibility}</span></div><button type="button" onClick={() => onUse(item)} className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground">Use</button></div>
          {item.description ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p> : null}
          <div className="mt-2 flex flex-wrap gap-1">{item.compatibility.slice(0, 4).map((value) => <span key={value} className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{value}</span>)}</div>
          {item.visibility !== 'public' ? <button type="button" onClick={() => onPublish(item)} className="mt-2 text-[11px] font-medium text-violet-600 hover:underline">Publish to Marketplace</button> : <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-600"><Globe2 className="size-3" /> Marketplace</span>}
        </article>)}</div> : <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground"><Boxes className="mx-auto mb-2 size-5" />Save components from the canvas to build your shared library.</div>}
      </section>
      <section className="mt-5 border-t border-border/70 pt-3">
        <div className="flex items-center gap-2 px-1 py-2"><Globe2 className="size-4 text-violet-600" /><h3 className="text-xs font-semibold">Vedoy Marketplace</h3></div>
        {marketplaceItems.length ? <div className="grid gap-2">{marketplaceItems.map((item) => <article key={item.id} className="rounded-xl border border-border/70 bg-background/70 p-3">
          <strong className="block text-sm">{item.name}</strong><p className="mt-1 text-xs text-muted-foreground">{item.description || item.kind}</p>
          <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{item.price_coins ? `${item.price_coins} Vedoy Coins` : 'Free'}</span><button type="button" onClick={() => onAddFromMarketplace(item)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted"><PackagePlus className="size-3" />Add to My Library</button></div>
        </article>)}</div> : <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">No public assets yet. Marketplace publishing is ready for the first creators.</p>}
      </section>
    </div>
  </aside>
}
