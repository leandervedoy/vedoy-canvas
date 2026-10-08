'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExcalidrawImperativeAPI, LibraryItems } from '@excalidraw/excalidraw/types'
import type { CanvasSnapshot } from '@/components/canvas-editor'
import { BookView } from '@/components/book-view'
import { DesignLibrary } from '@/components/design-library'
import { BoardDock } from '@/components/board-dock'
import { AccessModal, type AccessReason } from '@/components/access-modal'
import { countNotesOfKind, countPagesInCategory, createBookFromTemplate, findBookForNote, findCategoryForNote, FREE_BOOK_LIMITS, type BookTemplateId, type Note } from '@/lib/notebook'
import { getLocalScene, saveLocalScene } from '@/lib/local-scene-store'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { ArrowRight, BookOpen, Brush, ChevronDown, ChevronRight, Circle, Clipboard, Diamond, Download, Eraser, ExternalLink, FileDown, FilePlus2, FileText, FileType2, FileUp, Folder, FolderPlus, Globe2, Hand, HelpCircle, Image as ImageIcon, LibraryBig, List, ListOrdered, LogIn, LogOut, Menu, Minus, Moon, MousePointer2, NotebookTabs, Pencil, Plus, Presentation, Redo2, Save, Square, Star, StickyNote, Sun, Table2, Trash2, Type, Undo2 } from 'lucide-react'
import { WebsiteView, starterWebsiteHtml } from '@/components/website-view'

const CanvasEditor = dynamic(() => import('@/components/canvas-editor').then((module) => module.CanvasEditor), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">Laster tegneflate…</div>,
})

const vedoyLoginUrl = (process.env.NEXT_PUBLIC_VEDOY_LOGIN_URL ?? 'https://vedoy-login.vercel.app').replace(/\/$/, '')
const vedoyApiUrl = (process.env.NEXT_PUBLIC_VEDOY_API_URL?.trim() || vedoyLoginUrl).replace(/\/$/, '')
const vedoyAuthBaseUrl = `${vedoyLoginUrl}/api/auth`
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const clientId = process.env.NEXT_PUBLIC_VEDOY_LOGIN_CLIENT_ID
const cloudBackendReady = Boolean(vedoyApiUrl || (supabaseUrl && supabasePublishableKey))
const authConfigured = Boolean(clientId)
const authTokenKey = 'vedoy-canvas-auth-token-v1'
const authRefreshTokenKey = 'vedoy-canvas-refresh-token-v1'
const authExpiresAtKey = 'vedoy-canvas-token-expires-at-v1'

type ExportFormat = 'svg' | 'png' | 'jpg' | 'clipboard'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function isCanvasSnapshot(value: unknown): value is CanvasSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<CanvasSnapshot>
  return Array.isArray(snapshot.elements) && Boolean(snapshot.appState) && typeof snapshot.appState === 'object' && Boolean(snapshot.files) && typeof snapshot.files === 'object'
}

type WorkspaceSnapshot = CanvasSnapshot & { vedoyNotebook?: Note[] }
const boardId = 'workspace-board'

type VedoyUser = {
  id: string
  email?: string
  plan?: 'free' | 'supporter' | 'supporter_plus'
}

type VedoyBookRow = {
  id: string
  owner_id: string
  title: string
  data: Note
  updated_at: string
}

type VedoyWorkspace = {
  snapshot?: unknown
  books?: VedoyBookRow[]
}

function withBookAccess(book: Note, userId: string): Note {
  const ownerId = book.ownerId ?? userId
  const shared = ownerId !== userId
  const apply = (note: Note): Note => ({ ...note, ownerId, shared, canEdit: true, children: note.children?.map(apply) })
  return apply(book)
}

function cloudBook(row: VedoyBookRow, userId: string): Note {
  return withBookAccess({ ...row.data, id: row.id, title: row.title, ownerId: row.owner_id }, userId)
}

function withoutAccessMetadata(note: Note): Note {
  const { ownerId: _ownerId, shared: _shared, canEdit: _canEdit, ...stored } = note
  return { ...stored, children: note.children?.map(withoutAccessMetadata) }
}

function hasCanvasEmbed(items: Note[], canvasId: string): boolean {
  return items.some((note) => (note.contentHtml?.includes(`data-canvas-embed="${canvasId}"`) ?? false) || hasCanvasEmbed(note.children ?? [], canvasId))
}

function refreshCanvasEmbeds(items: Note[], canvasId: string, preview: string, width?: number, height?: number): Note[] {
  return items.map((note) => {
    let contentHtml = note.contentHtml
    if (contentHtml?.includes(`data-canvas-embed="${canvasId}"`)) {
      const documentCopy = new DOMParser().parseFromString(`<div>${contentHtml}</div>`, 'text/html')
      const root = documentCopy.body.firstElementChild
      for (const figure of Array.from(root?.querySelectorAll('figure[data-canvas-embed]') ?? [])) {
        if (figure.getAttribute('data-canvas-embed') !== canvasId) continue
        let image = figure.querySelector('img')
        if (!image) {
          image = documentCopy.createElement('img')
          image.alt = 'Canvas-tegning'
          figure.insertBefore(image, figure.querySelector('figcaption'))
        }
        image.setAttribute('src', preview)
        if (width) figure.setAttribute('data-canvas-width', String(Math.round(width)))
        if (height) figure.setAttribute('data-canvas-height', String(Math.round(height)))
      }
      contentHtml = root?.innerHTML ?? contentHtml
    }
    return { ...note, contentHtml, children: note.children ? refreshCanvasEmbeds(note.children, canvasId, preview, width, height) : note.children }
  })
}

function resizeCanvasEmbeds(items: Note[], canvasId: string, width: number, height: number): Note[] {
  return items.map((note) => {
    let contentHtml = note.contentHtml
    if (contentHtml?.includes(`data-canvas-embed="${canvasId}"`)) {
      const documentCopy = new DOMParser().parseFromString(`<div>${contentHtml}</div>`, 'text/html')
      const root = documentCopy.body.firstElementChild
      for (const figure of Array.from(root?.querySelectorAll('figure[data-canvas-embed]') ?? [])) {
        if (figure.getAttribute('data-canvas-embed') !== canvasId) continue
        figure.setAttribute('data-canvas-width', String(Math.round(width)))
        figure.setAttribute('data-canvas-height', String(Math.round(height)))
      }
      contentHtml = root?.innerHTML ?? contentHtml
    }
    return { ...note, contentHtml, children: note.children ? resizeCanvasEmbeds(note.children, canvasId, width, height) : note.children }
  })
}

function ensureWorkspaceBoard(items: Note[]): Note[] {
  const boards: Note[] = []
  const separateBoards = (entries: Note[]): Note[] => entries.flatMap((note) => {
    if (note.kind === 'board') {
      boards.push({ ...note, children: undefined })
      return separateBoards(note.children ?? [])
    }
    const children = note.children ? separateBoards(note.children) : undefined
    return [{ ...note, children }]
  })
  const books = separateBoards(items)
  const allBoards = boards.length ? boards : [{ id: boardId, title: 'Skole', kind: 'board' as const }, { id: 'workspace-board-vedoy', title: 'Vedøy Utvikling', kind: 'board' as const }]
  let boardNumber = 0
  const normalizedBoards = allBoards.map((note) => {
    boardNumber += 1
    return note.title === 'Tavle' ? { ...note, title: `Tavle ${boardNumber}` } : note
  })
  return normalizedBoards.some((note) => note.id === boardId) ? [...normalizedBoards, ...books] : [{ id: boardId, title: 'Skole', kind: 'board' }, ...normalizedBoards, ...books]
}

function findNoteInTree(items: Note[], id: string): Note | undefined {
  for (const note of items) {
    if (note.id === id) return note
    const found = findNoteInTree(note.children ?? [], id)
    if (found) return found
  }
}

function isSceneNote(note: Note | undefined): boolean {
  return note?.kind === 'board' || note?.kind === 'canvas' || note?.kind === 'website'
}

function isCanvasNote(note: Note | undefined): boolean {
  return note?.kind === 'board' || note?.kind === 'canvas'
}

function selectedBoardId(items: Note[], preferredId: string | null): string {
  return items.some((note) => note.kind === 'board' && note.id === preferredId) ? preferredId! : boardId
}

function boardSelectionKey(userId: string): string {
  return `vedoy-canvas-active-board-v1-${userId}`
}

function boardSceneKey(userId: string, canvasId: string): string {
  return `${userId}:board:${canvasId}`
}

function mergeNoteTrees(primary: Note[], localDraft: Note[]): Note[] {
  const merge = (current: Note[], drafts: Note[]): Note[] => {
    const result = [...current]
    for (const draft of drafts) {
      const index = result.findIndex((note) => note.id === draft.id)
      if (index < 0) result.push(draft)
      else result[index] = { ...result[index], ...draft, children: merge(result[index].children ?? [], draft.children ?? []) }
    }
    return result
  }
  return merge(primary, localDraft)
}

function findNotePath(items: Note[], id: string, path: Note[] = []): Note[] | undefined {
  for (const note of items) {
    const nextPath = [...path, note]
    if (note.id === id) return nextPath
    const found = findNotePath(note.children ?? [], id, nextPath)
    if (found) return found
  }
}

function collectCanvasNotes(items: Note[]): Note[] {
  return items.flatMap((note) => [...(note.kind === 'canvas' || note.kind === 'frame' ? [note] : []), ...collectCanvasNotes(note.children ?? [])])
}

async function framePreview(snapshot: CanvasSnapshot, frameId: string): Promise<string | null> {
  const withFrameId = (element: CanvasSnapshot['elements'][number]) => (element as typeof element & { customData?: { vedoyFrameId?: string } }).customData?.vedoyFrameId
  const frame = snapshot.elements.find((element) => withFrameId(element) === frameId)
  if (!frame || frame.type !== 'rectangle') return null
  const left = Math.min(frame.x, frame.x + frame.width)
  const top = Math.min(frame.y, frame.y + frame.height)
  const right = Math.max(frame.x, frame.x + frame.width)
  const bottom = Math.max(frame.y, frame.y + frame.height)
  const frameLabelIds = new Set(((frame as typeof frame & { boundElements?: Array<{ id: string; type: string }> }).boundElements ?? []).filter((bound) => bound.type === 'text').map((bound) => bound.id))
  const content = snapshot.elements.filter((element) => element.id !== frame.id && !frameLabelIds.has(element.id) && !element.isDeleted && !withFrameId(element))
  const cropBounds = { ...frame, type: 'frame', x: left, y: top, width: right - left, height: bottom - top, opacity: 0, label: undefined, customData: undefined } as never
  try {
    const { exportToBlob } = await import('@excalidraw/excalidraw')
    const blob = await exportToBlob({ elements: content, exportingFrame: cropBounds, appState: { ...snapshot.appState, exportBackground: true }, files: snapshot.files, mimeType: 'image/png', quality: 0.85, exportPadding: 0 })
    return await blobToDataUrl(blob)
  } catch {
    return null
  }
}

