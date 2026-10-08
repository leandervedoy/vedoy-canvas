'use client'

import { useEffect, useState } from 'react'

const clientId = process.env.NEXT_PUBLIC_VEDOY_LOGIN_CLIENT_ID
const vedoyLoginUrl = (process.env.NEXT_PUBLIC_VEDOY_LOGIN_URL ?? 'https://vedoy-login.vercel.app').replace(/\/$/, '')
const tokenUrl = `${vedoyLoginUrl}/api/auth/oauth2/token`
const authTokenKey = 'vedoy-canvas-auth-token-v1'
const authRefreshTokenKey = 'vedoy-canvas-refresh-token-v1'
const authExpiresAtKey = 'vedoy-canvas-token-expires-at-v1'

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

export default function AuthCallback() {
  const [message, setMessage] = useState('Fullfører innlogging…')

  useEffect(() => {
    const finish = async () => {
      const query = new URLSearchParams(window.location.search)
      const providerError = query.get('error_description') || query.get('error')
      if (providerError) throw new Error(providerError)
      const code = query.get('code')
      if (!clientId) throw new Error('Vedøy Login er ikke konfigurert.')
      const state = query.get('state')
      const verifier = sessionStorage.getItem('vedoy_login_verifier')
      const expectedState = sessionStorage.getItem('vedoy_login_state')
      if (!code || !verifier || !state || state !== expectedState) throw new Error('Ugyldig eller utløpt innlogging.')

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          code_verifier: verifier,
          client_id: clientId,
          redirect_uri: `${window.location.origin}/auth/callback`,
        }),
        cache: 'no-store',
      })
      const tokens = await response.json().catch(() => null) as TokenResponse | null
      if (!response.ok || !tokens?.access_token) throw new Error(tokens?.error_description || tokens?.error || 'Token kunne ikke hentes.')
      window.localStorage.setItem(authTokenKey, tokens.access_token)
      if (tokens.refresh_token) window.localStorage.setItem(authRefreshTokenKey, tokens.refresh_token)
      if (tokens.expires_in) window.localStorage.setItem(authExpiresAtKey, String(Date.now() + tokens.expires_in * 1000))
      sessionStorage.removeItem('vedoy_login_verifier')
      sessionStorage.removeItem('vedoy_login_state')
      window.history.replaceState({}, '', '/auth/callback')
      window.location.replace('/')
    }

    finish().catch((error) => setMessage(error instanceof Error ? error.message : 'Innloggingen feilet.'))
  }, [])

  return <main className="grid min-h-screen place-items-center bg-background text-foreground"><p>{message}</p></main>
}
