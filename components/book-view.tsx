'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { BookMarked, ChevronRight, FilePlus2, FileText, FolderPlus, GripVertical, LayoutTemplate, PanelLeftClose, PanelLeftOpen, Search, Share2, Users, X } from 'lucide-react'
import { RichTextEditor, richHtmlFromLegacy, sanitizeRichHtml } from '@/components/rich-text-editor'
import { bookTemplates, noteSearchText, plainTextFromHtml, type BookTemplateId, type Note } from '@/lib/notebook'

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

export function BookView({ notes, activeNote, currentUserId, userEmail, onSelect, onAddBook, onAddSection, onAddPage, onAddTemplate, onUpdate, onOpenCanvas, onCanvasPreview, onInvite, onNotify }: {
  notes: Note[]
  activeNote: string
  currentUserId?: string
  userEmail?: string
  onSelect: (id: string) => void
  onAddBook: () => void
  onAddSection: (bookId: string) => void
  onAddPage: (parentId?: string) => void
  onAddTemplate: (templateId: BookTemplateId) => void
  onUpdate: (id: string, changes: Partial<Pick<Note, 'title' | 'content' | 'contentHtml'>>) => void
  onOpenCanvas: (pageId: string) => void
  onCanvasPreview: (pageId: string) => Promise<string | null>
  onInvite: (bookId: string, email: string) => Promise<string>
  onNotify: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const [navigationOpen, setNavigationOpen] = useState(true)
  const [navigationWidth, setNavigationWidth] = useState(432)
  const [isResizing, setIsResizing] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const books = notes.filter((note) => note.kind === 'folder' || note.children)
  const activePath = findPath(notes, activeNote)
  const activeBook = activePath?.[0] ?? books[0] ?? notes[0]
  const sections = (activeBook?.children ?? []).filter((note) => note.kind === 'folder' || note.children)
  const activeSection = activePath?.slice(1).find((note) => note.kind === 'folder' || note.children) ?? sections[0]
  const pageScope = activeSection ? activeSection.children ?? [] : activeBook?.children ?? notes
  const currentPage = activePath?.findLast((note) => note.kind === 'file' || !note.children) ?? firstPage(activeSection ?? activeBook)
  const pageParentId = activeSection?.id ?? activeBook?.id
  const canEdit = currentPage?.canEdit !== false && activeBook?.canEdit !== false
  const canShare = Boolean(currentUserId && (!activeBook?.ownerId || activeBook.ownerId === currentUserId))
  const normalizedQuery = query.trim().toLowerCase()
  const pages = useMemo(() => {
    if (!normalizedQuery) return collectPages(pageScope)
    return collectPages(notes).filter((page) => {
      const path = findPath(notes, page.id) ?? []
      return `${path.map((item) => item.title).join(' ')} ${noteSearchText(page)}`.toLowerCase().includes(normalizedQuery)
    })
  }, [normalizedQuery, notes, pageScope])

  const submitInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!activeBook || !email) return
    setInviting(true)
    const message = await onInvite(activeBook.id, email)
    setInviting(false)
    onNotify(message)
    if (message.startsWith('Tilgang')) {
      setInviteEmail('')
      setShareOpen(false)
    }
  }

  return <section className="relative flex h-full min-h-0 bg-[#f5f3ee] pt-[4.75rem] text-[#27251f] dark:bg-[#151515] dark:text-[#f5f3ee]" aria-label="Bokvisning">
    {!navigationOpen && <button type="button" onClick={() => setNavigationOpen(true)} className="absolute left-2 top-20 z-20 flex size-9 items-center justify-center rounded-lg border border-black/10 bg-white/90 text-[#27251f] shadow-sm backdrop-blur hover:bg-white dark:border-white/10 dark:bg-[#27251f]/90 dark:text-white" aria-label="Åpne boknavigasjon"><PanelLeftOpen className="size-4" /></button>}

    {navigationOpen ? <div className="relative flex w-36 shrink-0 sm:w-56 md:w-[var(--book-navigation-width)]" style={{ '--book-navigation-width': `${navigationWidth}px` } as CSSProperties}>
      <aside className="hidden w-52 shrink-0 flex-col border-r border-black/10 bg-[#27251f] px-3 py-5 text-white md:flex" aria-label="Bøker">
        <div className="mb-4 flex items-center justify-between px-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">Mine bøker</span>
          <button type="button" onClick={onAddBook} className="flex size-7 items-center justify-center rounded-md hover:bg-white/10" aria-label="Ny bok"><FolderPlus className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {books.map((book, index) => <button key={book.id} type="button" onClick={() => { const page = firstPage(book); onSelect(page?.id ?? book.id) }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs transition-colors ${book.id === activeBook?.id ? 'bg-white/14 text-white' : 'text-white/65 hover:bg-white/8 hover:text-white'}`}>
            <span className={`h-7 w-1.5 rounded-full ${['bg-violet-400', 'bg-amber-400', 'bg-sky-400', 'bg-emerald-400'][index % 4]}`} />
            <BookMarked className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate font-medium">{book.title}</span>{book.shared ? <Users className="size-3 shrink-0 opacity-65" /> : null}
          </button>)}
        </div>
        <button type="button" onClick={onAddBook} className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/55 hover:bg-white/8 hover:text-white"><FolderPlus className="size-4" />Ny bok</button>
        <button type="button" onClick={() => setTemplatesOpen(true)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-white/55 hover:bg-white/8 hover:text-white"><LayoutTemplate className="size-4" />Maler</button>
      </aside>

      <aside className="flex min-w-0 flex-1 flex-col border-r border-black/10 bg-white/70 py-4 dark:border-white/10 dark:bg-white/5" aria-label="Sider">
        <div className="px-3">
          <div className="flex items-center gap-1">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{activeBook?.title ?? 'Min bok'}</p>
            <button type="button" onClick={() => setShareOpen(true)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-black/40 hover:bg-black/5 hover:text-violet-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-violet-300" aria-label="Del bok"><Share2 className="size-3.5" /></button>
            <button type="button" onClick={() => setNavigationOpen(false)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-black/40 hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Lukk boknavigasjon"><PanelLeftClose className="size-4" /></button>
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto pb-2">
            {sections.map((section) => <button key={section.id} type="button" onClick={() => { const page = firstPage(section); onSelect(page?.id ?? section.id) }} className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${section.id === activeSection?.id ? 'bg-violet-600 text-white' : 'bg-black/5 text-black/55 hover:bg-black/10 dark:bg-white/10 dark:text-white/65'}`}>{section.title}</button>)}
            {activeBook && canEdit ? <button type="button" onClick={() => onAddSection(activeBook.id)} className="shrink-0 rounded-md px-2 py-1 text-[10px] text-black/45 hover:bg-black/5 dark:text-white/45" aria-label="Ny seksjon">+ Seksjon</button> : null}
          </div>
          <label className="mt-1 flex items-center gap-2 rounded-lg border border-black/10 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-black/20">
            <Search className="size-3.5 text-black/35 dark:text-white/35" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-black/35 dark:placeholder:text-white/35" placeholder="Søk i alt" aria-label="Søk i alle bøker og canvas" />
          </label>
          {normalizedQuery ? <p className="mt-1.5 text-[10px] text-black/40 dark:text-white/40">{pages.length} treff i bøker og canvas</p> : null}
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-black/10 px-2 py-2 dark:border-white/10">
          {pages.map((page) => {
            const path = findPath(notes, page.id) ?? []
            const preview = plainTextFromHtml(page.contentHtml) || page.content?.trim() || (noteSearchText(page).replace(page.title.toLowerCase(), '').trim()) || 'Tom side'
            return <button key={page.id} type="button" onClick={() => onSelect(page.id)} className={`mb-1 flex w-full items-start gap-2 rounded-lg px-2.5 py-2.5 text-left ${page.id === currentPage?.id ? 'bg-violet-100 text-violet-950 dark:bg-violet-500/20 dark:text-violet-100' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
              <FileText className="mt-0.5 size-3.5 shrink-0 opacity-50" /><span className="min-w-0"><span className="block truncate text-xs font-medium">{page.title}</span><span className="mt-0.5 block truncate text-[10px] opacity-45">{normalizedQuery ? `${path[0]?.title ?? 'Bok'} · ` : ''}{preview}</span></span><ChevronRight className="ml-auto mt-0.5 size-3 opacity-30" />
            </button>
          })}
        </div>
        {canEdit ? <button type="button" onClick={() => onAddPage(pageParentId)} className="m-2 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-3 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-violet-700"><FilePlus2 className="size-4" />Ny side</button> : <p className="m-3 text-center text-[10px] text-black/45 dark:text-white/45">Kun lesetilgang</p>}
      </aside>
      <button type="button" onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setIsResizing(true) }} onPointerMove={(event) => { if (isResizing) setNavigationWidth(Math.min(640, Math.max(360, event.clientX))) }} onPointerUp={(event) => { setIsResizing(false); event.currentTarget.releasePointerCapture(event.pointerId) }} className="absolute -right-2 top-0 z-10 hidden h-full w-4 cursor-col-resize touch-none items-center justify-center text-black/20 hover:text-violet-600 md:flex dark:text-white/20 dark:hover:text-violet-400" aria-label="Juster bredden på boknavigasjonen">
        <GripVertical className="size-4 rounded bg-white/80 shadow-sm dark:bg-[#27251f]/80" />
      </button>
    </div> : null}

    <article className="min-w-0 flex-1 overflow-y-auto px-2 py-3 sm:px-8 sm:py-5 lg:px-14" aria-label="Aktiv side">
      {currentPage ? <div className="mx-auto min-h-[calc(100vh-7rem)] max-w-4xl rounded-sm bg-white px-4 py-6 shadow-[0_2px_18px_rgba(39,37,31,0.08)] dark:bg-[#202020] sm:px-10 sm:py-8 lg:px-14">
        <input value={currentPage.title} disabled={!canEdit} onChange={(event) => onUpdate(currentPage.id, { title: event.target.value })} className="w-full border-b border-black/10 bg-transparent pb-4 text-2xl font-semibold tracking-tight outline-none placeholder:text-black/25 disabled:opacity-70 dark:border-white/10 dark:placeholder:text-white/25 sm:text-3xl" placeholder="Sidetittel" aria-label="Sidetittel" />
        {canEdit ? <RichTextEditor pageId={currentPage.id} html={currentPage.contentHtml ?? richHtmlFromLegacy(currentPage.content)} onChange={(contentHtml) => onUpdate(currentPage.id, { contentHtml, content: undefined })} onOpenCanvas={() => onOpenCanvas(currentPage.id)} onCanvasPreview={() => onCanvasPreview(currentPage.id)} onNotify={onNotify} /> : <div className="rich-editor mt-6" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(currentPage.contentHtml ?? richHtmlFromLegacy(currentPage.content)) }} />}
        {canEdit ? <button type="button" onClick={() => onAddPage(pageParentId)} className="mt-10 flex items-center gap-2 rounded-lg border border-dashed border-black/20 px-3 py-2 text-xs text-black/45 hover:border-violet-400 hover:text-violet-700 dark:border-white/20 dark:text-white/45"><FilePlus2 className="size-4" />Fortsett med en ny side</button> : null}
      </div> : <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center"><BookMarked className="size-12 text-violet-500" /><h2 className="mt-4 text-xl font-semibold">Denne boken er tom</h2><p className="mt-2 text-sm opacity-55">Lag så mange sider du trenger.</p>{canEdit ? <button type="button" onClick={() => onAddPage(pageParentId)} className="mt-5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white">Lag første side</button> : null}</div>}
    </article>

    {templatesOpen ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onClick={() => setTemplatesOpen(false)}><section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#272727]" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">Maler</p><h2 className="text-lg font-semibold">Start med en ferdig bok</h2></div><button type="button" onClick={() => setTemplatesOpen(false)} className="flex size-8 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Lukk maler"><X className="size-4" /></button></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{bookTemplates.map((template) => <button key={template.id} type="button" onClick={() => { onAddTemplate(template.id); setTemplatesOpen(false) }} className="rounded-xl border border-black/10 p-4 text-left hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:hover:bg-violet-500/10"><LayoutTemplate className="size-5 text-violet-600" /><span className="mt-3 block text-sm font-semibold">{template.title}</span><span className="mt-1 block text-xs opacity-55">{template.description}</span></button>)}</div></section></div> : null}

    {shareOpen ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onClick={() => setShareOpen(false)}><section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#272727]" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">Samarbeid</p><h2 className="text-lg font-semibold">Del «{activeBook?.title}»</h2></div><button type="button" onClick={() => setShareOpen(false)} className="flex size-8 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Lukk deling"><X className="size-4" /></button></div>{canShare ? <><p className="mt-3 text-xs opacity-60">Kollegaen får redigeringstilgang når de logger inn med denne e-postadressen.</p><form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void submitInvite() }}><input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="kollega@firma.no" className="min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10" aria-label="E-post til kollega" /><button type="submit" disabled={inviting} className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50">{inviting ? 'Deler…' : 'Inviter'}</button></form></> : <p className="mt-4 rounded-lg bg-black/5 p-3 text-sm opacity-65 dark:bg-white/5">{userEmail ? 'Bare eieren kan invitere flere til denne boken.' : 'Logg inn for å dele bøker.'}</p>}</section></div> : null}
  </section>
}
