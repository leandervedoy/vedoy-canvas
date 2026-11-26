'use client'

import { useEffect, useState } from 'react'
import { createClient, type User } from '@supabase/supabase-js'
import { ArrowRight, BookOpen, Boxes, LayoutGrid, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const clientId = process.env.NEXT_PUBLIC_VEDOY_LOGIN_CLIENT_ID
const supabase = url && key ? createClient(url, key, {
  auth: { storageKey: 'vedoy-canvas-auth-v2', detectSessionInUrl: false },
}) : null

async function authorize(): Promise<{ user: User | null, authorized: boolean }> {
  if (!supabase) return { user: null, authorized: false }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { user: null, authorized: false }
  const { data: membership, error: membershipError } = await supabase
    .from('canvas_internal_members').select('active').eq('user_id', data.user.id).maybeSingle()
  return { user: data.user, authorized: !membershipError && membership?.active === true }
}
function encode(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
async function startLogin() {
  if (!url || !clientId) return
  const verifier = encode(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const state = encode(crypto.getRandomValues(new Uint8Array(24)))
  sessionStorage.setItem('vedoy_login_verifier', verifier)
  sessionStorage.setItem('vedoy_login_state', state)
  const endpoint = new URL('/auth/v1/oauth/authorize', url)
  endpoint.search = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: location.origin + '/auth/callback', state, code_challenge: encode(new Uint8Array(digest)), code_challenge_method: 'S256', scope: 'openid email profile' }).toString()
  location.assign(endpoint.toString())
}
export function InternalCanvasGate({ children }: { children: (user: User) => React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'denied' | 'login' | 'allowed'>('loading')
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    let active = true
    const refresh = () => {
      void authorize().then(result => {
        if (!active) return
        setUser(result.user)
        setState(result.authorized ? 'allowed' : result.user ? 'denied' : 'login')
      }).catch(() => active && setState('denied'))
    }
    refresh()
    const { data } = supabase?.auth.onAuthStateChange(() => {
      // Do not call Supabase API synchronously inside the auth callback.
      queueMicrotask(refresh)
    }) ?? { data: null }
    return () => { active = false; data?.subscription.unsubscribe() }
  }, [])
  if (state === 'allowed' && user) return <>{children(user)}</>
  return <main className="min-h-screen overflow-hidden bg-[#f7f8f1] text-[#203127]">
    <div className="mx-auto max-w-7xl px-6">
      <nav className="flex items-center justify-between gap-4 py-6">
        <a href="#" className="flex items-center gap-2 font-bold tracking-tight"><span className="grid size-9 place-items-center rounded-xl bg-[#233d2e] text-lg text-[#d4edac]">∞</span><span>Vedøy <span className="font-normal text-[#718374]">/ Infinite Canvas</span></span></a>
        <a href="#tilgang" className="rounded-full border border-[#bfd0bf] px-4 py-2 text-sm font-semibold transition hover:bg-white">Logg inn <span aria-hidden="true">↗</span></a>
      </nav>
      <section className="grid items-center gap-12 pb-20 pt-12 md:grid-cols-2 md:pb-28 md:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#cfddc7] bg-[#ebf2df] px-3 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-[#4c694a]"><Sparkles className="size-3.5" /> Mer oversikt. Mer rom for idéer.</p>
          <h1 className="mt-7 max-w-xl text-5xl font-semibold leading-[1.06] tracking-[-.055em] sm:text-6xl">Alt du tenker på.<br/><span className="text-[#789d60]">Ett sted å skape.</span></h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-[#607267]">Samle idéer, dokumentasjon og prosjekter i et arbeidsområde som gjør det enklere å finne frem – og komme videre.</p>
          <div className="mt-8 flex flex-wrap gap-3"><a href="#tilgang" className="inline-flex items-center gap-3 rounded-full bg-[#254334] px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-[#385b42]">Åpne Canvas <ArrowRight className="size-4" /></a><a href="#muligheter" className="rounded-full border border-[#c2d0bf] px-6 py-3.5 text-sm font-semibold hover:bg-white">Se mulighetene</a></div>
          <p className="mt-5 text-xs text-[#798b7a]">Tilgang er foreløpig forbeholdt interne medlemmer.</p>
        </div>
        <div aria-hidden="true" className="relative min-h-[390px] rounded-[2rem] border border-white bg-[#dce8d4] p-4 shadow-[0_30px_80px_-40px_rgba(44,77,49,.5)] sm:p-7">
          <div className="absolute -left-3 top-16 rounded-full bg-[#f4ce83] px-4 py-2 text-xs font-semibold text-[#564121] shadow-lg">✳ En idé blir til</div>
          <div className="h-full min-h-[340px] overflow-hidden rounded-2xl border border-[#d0dec9] bg-[#f9fbf5] shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#e2eadf] px-4 py-3"><span className="size-2 rounded-full bg-[#dbaa95]"/><span className="size-2 rounded-full bg-[#e2ce9c]"/><span className="size-2 rounded-full bg-[#a5c79a]"/><span className="ml-3 text-xs text-[#78907a]">Mitt arbeidsområde</span></div>
            <div className="grid min-h-[290px] grid-cols-[94px_1fr] sm:grid-cols-[120px_1fr]">
              <div className="border-r border-[#e6ece3] p-3 text-[10px] leading-7 text-[#829184]"><strong className="text-[#394e40]">MITT ROM</strong><br/>◧ Oversikt<br/>◫ Prosjekter<br/>▤ Mine bøker<br/>✦ Idéer</div>
              <div className="relative bg-[radial-gradient(#d6e3d1_1px,transparent_1px)] p-5 [background-size:16px_16px]"><div className="rounded-xl border border-[#dfebd8] bg-white p-4 shadow-sm"><p className="text-[10px] uppercase tracking-widest text-[#839986]">Mitt neste prosjekt</p><p className="mt-2 text-lg font-semibold">Fra idé til virkelighet ✨</p><p className="mt-1 text-xs text-[#819184]">Planlegg · Samle · Skap</p></div><div className="mt-5 flex gap-3"><div className="w-1/2 rotate-[-3deg] rounded-xl bg-[#f5e5a8] p-3 text-xs leading-5 text-[#615a32] shadow-sm">Hva vil vi<br/><strong>skape sammen?</strong></div><div className="mt-3 w-1/2 rotate-[3deg] rounded-xl bg-[#d6eaca] p-3 text-xs leading-5 text-[#446044] shadow-sm">Planen starter<br/><strong>akkurat her ↗</strong></div></div></div>
            </div>
          </div>
          <div className="absolute -bottom-4 right-3 rounded-2xl bg-[#294735] px-4 py-3 text-xs text-white shadow-xl"><span className="text-[#b9dc9f]">●</span> Plass til hele idéen</div>
        </div>
      </section>
      <section id="muligheter" className="border-t border-[#dbe5d8] py-16">
        <div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#799c68]">Ett sted for det som betyr noe</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Mindre leting. Mer fremdrift.</h2><p className="mt-4 leading-7 text-[#6a7d6d]">Fra første skisse til kunnskapen teamet trenger i hverdagen. Gi idéene dine en plass å vokse.</p></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-[#e0e9dc] bg-white p-7"><LayoutGrid className="size-7 text-[#719b63]"/><h3 className="mt-6 text-xl font-semibold">Tenk fritt</h3><p className="mt-3 text-sm leading-6 text-[#708174]">Bruk en uendelig tavle til idéer, skisser og planlegging.</p></article>
          <article className="rounded-3xl border border-[#e0e9dc] bg-white p-7"><BookOpen className="size-7 text-[#719b63]"/><h3 className="mt-6 text-xl font-semibold">Samle kunnskap</h3><p className="mt-3 text-sm leading-6 text-[#708174]">Organiser dokumenter og notater i bøker som gjør informasjon lettere å finne.</p></article>
          <article className="rounded-3xl border border-[#e0e9dc] bg-white p-7"><Boxes className="size-7 text-[#719b63]"/><h3 className="mt-6 text-xl font-semibold">Skap videre</h3><p className="mt-3 text-sm leading-6 text-[#708174]">Vi utforsker verktøy for å bygge nettsider, webapper og interaktive opplevelser i samme arbeidsområde.</p><p className="mt-4 text-xs font-semibold text-[#789b68]">Planlagt videreutvikling</p></article>
        </div>
      </section>
      <section id="tilgang" className="mb-16 grid gap-8 rounded-[2rem] bg-[#203c2e] p-8 text-white md:grid-cols-2 md:items-center md:p-12">
        <div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#b4d69e]">Klar for mer oversikt?</p><h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Gi idéene dine et hjem.</h2><p className="mt-4 max-w-md leading-7 text-[#c5d7c4]">Canvas er under utvikling og tilgjengelig for interne medlemmer med Vedøy ID.</p></div>
        <div className="rounded-2xl border border-white/15 bg-white/10 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="size-4 text-[#c4e6a9]"/> Intern tilgang</div>
          <p className="mt-3 text-sm leading-6 text-[#d0dfcf]">{state === 'loading' ? 'Kontrollerer medlemskap …' : state === 'login' ? 'Logg inn med Vedøy ID for å åpne arbeidsområdet.' : 'Du har ikke aktivt Vedøy Internal Membership. Kontakt en administrator dersom dette er feil.'}</p>
          {state === 'loading' ? <LoaderCircle className="mt-5 size-5 animate-spin text-[#c4e6a9]" /> : state === 'login' ? <button disabled={!clientId} onClick={() => void startLogin()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#c6e6aa] px-5 py-3 font-semibold text-[#1e3a28] hover:bg-[#d7efc2] disabled:opacity-40">Logg inn med Vedøy ID <ArrowRight className="size-4"/></button> : <button onClick={() => void supabase?.auth.signOut().then(() => location.reload())} className="mt-5 rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold">Bytt konto</button>}
        </div>
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dbe5d8] py-6 text-xs text-[#809082]"><span>© Vedøy · Infinite Canvas</span><span>Think. Plan. Create. Together.</span></footer>
    </div>
  </main>
}
