import type { CanvasSnapshot } from '@/components/canvas-editor'

export type Note = {
  id: string
  title: string
  kind?: 'folder' | 'file'
  favorite?: boolean
  content?: string
  snapshot?: CanvasSnapshot
  children?: Note[]
}

