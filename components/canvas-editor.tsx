'use client'

import '@excalidraw/excalidraw/index.css'
import { useRef } from 'react'
import { Excalidraw, convertToExcalidrawElements, serializeAsJSON } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types'

export type CanvasSnapshot = {
  elements: readonly ExcalidrawElement[]
  appState: Partial<AppState>
  files: BinaryFiles
}

const starterElements = convertToExcalidrawElements([
  {
    type: 'rectangle',
    x: 260,
    y: 180,
    width: 360,
    height: 170,
    backgroundColor: '#fff3bf',
    fillStyle: 'solid',
    strokeColor: '#343a40',
    roundness: { type: 3 },
    label: { text: 'Ideas become clearer\nwhen you see the whole picture.', fontSize: 20 },
  },
  {
    type: 'ellipse',
    x: 720,
    y: 175,
    width: 280,
    height: 190,
    backgroundColor: '#a5d8ff',
    fillStyle: 'solid',
    strokeColor: '#1971c2',
  },
  {
    type: 'text',
    x: 285,
    y: 450,
    width: 420,
    text: 'Research\nCollect references before\nthe next sketch.',
    fontSize: 24,
    strokeColor: '#343a40',
  },
])

function starterScene(darkMode: boolean): ExcalidrawInitialDataState {
  return {
    elements: starterElements,
    appState: { viewBackgroundColor: darkMode ? '#141414' : '#f5f7fa' },
    scrollToContent: true,
  }
}

export function CanvasEditor({
  initialSnapshot,
  darkMode,
  onApi,
  onSceneChange,
  onLibraryChange,
  onOpenBook,
}: {
  initialSnapshot: CanvasSnapshot | null
  darkMode: boolean
  onApi: (api: ExcalidrawImperativeAPI) => void
  onSceneChange: (snapshot: CanvasSnapshot) => void
  onLibraryChange?: (items: readonly unknown[]) => void
  onOpenBook?: (bookId: string) => void
}) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const initialData: ExcalidrawInitialDataState = initialSnapshot ?? starterScene(darkMode)

  return (
    <div className="h-full w-full" data-testid="vedoy-excalidraw">
      <Excalidraw
        excalidrawAPI={(api) => { apiRef.current = api; onApi(api) }}
        initialData={initialData}
        langCode="en"
        theme={darkMode ? 'dark' : 'light'}
        name="Vedoy Canvas"
        handleKeyboardGlobally
        onChange={(elements, appState, files) => {
          const serialized = serializeAsJSON(elements, appState, files, 'database')
          onSceneChange(JSON.parse(serialized) as CanvasSnapshot)
        }}
        onPointerUp={() => {
          const api = apiRef.current
          if (!api) return
          const selected = api.getSceneElements().find((element) => api.getAppState().selectedElementIds[element.id]) as (ExcalidrawElement & { customData?: { vedoyBookId?: string } }) | undefined
          const bookId = selected?.customData?.vedoyBookId
          if (bookId) onOpenBook?.(bookId)
        }}
        onLibraryChange={(items) => onLibraryChange?.(items)}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      />
    </div>
  )
}
