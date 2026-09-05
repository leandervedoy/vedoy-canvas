'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const clientId = process.env.NEXT_PUBLIC_VEDOY_LOGIN_CLIENT_ID
const callbackUrl = 'https://vedoy-canvas.vercel.app/auth/callback'

export default function AuthCallback() {
  const [message, setMessage] = useState('Fullfører innlogging…')
  useEffect(() => {
    const finish = async () => {
      if (!supabaseUrl || !supabaseKey || !clientId) throw new Error('Vedøy Login er ikke konfigurert.')
      const query = new URLSearchParams(window.location.search)
      const providerError = query.get('error_description') || query.get('error')
      if (providerError) throw new Error(providerError)
      const code = query.get('code')
      const state = query.get('state')
      const verifier = sessionStorage.getItem('vedoy_login_verifier')
      const expectedState = sessionStorage.getItem('vedoy_login_state')
      if (!code || !verifier || !state || state !== expectedState) throw new Error('Ugyldig eller utløpt innlogging.')
      const response = await fetch(new URL('/auth/v1/oauth/token', supabaseUrl), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: callbackUrl }) })
      const tokens = await response.json()
      if (!response.ok || !tokens.access_token || !tokens.refresh_token) throw new Error(tokens.error_description || 'Token kunne ikke hentes.')
      const client = createClient(supabaseUrl, supabaseKey)
      const { error } = await client.auth.setSession({ access_token: tokens.access_token, refresh_token: tokens.refresh_token })
      if (error) throw error
      sessionStorage.removeItem('vedoy_login_verifier')
      sessionStorage.removeItem('vedoy_login_state')
      window.location.replace('/')
    }
    finish().catch((error) => setMessage(error instanceof Error ? error.message : 'Innloggingen feilet.'))
  }, [])
  return <main className="grid min-h-screen place-items-center bg-background text-foreground"><p>{message}</p></main>
}
