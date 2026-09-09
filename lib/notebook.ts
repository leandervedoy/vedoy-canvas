import type { CanvasSnapshot } from '@/components/canvas-editor'

export type Note = {
  id: string
  title: string
  kind?: 'folder' | 'file'
  favorite?: boolean
  content?: string
  contentHtml?: string
  snapshot?: CanvasSnapshot
  children?: Note[]
  ownerId?: string
  shared?: boolean
  canEdit?: boolean
}

export type BookTemplateId = 'customer-meeting' | 'project-plan' | 'idea-book' | 'weekly-plan'

export type BookTemplate = {
  id: BookTemplateId
  title: string
  description: string
}

export const bookTemplates: BookTemplate[] = [
  { id: 'customer-meeting', title: 'Kundemøte', description: 'Agenda, notater og neste steg' },
  { id: 'project-plan', title: 'Prosjektplan', description: 'Mål, fremdrift og oppgaver' },
  { id: 'idea-book', title: 'Idébok', description: 'Idéer, research og prioritering' },
  { id: 'weekly-plan', title: 'Ukesplan', description: 'Fokus, avtaler og ukesoppgaver' },
]

const page = (id: string, title: string, contentHtml: string): Note => ({ id, title, kind: 'file', contentHtml })
const section = (id: string, title: string, children: Note[]): Note => ({ id, title, kind: 'folder', children })

export function createBookFromTemplate(templateId: BookTemplateId, seed = Date.now()): Note {
  const prefix = `${templateId}-${seed}`

  if (templateId === 'customer-meeting') return {
    id: `book-${prefix}`,
    title: 'Kundemøte',
    kind: 'folder',
    children: [section(`section-${prefix}-meeting`, 'Møte', [
      page(`page-${prefix}-agenda`, 'Agenda', '<h2>Agenda</h2><ul><li>Tema 1</li><li>Tema 2</li></ul>'),
      page(`page-${prefix}-notes`, 'Møtenotater', '<h2>Notater</h2><p>Skriv hovedpunktene fra møtet her.</p><h3>Neste steg</h3><p data-task="true"><input type="checkbox"> Avtal oppfølging</p>'),
    ])],
  }

  if (templateId === 'project-plan') return {
    id: `book-${prefix}`,
    title: 'Prosjektplan',
    kind: 'folder',
    children: [
      section(`section-${prefix}-overview`, 'Oversikt', [page(`page-${prefix}-goal`, 'Mål og omfang', '<h2>Prosjektmål</h2><p>Hva skal prosjektet oppnå?</p><h3>Omfang</h3><ul><li>Leveranse</li><li>Målgruppe</li></ul>')]),
      section(`section-${prefix}-delivery`, 'Gjennomføring', [page(`page-${prefix}-tasks`, 'Oppgaver', '<h2>Oppgaver</h2><p data-task="true"><input type="checkbox"> Første milepæl</p><p data-task="true"><input type="checkbox"> Neste milepæl</p>')]),
    ],
  }

  if (templateId === 'weekly-plan') return {
    id: `book-${prefix}`,
    title: 'Ukesplan',
    kind: 'folder',
    children: [section(`section-${prefix}-week`, 'Denne uken', [
      page(`page-${prefix}-focus`, 'Ukens fokus', '<h2>Ukens viktigste mål</h2><p data-task="true"><input type="checkbox"> Viktigste oppgave</p><h3>Avtaler</h3><ul><li>Mandag</li><li>Fredag</li></ul>'),
      page(`page-${prefix}-review`, 'Ukesoppsummering', '<h2>Hva gikk bra?</h2><p><br></p><h2>Hva tar jeg med videre?</h2><p><br></p>'),
    ])],
  }

  return {
    id: `book-${prefix}`,
    title: 'Idébok',
    kind: 'folder',
    children: [section(`section-${prefix}-ideas`, 'Ideer', [
      page(`page-${prefix}-capture`, 'Nye ideer', '<h2>Idéer</h2><p>Samle tanker, bilder og skisser her.</p>'),
      page(`page-${prefix}-priorities`, 'Prioritering', '<h2>Ideer å teste</h2><p data-task="true"><input type="checkbox"> Velg én idé</p><p data-task="true"><input type="checkbox"> Test med en ekte kunde</p>'),
    ])],
  }
}

export function plainTextFromHtml(html = '') {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function canvasText(note: Note) {
  return (note.snapshot?.elements ?? [])
    .filter((element): element is typeof element & { text: string } => element.type === 'text' && 'text' in element)
    .map((element) => element.text)
    .join(' ')
}

export function noteSearchText(note: Note) {
  return [note.title, note.content, plainTextFromHtml(note.contentHtml), canvasText(note)].filter(Boolean).join(' ').toLowerCase()
}
