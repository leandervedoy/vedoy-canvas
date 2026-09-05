'use client'

import 'tldraw/tldraw.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient, type User } from '@supabase/supabase-js'
import { getSnapshot, loadSnapshot, Tldraw, type Editor, type TLShapeId, toRichText } from 'tldraw'
import { ChevronDown, ChevronRight, Download, FilePlus2, FolderPlus, LogIn, LogOut, Menu, Moon, NotebookTabs, StickyNote, Sun } from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const clientId = process.env.NEXT_PUBLIC_VEDOY_LOGIN_CLIENT_ID
const callbackUrl = 'https://vedoy-canvas.vercel.app/auth/callback'
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

type Note = { id: string; title: string; children?: Note[] }

const initialNotes: Note[] = [
  { id: 'canvas', title: 'Canvas ideas', children: [{ id: 'research', title: 'Research' }, { id: 'directions', title: 'Directions' }] },
  { id: 'launch', title: 'Product launch', children: [{ id: 'timeline', title: 'Timeline' }] },
  { id: 'inbox', title: 'Untitled note' },
]

function NoteTree({ notes, activeNote, expanded, onSelect, onToggle }: { notes: Note[]; activeNote: string; expanded: string[]; onSelect: (id: string) => void; onToggle: (id: string) => void }) {
  return <div className="flex flex-col gap-0.5">{notes.map((note) => {
    const hasChildren = Boolean(note.children?.length)
    const isExpanded = expanded.includes(note.id)
    return <div key={note.id}>
      <div className={`flex items-center gap-1 rounded-lg pr-2 transition-colors ${activeNote === note.id ? 'bg-muted' : 'hover:bg-muted/70'}`}>
        <button onClick={() => hasChildren && onToggle(note.id)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground" aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${note.title}`} disabled={!hasChildren}>
          {hasChildren ? (isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />) : <span className="size-3.5" />}
        </button>
        <button onClick={() => onSelect(note.id)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-xs font-medium"><StickyNote className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{note.title}</span></button>
      </div>
      {hasChildren && isExpanded && <div className="ml-4 border-l border-border/70 pl-2"><NoteTree notes={note.children ?? []} activeNote={activeNote} expanded={expanded} onSelect={onSelect} onToggle={onToggle} /></div>}
    </div>
  })}</div>
}

function seedCanvas(editor: Editor) {
  if (editor.getCurrentPageShapeIds().size > 0) return
  editor.createShapes([
    { type: 'note', x: 260, y: 180, props: { richText: toRichText('Ideas become clearer when you can see the whole picture.') } },
    { type: 'geo', x: 650, y: 160, props: { geo: 'ellipse', w: 280, h: 190, color: 'blue', fill: 'semi', dash: 'draw', size: 'm' } },
    { type: 'text', x: 280, y: 470, props: { richText: toRichText('Research\nCollect references before the next sketch.'), size: 'm', color: 'black' } },
  ])
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
  const [editor, setEditor] = useState<Editor | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [syncState, setSyncState] = useState<'waiting' | 'loading' | 'saved' | 'error'>('waiting')
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [notes, setNotes] = useState(initialNotes)
  const [activeNote, setActiveNote] = useState('canvas')
  const [expanded, setExpanded] = useState(['canvas', 'launch'])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentNote = useMemo(() => {
    const find = (items: Note[]): Note | undefined => {
      for (const item of items) {
        if (item.id === activeNote) return item
        const found = item.children && find(item.children)
        if (found) return found
      }
    }
    return find(notes)
  }, [activeNote, notes])

  const addNote = () => {
    const id = `note-${Date.now()}`
    setNotes((current) => [...current, { id, title: 'New sub note' }])
    setActiveNote(id)
  }

  const toggleExpanded = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    supabase.auth.getUser().then(({ data }) => { setUser(data.user ?? null); setAuthReady(true) })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.documentElement.classList.toggle('light', !darkMode)
    editor?.user.updateUserPreferences({ colorScheme: darkMode ? 'dark' : 'light' })
  }, [darkMode, editor])

  useEffect(() => {
    if (editor && authReady && !user) seedCanvas(editor)
  }, [editor, authReady, user])

  useEffect(() => {
    if (!editor || !user || !supabase) return
    let cancelled = false
    let stopListening: (() => void) | undefined

    const initialize = async () => {
      setSyncState('loading')
      const { data, error } = await supabase.from('canvas_documents').select('snapshot').eq('user_id', user.id).maybeSingle()
      if (cancelled) return
      if (error) { setSyncState('error'); return }

      if (data?.snapshot) {
        loadSnapshot(editor.store, data.snapshot)
      } else seedCanvas(editor)

      const save = async () => {
        const snapshot = getSnapshot(editor.store)
        const { error: saveError } = await supabase.from('canvas_documents').upsert({ user_id: user.id, snapshot, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
        if (!cancelled) setSyncState(saveError ? 'error' : 'saved')
      }

      await save()
      stopListening = editor.store.listen(() => {
        setSyncState('loading')
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(save, 800)
      }, { scope: 'document', source: 'user' })
    }

    initialize()
    return () => {
      cancelled = true
      stopListening?.()
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [editor, user])

  const exportCanvas = async () => {
    if (!editor) return
    const ids = Array.from(editor.getCurrentPageShapeIds()) as TLShapeId[]
    const svg = await editor.getSvgString(ids)
    if (!svg) return
    const url = URL.createObjectURL(new Blob([svg.svg], { type: 'image/svg+xml' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'vedoy-canvas.svg'
    link.click()
    URL.revokeObjectURL(url)
  }

  const signOut = async () => {
    await supabase?.auth.signOut()
    setUser(null)
    setSyncState('waiting')
  }

  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
    <div className="absolute inset-0"><Tldraw onMount={setEditor} /></div>

    <header className="absolute left-4 top-20 z-10 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-border/70 bg-card/95 px-3 py-2.5 shadow-md backdrop-blur-md sm:left-6">
      <button onClick={() => setNotebookOpen((open) => !open)} className={`flex size-8 items-center justify-center rounded-lg ${notebookOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} aria-label={notebookOpen ? 'Close notebook' : 'Open notebook'} aria-expanded={notebookOpen}><Menu className="size-[18px]" /></button>
      <div className="h-5 w-px bg-border" />
      <span className="pr-1 text-sm font-semibold">Vedoy Canvas</span>
      <button onClick={() => setDarkMode((value) => !value)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>{darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
      {authReady && (user ? <>
        <span className="hidden max-w-36 truncate text-[11px] text-muted-foreground md:inline">{syncState === 'loading' ? 'Lagrer…' : syncState === 'error' ? 'Lagringsfeil' : 'Lagret'}</span>
        <button onClick={signOut} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Logg ut"><LogOut className="size-4" /></button>
      </> : <button onClick={startLogin} disabled={!clientId} className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"><LogIn className="size-3.5" />Logg inn</button>)}
    </header>

    {notebookOpen && <aside className="absolute left-4 top-[8.75rem] z-10 flex max-h-[calc(100vh-10rem)] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-xl border border-border/70 bg-card/95 p-3 shadow-md backdrop-blur-md sm:left-6" aria-label="Notebook navigator">
      <div className="flex items-center justify-between px-2 pb-3"><div className="flex items-center gap-2"><NotebookTabs className="size-4 text-muted-foreground" /><span className="text-xs font-semibold">Notebook</span></div><div className="flex items-center"><button onClick={addNote} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Add sub note"><FilePlus2 className="size-3.5" /></button><button className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="New notebook"><FolderPlus className="size-3.5" /></button></div></div>
      <div className="border-t border-border/70 pt-2"><NoteTree notes={notes} activeNote={activeNote} expanded={expanded} onSelect={setActiveNote} onToggle={toggleExpanded} /></div>
      <div className="mt-3 border-t border-border/70 px-2 pt-3 text-[11px] leading-5 text-muted-foreground">Now editing <span className="font-medium text-foreground">{currentNote?.title}</span><br />Organize ideas with nested notes.</div>
    </aside>}

    <button onClick={exportCanvas} className="absolute right-4 top-20 z-10 flex items-center gap-2 rounded-xl border border-border/70 bg-card/95 px-3 py-2.5 text-xs font-medium text-muted-foreground shadow-md backdrop-blur-md sm:right-6" aria-label="Export canvas"><Download className="size-3.5" /><span className="hidden sm:inline">Export</span></button>
    {authReady && !user && <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 mx-auto w-fit rounded-full border border-border/70 bg-card/95 px-4 py-2 text-xs text-muted-foreground shadow-md">Logg inn for sikker lagring i Supabase</div>}
  </main>
}
