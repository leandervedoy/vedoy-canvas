'use client'

import { Pencil, Plus } from 'lucide-react'

export function BoardDock({ boards, activeId, canCreate, onSelect, onAdd, onRename, onLocked }: { boards: Array<{ id: string; title: string }>; activeId: string; canCreate: boolean; onSelect: (id: string) => void; onAdd: () => void; onRename: (id: string) => void; onLocked: () => void }) {
  return <nav className="vedoy-board-dock" aria-label="Bytt tavle">
    <div className="vedoy-board-tabs">{boards.map((board, index) => <div key={board.id} className={`vedoy-board-tab ${activeId === board.id ? 'is-active' : ''}`}>
      <button onClick={() => onSelect(board.id)} className="min-w-0 flex-1 text-left"><span className="vedoy-board-number">{index + 1}</span><span className="truncate">{board.title}</span></button>
      <button onClick={() => onRename(board.id)} className="vedoy-board-rename" aria-label={`Gi ${board.title} nytt navn`}><Pencil className="size-3" /></button>
    </div>)}</div>
    <button onClick={canCreate ? onAdd : onLocked} className="vedoy-board-add" aria-label="Legg til tavle"><Plus className="size-4" /><span>Ny tavle</span></button>
  </nav>
}
