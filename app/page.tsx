'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, Eraser, FilePlus2, FolderPlus, Hand, Menu, Minus, MousePointer2, NotebookTabs, Pencil, Plus, Redo2, StickyNote, TextCursorInput, Undo2 } from 'lucide-react'

type Note = { id: string; title: string; children?: Note[] }

const initialNotes: Note[] = [
  { id: 'canvas', title: 'Canvas ideas', children: [{ id: 'research', title: 'Research' }, { id: 'directions', title: 'Directions' }] },
  { id: 'launch', title: 'Product launch', children: [{ id: 'timeline', title: 'Timeline' }] },
  { id: 'inbox', title: 'Untitled note' },
]

const tools = [
  { label: 'Select', icon: MousePointer2 },
  { label: 'Draw', icon: Pencil },
  { label: 'Eraser', icon: Eraser },
  { label: 'Sticky note', icon: StickyNote },
  { label: 'Text', icon: TextCursorInput },
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

export default function Page() {
  const [activeTool, setActiveTool] = useState('Select')
  const [zoom, setZoom] = useState(100)
  const [notebookOpen, setNotebookOpen] = useState(false)
  const [notes, setNotes] = useState(initialNotes)
  const [activeNote, setActiveNote] = useState('canvas')
  const [expanded, setExpanded] = useState(['canvas', 'launch'])

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
  const changeZoom = (amount: number) => setZoom((current) => Math.min(200, Math.max(25, current + amount)))

  return <main className="canvas-shell relative min-h-screen overflow-hidden bg-background text-foreground selection:bg-primary/15">
    <div className="canvas-art absolute inset-0" aria-label="Infinite canvas workspace">
      <div className="sticky-note absolute left-[18%] top-[30%] w-52 rotate-[-3deg] rounded-xl bg-canvas-yellow p-5 shadow-note transition-transform hover:rotate-0">
        <div className="mb-8 flex items-start justify-between"><StickyNote className="size-4 text-foreground/60" /><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/50">Note 01</span></div>
        <p className="text-base font-medium leading-relaxed text-foreground">Ideas become clearer when you can see the whole picture.</p><div className="mt-5 text-[11px] text-foreground/55">Just now</div>
      </div>
      <div className="absolute left-[56%] top-[25%] h-44 w-64 rotate-[8deg] rounded-[34%_66%_58%_42%/43%_33%_67%_57%] border-[6px] border-canvas-blue/80 bg-canvas-blue/10 shadow-[10px_12px_0_var(--canvas-blue-soft)]" aria-label="Blue drawn shape" />
      <div className="absolute left-[58%] top-[38%] h-20 w-28 rotate-[-18deg] rounded-[55%_45%_35%_65%/60%_45%_55%_40%] border-[5px] border-canvas-blue/55" />
      <div className="absolute left-[18%] top-[57%] max-w-60 rotate-[2deg] rounded-xl border border-border/60 bg-card/90 px-4 py-3 text-xs text-muted-foreground shadow-md"><span className="font-medium text-foreground">Research</span><br />Collect references before the next sketch.</div>
    </div>

    <header className="absolute left-4 top-4 flex items-center gap-3 rounded-xl border border-border/70 bg-card/95 px-3 py-2.5 shadow-md backdrop-blur-md sm:left-6 sm:top-6">
      <button onClick={() => setNotebookOpen((open) => !open)} className={`flex size-8 items-center justify-center rounded-lg ${notebookOpen ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} aria-label="Open notebook"><Menu className="size-[18px]" /></button>
      <div className="h-5 w-px bg-border" /><span className="pr-1 text-sm font-semibold">Vedoy Canvas</span>
    </header>

    {notebookOpen && <aside className="absolute left-4 top-[4.75rem] flex w-72 flex-col rounded-xl border border-border/70 bg-card/95 p-3 shadow-md backdrop-blur-md sm:left-6 sm:top-[5.25rem]" aria-label="Notebook navigator">
      <div className="flex items-center justify-between px-2 pb-3"><div className="flex items-center gap-2"><NotebookTabs className="size-4 text-muted-foreground" /><span className="text-xs font-semibold">Notebook</span></div><div className="flex items-center"><button onClick={addNote} className="flex size-7 items-center justify-center" aria-label="Add sub note"><FilePlus2 className="size-3.5" /></button><button className="flex size-7 items-center justify-center" aria-label="New notebook"><FolderPlus className="size-3.5" /></button></div></div>
      <div className="border-t border-border/70 pt-2"><NoteTree notes={notes} activeNote={activeNote} expanded={expanded} onSelect={setActiveNote} onToggle={toggleExpanded} /></div>
      <div className="mt-3 border-t border-border/70 px-2 pt-3 text-[11px] leading-5 text-muted-foreground">Now editing <span className="font-medium text-foreground">{currentNote?.title}</span><br />Organize ideas with nested notes.</div>
    </aside>}

    <div className="absolute right-4 top-4 rounded-xl border border-border/70 bg-card/95 p-1.5 shadow-md sm:right-6 sm:top-6"><button className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground" aria-label="Export canvas"><Download className="size-3.5" /><span className="hidden sm:inline">Export</span></button></div>
    <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/70 bg-card/95 p-1.5 shadow-md sm:bottom-7 sm:p-2">{tools.map(({ label, icon: Icon }) => <button key={label} onClick={() => setActiveTool(label)} aria-label={label} aria-pressed={activeTool === label} className={`flex size-10 items-center justify-center rounded-full sm:size-11 ${activeTool === label ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}><Icon className="size-[18px]" /></button>)}</div>
    <div className="absolute bottom-5 right-4 flex items-center rounded-full border border-border/70 bg-card/95 p-1.5 shadow-md sm:bottom-7 sm:right-6"><button onClick={() => changeZoom(10)} className="flex size-8 items-center justify-center" aria-label="Zoom in"><Plus className="size-4" /></button><button onClick={() => changeZoom(-10)} className="flex size-8 items-center justify-center" aria-label="Zoom out"><Minus className="size-4" /></button><button onClick={() => setZoom(100)} className="min-w-12 px-2 py-2 text-[11px]" aria-label="Reset zoom">{zoom}%</button></div>
    <div className="absolute bottom-7 left-6 hidden items-center gap-2 text-[11px] text-muted-foreground/70 lg:flex"><Hand className="size-3.5" /><span>Space to pan</span><span>·</span><Undo2 className="size-3.5" /><Redo2 className="size-3.5" /></div>
  </main>
}
