'use client'

import '@excalidraw/excalidraw/index.css'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Frame, Globe, ScanLine, Save } from 'lucide-react'
import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw'
import type { ExcalidrawElement, ExcalidrawFrameElement } from '@excalidraw/excalidraw/element/types'
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, ExcalidrawInitialDataState, LibraryItems } from '@excalidraw/excalidraw/types'

export type CanvasSnapshot = {
  elements: readonly ExcalidrawElement[]
  appState: Partial<AppState>
  files: BinaryFiles
}

function emptyScene(darkMode: boolean): ExcalidrawInitialDataState {
  return {
    elements: [],
    appState: { viewBackgroundColor: darkMode ? '#141414' : '#f5f7fa' },
    scrollToContent: true,
  }
}

function selectedFrame(api: ExcalidrawImperativeAPI): ExcalidrawFrameElement | undefined {
  const elements = api.getSceneElements()
  const selectedIds = api.getAppState().selectedElementIds
  const selected = elements.find((element) => selectedIds[element.id])
  if (!selected) return undefined
  const frameId = selected.type === 'frame' ? selected.id : selected.frameId
  return elements.find((element) => element.type === 'frame' && element.id === frameId) as ExcalidrawFrameElement | undefined
}

function frameAndContents(elements: readonly ExcalidrawElement[], frame: ExcalidrawFrameElement) {
  const frameIds = new Set([frame.id])
  let changed = true
  while (changed) {
    changed = false
    for (const element of elements) {
      if (element.type === 'frame' && element.frameId && frameIds.has(element.frameId) && !frameIds.has(element.id)) {
        frameIds.add(element.id)
        changed = true
      }
    }
  }
  return elements.filter((element) => element.id === frame.id || !!element.frameId && frameIds.has(element.frameId))
}

