'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient, type User } from '@supabase/supabase-js'
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types'
import type { CanvasSnapshot } from '@/components/canvas-editor'
import { BookView } from '@/components/book-view'
import { createBookFromTemplate, type BookTemplateId, type Note } from '@/lib/notebook'
import { getLocalScene, saveLocalScene } from '@/lib/local-scene-store'
import { ArrowRight, BookOpen, Brush, ChevronDown, ChevronRight, Circle, Clipboard, Diamond, Download, Eraser, ExternalLink, FileDown, FilePlus2, FileText, FileType2, FileUp, FolderPlus, Frame, Hand, HelpCircle, Image as ImageIcon, LibraryBig, LogIn, LogOut, Menu, Minus, Moon, MousePointer2, NotebookTabs, Pencil, Presentation, Redo2, Save, Square, Star, StickyNote, Sun, Trash2, Type, Undo2 } from 'lucide-react'

const CanvasEditor = dynamic(() => import('@/components/canvas-editor').then((module) => module.CanvasEditor), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">Laster tegneflate…</div>,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const clientId = process.env.NEXT_PUBLIC_VEDOY_LOGIN_CLIENT_ID
const callbackUrl = 'https://vedoy-canvas.vercel.app/auth/callback'
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: 'vedoy-canvas-auth-v2',
    detectSessionInUrl: false,
  },
}) : null

type DrawingTool = 'selection' | 'hand' | 'rectangle' | 'diamond' | 'ellipse' | 'arrow' | 'line' | 'freedraw' | 'text' | 'image' | 'eraser' | 'frame' | 'embeddable' | 'laser'

const drawingTools: Array<{ type: DrawingTool; label: string; icon: typeof MousePointer2 }> = [
  { type: 'selection', label: 'Velg', icon: MousePointer2 },
  { type: 'hand', label: 'Flytt', icon: Hand },
  { type: 'rectangle', label: 'Rektangel', icon: Square },
  { type: 'diamond', label: 'Diamant', icon: Diamond },
  { type: 'ellipse', label: 'Sirkel', icon: Circle },
  { type: 'arrow', label: 'Pil', icon: ArrowRight },
  { type: 'line', label: 'Linje', icon: Minus },
  { type: 'freedraw', label: 'Tegn', icon: Pencil },
  { type: 'text', label: 'Tekst', icon: Type },
  { type: 'image', label: 'Bilde', icon: ImageIcon },
  { type: 'eraser', label: 'Viskelær', icon: Eraser },
  { type: 'frame', label: 'Ramme', icon: Frame },
  { type: 'embeddable', label: 'Innhold', icon: ExternalLink },
  { type: 'laser', label: 'Laser', icon: Presentation },
]

type ExportFormat = 'svg' | 'png' | 'clipboard'

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

type CloudBookRow = {
  id: string
  owner_id: string
  title: string
  data: Note
  updated_at: string
}

function withBookAccess(book: Note, userId: string): Note {
  const ownerId = book.ownerId ?? userId
  const shared = ownerId !== userId
  const apply = (note: Note): Note => ({ ...note, ownerId, shared, canEdit: true, children: note.children?.map(apply) })
  return apply(book)
}

function cloudBook(row: CloudBookRow, userId: string): Note {
  return withBookAccess({ ...row.data, id: row.id, title: row.title, ownerId: row.owner_id }, userId)
}

function withoutAccessMetadata(note: Note): Note {
  const { ownerId: _ownerId, shared: _shared, canEdit: _canEdit, ...stored } = note
  return { ...stored, children: note.children?.map(withoutAccessMetadata) }
}

function hasCanvasEmbed(items: Note[], canvasId: string): boolean {
  return items.some((note) => (note.contentHtml?.includes(`data-canvas-embed="${canvasId}"`) ?? false) || hasCanvasEmbed(note.children ?? [], canvasId))
}

function refreshCanvasEmbeds(items: Note[], canvasId: string, preview: string): Note[] {
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
      }
      contentHtml = root?.innerHTML ?? contentHtml
    }
    return { ...note, contentHtml, children: note.children ? refreshCanvasEmbeds(note.children, canvasId, preview) : note.children }
  })
}

const initialNotes: Note[] = [
  { id: 'canvas', title: 'Idéboken', kind: 'folder', children: [{ id: 'ideas', title: 'Ideer', kind: 'folder', children: [{ id: 'research', title: 'Research', kind: 'file', content: 'Samle referanser, lenker og tanker her.' }, { id: 'directions', title: 'Retninger', kind: 'file' }] }] },
  { id: 'launch', title: 'Produktlansering', kind: 'folder', children: [{ id: 'planning', title: 'Planlegging', kind: 'folder', children: [{ id: 'timeline', title: 'Tidslinje', kind: 'file' }] }] },
  { id: 'inbox', title: 'Untitled note', kind: 'file' },
]

