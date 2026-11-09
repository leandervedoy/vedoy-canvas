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

export type BookTemplateId = 'customer-meeting' | 'project-plan' | 'idea-book' | 'weekly-plan' | 'article-template'

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
  { id: 'article-template', title: 'Artikkelmal', description: 'SEO, leseflyt, interaktivitet og trykk' },
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

  if (templateId === 'article-template') return {
    id: `book-${prefix}`,
    title: 'Artikkel',
    kind: 'folder',
    children: [
      section(`section-${prefix}-start`, 'Start', [
        page(`page-${prefix}-title`, 'Tittel og ingress', '<h1>[Tall eller tydelig løfte]: Slik kan [målgruppe] oppnå [ønsket resultat]</h1><p><strong>Ingress:</strong> Mange [målgruppe] opplever [problem]. Med noen enkle grep kan du [fordel]. Her får du en praktisk oversikt over [hovedtema].</p><h2>Kort fortalt</h2><ul><li><strong>Dette handler saken om:</strong> [kort forklaring]</li><li><strong>Dette gjelder for:</strong> [målgruppe]</li><li><strong>Viktigste råd:</strong> [råd]</li><li><strong>Tidsbruk:</strong> [5 minutter]</li><li><strong>Vanskelighetsgrad:</strong> [enkel/middels/avansert]</li></ul>'),
        page(`page-${prefix}-toc`, 'Innholdsfortegnelse', '<h2>I denne artikkelen</h2><ol><li>Hva er [tema]?</li><li>Hvorfor er det viktig?</li><li>De vanligste utfordringene</li><li>Slik går du frem</li><li>Vanlige feil</li><li>Eksempel fra virkeligheten</li><li>Sjekkliste</li><li>Konklusjon</li></ol>'),
      ]),
      section(`section-${prefix}-body`, 'Hoveddel', [
        page(`page-${prefix}-hook`, 'Krok og forklaring', '<h2>Innledning</h2><p><strong>Krok:</strong> Start med et spørsmål, en kort historie, et faktum eller et scenario.</p><blockquote>I denne artikkelen viser vi hvordan du kan [konkret resultat], steg for steg.</blockquote><h2>Hva betyr [hovedtema]?</h2><ul><li>Hva er det?</li><li>Hva er det ikke?</li><li>Hvem har nytte av det?</li><li>Hvorfor er det relevant nå?</li></ul>'),
        page(`page-${prefix}-why`, 'Hvorfor bry seg?', '<h2>Hvorfor bør leseren bry seg?</h2><ul><li>Spare tid</li><li>Redusere kostnader</li><li>Unngå vanlige feil</li><li>Føle seg tryggere</li><li>Ta bedre beslutninger</li></ul><p>Knytt hvert punkt til hva leseren faktisk sparer i tid, penger, frustrasjon eller risiko.</p>'),
        page(`page-${prefix}-steps`, 'Stegvis hoveddel', '<h2>Steg 1: [Handlingsrettet overskrift]</h2><ol><li>Hva skal leseren gjøre?</li><li>Hvorfor er det viktig?</li><li>Hvordan gjøres det?</li><li>Hva bør leseren passe på?</li></ol><h3>Prøv dette</h3><p>[Konkret råd eller handling]</p><h3>Vær oppmerksom på</h3><p>[Vanlig feil, risiko eller misforståelse]</p><hr><p>Gjenta strukturen for steg 2, 3 og 4.</p>'),
      ]),
      section(`section-${prefix}-proof`, 'Eksempel og dokumentasjon', [
        page(`page-${prefix}-story`, 'Menneskelig historie', '<h2>Eksempel eller menneskelig historie</h2><ul><li><strong>Utgangspunkt:</strong> Hva var problemet?</li><li><strong>Utfordring:</strong> Hva gjorde situasjonen vanskelig?</li><li><strong>Tiltak:</strong> Hva ble gjort?</li><li><strong>Resultat:</strong> Hva ble bedre?</li><li><strong>Lærdom:</strong> Hva kan leseren ta med seg?</li></ul><p>Bruk ekte sitater når det er mulig, og merk tydelig hvis eksempelet er oppdiktet.</p>'),
        page(`page-${prefix}-facts`, 'Fakta og kilder', '<h2>Faktaboks</h2><ul><li><strong>Kilde:</strong> [navn på kilde]</li><li><strong>Dato:</strong> [dato]</li><li><strong>Nøkkeltall:</strong> [relevant tall]</li><li><strong>Hva betyr dette?</strong> [kort forklaring]</li></ul><p>Skill tydelig mellom fakta, meninger og råd. Bruk ekspertkilder ved økonomi, helse, jus, sikkerhet, teknologi og personvern.</p>'),
      ]),
      section(`section-${prefix}-interactive`, 'Interaktivitet og handling', [
        page(`page-${prefix}-interactive`, 'Interaktive elementer', '<h2>Digital versjon</h2><ul><li>Klikkbare innholdslenker</li><li>Avstemning eller quiz</li><li>Kalkulator</li><li>Avkrysningsliste</li><li>Før-og-etter-visning</li><li>Relatert innhold</li><li>Nedlastbar sjekkliste</li></ul><h2>Trykt versjon</h2><ul><li>QR-kode med tekstlig alternativ</li><li>Telefonnummer eller kort nettadresse</li><li>Avkrysningsliste</li><li>Spørsmål i margen</li></ul><p>Artikkelen skal alltid gi mening uten mobil, internett eller interaktive funksjoner.</p>'),
        page(`page-${prefix}-errors`, 'Vanlige feil', '<h2>Dette bør du unngå</h2><ol><li>[Vanlig feil]</li><li>[Vanlig feil]</li><li>[Vanlig feil]</li><li>[Vanlig feil]</li></ol><h3>Slik gjør du det bedre</h3><p>[Kort og konkret forbedring]</p>'),
        page(`page-${prefix}-checklist`, 'Sjekkliste', '<h2>Før du avslutter</h2><p data-task="true"><input type="checkbox"> Jeg har definert temaet enkelt.</p><p data-task="true"><input type="checkbox"> Jeg har svart på leserens viktigste spørsmål.</p><p data-task="true"><input type="checkbox"> Jeg har brukt tydelige mellomtitler.</p><p data-task="true"><input type="checkbox"> Jeg har gitt konkrete råd.</p><p data-task="true"><input type="checkbox"> Jeg har forklart vanskelige ord.</p><p data-task="true"><input type="checkbox"> Jeg har oppgitt relevante kilder.</p><p data-task="true"><input type="checkbox"> Jeg har kontrollert fakta og datoer.</p><p data-task="true"><input type="checkbox"> Artikkelen fungerer uten bilder og interaktive funksjoner.</p><p data-task="true"><input type="checkbox"> Leseren vet hva neste steg er.</p>'),
      ]),
      section(`section-${prefix}-finish`, 'Publisering', [
        page(`page-${prefix}-conclusion`, 'Konklusjon og CTA', '<h2>Konklusjon</h2><p>[Tema] trenger ikke å være vanskelig. Ved å [tiltak 1], [tiltak 2] og [tiltak 3] kan du allerede i dag [ønsket resultat].</p><h3>Prøv dette i dag</h3><p>Start med [minste og enkleste første steg].</p><h2>Call to action</h2><p>Velg én hovedhandling: last ned sjekklisten, del artikkelen, les videre, test løsningen, bestill en vurdering eller ta kontakt.</p>'),
        page(`page-${prefix}-seo`, 'SEO', '<h2>SEO-mal</h2><ul><li><strong>Hovedsøkeord:</strong> [ord eller frase]</li><li><strong>Relaterte søkeord:</strong> [ord 1], [ord 2], [ord 3]</li><li><strong>Søkeintensjon:</strong> Hva ønsker leseren å finne ut eller gjøre?</li><li><strong>SEO-tittel:</strong> [Hovedsøkeord]: [tydelig løfte]</li><li><strong>Metabeskrivelse:</strong> ca. 140–160 tegn</li><li><strong>URL:</strong> /enkle-rad-om-tema</li><li><strong>Alt-tekst:</strong> Beskriv bildet konkret og relevant</li></ul>'),
        page(`page-${prefix}-rhythm`, 'Lengde og rytme', '<h2>Anbefalt lengde og rytme</h2><ul><li>Korte avsnitt på 1–4 setninger</li><li>Ny mellomtittel hver 150–250 ord</li><li>Punktlister der det passer</li><li>Viktigste poeng tidlig</li><li>Variasjon mellom fakta, eksempel og råd</li><li>Én tydelig idé om gangen</li><li>Et visuelt element omtrent hver 300–500 ord</li></ul><h2>Hovedregelen</h2><ol><li><strong>Hvorfor skal jeg bry meg?</strong></li><li><strong>Hva bør jeg vite eller gjøre?</strong></li><li><strong>Hva er mitt neste steg?</strong></li></ol>'),
      ]),
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
