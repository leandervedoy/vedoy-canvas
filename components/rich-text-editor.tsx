'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { Bold, CheckSquare, Heading1, Heading2, ImagePlus, Italic, Link2, List, Palette } from 'lucide-react'

const allowedTags = new Set(['A', 'BLOCKQUOTE', 'BR', 'DIV', 'EM', 'FIGCAPTION', 'FIGURE', 'H1', 'H2', 'H3', 'IMG', 'INPUT', 'LABEL', 'LI', 'OL', 'P', 'S', 'STRONG', 'U', 'UL'])
const allowedAttributes = new Set(['alt', 'checked', 'contenteditable', 'data-canvas-embed', 'data-task', 'href', 'rel', 'src', 'target', 'type'])

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
    for (const attribute of Array.from(element.attributes)) {
      if (!allowedAttributes.has(attribute.name)) element.removeAttribute(attribute.name)
    }
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
    if (element.tagName === 'INPUT') {
      element.setAttribute('type', 'checkbox')
      element.setAttribute('contenteditable', 'false')
    }
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

export function RichTextEditor({ pageId, html, onChange, onOpenCanvas, onCanvasPreview, onNotify }: {
  pageId: string
  html: string
  onChange: (html: string) => void
  onOpenCanvas: () => void
  onCanvasPreview: () => Promise<string | null>
  onNotify: (message: string) => void
}) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const imageInput = useRef<HTMLInputElement | null>(null)
  const lastEmittedHtml = useRef('')
  const loadedPageId = useRef<string | null>(null)

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

  const insertHtml = (value: string) => {
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, value)
    saveEditor()
  }

  const addLink = () => {
    const value = window.prompt('Lim inn lenken')?.trim()
    if (!value) return
    const href = /^(https?:|mailto:)/i.test(value) ? value : `https://${value}`
    command('createLink', href)
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

  const addCanvas = async () => {
    const preview = await onCanvasPreview()
    const image = preview ? `<img src="${preview}" alt="Canvas-tegning">` : '<div>Tomt canvas</div>'
    insertHtml(`<figure data-canvas-embed="${escapeHtml(pageId)}" contenteditable="false">${image}<figcaption>Canvas · klikk for å redigere</figcaption></figure><p><br></p>`)
  }

  return <div className="mt-5">
    <div className="sticky top-0 z-10 mb-4 flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-black/10 bg-white/95 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#272727]/95" aria-label="Rik tekst-verktøy">
      <ToolbarButton label="Overskrift 1" onClick={() => command('formatBlock', 'h1')}><Heading1 className="size-4" /></ToolbarButton>
      <ToolbarButton label="Overskrift 2" onClick={() => command('formatBlock', 'h2')}><Heading2 className="size-4" /></ToolbarButton>
      <ToolbarButton label="Fet" onClick={() => command('bold')}><Bold className="size-4" /></ToolbarButton>
      <ToolbarButton label="Kursiv" onClick={() => command('italic')}><Italic className="size-4" /></ToolbarButton>
      <ToolbarButton label="Punktliste" onClick={() => command('insertUnorderedList')}><List className="size-4" /></ToolbarButton>
      <ToolbarButton label="Avkryssing" onClick={() => insertHtml('<p data-task="true"><input type="checkbox" contenteditable="false"> Oppgave</p>')}><CheckSquare className="size-4" /></ToolbarButton>
      <ToolbarButton label="Lenke" onClick={addLink}><Link2 className="size-4" /></ToolbarButton>
      <ToolbarButton label="Bilde" onClick={() => imageInput.current?.click()}><ImagePlus className="size-4" /></ToolbarButton>
      <span className="mx-1 h-5 w-px shrink-0 bg-black/10 dark:bg-white/10" />
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void addCanvas()} className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-violet-600 px-2.5 text-xs font-medium text-white hover:bg-violet-700" aria-label="Sett inn canvas"><Palette className="size-3.5" />Canvas</button>
    </div>
    <input ref={imageInput} type="file" className="hidden" accept="image/*" onChange={(event) => { addImage(event.target.files?.[0]); event.target.value = '' }} />
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
      onPaste={(event) => { event.preventDefault(); document.execCommand('insertText', false, event.clipboardData.getData('text/plain')); saveEditor() }}
      onClick={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('[data-canvas-embed]')) onOpenCanvas()
      }}
    />
  </div>
}
