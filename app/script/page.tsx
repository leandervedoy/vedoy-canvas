'use client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { compileVedoyScript } from '@/lib/vedoy-script'
type Language = 'vedoyscript' | 'javascript'
const initial = 'when open_circle clicked\n  go "/meny"\nend'
export default function ScriptStudio() {
  const [language, setLanguage] = useState<Language>('vedoyscript')
  const [script, setScript] = useState(initial)
  const [javascript, setJavascript] = useState('document.getElementById("open_circle")?.addEventListener("click", () => { window.location.assign("/meny"); });')
  const [name, setName] = useState('Åpne')
  const [id, setId] = useState('open_circle')
  const [notice, setNotice] = useState('')
  const result = useMemo(() => compileVedoyScript(script), [script])
  function exportHtml() {
    if (language === 'vedoyscript' && result.errors.length) return
    const code = language === 'vedoyscript' ? result.javascript : javascript
    const html = `<!doctype html><html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vedoy Canvas</title><style>body{font-family:system-ui;min-height:100vh;display:grid;place-items:center}button{border:0;border-radius:50%;width:140px;height:140px;background:#2563eb;color:white;cursor:pointer;font-size:18px}</style></head><body><button id="${id.replace(/[^a-zA-Z0-9_-]/g, '')}">${name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</button><script>${code.replace(/<\\/script/gi, '<\\/script')}<\/script></body></html>`
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    const a = document.createElement('a'); a.href = url; a.download = 'vedoy-canvas.html'; a.click(); URL.revokeObjectURL(url)
  }
  return <main className="min-h-screen bg-background p-4 text-foreground md:p-8"><div className="mx-auto max-w-5xl space-y-5">
    <div className="flex items-center justify-between gap-3"><div><Link href="/" className="text-sm text-muted-foreground hover:underline">← Til Canvas</Link><h1 className="text-2xl font-semibold">Visual App Designer</h1><p className="text-sm text-muted-foreground">VedoyScript er standardspråket. Bytt til JavaScript når du ønsker det.</p></div><button onClick={exportHtml} disabled={language === 'vedoyscript' && result.errors.length > 0} className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50">Eksporter HTML</button></div>
    <div className="grid gap-5 md:grid-cols-2">
      <section className="space-y-4 rounded-xl border p-4"><h2 className="font-semibold">Design</h2><label className="block text-sm">Elementnavn<input className="mt-1 w-full rounded border bg-background p-2" value={name} onChange={e=>setName(e.target.value)}/></label><label className="block text-sm">Element-ID<input className="mt-1 w-full rounded border bg-background p-2" value={id} onChange={e=>setId(e.target.value)}/></label><div className="flex min-h-64 items-center justify-center rounded-lg bg-muted"><button id={id} onClick={()=>setNotice('Forhåndsvisning: handlinger kjøres først i eksportert HTML.')} className="flex h-36 w-36 items-center justify-center rounded-full bg-blue-600 p-3 text-center text-white">{name}</button></div><p className="text-xs text-muted-foreground">{notice || 'Klikk på sirkelen for å velge og teste elementet.'}</p></section>
      <section className="space-y-4 rounded-xl border p-4"><div className="flex items-center justify-between"><h2 className="font-semibold">Kode</h2><label className="text-sm">Språk <select aria-label="Programmeringsspråk" className="ml-2 rounded border bg-background p-2" value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="vedoyscript">VedoyScript (standard)</option><option value="javascript">JavaScript</option></select></label></div><textarea spellCheck={false} aria-label="Kodeeditor" className="h-52 w-full rounded-lg border bg-background p-3 font-mono text-sm" value={language==='vedoyscript'?script:javascript} onChange={e=>language==='vedoyscript'?setScript(e.target.value):setJavascript(e.target.value)}/>{language==='vedoyscript' ? <><p className="text-sm">Kommandoer: when ID clicked, go "/side", say "tekst", show ID, hide ID, end.</p>{result.errors.length ? <ul className="text-sm text-red-600">{result.errors.map((e,i)=><li key={i}>{e}</li>)}</ul> : <p className="text-sm text-green-600">✓ VedoyScript validert</p>}<h3 className="font-medium">Generert JavaScript</h3><pre className="overflow-x-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">{result.javascript || 'Rett feilene for å generere kode.'}</pre></> : <p className="text-sm text-amber-700">JavaScript er for erfarne utviklere. Eksportert kode kjøres i nettleseren. Ikke lim inn kode fra ukjente kilder.</p>}</section>
    </div><p className="text-xs text-muted-foreground">Første versjon: én interaktiv komponent, språkvalg og HTML-eksport. Full Excalidraw-kobling, sikker JS-sandbox og flerkomponent-layout kommer i neste fase.</p>
  </div></main>
}