function NoteTree({ notes, activeNote, expanded, onSelect, onToggle, onRename, onFavorite, onDelete, onDrop }: { notes: Note[]; activeNote: string; expanded: string[]; onSelect: (id: string) => void; onToggle: (id: string) => void; onRename: (id: string) => void; onFavorite: (id: string) => void; onDelete: (id: string) => void; onDrop: (targetId: string, draggedId: string) => void }) {
  return <div className="flex flex-col gap-0.5">{notes.map((note) => {
    const hasChildren = Boolean(note.children?.length)
    const isExpanded = expanded.includes(note.id)
    return <div key={note.id}>
      <div draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', note.id) }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const draggedId = event.dataTransfer.getData('text/plain'); if (draggedId && draggedId !== note.id) onDrop(note.id, draggedId) }} className={`group flex items-center gap-1 rounded-lg pr-1 transition-colors ${activeNote === note.id ? 'bg-muted' : 'hover:bg-muted/70'}`}>
        <button onClick={() => hasChildren && onToggle(note.id)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${note.title}`} disabled={!hasChildren}>
          {hasChildren ? (isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />) : <span className="size-3.5" />}
        </button>
        <button onClick={() => onSelect(note.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-xs font-medium"><StickyNote className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{note.title}</span></button>
        <button onClick={() => onFavorite(note.id)} className={`flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-background ${note.favorite ? 'text-yellow-500' : 'text-muted-foreground opacity-0 group-hover:opacity-100'}`} aria-label={note.favorite ? `Fjern ${note.title} fra favoritter` : `Merk ${note.title} som favoritt`}><Star className="size-3" fill={note.favorite ? 'currentColor' : 'none'} /></button>
        <button onClick={() => onRename(note.id)} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground" aria-label={`Rediger navnet på ${note.title}`} title="Rediger navn"><Pencil className="size-3" /></button>
        <button onClick={() => onDelete(note.id)} className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600" aria-label={`Slett ${note.title}`} title="Slett"><Trash2 className="size-3" /></button>
      </div>
      {hasChildren && isExpanded && <div className="ml-4 border-l border-border/70 pl-2"><NoteTree notes={note.children ?? []} activeNote={activeNote} expanded={expanded} onSelect={onSelect} onToggle={onToggle} onRename={onRename} onFavorite={onFavorite} onDelete={onDelete} onDrop={onDrop} /></div>}
    </div>
  })}</div>
}

function encodeBase64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function startLogin() {
  if (!supabaseUrl || !clientId) return
  const verifier = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = encodeBase64Url(new Uint8Array(digest))
  const state = encodeBase64Url(crypto.getRandomValues(new Uint8Array(24)))
  sessionStorage.setItem('vedoy_login_verifier', verifier)
  sessionStorage.setItem('vedoy_login_state', state)
  const url = new URL('/auth/v1/oauth/authorize', supabaseUrl)
  url.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: callbackUrl, state, code_challenge: challenge, code_challenge_method: 'S256', scope: 'openid email profile' }).toString()
  window.location.assign(url.toString())
}

export default function Page() {
  const [viewMode, setViewMode] = useState<'canvas' | 'book'>('canvas')
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [syncState, setSyncState] = useState<'waiting' | 'loading' | 'saved' | 'error'>('waiting')
  const [initialSnapshot, setInitialSnapshot] = useState<CanvasSnapshot | null | undefined>(undefined)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [moreToolsOpen, setMoreToolsOpen] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [bookPickerOpen, setBookPickerOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [libraryItems, setLibraryItems] = useState<readonly unknown[]>([])
  const [activeTool, setActiveTool] = useState<DrawingTool>('selection')
  const [notes, setNotes] = useState(initialNotes)
  const [activeNote, setActiveNote] = useState('canvas')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [draftNoteTitle, setDraftNoteTitle] = useState('')
  const [nameDialog, setNameDialog] = useState<{ id: string; kind: 'bok' | 'side' } | null>(null)
  const [expanded, setExpanded] = useState(['canvas', 'launch'])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notebookSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bookSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const localNotesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorApi = useRef<ExcalidrawImperativeAPI | null>(null)
  const notesRef = useRef(notes)
  const activeNoteRef = useRef(activeNote)
  const skipNextBookSave = useRef(false)
  const sceneInput = useRef<HTMLInputElement | null>(null)
  const libraryInput = useRef<HTMLInputElement | null>(null)

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2600)
  }

  const updateNoteTree = (items: Note[], id: string, updater: (note: Note) => Note): Note[] => items.map((note) => note.id === id ? updater(note) : { ...note, children: note.children ? updateNoteTree(note.children, id, updater) : note.children })

  const beginRename = (id: string) => {
    const find = (items: Note[]): Note | undefined => {
      for (const item of items) {
        if (item.id === id) return item
        const child = find(item.children ?? [])
        if (child) return child
      }
    }
    const note = find(notes)
    if (note) { setEditingNoteId(id); setDraftNoteTitle(note.title); setNameDialog({ id, kind: note.children ? 'bok' : 'side' }); setActiveNote(id) }
  }

  const findNote = (items: Note[], id: string): Note | undefined => items.reduce<Note | undefined>((found, item) => found ?? (item.id === id ? item : findNote(item.children ?? [], id)), undefined)

  const openNote = async (id: string) => {
    if (id === activeNote) return
    const api = editorApi.current
    const target = findNote(notes, id)
    if (!api || !target) { setActiveNote(id); return }
    const { serializeAsJSON } = await import('@excalidraw/excalidraw')
    const currentSnapshot = JSON.parse(serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'database')) as CanvasSnapshot
    const updatedNotes = updateNoteTree(notesRef.current, activeNote, (note) => ({ ...note, snapshot: currentSnapshot }))
    notesRef.current = updatedNotes
    setNotes(updatedNotes)
    activeNoteRef.current = id
    setActiveNote(id)
    if (target.snapshot) api.updateScene({ elements: target.snapshot.elements, appState: { ...api.getAppState(), ...target.snapshot.appState } })
    else api.resetScene()
  }

  const saveNoteTitle = () => {
    const title = draftNoteTitle.trim()
    if (!editingNoteId || !title) return
    setNotes((current) => updateNoteTree(current, editingNoteId, (note) => ({ ...note, title })))
    setEditingNoteId(null)
    setNameDialog(null)
  }

  const addBook = () => {
    const id = `book-${Date.now()}`
    setNotes((current) => [...current, { id, title: 'Ny bok', kind: 'folder', children: [], ownerId: user?.id, canEdit: true }])
    setActiveNote(id); setEditingNoteId(id); setDraftNoteTitle('Ny bok'); setNameDialog({ id, kind: 'bok' }); setAddMenuOpen(false)
  }

  const addTemplate = (templateId: BookTemplateId) => {
    const book = { ...createBookFromTemplate(templateId), ownerId: user?.id, canEdit: true }
    const firstPage = book.children?.[0]?.children?.[0]
    setNotes((current) => [...current, book])
    setExpanded((current) => [...new Set([...current, book.id, ...(book.children?.map((section) => section.id) ?? [])])])
    setActiveNote(firstPage?.id ?? book.id)
    notify(`${book.title} er opprettet`)
  }

  const addPage = (parentId?: string) => {
    const id = `note-${Date.now()}`
    const newNote = { id, title: 'Ny side', kind: 'file' as const }
    if (!parentId) setNotes((current) => [...current, newNote])
    else {
      const append = (items: Note[]): Note[] => items.map((note) => note.id === parentId ? { ...note, children: [...(note.children ?? []), newNote] } : { ...note, children: note.children ? append(note.children) : note.children })
      setNotes(append)
      setExpanded((current) => current.includes(parentId) ? current : [...current, parentId])
    }
    setActiveNote(id); setEditingNoteId(id); setDraftNoteTitle('Ny side'); setNameDialog({ id, kind: 'side' }); setAddMenuOpen(false)
  }

  const addSubpage = () => {
    addPage(activeNote)
  }

  const addFolder = (parentId?: string) => {
    const id = `folder-${Date.now()}`
    const newFolder: Note = { id, title: 'Ny undermappe', kind: 'folder', children: [] }
    if (!parentId) setNotes((current) => [...current, newFolder])
    else setNotes((current) => updateNoteTree(current, parentId, (note) => ({ ...note, children: [...(note.children ?? []), newFolder] })))
    if (parentId) setExpanded((current) => current.includes(parentId) ? current : [...current, parentId])
    setActiveNote(id); setEditingNoteId(id); setDraftNoteTitle('Ny undermappe'); setNameDialog({ id, kind: 'bok' }); setAddMenuOpen(false)
  }

  const addSubfolder = () => addFolder(activeNote)

  const addSection = (bookId: string) => {
    const id = `section-${Date.now()}`
    const section: Note = { id, title: 'Ny seksjon', kind: 'folder', children: [] }
    setNotes((current) => updateNoteTree(current, bookId, (note) => ({ ...note, children: [...(note.children ?? []), section] })))
    setExpanded((current) => current.includes(bookId) ? current : [...current, bookId])
    setActiveNote(id)
    setEditingNoteId(id)
    setDraftNoteTitle('Ny seksjon')
    setNameDialog({ id, kind: 'bok' })
  }

  const updateNote = (id: string, changes: Partial<Pick<Note, 'title' | 'content' | 'contentHtml'>>) => {
    setNotes((current) => updateNoteTree(current, id, (note) => ({ ...note, ...changes })))
  }

  const toggleFavorite = (id: string) => setNotes((current) => updateNoteTree(current, id, (note) => ({ ...note, favorite: !note.favorite })))

  const deleteNote = (id: string) => {
    const find = (items: Note[]): Note | undefined => {
      for (const item of items) {
        if (item.id === id) return item
        const child = find(item.children ?? [])
        if (child) return child
      }
    }
    const note = find(notes)
    if (!note || !window.confirm(`Slette ${note.title}?`)) return
    const remove = (items: Note[]): Note[] => items.filter((item) => item.id !== id).map((item) => ({ ...item, children: item.children ? remove(item.children) : item.children }))
    setNotes(remove)
    if (activeNote === id) setActiveNote('canvas')
  }

  const moveNote = (targetId: string, draggedId: string) => {
    const contains = (items: Note[], parentId: string, childId: string): boolean => items.some((item) => item.id === parentId && (item.children ?? []).some((child) => child.id === childId || contains([child], child.id, childId)))
    if (contains(notes, draggedId, targetId)) return
    let dragged: Note | undefined
    const withoutDragged = (items: Note[]): Note[] => items.filter((item) => { if (item.id === draggedId) { dragged = item; return false }; return true }).map((item) => ({ ...item, children: item.children ? withoutDragged(item.children) : item.children }))
    const insertBeforeTarget = (items: Note[]): Note[] => { const targetIndex = items.findIndex((item) => item.id === targetId); if (targetIndex !== -1 && dragged) return [...items.slice(0, targetIndex), dragged, ...items.slice(targetIndex)]; return items.map((item) => ({ ...item, children: item.children ? insertBeforeTarget(item.children) : item.children })) }
    const removed = withoutDragged(notes)
    if (dragged) setNotes(insertBeforeTarget(removed))
  }

  const toggleExpanded = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const changeView = (nextView: 'canvas' | 'book') => {
    setViewMode(nextView)
    setNotebookOpen(false)
    setAddMenuOpen(false)
    setMoreToolsOpen(false)
    setActionsOpen(false)
    setHelpOpen(false)
    setBookPickerOpen(false)
    setEditingNoteId(null)
    setNameDialog(null)
    editorApi.current?.toggleSidebar({ name: null, force: false })
  }

  const chooseTool = (type: DrawingTool) => {
    const api = editorApi.current
    if (!api) return
    api.setActiveTool(type === 'image' ? { type, insertOnCanvasDirectly: true } : { type })
    setActiveTool(type)
    setMoreToolsOpen(false)
  }

  const bookTextCommand = (name: string, value?: string) => {
    document.execCommand(name, false, value)
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) selection.getRangeAt(0).commonAncestorContainer.parentElement?.closest('[contenteditable]')?.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'formatBlock' }))
  }

  const historyShortcut = (redo = false) => {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: !isMac, metaKey: isMac, shiftKey: redo, bubbles: true }))
  }

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    // Never hold the canvas behind a slow or stale auth session. Authentication
    // enhances persistence, but the drawing surface must always start instantly.
    setAuthReady(true)
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null)).catch(() => setUser(null))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.documentElement.classList.toggle('light', !darkMode)
  }, [darkMode])

  useEffect(() => {
    const key = `vedoy-canvas-notes-v1-${user?.id ?? 'anonymous'}`
    try {
      const stored = window.localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setNotes(parsed)
      }
    } catch { /* Keep the starter notebook if local storage is unavailable. */ }
  }, [user?.id])

  useEffect(() => {
    activeNoteRef.current = activeNote
  }, [activeNote])

  useEffect(() => {
    notesRef.current = notes
    if (localNotesTimer.current) clearTimeout(localNotesTimer.current)
    localNotesTimer.current = setTimeout(() => {
      try { window.localStorage.setItem(`vedoy-canvas-notes-v1-${user?.id ?? 'anonymous'}`, JSON.stringify(notes)) } catch { /* Optional device-local preference. */ }
    }, 250)
    return () => { if (localNotesTimer.current) clearTimeout(localNotesTimer.current) }
  }, [notes, user?.id])

  useEffect(() => {
    if (!authReady) return
    let cancelled = false

    const initialize = async () => {
      editorApi.current = null
      if (!user || !supabase) {
        const localScene = await getLocalScene('anonymous')
        if (cancelled) return
        setInitialSnapshot(localScene)
        setSyncState('waiting')
        return
      }

      setInitialSnapshot(undefined)
      setSyncState('loading')
      const [documentResult, booksResult] = await Promise.all([
        supabase.from('canvas_documents').select('snapshot').eq('user_id', user.id).maybeSingle(),
        supabase.from('canvas_books').select('id, owner_id, title, data, updated_at').order('updated_at', { ascending: true }),
      ])
      if (cancelled) return
      if (documentResult.error) {
        setInitialSnapshot(null)
        setSyncState('error')
        return
      }
      const storedSnapshot = isCanvasSnapshot(documentResult.data?.snapshot) ? documentResult.data.snapshot as WorkspaceSnapshot : null
      const legacyNotes = Array.isArray(storedSnapshot?.vedoyNotebook) ? storedSnapshot.vedoyNotebook : null
      if (!booksResult.error && booksResult.data?.length) {
        const cloudBooks = (booksResult.data as CloudBookRow[]).map((book) => cloudBook(book, user.id))
        const loosePages = (legacyNotes ?? []).filter((note) => note.kind === 'file' && !note.children)
        setNotes([...cloudBooks, ...loosePages])
      } else if (legacyNotes) {
        setNotes(legacyNotes.map((note) => note.kind === 'folder' || note.children ? withBookAccess(note, user.id) : note))
      }
      setInitialSnapshot(storedSnapshot)
      setSyncState(documentResult.error || booksResult.error ? 'error' : storedSnapshot ? 'saved' : 'waiting')
    }

    initialize()
    return () => {
      cancelled = true
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [authReady, user])

  const saveScene = useCallback((snapshot: CanvasSnapshot) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const canvasId = activeNoteRef.current
      let updatedNotes = updateNoteTree(notesRef.current, canvasId, (note) => ({ ...note, snapshot }))
      if (hasCanvasEmbed(updatedNotes, canvasId)) {
        try {
          const { exportToBlob } = await import('@excalidraw/excalidraw')
          const preview = await blobToDataUrl(await exportToBlob({ elements: snapshot.elements, appState: { ...snapshot.appState, exportBackground: true }, files: snapshot.files, mimeType: 'image/png', quality: 0.75 }))
          updatedNotes = refreshCanvasEmbeds(updatedNotes, canvasId, preview)
        } catch { /* Keep the previous preview if rendering fails. */ }
      }
      notesRef.current = updatedNotes
      setNotes(updatedNotes)
      await saveLocalScene(user?.id ?? 'anonymous', snapshot)
      if (!user || !supabase) {
        setSyncState('waiting')
        return
      }
      setSyncState('loading')
      const workspaceSnapshot: WorkspaceSnapshot = { ...snapshot, vedoyNotebook: updatedNotes }
      const { error } = await supabase.from('canvas_documents').upsert({ user_id: user.id, snapshot: workspaceSnapshot, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      setSyncState(error ? 'error' : 'saved')
    }, 800)
  }, [user, activeNote])

  useEffect(() => {
    if (!user || !supabase || initialSnapshot === undefined) return
    if (notebookSaveTimer.current) clearTimeout(notebookSaveTimer.current)
    notebookSaveTimer.current = setTimeout(async () => {
      const api = editorApi.current
      if (!api) return
      setSyncState('loading')
      const { serializeAsJSON } = await import('@excalidraw/excalidraw')
      const canvas = JSON.parse(serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'database')) as CanvasSnapshot
      const workspaceSnapshot: WorkspaceSnapshot = { ...canvas, vedoyNotebook: notes }
      const { error } = await supabase.from('canvas_documents').upsert({ user_id: user.id, snapshot: workspaceSnapshot, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      setSyncState(error ? 'error' : 'saved')
    }, 1000)
    return () => { if (notebookSaveTimer.current) clearTimeout(notebookSaveTimer.current) }
  }, [initialSnapshot, notes, user])

  useEffect(() => {
    if (!user || !supabase || initialSnapshot === undefined) return
    if (skipNextBookSave.current) {
      skipNextBookSave.current = false
      return
    }
    if (bookSaveTimer.current) clearTimeout(bookSaveTimer.current)
    bookSaveTimer.current = setTimeout(async () => {
      const books = notes.filter((note) => note.kind === 'folder' || note.children)
      const results = await Promise.all(books.map((book) => {
        const data = withoutAccessMetadata(book)
        const payload = { title: book.title, data, updated_at: new Date().toISOString() }
        if (book.ownerId && book.ownerId !== user.id) return supabase.from('canvas_books').update(payload).eq('id', book.id)
        return supabase.from('canvas_books').upsert({ id: book.id, owner_id: user.id, ...payload }, { onConflict: 'id' })
      }))
      setSyncState(results.some((result) => result.error) ? 'error' : 'saved')
    }, 1200)
    return () => { if (bookSaveTimer.current) clearTimeout(bookSaveTimer.current) }
  }, [initialSnapshot, notes, user])

  useEffect(() => {
    if (!user || !supabase) return
    const channel = supabase.channel(`canvas-books-${user.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'canvas_books' }, (payload) => {
      const next = payload.new as CloudBookRow | undefined
      const previous = payload.old as Partial<CloudBookRow> | undefined
      skipNextBookSave.current = true
      setNotes((current) => {
        if (payload.eventType === 'DELETE' && previous?.id) return current.filter((note) => note.id !== previous.id)
        if (!next?.id || !next.data) return current
        const updated = cloudBook(next, user.id)
        const index = current.findIndex((note) => note.id === next.id)
        if (index === -1) return [...current, updated]
        return current.map((note) => note.id === next.id ? updated : note)
      })
    }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [user])

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
    if (format === 'png') {
      const blob = await excalidraw.exportToBlob({ ...payload, mimeType: 'image/png' })
      downloadBlob(blob, 'vedoy-canvas.png')
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

  const canvasPreview = async (pageId: string) => {
    if (pageId !== activeNoteRef.current) await openNote(pageId)
    try { return await blobToDataUrl(await canvasPng()) } catch { return null }
  }

  const openCanvasPage = (pageId: string) => {
    void openNote(pageId)
    changeView('canvas')
  }

  const addBookToCanvas = async (bookId: string) => {
    const api = editorApi.current
    const book = findNote(notes, bookId)
    if (!api || !book) return
    const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
    const existing = api.getSceneElements()
    const offset = (existing.length % 4) * 340
    const elements = convertToExcalidrawElements([{
      type: 'rectangle',
      x: 180 + offset,
      y: 160 + Math.floor(existing.length / 4) * 190,
      width: 300,
      height: 130,
      backgroundColor: '#ede9fe',
      fillStyle: 'solid',
      strokeColor: '#7c3aed',
      roundness: { type: 3 },
      label: { text: `BOK\n${book.title}`, fontSize: 24 },
      customData: { vedoyBookId: book.id },
    }] as never)
    api.updateScene({ elements: [...existing, ...elements] })
    setBookPickerOpen(false)
    notify(`Boken «${book.title}» er lagt på canvas`)
  }

  const inviteToBook = async (bookId: string, email: string) => {
    if (!user || !supabase) return 'Logg inn for å dele bøker'
    const book = notes.find((note) => note.id === bookId)
    if (!book || (book.ownerId && book.ownerId !== user.id)) return 'Bare eieren kan invitere til denne boken'
    const bookResult = await supabase.from('canvas_books').upsert({ id: book.id, owner_id: user.id, title: book.title, data: withoutAccessMetadata(book), updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (bookResult.error) return `Deling feilet: ${bookResult.error.message}`
    const { error } = await supabase.from('canvas_book_members').upsert({ book_id: book.id, owner_id: user.id, invitee_email: email, role: 'editor' }, { onConflict: 'book_id,invitee_email' })
    return error ? `Delingen feilet: ${error.message}` : `Tilgang gitt til ${email}`
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
    const { serializeLibraryAsJSON } = await import('@excalidraw/excalidraw')
    downloadBlob(new Blob([serializeLibraryAsJSON(libraryItems as never)], { type: 'application/json' }), 'vedoy-library.excalidrawlib')
  }

  const openVedoyGraphics = async () => {
    const api = editorApi.current
    if (!api) return
    const { convertToExcalidrawElements } = await import('@excalidraw/excalidraw')
    const created = 1750000000000
    const graphics = [
      { id: 'vedoy-flow-node', name: 'Flow node', specs: [{ type: 'rectangle', x: 0, y: 0, width: 260, height: 100, backgroundColor: '#ede9fe', fillStyle: 'solid', strokeColor: '#7c3aed', roundness: { type: 3 } }, { type: 'text', x: 55, y: 37, width: 150, text: 'Prosess', fontSize: 24, strokeColor: '#4c1d95' }] },
      { id: 'vedoy-flow-decision', name: 'Beslutning', specs: [{ type: 'diamond', x: 20, y: 0, width: 220, height: 140, backgroundColor: '#fef3c7', fillStyle: 'solid', strokeColor: '#d97706' }, { type: 'text', x: 66, y: 57, width: 130, text: 'Valg?', fontSize: 24, strokeColor: '#92400e' }] },
      { id: 'vedoy-flow-start', name: 'Start / slutt', specs: [{ type: 'ellipse', x: 0, y: 0, width: 240, height: 100, backgroundColor: '#dcfce7', fillStyle: 'solid', strokeColor: '#16a34a' }, { type: 'text', x: 62, y: 37, width: 120, text: 'Start', fontSize: 24, strokeColor: '#166534' }] },
      { id: 'vedoy-flow-note', name: 'Vedøy-notat', specs: [{ type: 'rectangle', x: 0, y: 0, width: 260, height: 150, backgroundColor: '#fef9c3', fillStyle: 'solid', strokeColor: '#ca8a04', roundness: { type: 3 } }, { type: 'text', x: 25, y: 28, width: 210, text: 'Husk dette', fontSize: 24, strokeColor: '#713f12' }] },
      { id: 'vedoy-flow-arrow', name: 'Flyt-pil', specs: [{ type: 'arrow', x: 0, y: 40, width: 300, height: 0, startArrowhead: null, endArrowhead: 'arrow', strokeColor: '#7c3aed', strokeWidth: 4 }] },
    ].map((item) => ({ id: item.id, status: 'published' as const, created, name: item.name, elements: convertToExcalidrawElements(item.specs as never) }))
    await api.updateLibrary({ libraryItems: graphics as never, merge: true, openLibraryMenu: true })
    notify('Vedøy-grafikk åpnet i biblioteket')
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

  const fileActions: Array<{ icon: typeof MousePointer2; label: string; action: () => void }> = [
    { icon: FileUp, label: 'Åpne canvas', action: () => sceneInput.current?.click() },
    { icon: Save, label: 'Lagre .excalidraw', action: () => void saveSceneFile() },
    { icon: FileDown, label: 'Eksporter SVG', action: () => void exportCanvas('svg') },
    { icon: ImageIcon, label: 'Eksporter PNG', action: () => void exportCanvas('png') },
    { icon: FileText, label: 'Eksporter TXT', action: exportText },
    { icon: FileType2, label: 'Eksporter PDF', action: () => void exportPdf() },
    { icon: FileType2, label: 'Eksporter Word', action: () => void exportDocument('word') },
    { icon: FileType2, label: 'For Google Docs', action: () => void exportDocument('google') },
    { icon: FileType2, label: 'For Proton Docs', action: () => void exportDocument('proton') },
    { icon: Clipboard, label: 'Kopier PNG', action: () => void exportCanvas('clipboard') },
    { icon: LibraryBig, label: 'Importer bibliotek', action: () => libraryInput.current?.click() },
    { icon: BookOpen, label: 'Eksporter bibliotek', action: () => void exportLibrary() },
    { icon: HelpCircle, label: 'Snarveier og hjelp', action: () => setHelpOpen(true) },
    { icon: Trash2, label: 'Tøm canvas', action: clearCanvas },
  ]

  const signOut = async () => {
    await supabase?.auth.signOut()
    setUser(null)
    setSyncState('waiting')
  }

  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground"><style jsx global>{`.excalidraw .App-menu_top__left, .excalidraw .App-menu_top__right, .excalidraw .App-toolbar-container { display: none !important; }`}</style>
    <div className={`absolute inset-0 ${viewMode === 'canvas' ? 'block' : 'hidden'}`} aria-hidden={viewMode !== 'canvas'}>
      {initialSnapshot !== undefined && <CanvasEditor key={`${user?.id ?? 'anonymous'}-excalidraw-v1`} initialSnapshot={initialSnapshot} darkMode={darkMode} onApi={(api) => { editorApi.current = api }} onSceneChange={saveScene} onLibraryChange={setLibraryItems} onOpenBook={(bookId) => { void openNote(bookId); changeView('book') }} />}
    </div>
    {viewMode === 'book' && <div className="absolute inset-0"><BookView notes={notes} activeNote={activeNote} currentUserId={user?.id} userEmail={user?.email} onSelect={(id) => { void openNote(id) }} onAddBook={addBook} onAddSection={addSection} onAddPage={addPage} onAddFolder={addFolder} onRename={beginRename} onDelete={deleteNote} onAddTemplate={addTemplate} onUpdate={updateNote} onOpenCanvas={openCanvasPage} onCanvasPreview={canvasPreview} onInvite={inviteToBook} onNotify={notify} /></div>}

    <header className="absolute inset-x-4 top-4 z-10 flex items-center gap-1.5 rounded-xl border border-border/70 bg-card/95 px-2.5 py-2.5 shadow-md backdrop-blur-md sm:inset-x-6 sm:gap-2 sm:px-3">
      <button onClick={() => { setNotebookOpen((open) => !open); setMoreToolsOpen(false) }} className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${notebookOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} aria-label={notebookOpen ? 'Close notebook' : 'Open notebook'} aria-expanded={notebookOpen}><Menu className="size-[18px]" /></button>
      <div className="h-5 w-px bg-border" />
      <span className="hidden h-6 w-14 shrink-0 items-center sm:flex" aria-label="Vedøy">
        <Image src="/vedoy-logo-black.png" alt="Vedøy" width={960} height={438} className="h-5 w-auto object-contain dark:hidden" priority />
        <Image src="/vedoy-logo-white.png" alt="Vedøy" width={960} height={438} className="hidden h-5 w-auto object-contain dark:block" priority />
      </span>
      <div className="h-5 w-px shrink-0 bg-border" />
      <div className="flex shrink-0 rounded-lg bg-muted p-0.5" aria-label="Velg visning">
        <button type="button" onClick={() => changeView('canvas')} className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium ${viewMode === 'canvas' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} aria-label="Canvas" aria-pressed={viewMode === 'canvas'}><Brush className="size-3.5" /><span className="hidden sm:inline">Canvas</span></button>
        <button type="button" onClick={() => changeView('book')} className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium ${viewMode === 'book' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} aria-label="Bok" aria-pressed={viewMode === 'book'}><BookOpen className="size-3.5" /><span className="hidden sm:inline">Bok</span></button>
      </div>
      {viewMode === 'book' && <div className="hidden min-w-0 items-center gap-1 overflow-x-auto md:flex" aria-label="Tekstverktøy"><select defaultValue="Arial" onMouseDown={(event) => event.preventDefault()} onChange={(event) => bookTextCommand('fontName', event.target.value)} className="h-8 max-w-24 rounded-md border border-border bg-transparent px-1 text-[11px]" aria-label="Velg font"><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Courier New</option></select><select defaultValue="3" onMouseDown={(event) => event.preventDefault()} onChange={(event) => bookTextCommand('fontSize', event.target.value)} className="h-8 w-16 rounded-md border border-border bg-transparent px-1 text-[11px]" aria-label="Velg skriftstørrelse"><option value="1">10 px</option><option value="2">12 px</option><option value="3">14 px</option><option value="4">16 px</option><option value="5">20 px</option><option value="6">28 px</option><option value="7">36 px</option></select>{[['bold', 'B'], ['italic', 'I'], ['underline', 'U'], ['strikeThrough', 'S']].map(([command, label]) => <button key={command} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => bookTextCommand(command)} className="flex size-8 items-center justify-center rounded-md text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={command}>{label}</button>)}<button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => bookTextCommand('formatBlock', 'h2')} className="rounded-md px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground">H2</button></div>}
      {viewMode === 'canvas' && <button type="button" onClick={() => setBookPickerOpen((open) => !open)} className={`hidden items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:flex ${bookPickerOpen ? 'bg-muted text-foreground' : ''}`} aria-label="Legg bok på canvas" aria-expanded={bookPickerOpen}><BookOpen className="size-4" /><span className="hidden xl:inline">Bok</span></button>}
      <div className={`${viewMode === 'canvas' ? 'lg:flex' : 'lg:hidden'} hidden shrink-0 items-center gap-1`} aria-label="Tegneverktøy">
        {drawingTools.map((tool) => { const Icon = tool.icon; return <button key={tool.type} type="button" onClick={() => chooseTool(tool.type)} className={`flex size-8 items-center justify-center rounded-lg transition-colors ${activeTool === tool.type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} aria-label={tool.label} title={tool.label}><Icon className="size-4" /></button> })}
      </div>
      <div className={`${viewMode === 'canvas' ? 'flex' : 'hidden'} shrink-0 items-center gap-1 lg:hidden`} aria-label="Hurtigverktøy">
        {drawingTools.slice(0, 3).map((tool) => { const Icon = tool.icon; return <button key={tool.type} type="button" onClick={() => chooseTool(tool.type)} className={`${viewMode === 'canvas' ? 'sm:flex' : 'hidden'} hidden size-8 items-center justify-center rounded-lg transition-colors ${activeTool === tool.type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} aria-label={tool.label} title={tool.label}><Icon className="size-4" /></button> })}
        <button type="button" onClick={() => { setMoreToolsOpen((open) => !open); setNotebookOpen(false) }} className={`flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium ${moreToolsOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} aria-label="Se flere verktøy" aria-expanded={moreToolsOpen}>Mer <ChevronDown className={`size-3.5 transition-transform ${moreToolsOpen ? 'rotate-180' : ''}`} /></button>
      </div>
      {viewMode === 'canvas' && <><button type="button" onClick={() => historyShortcut(false)} className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:flex" aria-label="Angre" title="Angre"><Undo2 className="size-4" /></button>
      <button type="button" onClick={() => historyShortcut(true)} className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:flex" aria-label="Gjør om" title="Gjør om"><Redo2 className="size-4" /></button></>}
      <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />
      <button onClick={() => setDarkMode((value) => !value)} className="hidden size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted sm:flex" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>{darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
      {viewMode === 'canvas' && <button onClick={() => { void openVedoyGraphics() }} className="hidden items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:flex" aria-label="Åpne grafikkbibliotek"><BookOpen className="size-4" /><span className="hidden xl:inline">Grafikk</span></button>}
      <button onClick={() => { setActionsOpen((open) => !open); setMoreToolsOpen(false); setNotebookOpen(false) }} className="hidden items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:flex" aria-label="Fil og eksport"><Download className="size-4" /><span className="hidden xl:inline">Fil</span><ChevronDown className="size-3" /></button>
      {authReady && (user ? <>
        <span className="hidden max-w-36 truncate text-[11px] text-muted-foreground md:inline">{syncState === 'loading' ? 'Lagrer…' : syncState === 'error' ? 'Lagringsfeil' : 'Lagret'}</span>
        <button onClick={signOut} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Logg ut"><LogOut className="size-4" /></button>
      </> : <button onClick={startLogin} disabled={!clientId} className="flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-medium text-primary-foreground disabled:opacity-50 sm:h-auto sm:w-auto sm:px-3 sm:py-2" aria-label="Logg inn"><LogIn className="size-3.5" /><span className="hidden sm:inline">Logg inn</span></button>)}
    </header>

    <input ref={sceneInput} type="file" className="hidden" accept=".excalidraw,application/json" onChange={(event) => { void openSceneFile(event.target.files?.[0]); event.target.value = '' }} />
    <input ref={libraryInput} type="file" className="hidden" accept=".excalidrawlib,application/json" onChange={(event) => { void importLibrary(event.target.files?.[0]); event.target.value = '' }} />

    {actionsOpen && <div className="absolute right-4 top-[4.75rem] z-30 max-h-[calc(100vh-6rem)] w-64 overflow-y-auto rounded-xl border border-border/70 bg-card/95 p-2 shadow-lg backdrop-blur-md sm:right-6">
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Fil</div>
      {fileActions.map(({ icon: Icon, label, action }) => <button key={label} type="button" onClick={() => { action(); setActionsOpen(false) }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><Icon className="size-4" />{label}</button>)}
    </div>}

    {bookPickerOpen && <div className="absolute left-4 top-[4.75rem] z-30 w-72 rounded-xl border border-border/70 bg-card/95 p-2 shadow-lg backdrop-blur-md sm:left-auto sm:right-6" aria-label="Bøker på canvas"><p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Legg bok på canvas</p>{notes.filter((note) => note.kind === 'folder' || note.children).map((book) => <button key={book.id} type="button" onClick={() => { void addBookToCanvas(book.id) }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><BookOpen className="size-4" /><span className="truncate">{book.title}</span></button>)}</div>}

    {moreToolsOpen && <div className="absolute left-4 right-4 top-[4.75rem] z-20 grid grid-cols-4 gap-2 rounded-xl border border-border/70 bg-card/95 p-3 shadow-md backdrop-blur-md sm:left-auto sm:right-6 sm:w-80 lg:hidden" aria-label="Flere tegneverktøy">
      {drawingTools.slice(3).map((tool) => { const Icon = tool.icon; return <button key={tool.type} type="button" onClick={() => chooseTool(tool.type)} className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] transition-colors ${activeTool === tool.type ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="size-4" /><span>{tool.label}</span></button> })}
      <button type="button" onClick={() => historyShortcut(false)} className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"><Undo2 className="size-4" /><span>Angre</span></button>
      <button type="button" onClick={() => historyShortcut(true)} className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"><Redo2 className="size-4" /><span>Gjør om</span></button>
      <button type="button" onClick={() => setDarkMode((value) => !value)} className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden">{darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}<span>Tema</span></button>
      <button type="button" onClick={() => { void openVedoyGraphics(); setMoreToolsOpen(false) }} className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"><BookOpen className="size-4" /><span>Grafikk</span></button>
      <button type="button" onClick={() => { setActionsOpen(true); setMoreToolsOpen(false) }} className="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground sm:hidden"><Download className="size-4" /><span>Fil</span></button>
    </div>}

    {notebookOpen && <aside className="absolute left-4 top-[4.75rem] z-10 flex max-h-[calc(100vh-6rem)] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-xl border border-border/70 bg-card/95 p-3 shadow-md backdrop-blur-md sm:left-6" aria-label="Notebook navigator">
      <div className="flex items-center justify-between px-2 pb-3"><div className="flex items-center gap-2"><NotebookTabs className="size-4 text-muted-foreground" /><span className="text-xs font-semibold">Notebook</span></div><button onClick={() => setAddMenuOpen((open) => !open)} className={`flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground ${addMenuOpen ? 'bg-muted text-foreground' : ''}`} aria-label="Legg til bok eller side" aria-expanded={addMenuOpen}><FilePlus2 className="size-4" /></button></div>
      {addMenuOpen && <div className="mb-2 rounded-lg border border-border/70 bg-background p-1.5 shadow-sm"><p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Legg til</p><button onClick={addBook} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted"><FolderPlus className="size-3.5" />Ny bok</button><button onClick={() => addPage()} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted"><FilePlus2 className="size-3.5" />Ny side</button><button onClick={addSubpage} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted"><StickyNote className="size-3.5" />Ny underfil</button><button onClick={addSubfolder} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-muted"><FolderPlus className="size-3.5" />Ny undermappe</button></div>}
      <div className="border-t border-border/70 pt-2"><NoteTree notes={notes} activeNote={activeNote} expanded={expanded} onSelect={openNote} onToggle={toggleExpanded} onRename={beginRename} onFavorite={toggleFavorite} onDelete={deleteNote} onDrop={moveNote} /></div>
    </aside>}

    {nameDialog && <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm" onClick={() => { setNameDialog(null); setEditingNoteId(null) }}>
      <form onSubmit={(event) => { event.preventDefault(); saveNoteTitle() }} onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Nytt {nameDialog.kind}</p>
        <h2 className="mt-1 text-lg font-semibold">Gi {nameDialog.kind === 'bok' ? 'boken' : 'siden'} et navn</h2>
        <input autoFocus value={draftNoteTitle} onChange={(event) => setDraftNoteTitle(event.target.value)} className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30" aria-label={`Navn på ${nameDialog.kind}`} />
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setNameDialog(null); setEditingNoteId(null) }} className="rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-muted">Avbryt</button><button type="submit" className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">Lagre navn</button></div>
      </form>
    </div>}

    {authReady && !user && <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 mx-auto w-fit rounded-full border border-border/70 bg-card/95 px-4 py-2 text-xs text-muted-foreground shadow-md">Logg inn for sikker lagring i Supabase</div>}
    {toast && <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-medium text-background shadow-lg">{toast}</div>}
    {helpOpen && <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm" onClick={() => setHelpOpen(false)}><section className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Snarveier og hjelp</h2><button onClick={() => setHelpOpen(false)} className="rounded-lg px-3 py-1 text-sm hover:bg-muted">Lukk</button></div><div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><p><kbd>1</kbd> Velg</p><p><kbd>H</kbd> Flytt</p><p><kbd>R</kbd> Rektangel</p><p><kbd>O</kbd> Sirkel</p><p><kbd>A</kbd> Pil</p><p><kbd>P</kbd> Tegn</p><p><kbd>T</kbd> Tekst</p><p><kbd>Ctrl/Cmd + Z</kbd> Angre</p><p><kbd>Ctrl/Cmd + G</kbd> Grupper</p><p><kbd>Ctrl/Cmd + Shift + G</kbd> Løs opp</p></div><p className="mt-4 text-xs leading-5 text-muted-foreground">Høyreklikk på valgte elementer for lagrekkefølge, gruppering, justering, duplisering og å legge utvalget i biblioteket.</p></section></div>}
  </main>
}