export function CanvasEditor({
  initialSnapshot,
  darkMode,
  onApi,
  onSceneChange,
  onLibraryChange,
  onOpenCanvas,
  onOpenFrame,
  onOpenWebsite,
}: {
  initialSnapshot: CanvasSnapshot | null
  darkMode: boolean
  onApi: (api: ExcalidrawImperativeAPI) => void
  onSceneChange: (snapshot: CanvasSnapshot) => void
  onLibraryChange?: (items: LibraryItems) => void
  onOpenCanvas?: (canvasId: string) => void
  onOpenFrame?: (frameId: string) => void
  onOpenWebsite?: (websiteId: string) => void
}) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null)
  const sceneReady = useRef(false)
  const lastCardClick = useRef<{ id: string; at: number } | null>(null)
  const knownFrameIds = useRef(new Set<string>())
  const editorRoot = useRef<HTMLDivElement | null>(null)
  const toolbarSlot = useRef<HTMLDivElement | null>(null)
  const [toolbarReady, setToolbarReady] = useState(false)
  const [activeTool, setActiveTool] = useState<string>('selection')
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState('')
  const [namingFrameId, setNamingFrameId] = useState<string | null>(null)
  const [frameName, setFrameName] = useState('')
  const [initialData] = useState<ExcalidrawInitialDataState>(() => {
    let libraryItems: LibraryItems = []
    try { const saved = JSON.parse(localStorage.getItem('vedoy-personal-library-v1') ?? '[]'); if (Array.isArray(saved)) libraryItems = saved } catch { /* Invalid local data must not prevent opening the canvas. */ }
    return { ...(initialSnapshot ?? emptyScene(darkMode)), libraryItems, scrollToContent: false }
  })

  useEffect(() => {
    const root = editorRoot.current
    if (!root) return
    const slot = document.createElement('div')
    slot.className = 'vedoy-extra-toolbar-slot'
    toolbarSlot.current = slot
    const placeSlot = () => {
      const trigger = root.querySelector('.App-toolbar__extra-tools-trigger')
      const tools = trigger?.parentElement
      if (tools && slot.parentElement !== tools) {
        tools.appendChild(slot)
        setToolbarReady(true)
      }
    }
    placeSlot()
    const observer = new MutationObserver(placeSlot)
    observer.observe(root, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      slot.remove()
      toolbarSlot.current = null
      setToolbarReady(false)
    }
  }, [])

  const saveFrame = async () => {
    const api = apiRef.current
    const frame = api && selectedFrame(api)
    if (!api || !frame) return
    const elements = frameAndContents(api.getSceneElements(), frame)
    if (!elements.some((element) => element.id !== frame.id && !element.isDeleted)) {
      setSaveMessage('Tegn innhold i rammen før du lagrer den i biblioteket')
      window.setTimeout(() => setSaveMessage(''), 4000)
      return
    }
    if (elements.some((element) => element.type === 'image' || element.type === 'embeddable' || element.type === 'iframe')) {
      setSaveMessage('Frames with images or embeds cannot be saved to Personal Library')
      window.setTimeout(() => setSaveMessage(''), 4000)
      return
    }
    try {
      await api.updateLibrary({
        libraryItems: [{ id: crypto.randomUUID(), status: 'unpublished', created: Date.now(), name: frame.name || 'Frame', elements }],
        merge: true,
        openLibraryMenu: true,
      })
      setSaveMessage('Frame saved to Personal Library')
    } catch {
      setSaveMessage('Could not save this frame to Personal Library')
    }
    window.setTimeout(() => setSaveMessage(''), 4000)
  }

  const saveFrameName = () => {
    const api = apiRef.current
    const name = frameName.trim()
    if (!api || !namingFrameId || !name) return
    api.updateScene({ elements: api.getSceneElements().map((element) => element.id === namingFrameId ? ({ ...element, name } as typeof element) : element) })
    setNamingFrameId(null)
    setFrameName('')
  }

  return (
    <div ref={editorRoot} className="h-full w-full" data-testid="vedoy-excalidraw">
      {toolbarReady && toolbarSlot.current && createPortal(
        <>
          <button type="button" className={`vedoy-extra-tool ${activeTool === 'frame' ? 'is-active' : ''}`} title="Draw a frame" aria-label="Draw a frame" aria-pressed={activeTool === 'frame'} onClick={() => apiRef.current?.setActiveTool({ type: 'frame' })}>
            <Frame size={19} strokeWidth={1.8} />
          </button>
          <button type="button" className={`vedoy-extra-tool ${activeTool === 'embeddable' ? 'is-active' : ''}`} title="Embed a website" aria-label="Embed a website" aria-pressed={activeTool === 'embeddable'} onClick={() => apiRef.current?.setActiveTool({ type: 'embeddable' })}>
            <Globe size={19} strokeWidth={1.8} />
          </button>
          <button type="button" className={`vedoy-extra-tool ${activeTool === 'laser' ? 'is-active' : ''}`} title="Laser pointer" aria-label="Laser pointer" aria-pressed={activeTool === 'laser'} onClick={() => apiRef.current?.setActiveTool({ type: 'laser' })}>
            <ScanLine size={19} strokeWidth={1.8} />
          </button>
          {selectedFrameId && <button type="button" className="vedoy-extra-tool" title="Save frame to Personal Library" aria-label="Save frame to Personal Library" onClick={() => { void saveFrame() }}>
            <Save size={18} strokeWidth={1.8} />
          </button>}
        </>, toolbarSlot.current,
      )}
      {saveMessage && <div className="vedoy-frame-save-message" role="status">{saveMessage}</div>}
      {namingFrameId && <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm"><form onSubmit={(event) => { event.preventDefault(); saveFrameName() }} className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#272727]"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-600">Ny ramme</p><h2 className="mt-1 text-lg font-semibold">Gi rammen et navn</h2><p className="mt-1 text-xs text-black/55 dark:text-white/55">Navnet brukes når du lagrer den i ditt personlige bibliotek.</p><input autoFocus value={frameName} onChange={(event) => setFrameName(event.target.value)} placeholder="For eksempel: Logo-idé" className="mt-4 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-white/15" aria-label="Navn på ramme" /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { setNamingFrameId(null); setFrameName('') }} className="rounded-lg px-3 py-2 text-xs text-black/55 hover:bg-black/5 dark:text-white/55 dark:hover:bg-white/10">Avbryt</button><button type="submit" className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white">Lagre navn</button></div></form></div>}
      <Excalidraw
        excalidrawAPI={(api) => { apiRef.current = api; onApi(api) }}
        initialData={initialData}
        langCode="en"
        theme={darkMode ? 'dark' : 'light'}
        name="Vedoy Canvas"
        handleKeyboardGlobally
        onChange={(elements, appState, files) => {
          if (!sceneReady.current) {
            if (appState.isLoading) return
            sceneReady.current = true
            const api = apiRef.current
            if (api) {
              if (initialSnapshot?.files) api.addFiles(Object.values(initialSnapshot.files))
              knownFrameIds.current = new Set((initialSnapshot?.elements ?? []).filter((element) => element.type === 'frame').map((element) => element.id))
              api.updateScene({
                elements: initialSnapshot?.elements ?? [],
                appState: { ...appState, ...initialSnapshot?.appState, zoom: { value: (Number.isFinite(initialSnapshot?.appState?.zoom?.value) && Number(initialSnapshot?.appState?.zoom?.value) > 0 ? initialSnapshot!.appState.zoom!.value : 1) as AppState['zoom']['value'] }, scrollX: Number(initialSnapshot?.appState?.scrollX) || 0, scrollY: Number(initialSnapshot?.appState?.scrollY) || 0, viewBackgroundColor: initialSnapshot?.appState.viewBackgroundColor ?? (darkMode ? '#141414' : '#f5f7fa') },
              })
            }
            return
          }
          setActiveTool(appState.activeTool.type)
          const newFrame = elements.find((element) => element.type === 'frame' && !element.isDeleted && !knownFrameIds.current.has(element.id))
          for (const element of elements) if (element.type === 'frame') knownFrameIds.current.add(element.id)
          if (newFrame && !namingFrameId) {
            setNamingFrameId(newFrame.id)
            setFrameName('')
          }
          const selected = elements.find((element) => appState.selectedElementIds[element.id])
          const frameId = selected?.type === 'frame' ? selected.id : selected?.frameId
          setSelectedFrameId(frameId ?? null)
          const serialized = serializeAsJSON(elements, appState, files, 'database')
          onSceneChange(JSON.parse(serialized) as CanvasSnapshot)
        }}
        onPointerUp={(_activeTool, pointerDownState) => {
          const api = apiRef.current
          if (!api || pointerDownState.drag.hasOccurred || pointerDownState.resize.isResizing || pointerDownState.boxSelection.hasOccurred) return
          const selected = api.getSceneElements().find((element) => api.getAppState().selectedElementIds[element.id]) as (ExcalidrawElement & { customData?: { vedoyFrameId?: string; vedoyCanvasId?: string; vedoyWebsiteId?: string } }) | undefined
          const frameId = selected?.customData?.vedoyFrameId
          const canvasId = selected?.customData?.vedoyCanvasId
          const websiteId = selected?.customData?.vedoyWebsiteId
          if (frameId) {
            const now = Date.now()
            const previousClick = lastCardClick.current
            if (previousClick && previousClick.id === frameId && now - previousClick.at < 500) {
              lastCardClick.current = null
              onOpenFrame?.(frameId)
            } else lastCardClick.current = { id: frameId, at: now }
          }
          else if (canvasId || websiteId) {
            const id = canvasId ?? websiteId!
            const now = Date.now()
            const previousClick = lastCardClick.current
            if (previousClick && previousClick.id === id && now - previousClick.at < 500) {
              lastCardClick.current = null
              if (canvasId) onOpenCanvas?.(canvasId)
              else onOpenWebsite?.(websiteId!)
            } else lastCardClick.current = { id, at: now }
          }
        }}
        onLibraryChange={(items) => {
          onLibraryChange?.(items)
          try { localStorage.setItem('vedoy-personal-library-v1', JSON.stringify(items)) }
          catch { setSaveMessage('Biblioteket kunne ikke lagres lokalt. Eksporter det fra Fil-menyen.'); }
        }}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      />
    </div>
  )
}