const initialNotes: Note[] = [
  { id: boardId, title: 'Skole', kind: 'board' },
  { id: 'workspace-board-vedoy', title: 'Vedøy Utvikling', kind: 'board' },
  { id: 'canvas', title: 'Idéboken', kind: 'folder', children: [{ id: 'ideas', title: 'Ideer', kind: 'category', children: [{ id: 'research', title: 'Research', kind: 'file', content: 'Samle referanser, lenker og tanker her.' }, { id: 'directions', title: 'Retninger', kind: 'file' }] }] },
  { id: 'launch', title: 'Produktlansering', kind: 'folder', children: [{ id: 'planning', title: 'Planlegging', kind: 'category', children: [{ id: 'timeline', title: 'Tidslinje', kind: 'file' }] }] },
  { id: 'inbox', title: 'Untitled note', kind: 'file' },
]

type NoteDropPosition = 'before' | 'inside' | 'after'

function NoteTree({ notes, activeNote, expanded, boardList = false, onSelect, onToggle, onRename, onFavorite, onDelete, onDrop, onAddChild }: { notes: Note[]; activeNote: string; expanded: string[]; boardList?: boolean; onSelect: (id: string) => void; onToggle: (id: string) => void; onRename: (id: string) => void; onFavorite: (id: string) => void; onDelete: (id: string) => void; onDrop: (targetId: string, draggedId: string, position: NoteDropPosition) => void; onAddChild?: (note: Note, kind: 'book' | 'page' | 'category') => void }) {
  const [dropTarget, setDropTarget] = useState<{ id: string; position: NoteDropPosition } | null>(null)
  const [addMenuFor, setAddMenuFor] = useState<string | null>(null)
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 })
  useEffect(() => {
    if (!addMenuFor) return
    const close = () => setAddMenuFor(null)
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', key)
    }
  }, [addMenuFor])
  return <div className="flex flex-col gap-0.5">{notes.map((note) => {
    const hasChildren = Boolean(note.children?.length)
    const canContain = note.kind === 'folder' || note.kind === 'category' || hasChildren
    const isExpanded = expanded.includes(note.id)
    const ItemIcon = boardList ? StickyNote : note.kind === 'file' ? FileText : note.kind === 'category' ? Folder : BookOpen
    const position = dropTarget?.id === note.id ? (boardList && dropTarget.position === 'inside' ? 'after' : dropTarget.position) : null
    return <div key={note.id}>
      <div draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', note.id) }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; const rect = event.currentTarget.getBoundingClientRect(); const offset = event.clientY - rect.top; const nextPosition = boardList ? (offset < rect.height / 2 ? 'before' : 'after') : offset < rect.height * 0.25 ? 'before' : offset > rect.height * 0.75 ? 'after' : 'inside'; setDropTarget({ id: note.id, position: nextPosition }) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null) }} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const draggedId = event.dataTransfer.getData('text/plain'); if (draggedId && draggedId !== note.id && position) onDrop(note.id, draggedId, position); setDropTarget(null) }} className={`group vedoy-tree-row relative flex items-center gap-1 rounded-lg pr-1 transition-colors ${boardList ? (activeNote === note.id ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-primary/10 bg-background/60 hover:border-primary/30 hover:bg-primary/5') : (activeNote === note.id ? 'bg-muted' : 'hover:bg-muted/70')} ${position === 'inside' ? 'bg-primary/10 ring-2 ring-inset ring-primary/50' : ''} ${position === 'before' ? 'before:absolute before:inset-x-0 before:top-0 before:border-t-2 before:border-primary' : ''} ${position === 'after' ? 'after:absolute after:inset-x-0 after:bottom-0 after:border-b-2 after:border-primary' : ''}`}>
        <button onClick={() => canContain && onToggle(note.id)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground" aria-label={`${isExpanded ? 'Lukk' : 'Åpne'} ${note.title}`} disabled={!canContain}>
          {canContain ? (isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />) : <span className="size-3.5" />}
        </button>
        <button onClick={() => note.kind === 'category' ? onToggle(note.id) : onSelect(note.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-xs font-medium"><ItemIcon className={`size-3.5 shrink-0 ${boardList && activeNote === note.id ? 'text-primary-foreground' : note.kind === 'category' ? 'text-amber-600' : 'text-muted-foreground'}`} /><span className="truncate">{note.title}</span></button>
        {!boardList && onAddChild && <div className="relative"><button onClick={(event) => { event.stopPropagation(); const rect = event.currentTarget.getBoundingClientRect(); setMenuPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 160)), top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 132)) }); setAddMenuFor((current) => current === note.id ? null : note.id) }} className={`flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-background hover:text-foreground focus:opacity-100 ${addMenuFor === note.id ? 'bg-background opacity-100' : 'opacity-0 group-hover:opacity-100'}`} aria-label={`Legg til under ${note.title}`} title={`Legg til under ${note.title}`} aria-expanded={addMenuFor === note.id}><Plus className="size-3" /></button>
          {addMenuFor === note.id && createPortal(<div style={menuPosition} className="vedoy-popover fixed z-[100] w-36 rounded-xl border border-border bg-card p-1 shadow-xl" role="menu" aria-label={`Legg til under ${note.title}`}>
            {([{ kind: 'book' as const, label: 'Ny bok', icon: BookOpen }, { kind: 'page' as const, label: 'Ny side', icon: FileText }, { kind: 'category' as const, label: 'Ny kategori', icon: Folder }]).map(({ kind, label, icon: Icon }) => <button key={kind} type="button" role="menuitem" onClick={(event) => { event.stopPropagation(); setAddMenuFor(null); onAddChild(note, kind) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted"><Icon className="size-3.5 text-muted-foreground" />{label}</button>)}
          </div>, document.body)}
        </div>}
        <button onClick={() => onFavorite(note.id)} className={`flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-background ${note.favorite ? 'text-yellow-500' : 'text-muted-foreground opacity-0 group-hover:opacity-100'}`} aria-label={note.favorite ? `Fjern ${note.title} fra favoritter` : `Merk ${note.title} som favoritt`}><Star className="size-3" fill={note.favorite ? 'currentColor' : 'none'} /></button>
        <button onClick={() => onRename(note.id)} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Rediger navnet på ${note.title}`} title="Rediger navn"><Pencil className="size-3" /></button>
        {!(boardList && note.id === boardId) && <button onClick={() => onDelete(note.id)} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label={`Slett ${note.title}`} title="Slett"><Trash2 className="size-3" /></button>}
      </div>
      {hasChildren && isExpanded && <div className="ml-4 border-l border-border/70 pl-2"><NoteTree notes={note.children ?? []} activeNote={activeNote} expanded={expanded} onSelect={onSelect} onToggle={onToggle} onRename={onRename} onFavorite={onFavorite} onDelete={onDelete} onDrop={onDrop} onAddChild={onAddChild} /></div>}
    </div>
  })}</div>
}

function encodeBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function vedoyEndpoint(path: string) {
  return vedoyApiUrl ? `${vedoyApiUrl}${path.startsWith('/') ? path : `/${path}`}` : null
}

function getStoredAccessToken() {
  try {
    return window.localStorage.getItem(authTokenKey)
  } catch {
    return null
  }
}

function clearStoredTokens() {
  try {
    window.localStorage.removeItem(authTokenKey)
    window.localStorage.removeItem(authRefreshTokenKey)
    window.localStorage.removeItem(authExpiresAtKey)
  } catch {
    // Some privacy modes block local storage writes.
  }
}

