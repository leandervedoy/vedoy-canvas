import Link from 'next/link'
import { VedoyGamePreview } from '@/components/vedoy-game-preview'
export default function GamePage() {
  return <main className="mx-auto max-w-4xl space-y-5 p-6">
    <Link href="/" className="text-sm underline">← Canvas</Link>
    <h1 className="text-3xl font-bold">Vedoy Game</h1>
    <p>Three.js game runtime prototype with a reusable scene, entities and a lightweight Vedoy Motion adapter.</p>
    <VedoyGamePreview />
    <Link href="/game/docs" className="underline">Read the developer documentation →</Link>
  </main>
}
