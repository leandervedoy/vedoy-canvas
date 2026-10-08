'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { BookMarked, FilePlus2, FolderPlus, LayoutTemplate, Pencil, Share2, Trash2, Users, X } from 'lucide-react'
import { RichTextEditor, richHtmlFromLegacy, sanitizeRichHtml } from '@/components/rich-text-editor'
import { bookTemplates, plainTextFromHtml, type BookTemplateId, type Note } from '@/lib/notebook'

function findPath(items: Note[], id: string, path: Note[] = []): Note[] | null {
  for (const item of items) {
    const nextPath = [...path, item]
    if (item.id === id) return nextPath
    const found = findPath(item.children ?? [], id, nextPath)
    if (found) return found
  }
  return null
}

function firstPage(item?: Note): Note | undefined {
  if (!item) return undefined
  if (item.kind === 'canvas' || item.kind === 'frame' || item.kind === 'website' || item.kind === 'board') return undefined
  if (item.kind === 'file' || !item.children) return item
  for (const child of item.children) {
    const page = firstPage(child)
    if (page) return page
  }
}

function parentIdOf(items: Note[], id: string, parentId?: string): string | undefined {
  for (const item of items) {
    if (item.id === id) return parentId
    const found = parentIdOf(item.children ?? [], id, item.id)
    if (found) return found
  }
}

