'use client'

import { useEffect, useRef, useState } from 'react'
import type { ExcalidrawImperativeAPI, BinaryFileData } from '@excalidraw/excalidraw/types'
import type { DataURL } from '@excalidraw/excalidraw/types'
import type { FileId } from '@excalidraw/excalidraw/element/types'
import { FabricStudio, type FabricAsset } from '@/components/fabric-studio'

type Asset = { id: string; name: string; data: string; width: number; height: number; mime: string; libraryId: string }
type SavedLibrary = { id: string; name: string }
const librariesKey = 'vedoy-asset-libraries-v1'
const graphics = [
  { name: 'Sol', type: 'ellipse', color: '#eab144' },
  { name: 'Merke', type: 'diamond', color: '#85489a' },
  { name: 'Sirkel', type: 'ellipse', color: '#2ea5a8' },
  { name: 'Kort', type: 'rectangle', color: '#dbeafe' },
] as const

const templates = [
  {
    name: 'Logo-pakke',
    description: 'Merke, navnetrekk og fargeprøver',
    width: 760,
    height: 440,
    items: [
      { type: 'rectangle', x: 0, y: 0, width: 760, height: 440, backgroundColor: '#ffffff', strokeColor: '#d8e4ea', label: { text: 'LOGO WORKSHOP', fontSize: 24 } },
      { type: 'ellipse', x: 70, y: 110, width: 150, height: 150, backgroundColor: '#2ea5a8', strokeColor: '#2ea5a8', label: { text: 'V', fontSize: 72 } },
      { type: 'rectangle', x: 260, y: 120, width: 310, height: 70, backgroundColor: '#173f5f', strokeColor: '#173f5f', label: { text: 'Vedøy Studio', fontSize: 34 } },
      { type: 'rectangle', x: 260, y: 210, width: 180, height: 34, backgroundColor: '#f5f7fa', strokeColor: '#d8e4ea', label: { text: 'Tagline her', fontSize: 18 } },
      { type: 'rectangle', x: 70, y: 315, width: 90, height: 48, backgroundColor: '#173f5f', strokeColor: '#173f5f' },
      { type: 'rectangle', x: 178, y: 315, width: 90, height: 48, backgroundColor: '#2ea5a8', strokeColor: '#2ea5a8' },
      { type: 'rectangle', x: 286, y: 315, width: 90, height: 48, backgroundColor: '#eab144', strokeColor: '#eab144' },
    ],
  },
  {
    name: 'Instagram-post',
    description: 'Kvadratisk kampanjeoppsett',
    width: 520,
    height: 520,
    items: [
      { type: 'rectangle', x: 0, y: 0, width: 520, height: 520, backgroundColor: '#173f5f', strokeColor: '#173f5f' },
      { type: 'ellipse', x: 315, y: 42, width: 150, height: 150, backgroundColor: '#2ea5a8', strokeColor: '#2ea5a8' },
      { type: 'rectangle', x: 48, y: 70, width: 260, height: 76, backgroundColor: '#ffffff', strokeColor: '#ffffff', label: { text: 'STOR TITTEL', fontSize: 34 } },
      { type: 'rectangle', x: 48, y: 168, width: 310, height: 150, backgroundColor: '#f5f7fa', strokeColor: '#f5f7fa', label: { text: 'Budskap, tilbud eller idé\nsom skal deles.', fontSize: 24 } },
      { type: 'rectangle', x: 48, y: 374, width: 190, height: 54, backgroundColor: '#eab144', strokeColor: '#eab144', label: { text: 'LES MER', fontSize: 22 } },
    ],
  },
  {
    name: 'Presentasjon',
    description: 'Tittel, tre punkter og bildeplass',
    width: 920,
    height: 520,
    items: [
      { type: 'rectangle', x: 0, y: 0, width: 920, height: 520, backgroundColor: '#f8fafc', strokeColor: '#d8e4ea' },
      { type: 'rectangle', x: 54, y: 52, width: 420, height: 70, backgroundColor: '#173f5f', strokeColor: '#173f5f', label: { text: 'Presentasjonstittel', fontSize: 34 } },
      { type: 'rectangle', x: 54, y: 165, width: 360, height: 54, backgroundColor: '#ffffff', strokeColor: '#d8e4ea', label: { text: '1. Hovedpoeng', fontSize: 22 } },
      { type: 'rectangle', x: 54, y: 240, width: 360, height: 54, backgroundColor: '#ffffff', strokeColor: '#d8e4ea', label: { text: '2. Bevis eller eksempel', fontSize: 22 } },
      { type: 'rectangle', x: 54, y: 315, width: 360, height: 54, backgroundColor: '#ffffff', strokeColor: '#d8e4ea', label: { text: '3. Neste steg', fontSize: 22 } },
      { type: 'rectangle', x: 540, y: 90, width: 300, height: 300, backgroundColor: '#dbeafe', strokeColor: '#2ea5a8', label: { text: 'Bilde / grafikk', fontSize: 26 } },
    ],
  },
  {
    name: 'Nettside-seksjon',
    description: 'Hero, tekst og CTA for nettside',
    width: 980,
    height: 560,
    items: [
      { type: 'rectangle', x: 0, y: 0, width: 980, height: 560, backgroundColor: '#ffffff', strokeColor: '#d8e4ea' },
      { type: 'rectangle', x: 58, y: 65, width: 280, height: 48, backgroundColor: '#f5f7fa', strokeColor: '#d8e4ea', label: { text: 'Logo / navigasjon', fontSize: 18 } },
      { type: 'rectangle', x: 58, y: 170, width: 390, height: 92, backgroundColor: '#173f5f', strokeColor: '#173f5f', label: { text: 'Hero-tittel', fontSize: 40 } },
      { type: 'rectangle', x: 58, y: 292, width: 390, height: 92, backgroundColor: '#f8fafc', strokeColor: '#d8e4ea', label: { text: 'Kort tekst om tilbudet eller produktet.', fontSize: 22 } },
      { type: 'rectangle', x: 58, y: 420, width: 180, height: 56, backgroundColor: '#2ea5a8', strokeColor: '#2ea5a8', label: { text: 'Start nå', fontSize: 22 } },
      { type: 'rectangle', x: 560, y: 150, width: 310, height: 260, backgroundColor: '#dbeafe', strokeColor: '#2ea5a8', label: { text: 'Produktbilde', fontSize: 26 } },
    ],
  },
] as const

