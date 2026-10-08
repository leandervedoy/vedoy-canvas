'use client'

import { useState } from 'react'
import { Check, LockKeyhole, LogIn, X } from 'lucide-react'

export type AccessReason = 'login' | 'website' | 'graphics' | 'limit'

export function AccessModal({ reason, onClose, onLogin, onUpgrade, isLoggedIn = false }: { reason: AccessReason; onClose: () => void; onLogin: () => void; onUpgrade: () => Promise<void>; isLoggedIn?: boolean }) {
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const startCheckout = async () => {
    setCheckoutBusy(true)
    setCheckoutError(null)
    try {
      await onUpgrade()
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Betaling kunne ikke startes.')
      setCheckoutBusy(false)
    }
  }
  const title = reason === 'website' ? 'Nettside er låst' : reason === 'graphics' ? 'Vedøy-grafikk krever Supporter Plus' : reason === 'limit' ? 'Du har nådd plangrensen' : 'Logg inn for å fortsette'
  const text = reason === 'website'
    ? 'Beklager, men du må ha Supporter eller Supporter Plus for å få tilgang til Nettside-delen.'
    : reason === 'graphics'
      ? 'Dine egne opplastinger er tilgjengelige. Det kuraterte Vedøy-biblioteket åpnes med Supporter Plus.'
      : reason === 'limit'
        ? 'Gratisnivået inkluderer 2 bøker, opptil 7 kategorier per bok og 10 sider per kategori. Supporter åpner for ubegrenset innhold for 19 kr/mnd.'
        : 'Beklager, men du må være logget inn eller registrere deg for å opprette og lagre nytt innhold.'
  return <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="access-title" onMouseDown={event => event.stopPropagation()} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/20 bg-[#f8fafc] p-5 text-slate-950 shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#173f5f] text-white"><LockKeyhole className="size-5" /></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#2ea5a8]">Vedøy-medlemskap</p><h2 id="access-title" className="mt-1 text-2xl font-semibold">{title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{text}</p></div></div><button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-full hover:bg-slate-200" aria-label="Lukk"><X className="size-4" /></button></div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Plan name="Free" price="0 kr" muted features={['2 bøker', '7 kategorier per bok', '10 sider per kategori', 'Flere sider med Supporter']} />
        <Plan name="Supporter" price="19 kr/mnd" featured features={['Alle hovedverktøy', 'Nettsider', 'Ubegrenset med bøker', 'Ubegrenset med kategorier og sider']} />
        <Plan name="Supporter Plus" price="Kommer" features={['Alt i Supporter', 'Vedøy grafikkbibliotek', 'Bibliotekbutikk', 'Flere designressurser']} />
      </div>
      {checkoutError ? <p role="alert" className="mt-4 text-sm text-red-700">{checkoutError}</p> : null}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button onClick={onClose} className="rounded-xl px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200">Lukk</button>{isLoggedIn && reason === 'limit' ? <button type="button" onClick={() => { void startCheckout() }} disabled={checkoutBusy} className="flex items-center justify-center gap-2 rounded-xl bg-[#173f5f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0f304a] disabled:cursor-wait disabled:opacity-60">{checkoutBusy ? 'Åpner sikker betaling…' : 'Bli Supporter · 19 kr/mnd'}</button> : <button onClick={onLogin} className="flex items-center justify-center gap-2 rounded-xl bg-[#173f5f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0f304a]"><LogIn className="size-4" />Logg inn eller registrer deg</button>}</div>
    </section>
  </div>
}

function Plan({ name, price, features, featured = false, muted = false }: { name: string; price: string; features: string[]; featured?: boolean; muted?: boolean }) {
  return <article className={`rounded-2xl border p-4 ${featured ? 'border-[#2ea5a8] bg-white shadow-lg shadow-[#2ea5a8]/10' : 'border-slate-200 bg-white/70'} ${muted ? 'opacity-80' : ''}`}>
    <h3 className="font-semibold">{name}</h3><p className="mt-1 text-xl font-bold">{price}</p><ul className="mt-4 space-y-2">{features.map(feature => <li key={feature} className="flex gap-2 text-xs text-slate-600"><Check className="mt-0.5 size-3.5 shrink-0 text-[#2ea5a8]" />{feature}</li>)}</ul>
  </article>
}
