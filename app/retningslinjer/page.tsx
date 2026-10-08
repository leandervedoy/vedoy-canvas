import Link from 'next/link'

export const metadata = { title: 'Retningslinjer og kontakt · Vedøy Canvas' }

export default function Guidelines() {
  return <main className="mx-auto max-w-3xl space-y-8 px-6 py-12 leading-relaxed">
    <Link href="/" className="underline">← Til Vedøy Canvas</Link>
    <h1 className="text-3xl font-semibold">Retningslinjer og kontakt</h1>
    <section><h2 className="text-xl font-semibold">Kontakt</h2><p>Eiolf-Leander Haugsnes Vedøy</p><p><a className="underline" href="mailto:kundeservice@vedoystudio.no">kundeservice@vedoystudio.no</a><br /><a className="underline" href="tel:+4745917041">+47 45917041</a></p></section>
    <section><h2 className="text-xl font-semibold">Ditt innhold</h2><p>Last bare opp materiale du har rett til å bruke. Du beholder rettighetene til innholdet ditt. Kontroller lisensvilkårene for grafikk, fonter og biblioteker du importerer før publisering eller kommersiell bruk.</p></section>
    <section><h2 className="text-xl font-semibold">Lagring og sikkerhetskopi</h2><p>Arbeid uten innlogging og opplastingsbiblioteket lagres lokalt i nettleseren. Sletting av nettleserdata kan fjerne innholdet. Eksporter viktige tavler som .excalidraw og biblioteker som .excalidrawlib. Kontroller lagringsstatus; lokal lagring er ikke en sikkerhetskopi i skyen.</p></section>
    <section><h2 className="text-xl font-semibold">Ansvarlig bruk</h2><p>Ikke bruk tjenesten til ulovlig innhold, trakassering, svindel eller krenkelse av andres rettigheter. Unngå å legge inn passord og sensitive personopplysninger. Meld feil eller problematisk innhold til kundeservice med en beskrivelse og eventuell lenke.</p></section>
    <section><h2 className="text-xl font-semibold">KI og eksterne tjenester</h2><p>Når du velger KI-generering, sendes forespørselen til tjenestens modellleverandør via OpenRouter. Kontroller resultatet før bruk. Importerte biblioteker og eksterne lenker kan ha egne vilkår.</p></section>
    <section><h2 className="text-xl font-semibold">Åpen kildekode</h2><p>Canvas bygger på Excalidraw, Next.js, React og Lucide. Dokumenteksport bruker docx og jsPDF. Disse har egne lisenser og dokumentasjon.</p><ul className="list-inside list-disc">{[['Excalidraw', 'https://docs.excalidraw.com/'], ['Next.js', 'https://nextjs.org/docs'], ['React', 'https://react.dev/'], ['Lucide', 'https://lucide.dev/'], ['docx', 'https://docx.js.org/'], ['jsPDF', 'https://github.com/parallax/jsPDF']].map(([name, url]) => <li key={name}><a className="underline" href={url} rel="noopener noreferrer" target="_blank">{name}</a></li>)}</ul></section>
  </main>
}