async function assetsDatabase() {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('vedoy-assets', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('uploads', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function saveAsset(asset: Asset, remove = false) {
  const db = await assetsDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('uploads', 'readwrite')
      if (remove) tx.objectStore('uploads').delete(asset.id)
      else tx.objectStore('uploads').put(asset)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}

export function DesignLibrary({ api, notify, canCreate = true, hasVedoyGraphics = false, onLocked }: { api: () => ExcalidrawImperativeAPI | null; notify: (text: string) => void; canCreate?: boolean; hasVedoyGraphics?: boolean; onLocked?: (kind: 'login' | 'graphics') => void }) {
  const [tab, setTab] = useState<'Maler' | 'Grafikk' | 'Opplastinger' | 'Komponenter'>('Maler')
  const [uploads, setUploads] = useState<Asset[]>([])
  const [libraries, setLibraries] = useState<SavedLibrary[]>([{ id: 'vedoy-development', name: 'Vedøy Utvikling' }])
  const [activeLibraryId, setActiveLibraryId] = useState('vedoy-development')
  const [studioOpen, setStudioOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    void assetsDatabase().then(db => {
      const request = db.transaction('uploads').objectStore('uploads').getAll()
      request.onsuccess = () => { if (active) setUploads(request.result); db.close() }
      request.onerror = () => db.close()
    }).catch(() => notify('Opplastingsbiblioteket kunne ikke åpnes.'))
    return () => { active = false }
  }, [])
  useEffect(() => {
    try { const value = JSON.parse(localStorage.getItem(librariesKey) ?? '[]'); if (Array.isArray(value) && value.length) { setLibraries(value); setActiveLibraryId(value[0].id) } } catch { /* Keep the starter library. */ }
  }, [])
  const persistLibraries = (next: SavedLibrary[]) => { setLibraries(next); try { localStorage.setItem(librariesKey, JSON.stringify(next)) } catch { notify('Biblioteknavnene kunne ikke lagres lokalt.') } }
  const createLibrary = () => {
    if (!canCreate) { onLocked?.('login'); return }
    const name = window.prompt('Navn på nytt bibliotek', 'Mitt bibliotek')?.trim()
    if (!name) return
    const library = { id: crypto.randomUUID(), name }
    persistLibraries([...libraries, library]); setActiveLibraryId(library.id)
  }

  const importComponents = async () => {
    const editor = api()
    if (!editor) return
    const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
    await editor.updateLibrary({ merge: true, openLibraryMenu: true, libraryItems: ['Logg inn', 'Knapp', 'Kort', 'Etikett', 'Tekstfelt'].map((name, index) => ({
      id: `vedoy-standard-v1-${index}`, status: 'unpublished' as const, name, created: 0,
      elements: convertToExcalidrawElements([{ type: 'rectangle', x: 0, y: 0, width: name === 'Kort' || name === 'Logg inn' ? 280 : 180, height: name === 'Kort' ? 160 : name === 'Logg inn' ? 180 : 52, roughness: 0, roundness: { type: 3 }, backgroundColor: index <= 1 ? '#2ea5a8' : '#ffffff', fillStyle: 'solid', strokeColor: '#133e5b', label: { text: name === 'Logg inn' ? 'Logg inn\n\nE-post\nPassord' : name, fontFamily: 2, fontSize: 20 } }]),
    })) })
    notify('Fire standardkomponenter er lagt i personlig bibliotek. Dra dem til tavlen.')
  }
  const insertTemplate = async (template: typeof templates[number]) => {
    const editor = api()
    if (!editor) return
    const { convertToExcalidrawElements, CaptureUpdateAction } = await import('@excalidraw/excalidraw')
    const state = editor.getAppState()
    const baseX = -state.scrollX + 96
    const baseY = -state.scrollY + 120
    const elements = convertToExcalidrawElements(template.items.map(item => {
      const label = 'label' in item ? item.label : undefined
      return {
        ...item,
        x: baseX + item.x,
        y: baseY + item.y,
        roughness: 0,
        roundness: { type: 3 },
        fillStyle: 'solid',
        label: label ? { text: label.text, fontFamily: 2, fontSize: label.fontSize } : undefined,
      }
    }))
    editor.updateScene({ elements: [...editor.getSceneElements(), ...elements], captureUpdate: CaptureUpdateAction.IMMEDIATELY })
    editor.scrollToContent(elements)
    notify(`${template.name} er satt inn på tavlen.`)
  }
  const insertGraphic = async (graphic: typeof graphics[number]) => {
    const editor = api()
    if (!editor) return
    const { convertToExcalidrawElements, CaptureUpdateAction } = await import('@excalidraw/excalidraw')
    const state = editor.getAppState()
    const elements = convertToExcalidrawElements([{ type: graphic.type, x: -state.scrollX + 80, y: -state.scrollY + 100, width: 160, height: 160, roughness: 0, backgroundColor: graphic.color, fillStyle: 'solid', strokeColor: graphic.color }])
    editor.updateScene({ elements: [...editor.getSceneElements(), ...elements], captureUpdate: CaptureUpdateAction.IMMEDIATELY })
    editor.scrollToContent(elements)
  }
  const insertUpload = async (asset: Asset) => {
    const editor = api()
    if (!editor) return
    const { convertToExcalidrawElements, CaptureUpdateAction } = await import('@excalidraw/excalidraw')
    editor.addFiles([{ id: asset.id as FileId, dataURL: asset.data as DataURL, mimeType: asset.mime as BinaryFileData['mimeType'], created: Date.now() }])
    const state = editor.getAppState()
    const scale = Math.min(1, 600 / Math.max(asset.width, asset.height))
    const elements = convertToExcalidrawElements([{ type: 'image', fileId: asset.id as FileId, x: -state.scrollX + 80, y: -state.scrollY + 100, width: asset.width * scale, height: asset.height * scale, status: 'saved' }])
    editor.updateScene({ elements: [...editor.getSceneElements(), ...elements], captureUpdate: CaptureUpdateAction.IMMEDIATELY })
    editor.scrollToContent(elements)
  }
  const upload = async (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) { notify('Velg PNG, JPEG, WebP eller GIF på maks 10 MB.'); return }
    setBusy(true)
    try {
      const bitmap = await createImageBitmap(file)
      if (bitmap.width * bitmap.height > 40_000_000) { bitmap.close(); throw new Error('Bildet er for stort (maks 40 megapiksler).') }
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) })
      const asset = { id: crypto.randomUUID(), name: file.name, data, width: bitmap.width, height: bitmap.height, mime: file.type, libraryId: activeLibraryId }
      bitmap.close()
      await saveAsset(asset)
      setUploads(items => [...items, asset])
      notify('Bildet er lagret i opplastingsbiblioteket på denne enheten.')
    } catch (error) { notify(error instanceof Error ? error.message : 'Bildet kunne ikke lagres.') }
    finally { setBusy(false) }
  }
  const saveFabricAsset = async (created: FabricAsset) => {
    const asset: Asset = { id: crypto.randomUUID(), ...created, libraryId: activeLibraryId }
    await saveAsset(asset); setUploads(items => [...items, asset]); notify(`${asset.name} er lagret i ${libraries.find(item => item.id === activeLibraryId)?.name ?? 'biblioteket'}.`)
  }
  return <section className="design-library" aria-label="Designbibliotek">
    <div className="mb-3 flex items-center gap-2"><label className="min-w-0 flex-1 text-xs"><span className="sr-only">Aktivt bibliotek</span><select value={activeLibraryId} onChange={event => setActiveLibraryId(event.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2 font-semibold">{libraries.map(library => <option key={library.id} value={library.id}>{library.name}</option>)}</select></label><button onClick={createLibrary} className="grid size-8 shrink-0 place-items-center rounded-lg border border-border" aria-label="Lag nytt bibliotek">+</button></div>
    <div className="flex flex-wrap gap-1">{(['Maler', 'Grafikk', 'Opplastinger', 'Komponenter'] as const).map(name => <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)} className={`rounded-lg px-2 py-2 text-xs ${tab === name ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{name}</button>)}</div>
    {tab === 'Maler' && <div className="mt-3 grid gap-2">{templates.map(template => <button key={template.name} onClick={() => canCreate ? void insertTemplate(template).catch(() => notify('Malen kunne ikke settes inn.')) : onLocked?.('login')} className="rounded-xl border border-border p-3 text-left hover:bg-muted"><span className="block text-xs font-semibold">{template.name}</span><span className="mt-1 block text-[11px] text-muted-foreground">{template.description}</span><span className="mt-2 block rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">{template.width} × {template.height}</span></button>)}</div>}
    {tab === 'Grafikk' && <div className="mt-3"><div className="grid grid-cols-2 gap-2">{graphics.map(graphic => <button key={graphic.name} onClick={() => hasVedoyGraphics ? void insertGraphic(graphic).catch(() => notify('Grafikken kunne ikke settes inn.')) : onLocked?.('graphics')} className="rounded-xl border border-border p-3 text-xs hover:bg-muted"><span className="mx-auto mb-2 block size-10" style={{ background: graphic.color, borderRadius: graphic.type === 'ellipse' ? '50%' : 6, transform: graphic.type === 'diamond' ? 'rotate(45deg) scale(.7)' : undefined }} />{graphic.name}{!hasVedoyGraphics ? ' · Plus' : ''}</button>)}</div><button onClick={() => canCreate ? setStudioOpen(true) : onLocked?.('login')} className="mt-2 w-full rounded-lg border border-dashed border-border p-2 text-xs font-semibold">+ Bygg egen grafikk</button></div>}
    {tab === 'Komponenter' && <div className="mt-3 space-y-3 text-xs"><p>Logg inn-ramme, knapp, kort, etikett og tekstfelt som redigerbare klosser.</p><button className="w-full rounded-lg bg-primary p-2 text-primary-foreground" onClick={() => canCreate ? void importComponents().catch(() => notify('Komponentene kunne ikke importeres.')) : onLocked?.('login')}>Lagre klosser i personlig bibliotek</button><p className="text-muted-foreground">Åpnes i Excalidraw-biblioteket og kan dras inn på alle tavler.</p></div>}
    {tab === 'Opplastinger' && <div className="mt-3 space-y-2"><p className="text-xs text-muted-foreground">Lagres i valgt bibliotek på denne enheten. Eksporter tavlen for sikkerhetskopi.</p><input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /><button disabled={busy} onClick={() => canCreate ? input.current?.click() : onLocked?.('login')} className="w-full rounded-lg border border-border p-2 text-xs">{busy ? 'Lagrer…' : '+ Last opp bilde'}</button>{uploads.filter(asset => asset.libraryId === activeLibraryId || !asset.libraryId).map(asset => <div key={asset.id} className="flex items-center gap-2 rounded-lg border border-border p-2"><button className="min-w-0 flex-1 text-left text-xs" onClick={() => void insertUpload(asset).catch(() => notify('Bildet kunne ikke settes inn.'))}><img src={asset.data} alt="" className="mb-1 h-16 w-full object-contain" /><span className="block truncate">{asset.name}</span></button><button aria-label={`Fjern ${asset.name} fra biblioteket`} onClick={() => void saveAsset(asset, true).then(() => setUploads(items => items.filter(item => item.id !== asset.id))).catch(() => notify('Bildet kunne ikke fjernes.'))}>×</button></div>)}</div>}
    <a href="/retningslinjer" target="_blank" rel="noopener noreferrer" className="mt-4 block text-xs text-muted-foreground underline">Retningslinjer og kontakt</a>
    {studioOpen ? <FabricStudio onClose={() => setStudioOpen(false)} onSave={saveFabricAsset} /> : null}
  </section>
}
