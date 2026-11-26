'use client'
import { useEffect, useRef } from 'react'
import { VedoyGame, motionSpin } from '@/lib/vedoy-game'

export function VedoyGamePreview() {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!container.current) return
    const game = new VedoyGame(container.current)
    game.create('player', 'cube', '#2563eb')
    game.position('player', 0, 0, 0)
    const unsubscribe = motionSpin(game, 'player', 1.1)
    game.start()
    return () => { unsubscribe(); game.dispose() }
  }, [])
  return <div ref={container} aria-label="Interactive 3D cube game preview" className="h-80 w-full overflow-hidden rounded-xl border bg-slate-950" />
}