async function getFreshAccessToken() {
  const token = getStoredAccessToken()
  if (!token || typeof window === 'undefined') return token
  const expiresAt = Number(window.localStorage.getItem(authExpiresAtKey) || 0)
  if (!expiresAt || expiresAt > Date.now() + 60_000) return token
  const refreshToken = window.localStorage.getItem(authRefreshTokenKey)
  if (!refreshToken || !clientId) return token
  const response = await fetch(`${vedoyAuthBaseUrl}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId }),
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null) as { access_token?: string; refresh_token?: string; expires_in?: number } | null
  if (!response.ok || !data?.access_token) { clearStoredTokens(); return null }
  window.localStorage.setItem(authTokenKey, data.access_token)
  if (data.refresh_token) window.localStorage.setItem(authRefreshTokenKey, data.refresh_token)
  if (data.expires_in) window.localStorage.setItem(authExpiresAtKey, String(Date.now() + data.expires_in * 1000))
  return data.access_token
}

async function vedoyFetch<T>(path: string, init: RequestInit = {}, accessToken?: string | null): Promise<T> {
  const endpoint = vedoyEndpoint(path)
  if (!endpoint) throw new Error('Vedøy norsk database er ikke konfigurert.')
  const token = accessToken === undefined ? await getFreshAccessToken() : accessToken
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(endpoint, { ...init, headers, cache: 'no-store' })
  const data = await response.json().catch(() => null) as T | { error?: string; message?: string } | null
  if (!response.ok) {
    const message = data && typeof data === 'object' && ('error' in data || 'message' in data)
      ? String((data as { error?: string; message?: string }).error ?? (data as { message?: string }).message)
      : 'Vedøy database svarte ikke.'
    throw new Error(message)
  }
  return data as T
}

async function supabaseDataFetch<T>(path: string, init: RequestInit = {}, accessToken?: string | null): Promise<T> {
  const token = accessToken === undefined ? await getFreshAccessToken() : accessToken
  if (!supabaseUrl || !supabasePublishableKey || !token) throw new Error('Supabase-lagring er ikke konfigurert.')
  const headers = new Headers(init.headers)
  headers.set('apikey', supabasePublishableKey)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { ...init, headers, cache: 'no-store' })
  if (!response.ok) throw new Error(`Supabase-lagring svarte ${response.status}.`)
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

async function loadVedoyUser(accessToken?: string | null): Promise<VedoyUser | null> {
  const token = accessToken === undefined ? await getFreshAccessToken() : accessToken
  if (!token) return null
  try {
    const response = await fetch(`${vedoyAuthBaseUrl}/oauth2/userinfo`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    if (!response.ok) throw new Error('Vedøy Login-tokenet er ugyldig.')
    const data = await response.json() as { sub?: string; email?: string; name?: string; plan?: string }
    if (!data.sub) throw new Error('Vedøy Login-tokenet mangler konto-ID.')
    const plan = ['supporter', 'supporter_plus'].includes(String(data.plan ?? '')) ? data.plan as VedoyUser['plan'] : 'free'
    return { id: data.sub, email: data.email, plan }
  } catch {
    clearStoredTokens()
    return null
  }
}

async function loadVedoyWorkspace() {
  if (!vedoyApiUrl) {
    const rows = await supabaseDataFetch<Array<{ snapshot: unknown }>>('canvas_documents?select=snapshot&limit=1')
    return { snapshot: rows[0]?.snapshot }
  }
  return vedoyFetch<VedoyWorkspace>('/api/v1/canvas/workspace')
}

async function saveVedoyWorkspace(snapshot: WorkspaceSnapshot, userId: string) {
  if (!vedoyApiUrl) {
    await supabaseDataFetch('canvas_documents?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: userId, snapshot, updated_at: new Date().toISOString() }) })
    return
  }
  await vedoyFetch('/api/v1/canvas/workspace', { method: 'PUT', body: JSON.stringify({ snapshot }) })
}

async function saveVedoyBooks(books: Note[], userId: string) {
  if (!vedoyApiUrl) return
  await vedoyFetch('/api/v1/canvas/books', {
    method: 'PUT',
    body: JSON.stringify({
      books: books.map((book) => ({
        id: book.id,
        owner_id: book.ownerId ?? userId,
        title: book.title,
        data: withoutAccessMetadata(book),
        updated_at: new Date().toISOString(),
      })),
    }),
  })
}

async function startLogin() {
  const callbackUrl = `${window.location.origin}/auth/callback`
  if (!clientId) throw new Error('Vedøy Login-klient er ikke konfigurert.')
  const verifier = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = encodeBase64Url(new Uint8Array(digest))
  const state = encodeBase64Url(crypto.getRandomValues(new Uint8Array(24)))
  sessionStorage.setItem('vedoy_login_verifier', verifier)
  sessionStorage.setItem('vedoy_login_state', state)
  const url = new URL(`${vedoyAuthBaseUrl}/oauth2/authorize`)
  const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: callbackUrl, state, code_challenge: challenge, code_challenge_method: 'S256', scope: 'openid email profile' })
  url.search = params.toString()
  window.location.assign(url.toString())
}

export default function Page() {
  const [viewMode, setViewMode] = useState<'canvas' | 'book' | 'website'>('book')
  const [user, setUser] = useState<VedoyUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [savePromptOpen, setSavePromptOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginPending, setLoginPending] = useState(false)
  const [loginMessage, setLoginMessage] = useState<string | null>(null)
  const [darkMode, setDarkMode] = useState(false)
  const [syncState, setSyncState] = useState<'waiting' | 'loading' | 'saved' | 'error'>('waiting')
  const [initialSnapshot, setInitialSnapshot] = useState<CanvasSnapshot | null | undefined>(undefined)
  const [notebookOpen, setNotebookOpen] = useState(true)
  const headerRef = useRef<HTMLElement | null>(null)
  const [headerHeight, setHeaderHeight] = useState(72)
  useEffect(() => {
    const header = headerRef.current
    if (!header) return
    const observer = new ResizeObserver(() => setHeaderHeight(header.getBoundingClientRect().height))
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1099px)')
    if (media.matches) setNotebookOpen(false)
  }, [])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [libraryItems, setLibraryItems] = useState<LibraryItems>([])
  const [designLibraryOpen, setDesignLibraryOpen] = useState(false)
  const [accessReason, setAccessReason] = useState<AccessReason | null>(null)
  const [notes, setNotes] = useState(initialNotes)
  const [activeNote, setActiveNote] = useState(boardId)
  const [activeCanvasId, setActiveCanvasId] = useState(boardId)
  const [activeWebsiteId, setActiveWebsiteId] = useState<string | undefined>()
  const [newBoardItemType, setNewBoardItemType] = useState<'website' | null>(null)
  const [newBoardItemTitle, setNewBoardItemTitle] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [draftNoteTitle, setDraftNoteTitle] = useState('')
  const [nameDialog, setNameDialog] = useState<{ id: string; kind: 'bok' | 'side' | 'kategori' | 'tavle' } | null>(null)
  const [expanded, setExpanded] = useState(['canvas', 'launch'])
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const notebookSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localNotesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorApi = useRef<ExcalidrawImperativeAPI | null>(null)
  const notesRef = useRef(notes)
  const activeNoteRef = useRef(activeNote)
  const activeCanvasIdRef = useRef(activeCanvasId)
  const bookReturnPageRef = useRef('research')
  const sceneInput = useRef<HTMLInputElement | null>(null)
  const libraryInput = useRef<HTMLInputElement | null>(null)
  const websites = notes.filter((note) => note.kind === 'website')
  const personalLibraryItems = libraryItems.map((item, index) => ({ id: `library-${item.id}`, title: item.name || `Bibliotekelement ${index + 1}` }))
  const bookNotes = notes.filter((note) => note.kind !== 'board' && (note.kind === 'folder' || note.kind === 'file' || Boolean(note.children)))
  const canvasNotes = notes.filter((note) => note.kind === 'board')
  const plan = user?.plan ?? 'free'
  const isSupporter = plan === 'supporter' || plan === 'supporter_plus'
  const requireLogin = () => { if (user) return true; setAccessReason('login'); return false }

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  const startSupporterCheckout = async () => {
    const token = await getFreshAccessToken()
    if (!token) {
      setAccessReason('login')
      throw new Error('Logg inn med Vedøy før du starter et abonnement.')
    }
    const response = await fetch(`${vedoyLoginUrl}/api/stripe/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
    })
    const data = await response.json().catch(() => null) as { url?: string; error?: string } | null
    if (!response.ok || !data?.url) throw new Error(data?.error || 'Betalingsløsningen er ikke konfigurert ennå.')
    window.location.assign(data.url)
  }

  const openLogin = () => {
    setLoginMessage(null)
    setLoginOpen(true)
  }

  const submitGithubLogin = async () => {
    setLoginPending(true)
    setLoginMessage(null)
    try {
      await startLogin()
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : 'Vedøy-innloggingen kunne ikke startes.')
      setLoginPending(false)
    }
  }

  const updateNoteTree = (items: Note[], id: string, updater: (note: Note) => Note): Note[] => items.map((note) => note.id === id ? updater(note) : { ...note, children: note.children ? updateNoteTree(note.children, id, updater) : note.children })

  const beginRename = (id: string) => {
    const note = findNoteInTree(notes, id)
    if (note) { setEditingNoteId(id); setDraftNoteTitle(note.title); setNameDialog({ id, kind: note.kind === 'board' ? 'tavle' : note.kind === 'category' ? 'kategori' : note.kind === 'file' ? 'side' : 'bok' }); if (note.kind !== 'board' && note.kind !== 'category') setActiveNote(id) }
  }

  const findNote = (items: Note[], id: string): Note | undefined => items.reduce<Note | undefined>((found, item) => found ?? (item.id === id ? item : findNote(item.children ?? [], id)), undefined)

  const openNote = async (id: string) => {
    const target = findNote(notesRef.current, id)
    if (!target) return
    const nextCanvas = isCanvasNote(target)
    const switchingCanvas = nextCanvas && id !== activeCanvasIdRef.current
    if (switchingCanvas || (viewMode === 'canvas' && !nextCanvas)) {
      const api = editorApi.current
      const currentCanvasId = activeCanvasIdRef.current
      if (api && isCanvasNote(findNoteInTree(notesRef.current, currentCanvasId))) {
        const pendingSave = saveTimers.current.get(currentCanvasId)
        if (pendingSave) clearTimeout(pendingSave)
        saveTimers.current.delete(currentCanvasId)
        const { serializeAsJSON } = await import('@excalidraw/excalidraw')
        const currentSnapshot = JSON.parse(serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'database')) as CanvasSnapshot
        const updatedNotes = updateNoteTree(notesRef.current, currentCanvasId, (note) => ({ ...note, snapshot: currentSnapshot }))
        notesRef.current = updatedNotes
        setNotes(updatedNotes)
        void saveLocalScene(boardSceneKey(user?.id ?? 'anonymous', currentCanvasId), currentSnapshot)
      }
    }
    if (switchingCanvas) {
      activeCanvasIdRef.current = id
      setActiveCanvasId(id)
      const freshTarget = findNoteInTree(notesRef.current, id)
      const storedScene = isCanvasSnapshot(freshTarget?.snapshot) ? freshTarget.snapshot : await getLocalScene(boardSceneKey(user?.id ?? 'anonymous', id))
      setInitialSnapshot(storedScene)
      if (target.kind === 'board') window.localStorage.setItem(boardSelectionKey(user?.id ?? 'anonymous'), id)
    }
    activeNoteRef.current = id
    setActiveNote(id)
  }

  const saveNoteTitle = () => {
    const title = draftNoteTitle.trim()
    if (!editingNoteId || !title) return
    const editing = findNoteInTree(notesRef.current, editingNoteId)
    let updatedNotes = updateNoteTree(notesRef.current, editingNoteId, (note) => ({ ...note, title }))
    if (editing?.kind === 'frame') {
      const renameFrameLabel = (elements: CanvasSnapshot['elements']) => {
        const frame = elements.find((element) => (element as typeof element & { customData?: { vedoyFrameId?: string } }).customData?.vedoyFrameId === editingNoteId)
        if (!frame) return elements
        const textIds = new Set(((frame as typeof frame & { boundElements?: Array<{ id: string; type: string }> }).boundElements ?? []).filter((bound) => bound.type === 'text').map((bound) => bound.id))
        return elements.map((element) => textIds.has(element.id) && 'text' in element ? ({ ...element, text: `RAMME\n${title}` } as typeof element) : element)
      }
      const updateFrameLabel = (snapshot?: CanvasSnapshot) => snapshot ? ({ ...snapshot, elements: renameFrameLabel(snapshot.elements) }) : snapshot
      updatedNotes = updateNoteTree(updatedNotes, boardId, (note) => ({ ...note, snapshot: updateFrameLabel(note.snapshot) }))
      if (activeNoteRef.current === boardId && editorApi.current) {
        editorApi.current.updateScene({ elements: renameFrameLabel(editorApi.current.getSceneElements()) })
      }
    }
    notesRef.current = updatedNotes
    setNotes(updatedNotes)
    setEditingNoteId(null)
    setNameDialog(null)
  }

  const addBook = () => {
    if (!requireLogin()) return
    if (plan === 'free' && bookNotes.filter(note => note.kind === 'folder').length >= FREE_BOOK_LIMITS.books) { setAccessReason('limit'); return }
    const id = `book-${Date.now()}`
    setNotes((current) => [...current, { id, title: 'Ny bok', kind: 'folder', children: [], ownerId: user?.id, canEdit: true }])
    setActiveNote(id); setEditingNoteId(id); setDraftNoteTitle('Ny bok'); setNameDialog({ id, kind: 'bok' }); setAddMenuOpen(false)
  }

  const addTemplate = (templateId: BookTemplateId) => {
    if (!requireLogin()) return
    if (plan === 'free' && bookNotes.filter(note => note.kind === 'folder').length >= FREE_BOOK_LIMITS.books) { setAccessReason('limit'); return }
    const book = { ...createBookFromTemplate(templateId), ownerId: user?.id, canEdit: true }
    const firstPage = book.children?.[0]?.children?.[0]
    setNotes((current) => [...current, book])
    setExpanded((current) => [...new Set([...current, book.id, ...(book.children?.map((section) => section.id) ?? [])])])
    setActiveNote(firstPage?.id ?? book.id)
    notify(`${book.title} er opprettet`)
  }

  const addPage = (parentId?: string) => {
    if (!requireLogin()) return
    const notesNow = notesRef.current
    const book = parentId ? findBookForNote(notesNow, parentId) : undefined
    let parentCategory = parentId ? findCategoryForNote(notesNow, parentId) : undefined
    if (book && !parentCategory) {
      parentCategory = book.children?.find((child) => child.kind === 'category')
      if (!parentCategory && plan === 'free' && countNotesOfKind([book], 'category') >= FREE_BOOK_LIMITS.categoriesPerBook) {
        setAccessReason('limit')
        return
      }
    }
    if (book && parentCategory && plan === 'free' && countPagesInCategory(parentCategory) >= FREE_BOOK_LIMITS.pagesPerCategory) {
      setAccessReason('limit')
      return
    }
    const id = `note-${Date.now()}`
    const newNote = { id, title: 'Ny side', kind: 'file' as const }
    if (parentId && findNoteInTree(notesRef.current, parentId)?.kind === 'board') return
    if (!parentId) setNotes((current) => [...current, newNote])
    else {
      const targetId = parentCategory && findNoteInTree(notesNow, parentId)?.kind !== 'category' ? parentCategory.id : parentId
      const append = (items: Note[]): Note[] => items.map((note) => note.id === targetId ? { ...note, children: [...(note.children ?? []), newNote] } : { ...note, children: note.children ? append(note.children) : note.children })
      if (book && !parentCategory) {
        const category: Note = { id: `category-${Date.now()}`, title: 'Generelt', kind: 'category', children: [newNote] }
        setNotes(updateNoteTree(notesNow, book.id, (note) => ({ ...note, children: [...(note.children ?? []), category] })))
        setExpanded((current) => [...new Set([...current, book.id, category.id])])
      } else {
        setNotes(append)
        setExpanded((current) => current.includes(targetId) ? current : [...current, targetId])
      }
    }
    setActiveNote(id); setEditingNoteId(id); setDraftNoteTitle('Ny side'); setNameDialog({ id, kind: 'side' }); setAddMenuOpen(false)
  }

  const pageParentForSelection = () => {
    const tree = notesRef.current
    const active = findNoteInTree(tree, activeNoteRef.current)
    const anchor = active && (active.kind === 'folder' || active.kind === 'file')
      ? active
      : findNoteInTree(tree, bookReturnPageRef.current)
    const path = anchor ? findNotePath(tree, anchor.id) : undefined
    if (!anchor || !path) return undefined
    if (anchor.kind === 'folder') return anchor.id
    return path.length > 1 ? path[path.length - 2].id : undefined
  }

  const addSubpage = () => {
    const active = findNoteInTree(notesRef.current, activeNoteRef.current)
    const targetId = active && (active.kind === 'folder' || active.kind === 'file') ? active.id : bookReturnPageRef.current
    addPage(targetId)
  }

  const addFolder = (parentId?: string, title = 'Ny bok') => {
    if (!requireLogin()) return
    if (!parentId && plan === 'free' && bookNotes.filter((note) => note.kind === 'folder').length >= FREE_BOOK_LIMITS.books) { setAccessReason('limit'); return }
    const id = `folder-${Date.now()}`
    const newFolder: Note = { id, title, kind: 'folder', children: [] }
    if (parentId && findNoteInTree(notesRef.current, parentId)?.kind === 'board') return
    if (!parentId) setNotes((current) => [...current, newFolder])
    else setNotes((current) => updateNoteTree(current, parentId, (note) => ({ ...note, children: [...(note.children ?? []), newFolder] })))
    if (parentId) setExpanded((current) => current.includes(parentId) ? current : [...current, parentId])
    setActiveNote(id); setEditingNoteId(id); setDraftNoteTitle(title); setNameDialog({ id, kind: 'bok' }); setAddMenuOpen(false)
  }

  const addSubfolder = () => addFolder(activeNote)

  const addCategory = (parentId?: string) => {
    if (!requireLogin()) return
    const book = parentId ? findBookForNote(notesRef.current, parentId) : undefined
    if (book && plan === 'free' && countNotesOfKind([book], 'category') >= FREE_BOOK_LIMITS.categoriesPerBook) { setAccessReason('limit'); return }
    const id = `category-${Date.now()}`
    const category: Note = { id, title: 'Ny kategori', kind: 'category', children: [] }
    if (parentId && findNoteInTree(notesRef.current, parentId)?.kind === 'board') return
    if (!parentId) setNotes((current) => [...current, category])
    else setNotes((current) => updateNoteTree(current, parentId, (note) => ({ ...note, children: [...(note.children ?? []), category] })))
    if (parentId) setExpanded((current) => current.includes(parentId) ? current : [...current, parentId])
    setEditingNoteId(id)
    setDraftNoteTitle('Ny kategori')
    setNameDialog({ id, kind: 'kategori' })
  }

  const addNavigatorChild = (note: Note, kind: 'book' | 'page' | 'category') => {
    if (kind === 'book') addFolder(note.id, 'Ny bok')
    else if (kind === 'category') addCategory(note.id)
    else addPage(note.id)
  }

  const addSection = (bookId: string) => {
    if (!requireLogin()) return
    const book = findBookForNote(notesRef.current, bookId)
    if (book && plan === 'free' && countNotesOfKind([book], 'category') >= FREE_BOOK_LIMITS.categoriesPerBook) { setAccessReason('limit'); return }
    const id = `section-${Date.now()}`
    const section: Note = { id, title: 'Ny seksjon', kind: 'category', children: [] }
    if (findNoteInTree(notesRef.current, bookId)?.kind === 'board') return
    setNotes((current) => updateNoteTree(current, bookId, (note) => ({ ...note, children: [...(note.children ?? []), section] })))
    setExpanded((current) => current.includes(bookId) ? current : [...current, bookId])
    setActiveNote(id)
    setEditingNoteId(id)
    setDraftNoteTitle('Ny seksjon')
    setNameDialog({ id, kind: 'kategori' })
  }

  const updateNote = (id: string, changes: Partial<Note>) => {
    setNotes((current) => updateNoteTree(current, id, (note) => ({ ...note, ...changes })))
  }

  const toggleFavorite = (id: string) => setNotes((current) => updateNoteTree(current, id, (note) => ({ ...note, favorite: !note.favorite })))

  const deleteNote = async (id: string) => {
    const find = (items: Note[]): Note | undefined => {
      for (const item of items) {
        if (item.id === id) return item
        const child = find(item.children ?? [])
        if (child) return child
      }
    }
    const note = find(notes)
    if (note?.kind === 'board' && id === boardId) return
    if (!note || !window.confirm(`Slette ${note.title}?`)) return
    if (note.kind === 'board' && activeCanvasIdRef.current === id) await goToCanvasBoard(boardId)
    const remove = (items: Note[]): Note[] => items.filter((item) => item.id !== id).map((item) => ({ ...item, children: item.children ? remove(item.children) : item.children }))
    const updated = remove(notesRef.current)
    notesRef.current = updated
    setNotes(updated)
    if (activeNoteRef.current === id) { activeNoteRef.current = boardId; setActiveNote(boardId) }
  }

  const moveNote = (targetId: string, draggedId: string, position: NoteDropPosition) => {
    const current = notesRef.current
    const targetNote = findNoteInTree(current, targetId)
    const draggedNote = findNoteInTree(current, draggedId)
    if (!targetNote || !draggedNote || (targetNote.kind === 'board') !== (draggedNote.kind === 'board')) return
    if (draggedNote.kind === 'board' && position === 'inside') return
    const contains = (items: Note[], parentId: string, childId: string): boolean => items.some((item) => item.id === parentId && (item.children ?? []).some((child) => child.id === childId || contains([child], child.id, childId)))
    if (targetId === draggedId || contains(current, draggedId, targetId)) return
    let dragged: Note | undefined
    const withoutDragged = (items: Note[]): Note[] => items.flatMap((item) => {
      if (item.id === draggedId) { dragged = item; return [] }
      return [{ ...item, children: item.children ? withoutDragged(item.children) : item.children }]
    })
    const removed = withoutDragged(current)
    if (!dragged) return

    let inserted = false
    const place = (items: Note[]): Note[] => {
      if (position === 'inside') return items.map((item) => {
        if (item.id === targetId) {
          inserted = true
          return { ...item, children: [...(item.children ?? []), dragged!] }
        }
        return item.children ? { ...item, children: place(item.children) } : item
      })
      return items.flatMap((item) => {
        if (item.id === targetId) {
          inserted = true
          return position === 'before' ? [dragged!, item] : [item, dragged!]
        }
        return [{ ...item, children: item.children ? place(item.children) : item.children }]
      })
    }
    const updated = place(removed)
    if (!inserted) return
    notesRef.current = updated
    setNotes(updated)
    if (position === 'inside') setExpanded((currentExpanded) => currentExpanded.includes(targetId) ? currentExpanded : [...currentExpanded, targetId])
  }

  const toggleExpanded = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const selectNavigatorNote = async (id: string) => {
    const note = findNoteInTree(notesRef.current, id)
    if (!note) return
    if (note.kind === 'board') { await goToCanvasBoard(note.id); return }
    if (note.kind === 'frame') { await openCanvasFrame(id); return }
    if (note.kind === 'canvas') { openCanvasObject(id); return }
    if (note.kind === 'website') { openWebsite(id); return }
    const firstPageId = (item: Note): string | undefined => item.kind === 'file' ? item.id : item.children?.map(firstPageId).find(Boolean)
    const pageId = note.kind === 'file' ? note.id : firstPageId(note)
    if (pageId) {
      bookReturnPageRef.current = pageId
      await openNote(pageId)
    }
    changeView('book')
  }

  const changeView = (nextView: 'canvas' | 'book' | 'website') => {
    setViewMode(nextView)
    setAddMenuOpen(false)
    setActionsOpen(false)
    setHelpOpen(false)
    setEditingNoteId(null)
    setNameDialog(null)
    editorApi.current?.toggleSidebar({ name: null, force: false })
  }
  const requestWebsite = () => {
    if (!user || !isSupporter) { setAccessReason('website'); return }
    changeView('website')
  }

  const goToCanvasBoard = async (targetBoardId: string) => {
    if (activeCanvasIdRef.current !== targetBoardId || activeNoteRef.current !== targetBoardId) await openNote(targetBoardId)
    changeView('canvas')
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const api = editorApi.current
      if (api?.getSceneElements().length) api.scrollToContent(undefined, { fitToContent: true, animate: false })
    }))
  }

  const goToBoard = async () => goToCanvasBoard(activeCanvasIdRef.current)

  const addBoard = async () => {
    if (!requireLogin()) return
    const id = `workspace-board-${Date.now()}`
    let number = 1
    while (canvasNotes.some((note) => note.title === `Tavle ${number}`)) number += 1
    const title = `Tavle ${number}`
    const updated = [...notesRef.current, { id, title, kind: 'board' as const }]
    notesRef.current = updated
    setNotes(updated)
    await goToCanvasBoard(id)
    notify(`«${title}» er opprettet`)
  }

  const goToBooks = async () => {
    if (findNoteInTree(notesRef.current, bookReturnPageRef.current)) await openNote(bookReturnPageRef.current)
    changeView('book')
  }

  const createBoardItem = async () => {
    if (!newBoardItemType) return
    const title = newBoardItemTitle.trim() || 'Ny nettside'
    const id = `website-${Date.now()}`
    const note: Note = { id, title, kind: 'website', websiteHtml: starterWebsiteHtml(title) }
    const updatedNotes = [...notesRef.current, note]
    notesRef.current = updatedNotes
    setNotes(updatedNotes)
    setNewBoardItemType(null)
    setNewBoardItemTitle('')
    setActiveWebsiteId(id)
    changeView('website')
    notify(`Nettsiden «${title}» er opprettet`)
  }

  const bookTextCommand = (name: string, value?: string) => {
    document.execCommand(name, false, value)
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) selection.getRangeAt(0).commonAncestorContainer.parentElement?.closest('[contenteditable]')?.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'formatBlock' }))
  }

  const bookTextInsert = (html: string) => {
    const selection = window.getSelection()
    if (!selection?.rangeCount) return
    document.execCommand('insertHTML', false, html)
    document.querySelector('[contenteditable="true"]')?.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
  }

  const historyShortcut = (redo = false) => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: !isMac, metaKey: isMac, shiftKey: redo, bubbles: true }))
  }

  useEffect(() => {
    let cancelled = false
    const initializeAuth = async () => {
      const nextUser = await loadVedoyUser()
      if (cancelled) return
      setUser(nextUser)
      setAuthReady(true)
    }
    void initializeAuth()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.documentElement.classList.toggle('light', !darkMode)
  }, [darkMode])

  useEffect(() => {
    activeNoteRef.current = activeNote
  }, [activeNote])

  useEffect(() => {
    if (initialSnapshot === undefined) return
    notesRef.current = notes
    if (localNotesTimer.current) clearTimeout(localNotesTimer.current)
    localNotesTimer.current = setTimeout(() => {
      try { window.localStorage.setItem(`vedoy-canvas-notes-v1-${user?.id ?? 'anonymous'}`, JSON.stringify(notes)) } catch { /* Optional device-local preference. */ }
    }, 250)
    return () => { if (localNotesTimer.current) clearTimeout(localNotesTimer.current) }
  }, [initialSnapshot, notes, user?.id])

  useEffect(() => {
    if (!authReady) return
    let cancelled = false

    const initialize = async () => {
      editorApi.current = null
      if (!user || !cloudBackendReady) {
        let localNotes = initialNotes
        try {
          const storedNotes = window.localStorage.getItem(`vedoy-canvas-notes-v1-${user?.id ?? 'anonymous'}`)
          const parsedNotes = storedNotes ? JSON.parse(storedNotes) : null
          if (Array.isArray(parsedNotes)) {
            localNotes = ensureWorkspaceBoard(parsedNotes)
          }
        } catch { /* Use the starter notebook if local storage is unavailable. */ }
        const selectedId = selectedBoardId(localNotes, window.localStorage.getItem(boardSelectionKey('anonymous')))
        const boardSnapshot = findNoteInTree(localNotes, selectedId)?.snapshot
        const storedScene = await getLocalScene(boardSceneKey('anonymous', selectedId))
        const hasOtherBoardSnapshot = localNotes.some((note) => note.kind === 'board' && note.id !== boardId && isCanvasSnapshot(note.snapshot))
        const legacyScene = selectedId === boardId && !hasOtherBoardSnapshot ? await getLocalScene('anonymous') : null
        if (cancelled) return
        const resolvedScene = isCanvasSnapshot(boardSnapshot) ? boardSnapshot : storedScene ?? legacyScene
        if (resolvedScene && !isCanvasSnapshot(boardSnapshot)) localNotes = updateNoteTree(localNotes, selectedId, (note) => ({ ...note, snapshot: resolvedScene }))
        notesRef.current = localNotes
        setNotes(localNotes)
        activeCanvasIdRef.current = selectedId
        setActiveCanvasId(selectedId)
        setInitialSnapshot(resolvedScene)
        setSyncState('waiting')
        return
      }

      setInitialSnapshot(undefined)
      setSyncState('loading')
      let workspace: VedoyWorkspace = {}
      let loadError = false
      try {
        workspace = await loadVedoyWorkspace()
      } catch {
        loadError = true
      }
      if (cancelled) return
      if (loadError) {
        setInitialSnapshot(null)
        setSyncState('error')
        return
      }
      const storedSnapshot = isCanvasSnapshot(workspace.snapshot) ? workspace.snapshot as WorkspaceSnapshot : null
      const legacyNotes = ensureWorkspaceBoard(Array.isArray(storedSnapshot?.vedoyNotebook) ? storedSnapshot.vedoyNotebook : initialNotes)
      const saveLocalDraft = window.sessionStorage.getItem('vedoy-save-local-draft') === 'true'
      window.sessionStorage.removeItem('vedoy-save-local-draft')
      let localDraftNotes: Note[] = []
      if (saveLocalDraft) {
        try {
          const local = JSON.parse(window.localStorage.getItem('vedoy-canvas-notes-v1-anonymous') ?? 'null')
          if (Array.isArray(local)) localDraftNotes = ensureWorkspaceBoard(local)
        } catch { /* A damaged local draft must not block login. */ }
      }
      let workspaceNotes: Note[]
      if (workspace.books?.length) {
        const cloudBooks = workspace.books.map((book) => cloudBook(book, user.id))
        const loosePages = legacyNotes.filter((note) => note.kind === 'file' && !note.children)
        const workspaceItems = legacyNotes.filter((note) => note.kind === 'board' || note.kind === 'canvas' || note.kind === 'frame' || note.kind === 'website')
        const combined = [...cloudBooks, ...workspaceItems, ...loosePages]
        workspaceNotes = saveLocalDraft ? mergeNoteTrees(combined, localDraftNotes) : combined
      } else {
        const combined = legacyNotes.map((note) => note.kind === 'folder' || note.children ? withBookAccess(note, user.id) : note)
        workspaceNotes = saveLocalDraft ? mergeNoteTrees(combined, localDraftNotes) : combined
      }
      const preferredId = window.localStorage.getItem(boardSelectionKey(user.id)) ?? (saveLocalDraft ? window.localStorage.getItem(boardSelectionKey('anonymous')) : null)
      const selectedId = selectedBoardId(workspaceNotes, preferredId)
      const boardSnapshot = findNoteInTree(workspaceNotes, selectedId)?.snapshot
      const localScene = saveLocalDraft ? await getLocalScene(boardSceneKey('anonymous', selectedId)) : null
      const storedBoardScene = await getLocalScene(boardSceneKey(user.id, selectedId))
      const hasOtherBoardSnapshot = workspaceNotes.some((note) => note.kind === 'board' && note.id !== boardId && isCanvasSnapshot(note.snapshot))
      const legacyLocalScene = saveLocalDraft && selectedId === boardId && !hasOtherBoardSnapshot ? await getLocalScene('anonymous') : null
      if (cancelled) return
      const resolvedScene = isCanvasSnapshot(localScene) ? localScene : isCanvasSnapshot(boardSnapshot) ? boardSnapshot : storedBoardScene ?? legacyLocalScene ?? (selectedId === boardId && !hasOtherBoardSnapshot ? storedSnapshot : null)
      if (resolvedScene && !isCanvasSnapshot(boardSnapshot)) workspaceNotes = updateNoteTree(workspaceNotes, selectedId, (note) => ({ ...note, snapshot: resolvedScene }))
      notesRef.current = workspaceNotes
      setNotes(workspaceNotes)
      activeCanvasIdRef.current = selectedId
      setActiveCanvasId(selectedId)
      setInitialSnapshot(resolvedScene)
      setSyncState(storedSnapshot ? 'saved' : 'waiting')
    }

    initialize()
    return () => {
      cancelled = true
      for (const timer of saveTimers.current.values()) clearTimeout(timer)
      saveTimers.current.clear()
    }
  }, [authReady, user])

  const saveScene = useCallback((canvasId: string, snapshot: CanvasSnapshot) => {
    const previousTimer = saveTimers.current.get(canvasId)
    if (previousTimer) clearTimeout(previousTimer)
    const timer = setTimeout(async () => {
      saveTimers.current.delete(canvasId)
      if (!isSceneNote(findNoteInTree(notesRef.current, canvasId))) return
      let updatedNotes = updateNoteTree(notesRef.current, canvasId, (note) => ({ ...note, snapshot }))
      if (findNoteInTree(updatedNotes, canvasId)?.kind === 'board') {
        for (const element of snapshot.elements) {
          const customData = (element as typeof element & { customData?: { vedoyCanvasId?: string; vedoyFrameId?: string; vedoyWebsiteId?: string } }).customData
          const linkedId = customData?.vedoyCanvasId ?? customData?.vedoyFrameId ?? customData?.vedoyWebsiteId
          if (!linkedId || element.type !== 'rectangle') continue
          const width = Math.max(160, Math.min(2000, Math.round(element.width)))
          const height = Math.max(120, Math.min(1600, Math.round(element.height)))
          updatedNotes = updateNoteTree(updatedNotes, linkedId, (note) => ({ ...note, width, height }))
          if (customData?.vedoyCanvasId || customData?.vedoyFrameId) updatedNotes = resizeCanvasEmbeds(updatedNotes, linkedId, width, height)
        }
        for (const frame of collectCanvasNotes(updatedNotes).filter((item) => item.kind === 'frame' && hasCanvasEmbed(updatedNotes, item.id))) {
          const preview = await framePreview(snapshot, frame.id)
          if (preview) updatedNotes = refreshCanvasEmbeds(updatedNotes, frame.id, preview, frame.width, frame.height)
        }
      }
      if (hasCanvasEmbed(updatedNotes, canvasId)) {
        try {
          const { exportToBlob } = await import('@excalidraw/excalidraw')
          const preview = await blobToDataUrl(await exportToBlob({ elements: snapshot.elements, appState: { ...snapshot.appState, exportBackground: true }, files: snapshot.files, mimeType: 'image/png', quality: 0.75 }))
          const linkedCanvas = findNoteInTree(updatedNotes, canvasId)
          updatedNotes = refreshCanvasEmbeds(updatedNotes, canvasId, preview, linkedCanvas?.width, linkedCanvas?.height)
        } catch { /* Keep the previous preview if rendering fails. */ }
      }
      notesRef.current = updatedNotes
      setNotes(updatedNotes)
      await saveLocalScene(boardSceneKey(user?.id ?? 'anonymous', canvasId), snapshot)
      if (!user || !cloudBackendReady) {
        setSyncState('waiting')
        return
      }
      setSyncState('loading')
      const rootSnapshot: CanvasSnapshot = findNoteInTree(updatedNotes, boardId)?.snapshot ?? { elements: [], appState: {}, files: {} }
      const workspaceSnapshot: WorkspaceSnapshot = { ...rootSnapshot, vedoyNotebook: updatedNotes }
      try {
        await saveVedoyWorkspace(workspaceSnapshot, user.id)
        setSyncState('saved')
      } catch {
        setSyncState('error')
      }
    }, 800)
    saveTimers.current.set(canvasId, timer)
  }, [user])

  const saveProject = async () => {
    if (!user || !cloudBackendReady) {
      try {
        const api = editorApi.current
        let localNotes = notesRef.current
        const canvasId = activeCanvasIdRef.current
        if (api && isCanvasNote(findNoteInTree(localNotes, canvasId))) {
          const { serializeAsJSON } = await import('@excalidraw/excalidraw')
          const snapshot = JSON.parse(serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'database')) as CanvasSnapshot
          localNotes = updateNoteTree(localNotes, canvasId, (note) => ({ ...note, snapshot }))
          notesRef.current = localNotes
          setNotes(localNotes)
          await saveLocalScene(boardSceneKey('anonymous', canvasId), snapshot)
        }
        window.localStorage.setItem('vedoy-canvas-notes-v1-anonymous', JSON.stringify(localNotes))
      } catch { /* Existing autosave remains available if immediate local storage is unavailable. */ }
      setSavePromptOpen(true)
      return
    }
    const api = editorApi.current
    if (!api) { notify('Prosjektet lagres. Prøv igjen om et øyeblikk.'); return }
    setSyncState('loading')
    try {
      const { serializeAsJSON } = await import('@excalidraw/excalidraw')
      const editorSnapshot = JSON.parse(serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'database')) as CanvasSnapshot
      const canvasId = activeCanvasIdRef.current
      const updatedNotes = isCanvasNote(findNoteInTree(notesRef.current, canvasId)) ? updateNoteTree(notesRef.current, canvasId, (note) => ({ ...note, snapshot: editorSnapshot })) : notesRef.current
      notesRef.current = updatedNotes
      setNotes(updatedNotes)
      await saveLocalScene(boardSceneKey(user.id, canvasId), editorSnapshot)
      const rootSnapshot: CanvasSnapshot = findNoteInTree(updatedNotes, boardId)?.snapshot ?? { elements: [], appState: {}, files: {} }
      const workspaceSnapshot: WorkspaceSnapshot = { ...rootSnapshot, vedoyNotebook: updatedNotes }
      await saveVedoyWorkspace(workspaceSnapshot, user.id)
      const books = updatedNotes.filter((note) => note.kind === 'folder' || note.children)
      await saveVedoyBooks(books, user.id)
      notify('Prosjektet er lagret i kontoen din')
      setSyncState('saved')
    } catch {
      notify('Prosjektet kunne ikke lagres. Prøv igjen.')
      setSyncState('error')
    }
  }

  const loginToSaveProject = () => {
    window.sessionStorage.setItem('vedoy-save-local-draft', 'true')
    setSavePromptOpen(false)
    openLogin()
  }

  useEffect(() => {
    if (!user || !cloudBackendReady || initialSnapshot === undefined) return
    if (notebookSaveTimer.current) clearTimeout(notebookSaveTimer.current)
    notebookSaveTimer.current = setTimeout(async () => {
      setSyncState('loading')
      const rootSnapshot: CanvasSnapshot = findNoteInTree(notes, boardId)?.snapshot ?? { elements: [], appState: {}, files: {} }
      const workspaceSnapshot: WorkspaceSnapshot = { ...rootSnapshot, vedoyNotebook: notes }
      try {
        await saveVedoyWorkspace(workspaceSnapshot, user.id)
        await saveVedoyBooks(notes.filter((note) => note.kind === 'folder'), user.id)
        setSyncState('saved')
      } catch {
        setSyncState('error')
      }
    }, 1000)
    return () => { if (notebookSaveTimer.current) clearTimeout(notebookSaveTimer.current) }
  }, [initialSnapshot, notes, user])

  const exportCanvas = async (format: ExportFormat = 'svg') => {
    const api = editorApi.current
    if (!api || api.getSceneElements().length === 0) { notify('Canvaset er tomt'); return }
    const excalidraw = await import('@excalidraw/excalidraw')
    const payload = { elements: api.getSceneElements(), appState: { ...api.getAppState(), exportWithDarkMode: darkMode }, files: api.getFiles() }
    if (format === 'clipboard') {
      await excalidraw.exportToClipboard({ ...payload, type: 'png' })
      notify('PNG kopiert til utklippstavlen')
      return
    }
    if (format === 'png' || format === 'jpg') {
      const blob = await excalidraw.exportToBlob({ ...payload, mimeType: format === 'jpg' ? 'image/jpeg' : 'image/png', quality: 0.92 })
      downloadBlob(blob, `vedoy-canvas.${format}`)
      return
    }
    const svg = await excalidraw.exportToSvg(payload)
    downloadBlob(new Blob([svg.outerHTML], { type: 'image/svg+xml' }), 'vedoy-canvas.svg')
  }

  const canvasText = () => {
    const elements = editorApi.current?.getSceneElements() ?? []
    const text = elements
      .filter((element): element is typeof element & { text: string } => element.type === 'text' && 'text' in element)
      .map((element) => element.text.trim())
      .filter(Boolean)
    return text.length ? text.join('\n\n') : 'Dette canvaset inneholder visuelle elementer uten egen tekst.'
  }

  const canvasPng = async () => {
    const api = editorApi.current
    if (!api || api.getSceneElements().length === 0) throw new Error('empty')
    const { exportToBlob } = await import('@excalidraw/excalidraw')
    return exportToBlob({ elements: api.getSceneElements(), appState: { ...api.getAppState(), exportWithDarkMode: darkMode, exportBackground: true }, files: api.getFiles(), mimeType: 'image/png', quality: 1 })
  }

  const exportPptx = async () => {
    if (!isSupporter) { requireLogin(); return }
    try {
      const blob = await canvasPng()
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error ?? new Error('Kunne ikke lese canvasbildet'))
        reader.readAsDataURL(blob)
      })
      const { jsonToPPTX } = await import('@polotno/pptx-export')
      const design = {
        width: 1280,
        height: 720,
        pages: [{
          id: `vedoy-slide-${Date.now()}`,
          children: [{ id: 'vedoy-canvas-image', type: 'image', x: 0, y: 0, width: 1280, height: 720, src: dataUrl }],
        }],
      }
      await jsonToPPTX(design, 'vedoy-canvas.pptx')
      notify('PowerPoint-filen er lastet ned')
    } catch (error) {
      console.error(error)
      notify('PowerPoint-eksporten feilet. Prøv igjen.')
    }
  }

  const canvasPreview = useCallback(async (pageId: string) => {
    if (pageId.startsWith('library-')) {
      const item = libraryItems.find((entry) => `library-${entry.id}` === pageId)
      if (!item) return null
      try {
        const { exportToBlob } = await import('@excalidraw/excalidraw')
        return await blobToDataUrl(await exportToBlob({ elements: item.elements, appState: { exportBackground: true, viewBackgroundColor: '#ffffff' }, files: editorApi.current?.getFiles() ?? {}, mimeType: 'image/png', quality: 0.85 }))
      } catch { return null }
    }
    const canvas = findNoteInTree(notesRef.current, pageId)
    if (canvas?.kind === 'frame') {
      const board = findNoteInTree(notesRef.current, canvas.canvasBoardId ?? boardId)
      return board?.snapshot ? framePreview(board.snapshot, pageId) : null
    }
    if (!canvas?.snapshot) return null
    try {
      const { exportToBlob } = await import('@excalidraw/excalidraw')
      return await blobToDataUrl(await exportToBlob({ elements: canvas.snapshot.elements, appState: { ...canvas.snapshot.appState, exportBackground: true }, files: canvas.snapshot.files, mimeType: 'image/png', quality: 0.85 }))
    } catch { return null }
  }, [libraryItems])

  const openCanvasPage = (pageId: string) => {
    void openNote(pageId)
    changeView('canvas')
  }

  const openCanvasObject = (canvasId: string) => {
    if (canvasId.startsWith('library-')) {
      void goToBoard().then(() => editorApi.current?.toggleSidebar({ name: 'library', force: true }))
      return
    }
    if (findNoteInTree(notesRef.current, canvasId)?.kind === 'frame') {
      void openCanvasFrame(canvasId)
      return
    }
    if (viewMode === 'book' && activeNoteRef.current !== boardId) bookReturnPageRef.current = activeNoteRef.current
    void openNote(canvasId)
    changeView('canvas')
  }

  const openCanvasFrame = async (frameId: string) => {
    const frame = findNoteInTree(notesRef.current, frameId)
    if (!frame || frame.kind !== 'frame') return
    if (viewMode === 'book' && activeNoteRef.current !== boardId) bookReturnPageRef.current = activeNoteRef.current
    if (activeNoteRef.current !== (frame.canvasBoardId ?? boardId)) await openNote(frame.canvasBoardId ?? boardId)
    changeView('canvas')
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const element = editorApi.current?.getSceneElements().find((item) => (item as typeof item & { customData?: { vedoyFrameId?: string } }).customData?.vedoyFrameId === frameId)
      if (element && editorApi.current) {
        editorApi.current.updateScene({ appState: { selectedElementIds: { [element.id]: true } } })
        editorApi.current.scrollToContent([element], { fitToContent: true, animate: false })
      }
    }))
  }

  const openWebsite = (websiteId: string) => {
    setActiveWebsiteId(websiteId)
    changeView('website')
  }

  const getOpenRouterAccessToken = async () => {
    return getStoredAccessToken()
  }

  const inviteToBook = async (bookId: string, email: string) => {
    if (!user || !vedoyApiUrl) return 'Logg inn for å dele bøker'
    const book = notes.find((note) => note.id === bookId)
    if (!book || (book.ownerId && book.ownerId !== user.id)) return 'Bare eieren kan invitere til denne boken'
    try {
      await saveVedoyBooks([book], user.id)
      await vedoyFetch(`/api/v1/canvas/books/${encodeURIComponent(book.id)}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role: 'editor' }),
      })
      return `Tilgang gitt til ${email}`
    } catch (error) {
      return `Delingen feilet: ${error instanceof Error ? error.message : 'prøv igjen'}`
    }
  }

  const exportText = () => {
    const content = `Vedøy Canvas\n\n${canvasText()}\n`
    downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), 'vedoy-canvas.txt')
  }

  const exportPdf = async () => {
    try {
      const png = await canvasPng()
      const dataUrl = await blobToDataUrl(png)
      const bitmap = await createImageBitmap(png)
      const { jsPDF } = await import('jspdf')
      const landscape = bitmap.width >= bitmap.height
      const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 10
      const scale = Math.min((pageWidth - margin * 2) / bitmap.width, (pageHeight - margin * 2) / bitmap.height)
      const width = bitmap.width * scale
      const height = bitmap.height * scale
      pdf.addImage(dataUrl, 'PNG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, 'FAST')
      downloadBlob(pdf.output('blob'), 'vedoy-canvas.pdf')
      bitmap.close()
    } catch { notify('PDF kunne ikke eksporteres') }
  }

  const exportDocument = async (target: 'word' | 'google' | 'proton') => {
    try {
      const png = await canvasPng()
      const imageBytes = new Uint8Array(await png.arrayBuffer())
      const bitmap = await createImageBitmap(png)
      const maxWidth = 620
      const width = Math.min(bitmap.width, maxWidth)
      const height = Math.round(bitmap.height * (width / bitmap.width))
      const { Document, HeadingLevel, ImageRun, Packer, Paragraph } = await import('docx')
      const document = new Document({ sections: [{ children: [
        new Paragraph({ text: 'Vedøy Canvas', heading: HeadingLevel.TITLE }),
        new Paragraph({ text: canvasText() }),
        new Paragraph({ children: [new ImageRun({ data: imageBytes, type: 'png', transformation: { width, height } })] }),
      ] }] })
      const blob = await Packer.toBlob(document)
      const suffix = target === 'google' ? '-google-docs' : target === 'proton' ? '-proton-docs' : ''
      downloadBlob(blob, `vedoy-canvas${suffix}.docx`)
      bitmap.close()
      notify(target === 'word' ? 'Word-fil eksportert' : `DOCX klar for import i ${target === 'google' ? 'Google Docs' : 'Proton Docs'}`)
    } catch { notify('Dokumentet kunne ikke eksporteres') }
  }

  const saveSceneFile = async () => {
    const api = editorApi.current
    if (!api) return
    const { serializeAsJSON } = await import('@excalidraw/excalidraw')
    downloadBlob(new Blob([serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local')], { type: 'application/json' }), 'vedoy-canvas.excalidraw')
  }

  const openSceneFile = async (file?: File) => {
    const api = editorApi.current
    if (!api || !file) return
    try {
      const { loadFromBlob } = await import('@excalidraw/excalidraw')
      const data = await loadFromBlob(file, api.getAppState(), api.getSceneElements())
      api.updateScene({ elements: data.elements, appState: data.appState })
      if (data.files) api.addFiles(Object.values(data.files))
      notify('Canvas åpnet')
    } catch { notify('Filen kunne ikke åpnes') }
  }

  const exportLibrary = async () => {
    if (libraryItems.length === 0) { notify('Legg elementer i det personlige biblioteket først'); return }
    const requestedName = window.prompt('Navn på biblioteket', 'Mitt Vedøy-bibliotek')?.trim()
    if (!requestedName) return
    const { serializeLibraryAsJSON } = await import('@excalidraw/excalidraw')
    const safeName = requestedName.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').toLowerCase()
    downloadBlob(new Blob([serializeLibraryAsJSON(libraryItems as never)], { type: 'application/json' }), `${safeName || 'vedoy-library'}.excalidrawlib`)
    notify('Biblioteket er laget')
  }

  const importLibrary = async (file?: File) => {
    const api = editorApi.current
    if (!api || !file) return
    try {
      const { loadLibraryFromBlob } = await import('@excalidraw/excalidraw')
      const items = await loadLibraryFromBlob(file)
      await api.updateLibrary({ libraryItems: items, merge: true })
      notify('Bibliotek importert')
    } catch { notify('Biblioteket kunne ikke importeres') }
  }

  const clearCanvas = () => {
    if (!window.confirm('Tømme hele canvaset? Dette kan angres med Ctrl/Cmd + Z.')) return
    editorApi.current?.resetScene()
    notify('Canvas tømt')
  }

  const setCanvasColor = (kind: 'stroke' | 'background', color: string) => {
    const api = editorApi.current
    if (!api) return
    api.updateScene({ appState: { [kind === 'stroke' ? 'currentItemStrokeColor' : 'currentItemBackgroundColor']: color } } as never)
  }

  const allFileActions: Array<{ icon: typeof MousePointer2; label: string; action: () => void; paid?: boolean }> = [
    { icon: Save, label: 'Lagre prosjekt', action: () => void saveProject() },
    { icon: FileUp, label: 'Åpne canvas', action: () => sceneInput.current?.click(), paid: true },
    { icon: FileDown, label: 'Eksporter .excalidraw', action: () => void saveSceneFile(), paid: true },
    { icon: FileDown, label: 'Eksporter SVG', action: () => void exportCanvas('svg'), paid: true },
    { icon: ImageIcon, label: 'Eksporter PNG', action: () => void exportCanvas('png') },
    { icon: ImageIcon, label: 'Eksporter JPG', action: () => void exportCanvas('jpg') },
    { icon: FileText, label: 'Eksporter TXT', action: exportText, paid: true },
    { icon: FileType2, label: 'Eksporter PDF', action: () => void exportPdf(), paid: true },
    { icon: Presentation, label: 'Eksporter PowerPoint', action: () => void exportPptx(), paid: true },
    { icon: FileType2, label: 'Eksporter Word', action: () => void exportDocument('word'), paid: true },
    { icon: FileType2, label: 'For Google Docs', action: () => void exportDocument('google'), paid: true },
    { icon: FileType2, label: 'For Proton Docs', action: () => void exportDocument('proton'), paid: true },
    { icon: Clipboard, label: 'Kopier PNG', action: () => void exportCanvas('clipboard'), paid: true },
    { icon: LibraryBig, label: 'Importer bibliotek', action: () => libraryInput.current?.click(), paid: true },
    { icon: BookOpen, label: 'Lag bibliotek', action: () => requireLogin() && void exportLibrary(), paid: true },
    { icon: HelpCircle, label: 'Snarveier og hjelp', action: () => setHelpOpen(true) },
    { icon: HelpCircle, label: 'Retningslinjer og kontakt', action: () => { window.open('/retningslinjer', '_blank', 'noopener,noreferrer') } },
    { icon: Trash2, label: 'Tøm canvas', action: clearCanvas },
  ]
  const fileActions = allFileActions.filter(action => !action.paid || isSupporter)

  const signOut = async () => {
    clearStoredTokens()
    setUser(null)
    setSyncState('waiting')
  }

  return <main style={{ "--workspace-top": `${headerHeight}px` } as React.CSSProperties} data-navigation={notebookOpen && viewMode === "book"} className="vedoy-workspace relative h-dvh overflow-hidden bg-background text-foreground">
    <div className={`vedoy-canvas-area absolute inset-0 z-0 ${viewMode === 'canvas' ? 'block' : 'hidden'}`} aria-hidden={viewMode !== 'canvas'}>
      {initialSnapshot !== undefined && <CanvasEditor key={`${user?.id ?? 'anonymous'}-${activeCanvasId}-excalidraw-v1`} initialSnapshot={initialSnapshot} darkMode={darkMode} onApi={(api) => { editorApi.current = api }} onSceneChange={(snapshot) => saveScene(activeCanvasId, snapshot)} onLibraryChange={setLibraryItems} onOpenCanvas={openCanvasObject} onOpenFrame={(frameId) => { void openCanvasFrame(frameId) }} onOpenWebsite={openWebsite} />}
    </div>
    {viewMode === 'book' && <div className="vedoy-book-area absolute inset-0 z-0"><BookView notes={bookNotes} libraryItems={personalLibraryItems} activeNote={activeNote} currentUserId={user?.id} userEmail={user?.email} onSelect={(id) => { bookReturnPageRef.current = id; void openNote(id) }} onAddPage={addPage} onAddFolder={addFolder} onRename={beginRename} onDelete={deleteNote} onAddTemplate={addTemplate} onUpdate={updateNote} onOpenCanvas={openCanvasObject} onCanvasPreview={canvasPreview} onInvite={inviteToBook} onNotify={notify} /></div>}
    {viewMode === 'website' && <WebsiteView websites={websites} activeWebsiteId={activeWebsiteId} canGenerate={Boolean(user)} onSelect={setActiveWebsiteId} onCreate={() => { setNewBoardItemType('website'); setNewBoardItemTitle('Ny nettside') }} onUpdate={updateNote} onGetAccessToken={getOpenRouterAccessToken} onNotify={notify} />}

    <header ref={headerRef} className="vedoy-header absolute inset-x-4 top-4 z-10 flex max-w-[calc(100vw-2rem)] items-center gap-1.5 overflow-x-auto rounded-xl border border-border/70 bg-card/95 px-2.5 py-2.5 shadow-md backdrop-blur-md sm:inset-x-6 sm:max-w-[calc(100vw-3rem)] sm:gap-2 sm:px-3">
      {viewMode === 'book' && <button onClick={() => setNotebookOpen((open) => !open)} className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${notebookOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} aria-label={notebookOpen ? 'Lukk bokmeny' : 'Åpne bokmeny'} aria-expanded={notebookOpen}><Menu className="size-[18px]" /></button>}
      <div className="h-5 w-px bg-border" />
      <span className="hidden h-8 shrink-0 items-center gap-2 sm:flex" aria-label="Vedøy Canvas">
        <Image src="/vedoy-canvas-4color-fjord.png" alt="Vedøy Canvas" width={1600} height={1400} className="size-8 object-contain" priority />
        <span className="hidden text-xs font-semibold tracking-tight lg:inline">Vedøy Canvas</span>
      </span>
      <div className="h-5 w-px shrink-0 bg-border" />
      <div className="flex shrink-0 rounded-lg bg-muted p-0.5" aria-label="Velg visning">
        <button type="button" onClick={goToBoard} className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium ${viewMode === 'canvas' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} aria-label="Canvas" aria-pressed={viewMode === 'canvas'}><Brush className="size-3.5" /><span className="hidden sm:inline">Canvas</span></button>
        <button type="button" onClick={() => { void goToBooks() }} className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium ${viewMode === 'book' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} aria-label="Vedøy Bøker" aria-pressed={viewMode === 'book'}><BookOpen className="size-3.5" /><span className="hidden sm:inline">Bøker</span></button>
        <button type="button" onClick={requestWebsite} className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium ${viewMode === 'website' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} aria-label={isSupporter ? 'Nettside' : 'Nettside, låst'} aria-pressed={viewMode === 'website'}><Globe2 className="size-3.5" /><span className="hidden sm:inline">Nettside{!isSupporter ? ' 🔒' : ''}</span></button>
      </div>
      {viewMode === 'website' && <button type="button" onClick={() => { setNewBoardItemType('website'); setNewBoardItemTitle('Ny nettside') }} className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary px-2 text-xs font-medium text-primary-foreground hover:opacity-90" aria-label="Ny nettside"><Plus className="size-3.5" /><span className="hidden sm:inline">Nettside</span></button>}
      <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />
      <button onClick={() => setDarkMode((value) => !value)} className="hidden size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted sm:flex" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>{darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
      <button onClick={() => { void saveProject() }} className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Lagre prosjekt"><Save className="size-4" /><span className="hidden sm:inline">Lagre</span></button>
      {viewMode === 'canvas' && <button onClick={() => setDesignLibraryOpen(open => !open)} className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium ${designLibraryOpen ? 'border-[#2ea5a8] bg-[#2ea5a8]/10 text-[#173f5f]' : 'border-border text-muted-foreground hover:bg-muted'}`} aria-label="Grafikk og mine bibliotek" aria-expanded={designLibraryOpen}><LibraryBig className="size-4" /><span className="hidden md:inline">Grafikk</span></button>}
      <button onClick={() => { setActionsOpen((open) => !open) }} className="hidden items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:flex" aria-label="Fil og eksport"><Download className="size-4" /><span className="hidden xl:inline">Fil</span><ChevronDown className="size-3" /></button>
      {authReady && (user ? <>
        <span className="hidden max-w-36 truncate text-[11px] text-muted-foreground md:inline">{syncState === 'loading' ? 'Lagrer…' : syncState === 'error' ? 'Lagringsfeil' : 'Lagret'}</span>
        <button onClick={signOut} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Logg ut"><LogOut className="size-4" /></button>
      </> : <button onClick={openLogin} disabled={!authConfigured} className="flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-medium text-primary-foreground disabled:opacity-50 sm:h-auto sm:w-auto sm:px-3 sm:py-2" aria-label="Logg inn med Vedøy"><LogIn className="size-3.5" /><span className="hidden sm:inline">Logg inn</span></button>)}
    </header>

    <input ref={sceneInput} type="file" className="hidden" accept=".excalidraw,application/json" onChange={(event) => { void openSceneFile(event.target.files?.[0]); event.target.value = '' }} />
    <input ref={libraryInput} type="file" className="hidden" accept=".excalidrawlib,application/json" onChange={(event) => { void importLibrary(event.target.files?.[0]); event.target.value = '' }} />

    {actionsOpen && <div className="absolute right-4 top-[4.75rem] z-30 max-h-[calc(100vh-6rem)] w-64 overflow-y-auto rounded-xl border border-border/70 bg-card/95 p-2 shadow-lg backdrop-blur-md sm:right-6">
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fil</div>
      {fileActions.map(({ icon: Icon, label, action }) => <button key={label} type="button" onClick={() => { action(); setActionsOpen(false) }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><Icon className="size-4" />{label}</button>)}
    </div>}

    {viewMode === 'canvas' ? <BoardDock boards={canvasNotes} activeId={activeCanvasId} canCreate={Boolean(user)} onSelect={id => { void goToCanvasBoard(id) }} onAdd={() => { void addBoard() }} onRename={beginRename} onLocked={() => setAccessReason('login')} /> : null}
    {viewMode === 'canvas' && designLibraryOpen ? <aside className="vedoy-library-panel" aria-label="Grafikk og mine bibliotek"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#2ea5a8]">Mine bibliotek</p><h2 className="font-semibold">Bygg og gjenbruk klosser</h2></div><button onClick={() => setDesignLibraryOpen(false)} className="grid size-8 place-items-center rounded-full hover:bg-muted" aria-label="Lukk grafikkmeny">×</button></div><DesignLibrary api={() => editorApi.current} notify={notify} canCreate={Boolean(user)} hasVedoyGraphics={plan === 'supporter_plus'} onLocked={kind => setAccessReason(kind)} /></aside> : null}

    {notebookOpen && viewMode === 'book' && <aside className="vedoy-navigation absolute left-4 top-[4.75rem] z-40 flex max-h-[calc(100vh-6rem)] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-xl border border-border/70 bg-card/95 p-3 shadow-md backdrop-blur-md sm:left-6" aria-label="Boknavigasjon">
      <div className="border-b border-border/70 px-2 pb-3"><div className="flex items-center gap-2"><Image src="/vedoy-canvas-4color-fjord.png" alt="" width={1600} height={1400} className="size-7 object-contain" /><div><p className="text-xs font-semibold">Vedøy Bøker</p><p className="mt-0.5 text-[10px] text-muted-foreground">Hold over et element for å legge til under</p></div></div></div>
      <div className="pt-2"><NoteTree notes={bookNotes} activeNote={activeNote} expanded={expanded} onSelect={(id) => { void selectNavigatorNote(id) }} onToggle={toggleExpanded} onRename={beginRename} onFavorite={toggleFavorite} onDelete={deleteNote} onDrop={moveNote} onAddChild={addNavigatorChild} /></div>
    </aside>}
    {accessReason ? <AccessModal reason={accessReason} isLoggedIn={Boolean(user)} onClose={() => setAccessReason(null)} onLogin={() => { setAccessReason(null); openLogin() }} onUpgrade={startSupporterCheckout} /> : null}

    {nameDialog && <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm" onClick={() => { setNameDialog(null); setEditingNoteId(null) }}>
      <form onSubmit={(event) => { event.preventDefault(); saveNoteTitle() }} onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nytt {nameDialog.kind}</p>
        <h2 className="mt-1 text-lg font-semibold">Gi {nameDialog.kind === 'bok' ? 'boken' : nameDialog.kind === 'tavle' ? 'tavlen' : nameDialog.kind === 'kategori' ? 'kategorien' : 'siden'} et navn</h2>
        <input autoFocus value={draftNoteTitle} onChange={(event) => setDraftNoteTitle(event.target.value)} className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" aria-label={`Navn på ${nameDialog.kind}`} />
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setNameDialog(null); setEditingNoteId(null) }} className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted">Avbryt</button><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">Lagre navn</button></div>
      </form>
    </div>}

    {savePromptOpen && <div className="absolute inset-0 z-[60] flex items-center justify-center bg-background/65 p-4 backdrop-blur-sm" onClick={() => setSavePromptOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="save-project-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary"><Save className="size-5" /></div>
        <h2 id="save-project-title" className="mt-4 text-lg font-semibold">To save a project, log in or create an account</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Your work is saved on this device. Log in to save it to your Vedøy account and access it elsewhere.</p>
        <button type="button" onClick={loginToSaveProject} disabled={!authConfigured} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"><LogIn className="size-4" />Logg inn med Vedøy</button>
        <button type="button" onClick={() => setSavePromptOpen(false)} className="mt-3 w-full rounded-lg px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted">Continue on this device</button>
      </section>
    </div>}

    {loginOpen && <div className="fixed inset-0 z-[130] flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" onMouseDown={() => setLoginOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="login-title" onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Vedøy-konto</p><h2 id="login-title" className="mt-1 text-xl font-semibold">Logg inn eller registrer deg</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Logg inn eller opprett en konto med Vedøy for å lagre og synkronisere arbeidet ditt.</p></div>
          <button type="button" onClick={() => setLoginOpen(false)} className="rounded-lg px-3 py-1 text-sm text-muted-foreground hover:bg-muted" aria-label="Lukk">×</button>
        </div>
        <button type="button" onClick={() => { void submitGithubLogin() }} disabled={!authConfigured || loginPending} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"><LogIn className="size-4" />Fortsett med Vedøy</button>
        {loginMessage && <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{loginMessage}</p>}
      </section>
    </div>}

    {newBoardItemType && <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm" onClick={() => setNewBoardItemType(null)}>
      <form onSubmit={(event) => { event.preventDefault(); void createBoardItem() }} onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nettsider</p>
        <h2 className="mt-1 text-lg font-semibold">Opprett nettside</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">Nettsiden får sin egen visning, adskilt fra Canvas.</p>
        <label className="mt-4 block text-xs text-muted-foreground">Navn<input autoFocus value={newBoardItemTitle} onChange={(event) => setNewBoardItemTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" aria-label="Navn på nytt element" /></label>
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setNewBoardItemType(null)} className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted">Avbryt</button><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">Opprett</button></div>
      </form>
    </div>}

    {authReady && !user && <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 mx-auto w-fit rounded-full border border-border/70 bg-card/95 px-4 py-2 text-xs text-muted-foreground shadow-md">Lagret lokalt · logg inn for skybackup</div>}
    {toast && <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background shadow-lg">{toast}</div>}
    {helpOpen && <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" onClick={() => setHelpOpen(false)}><section className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Snarveier og hjelp</h2><button onClick={() => setHelpOpen(false)} className="rounded-lg px-3 py-1 text-sm hover:bg-muted">Lukk</button></div><div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><p><kbd>1</kbd> Velg</p><p><kbd>H</kbd> Flytt</p><p><kbd>R</kbd> Rektangel</p><p><kbd>O</kbd> Sirkel</p><p><kbd>A</kbd> Pil</p><p><kbd>P</kbd> Tegn</p><p><kbd>T</kbd> Tekst</p><p><kbd>Ctrl/Cmd + Z</kbd> Angre</p><p><kbd>Ctrl/Cmd + G</kbd> Grupper</p><p><kbd>Ctrl/Cmd + Shift + G</kbd> Løs opp</p></div><p className="mt-4 text-xs leading-5 text-muted-foreground">Høyreklikk på valgte elementer for lagrekkefølge, gruppering, justering, duplisering og å legge utvalget i biblioteket.</p></section></div>}
  </main>
}
