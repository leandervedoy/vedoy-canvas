import Link from 'next/link'
const example = `'use client'
import { useEffect, useRef } from 'react'
import { VedoyGame, motionSpin } from '@/lib/vedoy-game'

export default function MyGame() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!root.current) return
    const game = new VedoyGame(root.current)
    game.create('player', 'cube', '#2563eb')
    game.position('player', 0, 1, 0)
    const stopSpin = motionSpin(game, 'player', 1)
    game.start()
    return () => { stopSpin(); game.dispose() }
  }, [])
  return <div ref={root} style={{ width: '100%', height: 400 }} />
}`
export default function Docs() {
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <Link href="/game" className="underline">← Vedoy Game</Link>
    <h1 className="text-3xl font-bold">Vedoy Game documentation</h1>
    <p>Experimental game runtime built on Three.js. Works as a client component in Next.js. It is not yet a complete standalone framework or a VedoyScript game compiler.</p>
    <h2 className="text-xl font-semibold">Install</h2>
    <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-white">npm install three && npm install -D @types/three</pre>
    <h2 className="text-xl font-semibold">Quick start</h2>
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-4 text-xs text-white">{example}</pre>
    <h2 className="text-xl font-semibold">API</h2>
    <p>new VedoyGame(container), create(id, shape, color), position(id, x, y, z), get(id), onUpdate(callback), start(), stop(), dispose(), motionSpin(game, id, speed).</p>
    <h2 className="text-xl font-semibold">Mobile and desktop</h2>
    <p>The Three.js canvas can run inside a Capacitor WebView or Electron renderer, but packaging, permissions, native plugins, game input and performance validation must be configured separately. The prototype does not bundle Capacitor or Electron.</p>
    <h2 className="text-xl font-semibold">Roadmap</h2>
    <p>VedoyScript game compiler, physics, touch/gamepad controls, asset loader, scene editor, reusable Vedoy Motion timeline and native packaging.</p>
  </main>
}
