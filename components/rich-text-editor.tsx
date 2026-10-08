'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bold, CheckSquare, Code2, Heading1, Heading2, Heading3, ImagePlus, Italic, LibraryBig, Link2, List, ListOrdered, Strikethrough, Table2, Underline, Video } from 'lucide-react'

const allowedTags = new Set(['A', 'B', 'I', 'SPAN', 'STRIKE', 'BLOCKQUOTE', 'BR', 'DIV', 'EM', 'FIGCAPTION', 'FIGURE', 'FONT', 'H1', 'H2', 'H3', 'IFRAME', 'IMG', 'INPUT', 'LABEL', 'LI', 'MARK', 'OL', 'P', 'S', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TH', 'THEAD', 'TR', 'U', 'UL'])
const allowedAttributes = new Set(['allow', 'allowfullscreen', 'alt', 'checked', 'colspan', 'contenteditable', 'data-canvas-embed', 'data-canvas-width', 'data-canvas-height', 'data-task', 'face', 'frameborder', 'height', 'href', 'loading', 'rel', 'rowspan', 'sandbox', 'size', 'src', 'target', 'title', 'type', 'width'])

export function sanitizeRichHtml(html: string) {
  if (typeof window === 'undefined') return html
  const documentCopy = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = documentCopy.body.firstElementChild
  if (!root) return ''

  for (const element of Array.from(root.querySelectorAll('*'))) {
    if (!allowedTags.has(element.tagName)) {
      element.replaceWith(...Array.from(element.childNodes))
      continue
    }
    const safeStyle = document.createElement('span').style
    const sourceStyle = (element as HTMLElement).style
    for (const property of ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'text-align']) {
      const value = sourceStyle?.getPropertyValue(property)
      if (value && !/url\s*\(|expression|var\s*\(/i.test(value)) safeStyle.setProperty(property, value)
    }
    const fontColor = element.tagName === 'FONT' ? element.getAttribute('color') : null
    if (fontColor && CSS.supports('color', fontColor)) safeStyle.color = fontColor
    for (const attribute of Array.from(element.attributes)) {
      if (!allowedAttributes.has(attribute.name)) element.removeAttribute(attribute.name)
    }
    if (safeStyle.cssText) element.setAttribute('style', safeStyle.cssText)
    if (element.tagName === 'A') {
      const href = element.getAttribute('href') ?? ''
      if (!/^(https?:|mailto:)/i.test(href)) element.removeAttribute('href')
      else {
        element.setAttribute('target', '_blank')
        element.setAttribute('rel', 'noreferrer noopener')
      }
    }
    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src') ?? ''
      if (!/^(https?:|data:image\/(png|jpe?g|gif|webp);base64,)/i.test(src)) element.remove()
    }
    if (element.tagName === 'IFRAME') {
      const src = element.getAttribute('src') ?? ''
      if (!/^https:\/\/(www\.)?(youtube-nocookie\.com|youtube\.com|player\.vimeo\.com)\//i.test(src)) element.remove()
      else {
        element.setAttribute('loading', 'lazy')
        element.setAttribute('title', element.getAttribute('title') || 'Innebygd innhold')
        element.setAttribute('allowfullscreen', '')
      }
    }
    if (element.tagName === 'INPUT') {
      element.setAttribute('type', 'checkbox')
      element.setAttribute('contenteditable', 'false')
    }
  }
  for (const figure of Array.from(root.querySelectorAll<HTMLElement>('figure[data-canvas-embed]'))) {
    const image = figure.querySelector('img')
    if (!image?.getAttribute('src')) {
      figure.remove()
      continue
    }
    const width = Math.max(160, Math.min(2000, Number(figure.getAttribute('data-canvas-width')) || 360))
    const height = Math.max(120, Math.min(1600, Number(figure.getAttribute('data-canvas-height')) || 220))
    figure.style.width = `min(${width}px, 100%)`
    image.style.width = '100%'
    image.style.height = `${height}px`
    image.style.maxHeight = 'none'
  }
  for (const figure of Array.from(root.querySelectorAll<HTMLElement>('figure'))) {
    const label = figure.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (!figure.querySelector('img') && (label.includes('Tom ramme') || label.includes('Ny ramme · klikk for å redigere'))) figure.remove()
  }
  return root.innerHTML
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

export function richHtmlFromLegacy(content = '') {
  if (!content.trim()) return '<p><br></p>'
  return content.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`).join('')
}

function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="flex size-8 shrink-0 items-center justify-center rounded-md text-black/55 hover:bg-black/5 hover:text-violet-700 dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-violet-300" aria-label={label} title={label}>{children}</button>
}

function LibraryPickerOption({ canvas, onCanvasPreview, onMouseDown, onClick }: {
  canvas: { id: string; title: string; width?: number; height?: number }
  onCanvasPreview: (canvasId: string) => Promise<string | null>
  onMouseDown: () => void
  onClick: () => void
}) {
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void onCanvasPreview(canvas.id).then((image) => { if (active) setPreview(image) })
    return () => { active = false }
  }, [canvas.id, onCanvasPreview])

  return <button type="button" draggable onMouseDown={(event) => { event.preventDefault(); onMouseDown() }} onDragStart={(event) => { event.dataTransfer.setData('application/x-vedoy-canvas', canvas.id); event.dataTransfer.effectAllowed = 'copy' }} onClick={onClick} aria-label={`Sett inn ${canvas.title}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-black/10 p-2 text-left hover:border-violet-400 hover:bg-violet-50 dark:border-white/10 dark:hover:bg-white/5">
    <span className="grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-violet-400/50 bg-violet-50 dark:bg-white/5">{preview ? <img src={preview} alt="" className="h-full w-full object-contain" /> : <LibraryBig className="size-5 text-violet-500/60" />}</span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{canvas.title}</span></span>
    <span className="shrink-0 rounded-md bg-violet-600 px-2 py-1.5 text-[10px] font-semibold text-white">Sett inn</span>
  </button>
}

export function RichTextEditor({ pageId, html, canvasOptions, onChange, onOpenCanvas, onCanvasPreview, onNotify }: {
  pageId: string
  html: string
  canvasOptions: Array<{ id: string; title: string; width?: number; height?: number }>
  onChange: (html: string) => void
  onOpenCanvas: (canvasId: string) => void
  onCanvasPreview: (canvasId: string) => Promise<string | null>
  onNotify: (message: string) => void
}) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const imageInput = useRef<HTMLInputElement | null>(null)
  const lastEmittedHtml = useRef('')
  const loadedPageId = useRef<string | null>(null)
  const canvasInsertRange = useRef<Range | null>(null)
  const [insertDialog, setInsertDialog] = useState<'link' | 'video' | 'embed' | null>(null)
  const [insertValue, setInsertValue] = useState('')
  const [canvasPickerOpen, setCanvasPickerOpen] = useState(false)

  useEffect(() => {
    const safeHtml = sanitizeRichHtml(html)
    if (editorRef.current && (loadedPageId.current !== pageId || lastEmittedHtml.current !== safeHtml)) editorRef.current.innerHTML = safeHtml
    loadedPageId.current = pageId
    lastEmittedHtml.current = safeHtml
  }, [html, pageId])

  const saveEditor = () => {
    const editor = editorRef.current
    if (!editor) return
    for (const checkbox of Array.from(editor.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))) {
      if (checkbox.checked) checkbox.setAttribute('checked', '')
      else checkbox.removeAttribute('checked')
    }
    const safeHtml = sanitizeRichHtml(editor.innerHTML)
    lastEmittedHtml.current = safeHtml
    onChange(safeHtml)
  }

  const command = (name: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(name, false, value)
    saveEditor()
  }

  const selectCommand = (name: string, value: string) => {
    editorRef.current?.focus()
    document.execCommand(name, false, value)
    saveEditor()
  }

  const insertHtml = (value: string) => {
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, value)
    saveEditor()
  }

  const rememberCanvasInsertRange = () => {
    const selection = window.getSelection()
    if (selection?.rangeCount && editorRef.current?.contains(selection.anchorNode)) canvasInsertRange.current = selection.getRangeAt(0).cloneRange()
  }

  const pickScreenColor = async () => {
    rememberCanvasInsertRange()
    const EyeDropper = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper
    if (!EyeDropper) { onNotify('Bruk fargefeltet: denne nettleseren støtter ikke skjermpipette.'); return }
    try {
      const color = await new EyeDropper().open()
      if (canvasInsertRange.current) {
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(canvasInsertRange.current)
      }
      command('foreColor', color.sRGBHex)
    } catch { /* Escape cancels the browser picker. */ }
  }

  const insertCanvas = async (canvasId: string, dropRange?: Range) => {
    const canvas = canvasOptions.find((item) => item.id === canvasId)
    if (!canvas) return
    const savedRange = dropRange?.cloneRange() ?? canvasInsertRange.current?.cloneRange() ?? null
    const preview = await onCanvasPreview(canvasId)
    if (loadedPageId.current !== pageId) { onNotify('Siden ble byttet. Åpne den igjen før du setter inn elementet.'); return }
    if (!preview) { onNotify('Elementet kunne ikke forhåndsvises fra personlig bibliotek.'); return }
    const width = Math.max(160, Math.min(2000, Math.round(canvas.width ?? 360)))
    const height = Math.max(120, Math.min(1600, Math.round(canvas.height ?? 220)))
    const image = `<img src="${escapeHtml(preview)}" width="${width}" height="${height}" alt="${escapeHtml(canvas.title)}">`
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    const selection = window.getSelection()
    if (selection && savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges()
      selection.addRange(savedRange)
    } else if (selection) {
      const endOfPage = document.createRange()
      endOfPage.selectNodeContents(editor)
      endOfPage.collapse(false)
      selection.removeAllRanges()
      selection.addRange(endOfPage)
    }
    document.execCommand('insertHTML', false, `<figure data-canvas-embed="${escapeHtml(canvasId)}" data-canvas-width="${width}" data-canvas-height="${height}" contenteditable="false">${image}<figcaption>${escapeHtml(canvas.title)} · åpne i Canvas</figcaption></figure><p><br></p>`)
    saveEditor()
    canvasInsertRange.current = null
  }

  const addLink = () => {
    setInsertValue('')
    setInsertDialog('link')
  }

  const addImage = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { onNotify('Velg en bildefil'); return }
    if (file.size > 2_000_000) { onNotify('Bildet må være under 2 MB'); return }
    const reader = new FileReader()
    reader.onload = () => insertHtml(`<img src="${String(reader.result)}" alt="Innsatt bilde"><p><br></p>`)
    reader.onerror = () => onNotify('Kunne ikke lese bildet')
    reader.readAsDataURL(file)
  }

  const addVideo = () => {
    setInsertValue('')
    setInsertDialog('video')
  }

  const addEmbed = () => {
    setInsertValue('')
    setInsertDialog('embed')
  }

  const submitInsert = () => {
    const value = insertValue.trim()
    if (!value || !insertDialog) return
    if (insertDialog === 'link') {
      const href = /^(https?:|mailto:)/i.test(value) ? value : `https://${value}`
      command('createLink', href)
      setInsertDialog(null)
      return
    }
    if (!value) return
    try {
      const url = new URL(value)
      if (insertDialog === 'embed') {
        if (url.protocol !== 'https:') throw new Error('https')
        insertHtml(`<figure class="rich-embed"><iframe src="${escapeHtml(url.toString())}" title="Innebygd HTML-innhold" width="100%" height="360" frameborder="0" loading="lazy" sandbox="allow-scripts allow-same-origin allow-forms"></iframe><figcaption>Innebygd innhold</figcaption></figure><p><br></p>`)
        setInsertDialog(null)
        return
      }
      let embed = ''
      if (url.hostname === 'youtu.be') embed = `https://www.youtube-nocookie.com/embed/${url.pathname.slice(1)}`
      else if (url.hostname.endsWith('youtube.com')) embed = url.searchParams.get('v') ? `https://www.youtube-nocookie.com/embed/${url.searchParams.get('v')}` : value
      else if (url.hostname === 'vimeo.com') embed = `https://player.vimeo.com/video/${url.pathname.split('/').filter(Boolean).pop()}`
      else if (url.hostname === 'player.vimeo.com') embed = value
      if (!embed) throw new Error('unsupported')
      insertHtml(`<figure class="rich-video"><iframe src="${escapeHtml(embed)}" title="Video" width="100%" height="360" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe><figcaption>Video</figcaption></figure><p><br></p>`)
      setInsertDialog(null)
    } catch { onNotify(insertDialog === 'embed' ? 'Kun HTTPS-lenker kan bygges inn' : 'Bruk en gyldig YouTube- eller Vimeo-lenke') }
  }

  const rangeAtPoint = (x: number, y: number) => {
    const documentWithCaret = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null; caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }
    if (documentWithCaret.caretRangeFromPoint) return documentWithCaret.caretRangeFromPoint(x, y)
    const position = documentWithCaret.caretPositionFromPoint?.(x, y)
    if (!position) return null
    const range = document.createRange()
    range.setStart(position.offsetNode, position.offset)
    range.collapse(true)
    return range
  }

  return <div className="relative mt-5">
    <div className="sticky top-0 z-10 mb-4 flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-black/10 bg-white/95 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#272727]/95" aria-label="Rik tekst-verktøy">
      <button type="button" onMouseDown={(event) => { event.preventDefault(); rememberCanvasInsertRange() }} onClick={() => canvasOptions.length ? setCanvasPickerOpen(true) : onNotify('Lagre et element i personlig bibliotek i Canvas først')} className="mr-1 flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-violet-600 px-2.5 text-xs font-medium text-white hover:bg-violet-700" aria-label="Sett inn fra personlig bibliotek"><LibraryBig className="size-3.5" />Personlig bibliotek</button>
      <span className="mx-1 h-5 w-px shrink-0 bg-black/10 dark:bg-white/10" />
      <ToolbarButton label="Overskrift 1" onClick={() => command('formatBlock', 'h1')}><Heading1 className="size-4" /></ToolbarButton>
      <ToolbarButton label="Overskrift 2" onClick={() => command('formatBlock', 'h2')}><Heading2 className="size-4" /></ToolbarButton>
      <ToolbarButton label="Underoverskrift" onClick={() => command('formatBlock', 'h3')}><Heading3 className="size-4" /></ToolbarButton>
      <label className="flex h-8 shrink-0 items-center rounded-md border border-black/10 px-1.5 text-[11px] dark:border-white/10"><span className="sr-only">Font</span><input list="vedoy-fonts" defaultValue="Arial" onFocus={rememberCanvasInsertRange} onBlur={(event) => { if (canvasInsertRange.current) { const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(canvasInsertRange.current) }; selectCommand('fontName', event.target.value) }} className="w-28 bg-transparent outline-none" aria-label="Velg eller skriv installert font" /><datalist id="vedoy-fonts">{['Arial', 'Georgia', 'Verdana', 'Courier New', 'Trebuchet MS', 'Times New Roman', 'Palatino Linotype', 'Garamond', 'Impact', 'Comic Sans MS', 'Segoe UI', 'Calibri', 'Cambria', 'Candara', 'Consolas', 'Tahoma', 'Helvetica', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'].map(font => <option key={font} value={font} />)}</datalist></label>
      <ToolbarButton label="Plukk tekstfarge fra skjermen" onClick={() => void pickScreenColor()}>◉</ToolbarButton>
      <label className="flex h-8 shrink-0 items-center rounded-md border border-black/10 px-1.5 text-[11px] dark:border-white/10"><span className="sr-only">Størrelse</span><select defaultValue="3" onChange={(event) => selectCommand('fontSize', event.target.value)} className="w-14 bg-transparent outline-none" aria-label="Velg skriftstørrelse"><option value="1">10 px</option><option value="2">12 px</option><option value="3">14 px</option><option value="4">16 px</option><option value="5">20 px</option><option value="6">28 px</option><option value="7">36 px</option></select></label>
      <ToolbarButton label="Fet" onClick={() => command('bold')}><Bold className="size-4" /></ToolbarButton>
      <ToolbarButton label="Kursiv" onClick={() => command('italic')}><Italic className="size-4" /></ToolbarButton>
      <ToolbarButton label="Understreking" onClick={() => command('underline')}><Underline className="size-4" /></ToolbarButton>
      <ToolbarButton label="Gjennomstreking" onClick={() => command('strikeThrough')}><Strikethrough className="size-4" /></ToolbarButton>
      <label className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-black/55 hover:bg-black/5 dark:text-white/55 dark:hover:bg-white/10" title="Tekstfarge"><span className="sr-only">Velg tekstfarge</span><input type="color" defaultValue="#1f2937" onChange={(event) => selectCommand('foreColor', event.target.value)} className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Velg tekstfarge" /></label>
      <label className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-black/55 hover:bg-black/5 dark:text-white/55 dark:hover:bg-white/10" title="Uthevingsfarge"><span className="sr-only">Velg uthevingsfarge</span><input type="color" defaultValue="#fef08a" onChange={(event) => selectCommand('hiliteColor', event.target.value)} className="size-5 cursor-pointer rounded border-0 bg-transparent p-0" aria-label="Velg uthevingsfarge" /></label>
      <ToolbarButton label="Punktliste" onClick={() => command('insertUnorderedList')}><List className="size-4" /></ToolbarButton>
      <ToolbarButton label="Nummerliste" onClick={() => command('insertOrderedList')}><ListOrdered className="size-4" /></ToolbarButton>
      <ToolbarButton label="Avkryssing" onClick={() => insertHtml('<p data-task="true"><input type="checkbox" contenteditable="false"> Oppgave</p>')}><CheckSquare className="size-4" /></ToolbarButton>
      <ToolbarButton label="Nøkkelord" onClick={() => insertHtml('<mark>Nøkkelord</mark>')}><span className="text-[10px] font-bold">KEY</span></ToolbarButton>
      <ToolbarButton label="Tabell" onClick={() => insertHtml('<table><tbody><tr><th>Kolonne 1</th><th>Kolonne 2</th></tr><tr><td>Verdi</td><td>Verdi</td></tr></tbody></table><p><br></p>')}><Table2 className="size-4" /></ToolbarButton>
      <ToolbarButton label="Lenke" onClick={addLink}><Link2 className="size-4" /></ToolbarButton>
      <ToolbarButton label="Bilde" onClick={() => imageInput.current?.click()}><ImagePlus className="size-4" /></ToolbarButton>
      <ToolbarButton label="Video" onClick={addVideo}><Video className="size-4" /></ToolbarButton>
      <ToolbarButton label="HTML-innhold" onClick={addEmbed}><Code2 className="size-4" /></ToolbarButton>
    </div>
    {canvasPickerOpen ? <section className="absolute right-0 top-11 z-30 w-full max-w-sm rounded-2xl border border-black/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#272727]"><h2 className="text-base font-semibold">Personlig bibliotek</h2><p className="mt-1 text-xs text-black/55 dark:text-white/55">Velg et element du har lagret i Canvas. Dra det til ønsket sted, eller klikk for å sette det inn.</p><div className="mt-4 grid max-h-[55vh] gap-2 overflow-y-auto">{canvasOptions.map((canvas) => <LibraryPickerOption key={canvas.id} canvas={canvas} onCanvasPreview={onCanvasPreview} onMouseDown={rememberCanvasInsertRange} onClick={() => { setCanvasPickerOpen(false); void insertCanvas(canvas.id) }} />)}</div><button type="button" onClick={() => setCanvasPickerOpen(false)} className="mt-4 w-full rounded-lg px-3 py-2 text-xs text-black/55 hover:bg-black/5 dark:text-white/55 dark:hover:bg-white/5">Avbryt</button></section> : null}
    <input ref={imageInput} type="file" className="hidden" accept="image/*" onChange={(event) => { addImage(event.target.files?.[0]); event.target.value = '' }} />
    {insertDialog ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onClick={() => setInsertDialog(null)}><form className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#272727]" onSubmit={(event) => { event.preventDefault(); submitInsert() }} onClick={(event) => event.stopPropagation()}><h2 className="text-base font-semibold">{insertDialog === 'link' ? 'Sett inn lenke' : insertDialog === 'video' ? 'Sett inn video' : 'Bygg inn HTML-innhold'}</h2><p className="mt-1 text-xs text-black/55 dark:text-white/55">{insertDialog === 'link' ? 'Lim inn en nettadresse.' : insertDialog === 'video' ? 'Støtter YouTube og Vimeo.' : 'Kun HTTPS-lenker med sandbox.'}</p><input autoFocus value={insertValue} onChange={(event) => setInsertValue(event.target.value)} placeholder={insertDialog === 'link' ? 'https://...' : 'https://...'} className="mt-4 w-full rounded-lg border border-black/10 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-white/10" aria-label="URL" /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setInsertDialog(null)} className="rounded-lg px-3 py-2 text-xs text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10">Avbryt</button><button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-700">Sett inn</button></div></form></div> : null}
    <div
      ref={editorRef}
      className="rich-editor min-h-[calc(100vh-17rem)] w-full outline-none"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Sideinnhold"
      aria-multiline="true"
      onInput={saveEditor}
      onChange={saveEditor}
      onKeyUp={rememberCanvasInsertRange}
      onMouseUp={rememberCanvasInsertRange}
      onPaste={(event) => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); saveEditor() }}
      onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-vedoy-canvas')) event.preventDefault() }}
      onDrop={(event) => {
        const canvasId = event.dataTransfer.getData('application/x-vedoy-canvas')
        if (!canvasId) return
        event.preventDefault()
        setCanvasPickerOpen(false)
        const range = rangeAtPoint(event.clientX, event.clientY)
        void insertCanvas(canvasId, range ?? undefined)
      }}
      onClick={(event) => {
        const target = event.target as HTMLElement
        const embeddedCanvas = target.closest('[data-canvas-embed]')?.getAttribute('data-canvas-embed')
        if (embeddedCanvas) onOpenCanvas(embeddedCanvas)
      }}
    />
  </div>
}