export function BookView({ notes, libraryItems, activeNote, currentUserId, userEmail, onSelect, onAddPage, onAddFolder, onRename, onDelete, onAddTemplate, onUpdate, onOpenCanvas, onCanvasPreview, onInvite, onNotify }: {
  notes: Note[]
  libraryItems: Array<{ id: string; title: string; width?: number; height?: number }>
  activeNote: string
  currentUserId?: string
  userEmail?: string
  onSelect: (id: string) => void
  onAddPage: (parentId?: string) => void
  onAddFolder: (parentId?: string) => void
  onRename: (id: string) => void
  onDelete: (id: string) => void
  onAddTemplate: (templateId: BookTemplateId) => void
  onUpdate: (id: string, changes: Partial<Pick<Note, 'title' | 'content' | 'contentHtml'>>) => void
  onOpenCanvas: (canvasId: string) => void
  onCanvasPreview: (canvasId: string) => Promise<string | null>
  onInvite: (bookId: string, email: string) => Promise<string>
  onNotify: (message: string) => void
}) {
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ note: Note; x: number; y: number; parentId?: string } | null>(null)
  const hoverMenuTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const books = notes.filter((note) => note.kind === 'folder' || note.children)
  const activePath = findPath(notes, activeNote)
  const activeBook = activePath?.[0] ?? books[0] ?? notes[0]
  const currentPage = activePath?.findLast((note) => note.kind !== 'canvas' && note.kind !== 'frame' && note.kind !== 'website' && note.kind !== 'board' && (note.kind === 'file' || !note.children)) ?? firstPage(activeBook)
  const pageParentId = activePath?.slice(1).findLast((note) => note.kind === 'folder' || note.children)?.id ?? activeBook?.id
  const canEdit = currentPage?.canEdit !== false && activeBook?.canEdit !== false
  const canShare = Boolean(currentUserId && (!activeBook?.ownerId || activeBook.ownerId === currentUserId))
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [contextMenu])

  useEffect(() => () => {
    if (hoverMenuTimer.current) clearTimeout(hoverMenuTimer.current)
  }, [])

  const openContextMenu = (event: MouseEvent, note: Note) => {
    if (note.canEdit === false || activeBook?.canEdit === false) return
    event.preventDefault()
    event.stopPropagation()
    const width = 208
    const height = 180
    setContextMenu({ note, parentId: parentIdOf(notes, note.id), x: Math.min(event.clientX, window.innerWidth - width - 8), y: Math.min(event.clientY, window.innerHeight - height - 8) })
  }

  const scheduleHoverMenu = (event: MouseEvent, note: Note) => {
    if (note.canEdit === false || activeBook?.canEdit === false) return
    if (hoverMenuTimer.current) clearTimeout(hoverMenuTimer.current)
    const rect = event.currentTarget.getBoundingClientRect()
    hoverMenuTimer.current = setTimeout(() => {
      const width = 208
      const height = 180
      setContextMenu({ note, parentId: parentIdOf(notes, note.id), x: Math.min(rect.right + 6, window.innerWidth - width - 8), y: Math.min(rect.top, window.innerHeight - height - 8) })
    }, 1000)
  }

  const cancelHoverMenu = () => {
    if (hoverMenuTimer.current) clearTimeout(hoverMenuTimer.current)
    hoverMenuTimer.current = null
  }

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

  return <section className="relative flex h-full min-h-0 bg-[#f5f3ee] pt-0 text-[#27251f] dark:bg-[#151515] dark:text-[#f5f3ee]" aria-label="Bokvisning">
    <article className="min-w-0 flex-1 overflow-y-auto px-2 py-3 sm:px-8 sm:py-5 lg:px-14" aria-label="Aktiv side">
      {currentPage ? <div className="mx-auto min-h-[calc(100vh-7rem)] max-w-4xl rounded-sm bg-white px-4 py-6 shadow-[0_2px_18px_rgba(39,37,31,0.08)] dark:bg-[#202020] sm:px-10 sm:py-8 lg:px-14">
        <input value={currentPage.title} disabled={!canEdit} onChange={(event) => onUpdate(currentPage.id, { title: event.target.value })} className="w-full border-b border-black/10 bg-transparent pb-4 text-2xl font-semibold tracking-tight outline-none placeholder:text-black/25 disabled:opacity-70 dark:border-white/10 dark:placeholder:text-white/25 sm:text-3xl" placeholder="Sidetittel" aria-label="Sidetittel" />
        {canEdit ? <RichTextEditor pageId={currentPage.id} html={currentPage.contentHtml ?? richHtmlFromLegacy(currentPage.content)} canvasOptions={libraryItems} onChange={(contentHtml) => onUpdate(currentPage.id, { contentHtml, content: undefined })} onOpenCanvas={onOpenCanvas} onCanvasPreview={onCanvasPreview} onNotify={onNotify} /> : <div className="rich-editor mt-6" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(currentPage.contentHtml ?? richHtmlFromLegacy(currentPage.content)) }} />}
        {canEdit ? <button type="button" onClick={() => onAddPage(pageParentId)} className="mt-10 flex items-center gap-2 rounded-lg border border-dashed border-black/20 px-3 py-2 text-xs text-black/45 hover:border-violet-400 hover:text-violet-700 dark:border-white/20 dark:text-white/45"><FilePlus2 className="size-4" />Fortsett med en ny side</button> : null}
      </div> : <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center text-center"><BookMarked className="size-12 text-violet-500" /><h2 className="mt-4 text-xl font-semibold">Denne boken er tom</h2><p className="mt-2 text-sm opacity-55">Lag så mange sider du trenger.</p>{canEdit ? <button type="button" onClick={() => onAddPage(pageParentId)} className="mt-5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white">Lag første side</button> : null}</div>}
    </article>

    {contextMenu ? <div role="menu" aria-label={`Handlinger for ${contextMenu.note.title}`} className="fixed z-50 w-52 rounded-xl border border-black/10 bg-white p-1.5 text-[#27251f] shadow-xl dark:border-white/10 dark:bg-[#292929] dark:text-white" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
      <p className="truncate px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] opacity-45">{contextMenu.note.title}</p>
      <button role="menuitem" type="button" onClick={() => { onAddFolder(contextMenu.note.kind === 'folder' ? contextMenu.note.id : contextMenu.parentId); setContextMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10"><FolderPlus className="size-3.5" />Opprett undermappe</button>
      <button role="menuitem" type="button" onClick={() => { onAddPage(contextMenu.note.kind === 'folder' ? contextMenu.note.id : contextMenu.parentId); setContextMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10"><FilePlus2 className="size-3.5" />Opprett ny side</button>
      <button role="menuitem" type="button" onClick={() => { onRename(contextMenu.note.id); setContextMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10"><Pencil className="size-3.5" />Gi nytt navn</button>
      <div className="my-1 border-t border-black/10 dark:border-white/10" />
      <button role="menuitem" type="button" onClick={() => { onDelete(contextMenu.note.id); setContextMenu(null) }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"><Trash2 className="size-3.5" />Slett</button>
    </div> : null}

    {templatesOpen ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onClick={() => setTemplatesOpen(false)}><section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#272727]" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">Maler</p><h2 className="text-lg font-semibold">Start med en ferdig bok</h2></div><button type="button" onClick={() => setTemplatesOpen(false)} className="flex size-8 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Lukk maler"><X className="size-4" /></button></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{bookTemplates.map((template) => <button key={template.id} type="button" onClick={() => { onAddTemplate(template.id); setTemplatesOpen(false) }} className="rounded-xl border border-black/10 p-4 text-left hover:border-violet-300 hover:bg-violet-50 dark:border-white/10 dark:hover:bg-violet-500/10"><LayoutTemplate className="size-5 text-violet-600" /><span className="mt-3 block text-sm font-semibold">{template.title}</span><span className="mt-1 block text-xs opacity-55">{template.description}</span></button>)}</div></section></div> : null}

    {shareOpen ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onClick={() => setShareOpen(false)}><section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#272727]" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">Samarbeid</p><h2 className="text-lg font-semibold">Del «{activeBook?.title}»</h2></div><button type="button" onClick={() => setShareOpen(false)} className="flex size-8 items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Lukk deling"><X className="size-4" /></button></div>{canShare ? <><p className="mt-3 text-xs opacity-60">Kollegaen får redigeringstilgang når de logger inn med denne e-postadressen.</p><form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); void submitInvite() }}><input type="email" required value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="kollega@firma.no" className="min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10" aria-label="E-post til kollega" /><button type="submit" disabled={inviting} className="rounded-lg bg-violet-600 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50">{inviting ? 'Deler…' : 'Inviter'}</button></form></> : <p className="mt-4 rounded-lg bg-black/5 p-3 text-sm opacity-65 dark:bg-white/5">{userEmail ? 'Bare eieren kan invitere flere til denne boken.' : 'Logg inn for å dele bøker.'}</p>}</section></div> : null}
  </section>
}
