'use client'

import { CanvasWorkspace } from '@/components/canvas-workspace'
import { InternalCanvasGate } from '@/components/internal-canvas-gate'

export default function Page() {
  return <InternalCanvasGate>{() => <CanvasWorkspace />}</InternalCanvasGate>
}
