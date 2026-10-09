'use client'

import 'tldraw/tldraw.css'
import { useEffect, useMemo, useState } from 'react'
import { Tldraw, type Editor, type TLShapeId, toRichText } from 'tldraw'
import { ChevronDown, ChevronRight, Download, FilePlus2, FolderPlus, Menu, Moon, NotebookTabs, StickyNote, Sun } from 'lucide-react'

type Note = { id: string; title: string; children?: Note[] }
const initialNotes: Note[] = [
  { id: 'canvas', title: 'Canvas ideas', children: [{ id: 'research', title: 'Research' }, { id: 'directions', title: 'Directions' }] },
  { id: 'launch', title: 'Product launch', children: [{ id: 'timeline', title: 'Timeline' }] },
  { id: 'inbox', title: 'Untitled note' },
]

function NoteTree({ notes, activeNote, expanded, onSelect, onToggle }: { notes: Note[]; activeNote: string; expanded: string[]; onSelect: (id: string) => void; onToggle: (id: string) => void }) {
  return <div className="flex flex-col gap-0.5">{notes.map((note) => { const hasChildren = Boolean(note.children?.length); const open = expanded.includes(note.id); return <div key={note.id}><div className={`flex items-center gap-1 rounded-lg pr-2 ${activeNote === note.id ? 'bg-muted' : 'hover:bg-muted/70'}`}><button className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground" onClick={() => hasChildren && onToggle(note.id)} disabled={!hasChildren} aria-label={`${open ? 'Collapse' : 'Expand'} ${note.title}`}>{hasChildren ? (open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />) : <span className="size-3.5" />}</button><button className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-xs font-medium" onClick={() => onSelect(note.id)}><StickyNote className="size-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{note.title}</span></button></div>{hasChildren && open && <div className="ml-4 border-l border-border/70 pl-2"><NoteTree notes={note.children ?? []} activeNote={activeNote} expanded={expanded} onSelect={onSelect} onToggle={onToggle} /></div>}</div> })}</div>
}

export default function Page() {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.documentElement.classList.toggle('light', !darkMode)
    editor?.user.updateUserPreferences({ colorScheme: darkMode ? 'dark' : 'light' })
  }, [darkMode, editor])
  const [notes, setNotes] = useState(initialNotes)
  const [activeNote, setActiveNote] = useState('canvas')
  const [expanded, setExpanded] = useState(['canvas', 'launch'])
  const currentNote = useMemo(() => { const find = (items: Note[]): Note | undefined => { for (const item of items) { if (item.id === activeNote) return item; const found = item.children && find(item.children); if (found) return found } }; return find(notes) }, [activeNote, notes])
  const addNote = () => { const id = `note-${Date.now()}`; setNotes((items) => [...items, { id, title: 'New sub note' }]); setActiveNote(id) }
  const toggleExpanded = (id: string) => setExpanded((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])
  const seed = (instance: Editor) => {
    setEditor(instance)
    if (instance.getCurrentPageShapeIds().size > 0) return
    instance.createShapes([
      { type: 'note', x: 260, y: 180, props: { richText: toRichText('Ideas become clearer when you can see the whole picture.') } },
      { type: 'geo', x: 650, y: 160, props: { geo: 'ellipse', w: 280, h: 190, color: 'blue', fill: 'semi', dash: 'draw', size: 'm' } },
      { type: 'text', x: 280, y: 470, props: { richText: toRichText('Research\nCollect references before the next sketch.'), size: 'm', color: 'black' } },
    ])
  }
  const exportCanvas = async () => { if (!editor) return; const ids = Array.from(editor.getCurrentPageShapeIds()) as TLShapeId[]; const svg = await editor.getSvgString(ids); if (!svg) return; const blob = new Blob([svg.svg], { type: 'image/svg+xml' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'vedoy-canvas.svg'; link.click(); URL.revokeObjectURL(url) }

  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground"><div className="absolute inset-0"><Tldraw persistenceKey="vedoy-canvas-v2" onMount={seed} inferDarkMode={false} /></div>
    <header className="absolute left-4 top-20 z-10 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-border/70 bg-card/95 px-3 py-2.5 shadow-md backdrop-blur-md sm:left-6 sm:top-20"><button onClick={() => setNotebookOpen((open) => !open)} className={`flex size-8 items-center justify-center rounded-lg ${notebookOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'}`} aria-label="Open notebook"><Menu className="size-[18px]" /></button><div className="h-5 w-px bg-border" /><span className="pr-1 text-sm font-semibold">Vedoy Canvas</span><button onClick={() => setDarkMode((value) => !value)} className="ml-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'} title={darkMode ? 'Light mode' : 'Dark mode'}>{darkMode ? <Sun className="size-4" /> : <Moon className="size-4" />}</button></header>
    {notebookOpen && <aside className="absolute left-4 top-[4.75rem] z-10 flex w-72 flex-col rounded-xl border border-border/70 bg-card/95 p-3 shadow-md backdrop-blur-md sm:left-6 sm:top-36" aria-label="Notebook navigator"><div className="flex items-center justify-between px-2 pb-3"><div className="flex items-center gap-2"><NotebookTabs className="size-4 text-muted-foreground" /><span className="text-xs font-semibold">Notebook</span></div><div className="flex gap-1"><button onClick={addNote} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Add sub note"><FilePlus2 className="size-3.5" /></button><button className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="New notebook"><FolderPlus className="size-3.5" /></button></div></div><div className="border-t border-border/70 pt-2"><NoteTree notes={notes} activeNote={activeNote} expanded={expanded} onSelect={setActiveNote} onToggle={toggleExpanded} /></div><div className="mt-3 border-t border-border/70 px-2 pt-3 text-[11px] leading-5 text-muted-foreground">Now editing <span className="font-medium text-foreground">{currentNote?.title}</span><br />Organize ideas with nested notes.</div></aside>}
    <button onClick={exportCanvas} className="absolute right-4 top-20 z-10 flex items-center gap-2 rounded-xl border border-border/70 bg-card/95 px-3 py-2.5 text-xs font-medium text-muted-foreground shadow-md hover:bg-muted hover:text-foreground sm:right-6 sm:top-20" aria-label="Export canvas"><Download className="size-3.5" /><span className="hidden sm:inline">Export</span></button>

  </main>
}
