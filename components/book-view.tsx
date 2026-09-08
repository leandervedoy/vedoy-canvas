'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BookMarked, ChevronRight, FilePlus2, FileText, FolderPlus, Search } from 'lucide-react'
import type { Note } from '@/lib/notebook'

function findPath(items: Note[], id: string, path: Note[] = []): Note[] | null {
  for (const item of items) {
    const nextPath = [...path, item]
    if (item.id === id) return nextPath
    const found = findPath(item.children ?? [], id, nextPath)
    if (found) return found
  }
  return null
}

function collectPages(items: Note[]): Note[] {
  return items.flatMap((item) => item.kind === 'file' || !item.children ? [item] : collectPages(item.children))
}

function firstPage(item?: Note): Note | undefined {
  if (!item) return undefined
  if (item.kind === 'file' || !item.children) return item
  for (const child of item.children) {
    const page = firstPage(child)
    if (page) return page
  }
}

export function BookView({ notes, activeNote, onSelect, onAddBook, onAddSection, onAddPage, onUpdate }: {
  notes: Note[]
  activeNote: string
  onSelect: (id: string) => void
  onAddBook: () => void
  onAddSection: (bookId: string) => void
  onAddPage: (parentId?: string) => void
  onUpdate: (id: string, changes: Partial<Pick<Note, 'title' | 'content'>>) => void
}) {
  const [query, setQuery] = useState('')
  const pageEditor = useRef<HTMLTextAreaElement | null>(null)
  const books = notes.filter((note) => note.kind === 'folder' || note.children)
  const activePath = findPath(notes, activeNote)
  const activeBook = activePath?.[0] ?? books[0] ?? notes[0]
  const sections = (activeBook?.children ?? []).filter((note) => note.kind === 'folder' || note.children)
  const activeSection = activePath?.slice(1).find((note) => note.kind === 'folder' || note.children) ?? sections[0]
  const pageScope = activeSection ? activeSection.children ?? [] : activeBook?.children ?? notes
  const pages = useMemo(() => collectPages(pageScope).filter((page) => page.title.toLowerCase().includes(query.toLowerCase())), [pageScope, query])
  const currentPage = activePath?.findLast((note) => note.kind === 'file' || !note.children) ?? firstPage(activeSection ?? activeBook)
  const pageParentId = activeSection?.id ?? activeBook?.id

  useEffect(() => {
    const editor = pageEditor.current
    if (!editor) return
    editor.style.height = 'auto'
    editor.style.height = `${editor.scrollHeight}px`
  }, [currentPage?.id, currentPage?.content])

  return (
    <section className="flex h-full min-h-0 bg-[#f5f3ee] pt-[4.75rem] text-[#27251f] dark:bg-[#151515] dark:text-[#f5f3ee]" aria-label="Bokvisning">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-black/10 bg-[#27251f] px-3 py-5 text-white md:flex" aria-label="Bøker">
        <div className="mb-4 flex items-center justify-between px-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Mine bøker</span>
          <button type="button" onClick={onAddBook} className="flex size-7 items-center justify-center rounded-md hover:bg-white/10" aria-label="Ny bok"><FolderPlus className="size-4" /></button>
        </div>
        <div className="space-y-1">
          {books.map((book, index) => <button key={book.id} type="button" onClick={() => { const page = firstPage(book); onSelect(page?.id ?? book.id) }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${book.id === activeBook?.id ? 'bg-white/14 text-white' : 'text-white/65 hover:bg-white/8 hover:text-white'}`}>
            <span className={`h-7 w-1.5 rounded-full ${['bg-violet-400', 'bg-amber-400', 'bg-sky-400', 'bg-emerald-400'][index % 4]}`} />
            <BookMarked className="size-4 shrink-0" /><span className="truncate font-medium">{book.title}</span>
          </button>)}
        </div>
        <button type="button" onClick={onAddBook} className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/55 hover:bg-white/8 hover:text-white"><FolderPlus className="size-4" />Ny bok</button>
      </aside>

      <aside className="flex w-36 shrink-0 flex-col border-r border-black/10 bg-white/70 py-4 dark:border-white/10 dark:bg-white/5 sm:w-56" aria-label="Sider">
        <div className="px-3">
          <p className="truncate text-sm font-semibold">{activeBook?.title ?? 'Min bok'}</p>
          <div className="mt-3 flex gap-1 overflow-x-auto pb-2">
            {sections.map((section) => <button key={section.id} type="button" onClick={() => { const page = firstPage(section); onSelect(page?.id ?? section.id) }} className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${section.id === activeSection?.id ? 'bg-violet-600 text-white' : 'bg-black/5 text-black/55 hover:bg-black/10 dark:bg-white/10 dark:text-white/65'}`}>{section.title}</button>)}
            {activeBook && <button type="button" onClick={() => onAddSection(activeBook.id)} className="shrink-0 rounded-md px-2 py-1 text-[10px] text-black/45 hover:bg-black/5 dark:text-white/45" aria-label="Ny seksjon">+ Seksjon</button>}
          </div>
          <label className="mt-1 flex items-center gap-2 rounded-lg border border-black/10 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-black/20">
            <Search className="size-3.5 text-black/35 dark:text-white/35" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-black/35 dark:placeholder:text-white/35" placeholder="Søk i sider" aria-label="Søk i sider" />
          </label>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-black/10 px-2 py-2 dark:border-white/10">
          {pages.map((page) => <button key={page.id} type="button" onClick={() => onSelect(page.id)} className={`mb-1 flex w-full items-start gap-2 rounded-lg px-2.5 py-2.5 text-left ${page.id === currentPage?.id ? 'bg-violet-100 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
            <FileText className="mt-0.5 size-3.5 shrink-0 opacity-50" /><span className="min-w-0"><span className="block truncate text-xs font-medium">{page.title}</span><span className="mt-0.5 block truncate text-[10px] opacity-45">{page.content?.trim() || 'Tom side'}</span></span><ChevronRight className="ml-auto mt-0.5 size-3 opacity-30" />
          </button>)}
        </div>
        <button type="button" onClick={() => onAddPage(pageParentId)} className="m-2 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-violet-700"><FilePlus2 className="size-4" />Ny side</button>
      </aside>

      <article className="min-w-0 flex-1 overflow-y-auto px-2 py-3 sm:px-8 sm:py-5 lg:px-14" aria-label="Aktiv side">
        {currentPage ? <div className="mx-auto min-h-[calc(100vh-7rem)] max-w-4xl rounded-sm bg-white px-4 py-6 shadow-[0_2px_18px_rgba(39,37,31,0.08)] dark:bg-[#202020] sm:px-10 sm:py-8 lg:px-14">
          <input value={currentPage.title} onChange={(event) => onUpdate(currentPage.id, { title: event.target.value })} className="w-full border-b border-black/10 bg-transparent pb-4 text-2xl font-semibold tracking-tight outline-none placeholder:text-black/25 dark:border-white/10 dark:placeholder:text-white/25 sm:text-3xl" placeholder="Sidetittel" aria-label="Sidetittel" />
          <textarea ref={pageEditor} value={currentPage.content ?? ''} onChange={(event) => onUpdate(currentPage.id, { content: event.target.value })} className="mt-6 min-h-[calc(100vh-15rem)] w-full resize-none overflow-hidden bg-transparent text-[15px] leading-7 outline-none placeholder:text-black/30 dark:placeholder:text-white/30" placeholder="Begynn å skrive hvor som helst på siden …" aria-label="Sideinnhold" />
          <button type="button" onClick={() => onAddPage(pageParentId)} className="mt-10 flex items-center gap-2 rounded-lg border border-dashed border-black/20 px-3 py-2 text-xs text-black/45 hover:border-violet-400 hover:text-violet-700 dark:border-white/20 dark:text-white/45"><FilePlus2 className="size-4" />Fortsett med en ny side</button>
        </div> : <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center"><BookMarked className="size-12 text-violet-500" /><h2 className="mt-4 text-xl font-semibold">Denne boken er tom</h2><p className="mt-2 text-sm opacity-55">Lag så mange sider du trenger.</p><button type="button" onClick={() => onAddPage(pageParentId)} className="mt-5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white">Lag første side</button></div>}
      </article>
    </section>
  )
}
