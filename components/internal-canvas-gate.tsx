'use client'

import { useEffect, useState } from 'react'
import { createClient, type User } from '@supabase/supabase-js'
import { LockKeyhole, LoaderCircle } from 'lucide-react'

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
  return <main className="grid min-h-screen place-items-center bg-[#0b1018] px-6 text-white">
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151922] p-8 text-center shadow-2xl">
      <LockKeyhole className="mx-auto mb-5 size-9 text-[#a1a6ff]" />
      <h1 className="text-2xl font-semibold">Vedoy Infinite Canvas</h1>
      <p className="mt-2 text-sm text-slate-400">One Canvas. Infinite Possibilities.</p>
      <p className="mt-6 text-sm leading-6 text-slate-300">{state === 'loading'
        ? 'Kontrollerer medlemskap …'
        : state === 'login' ? 'Logg inn med Vedoy ID for å få tilgang til den interne arbeidsflaten.'
        : 'Du har ikke aktivt Vedoy Internal Membership. Kontakt en administrator dersom dette er feil.'}</p>
      {state === 'loading' ? <LoaderCircle className="mx-auto mt-5 size-5 animate-spin text-[#a1a6ff]" /> :
        state === 'login'
          ? <button disabled={!clientId} onClick={() => void startLogin()} className="mt-6 w-full rounded-xl bg-[#777df5] px-5 py-3 font-medium text-white disabled:opacity-40">Logg inn med Vedoy ID</button>
          : <button onClick={() => void supabase?.auth.signOut().then(() => location.reload())} className="mt-6 rounded-xl border border-white/20 px-5 py-2 text-sm">Bytt konto</button>}
    </div>
  </main>
}


