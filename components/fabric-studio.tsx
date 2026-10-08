'use client'

import { useEffect, useRef, useState } from 'react'
import { CirclePlus, Download, SquarePlus, Type, X } from 'lucide-react'

export type FabricAsset = { name: string; data: string; width: number; height: number; mime: string }

export function FabricStudio({ onClose, onSave }: { onClose: () => void; onSave: (asset: FabricAsset) => Promise<void> }) {
  const elementRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = useRef<import('fabric').Canvas | null>(null)
  const [name, setName] = useState('Ny grafikk')
  const [color, setColor] = useState('#2ea5a8')
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let mounted = true
    void import('fabric').then(({ Canvas, Rect, FabricText }) => {
      if (!mounted || !elementRef.current) return
      const canvas = new Canvas(elementRef.current, { width: 560, height: 360, backgroundColor: '#ffffff', preserveObjectStacking: true })
      canvas.add(new Rect({ left: 80, top: 85, width: 400, height: 190, rx: 26, ry: 26, fill: '#f5f7fa', stroke: '#173f5f', strokeWidth: 3 }), new FabricText('Dobbeltklikk for å endre', { left: 135, top: 160, fontSize: 28, fill: '#173f5f', fontFamily: 'Arial' }))
      canvasRef.current = canvas
      setReady(true)
    })
    return () => { mounted = false; canvasRef.current?.dispose(); canvasRef.current = null }
  }, [])
  const addShape = async (type: 'rect' | 'circle' | 'text') => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { Rect, Circle, IText } = await import('fabric')
    const object = type === 'rect' ? new Rect({ left: 80, top: 80, width: 180, height: 90, rx: 18, ry: 18, fill: color }) : type === 'circle' ? new Circle({ left: 100, top: 80, radius: 60, fill: color }) : new IText('Skriv her', { left: 100, top: 100, fontSize: 30, fill: color, fontFamily: 'Arial' })
    canvas.add(object)
    canvas.setActiveObject(object)
    canvas.renderAll()
  }
  const save = async () => {
    const canvas = canvasRef.current
    if (!canvas || !name.trim()) return
    canvas.discardActiveObject(); canvas.renderAll()
    await onSave({ name: name.trim(), data: canvas.toDataURL({ format: 'png', multiplier: 2 }), width: 560, height: 360, mime: 'image/png' })
    onClose()
  }
  return <div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/55 p-3 backdrop-blur-sm" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="fabric-title" className="w-full max-w-3xl rounded-3xl bg-white p-4 text-slate-950 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
      <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#2ea5a8]">Fabric.js</p><h2 id="fabric-title" className="text-xl font-semibold">Bygg en grafikk-kloss</h2></div><button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-slate-100" aria-label="Lukk"><X className="size-4" /></button></div>
      <div className="mt-4 flex flex-wrap items-center gap-2"><button onClick={() => void addShape('rect')} className="fabric-tool"><SquarePlus className="size-4" />Form</button><button onClick={() => void addShape('circle')} className="fabric-tool"><CirclePlus className="size-4" />Sirkel</button><button onClick={() => void addShape('text')} className="fabric-tool"><Type className="size-4" />Tekst</button><label className="fabric-tool">Farge<input type="color" value={color} onChange={event => setColor(event.target.value)} className="size-6" /></label><span className="text-xs text-slate-500">Flytt, skaler og roter elementene direkte.</span></div>
      <div className="mt-3 overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-2"><canvas ref={elementRef} className="mx-auto max-w-full" /></div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><input value={name} onChange={event => setName(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#2ea5a8]" aria-label="Navn på grafikk" /><button disabled={!ready || !name.trim()} onClick={() => void save()} className="flex items-center justify-center gap-2 rounded-xl bg-[#173f5f] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Download className="size-4" />Lagre i Mine bibliotek</button></div>
    </section>
  </div>
}
