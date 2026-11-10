'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient, type User } from '@supabase/supabase-js'
import { InternalCanvasGate } from '@/components/internal-canvas-gate'
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCheck, ChevronDown,
  Clock3, Coins, Lightbulb, ListChecks, LoaderCircle, LockKeyhole,
  Plus, Save, ShieldCheck, Sparkles, Target, Trash2, TrendingUp, X,
} from 'lucide-react'
import {
  DEFAULT_DECISION, INITIAL_APPROVAL_TASKS, breakEvenCustomers,
  estimateProfit, priorityAdvice, riceScore,
  type DecisionInput, type DecisionProject, type DecisionStatus, type DecisionTask,
} from '@/lib/decision-engine'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const clientId = process.env.NEXT_PUBLIC_VEDOY_LOGIN_CLIENT_ID
const supabase = url && key ? createClient(url, key, {
  auth: { storageKey: 'vedoy-canvas-auth-v2', detectSessionInUrl: false },
}) : null
const money = (n: number) => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(n) + ' kr'
const digits = (n: number) => new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 2 }).format(n)
const statuses: { id: DecisionStatus, label: string }[] = [
  { id: 'idea', label: 'Idé' }, { id: 'validate', label: 'Validering' },
  { id: 'approved', label: 'Godkjent' }, { id: 'building', label: 'Under utvikling' },
  { id: 'launched', label: 'Lansert' }, { id: 'parked', label: 'Parkert' },
]
const categories = ['Vedøy Studio', 'Vedøy Assist', 'Vedoy Collective', 'Vedoy Forge', 'Vedoy Earth', 'Vedoy Cloud', 'Annet']
const control = 'w-full rounded-xl border border-white/15 bg-[#151922] px-3 py-2.5 text-sm text-white outline-none transition focus:border-[#8c93ff] focus:ring-2 focus:ring-[#8c93ff]/20'
const tinyLabel = 'mb-1.5 block text-xs font-medium tracking-wide text-slate-400'
const card = 'rounded-2xl border border-white/10 bg-[#151922] p-4 sm:p-5'
function Field({ label, value, onChange, hint, min = 0, max, step = 1 }: {
  label: string, value: number, onChange: (v: number) => void,
  hint?: string, min?: number, max?: number, step?: number
}) {
  return <label className="block"><span className={tinyLabel}>{label}</span>
    <input className={control} type="number" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Math.min(max ?? 100000000, Math.max(min, Number(e.target.value) || 0)))} />
    {hint && <span className="mt-1 block text-[11px] leading-4 text-slate-500">{hint}</span>}
  </label>
}
function Meter({ label, value, note }: { label: string, value: string, note?: string }) {
  return <div className={card}><div className="text-xs text-slate-400">{label}</div>
    <div className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">{value}</div>
    {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}</div>
}

function DecisionWorkspace({ user }: { user: User }) {
  const [items, setItems] = useState<DecisionProject[]>([])
  const [tasks, setTasks] = useState<DecisionTask[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [editor, setEditor] = useState<DecisionInput | null>(null)
  const [tab, setTab] = useState<'overview' | 'compare' | 'tasks'>('overview')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [newTask, setNewTask] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [query, setQuery] = useState('')
  const active = items.find(item => item.id === selected)
  const form = editor ?? (active ? toInput(active) : null)
  const update = <K extends keyof DecisionInput>(field: K, value: DecisionInput[K]) => {
    setEditor(current => ({ ...(current ?? (active ? toInput(active) : DEFAULT_DECISION)), [field]: value }))
  }

  const load = async () => {
    if (!supabase) return
    const [projects, taskRows] = await Promise.all([
      supabase.from('canvas_decision_projects').select('*').order('updated_at', { ascending: false }),
      supabase.from('canvas_decision_tasks').select('*').order('created_at'),
    ])
    if (projects.error || taskRows.error) setNotice('Kunne ikke laste data. Kontroller at databasemigrasjonen er installert.')
    else {
      setItems((projects.data ?? []) as DecisionProject[])
      setTasks((taskRows.data ?? []) as DecisionTask[])
    }
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  const save = async () => {
    if (!supabase || !form || !form.title.trim()) { setNotice('Gi ideen et navn før du lagrer.'); return }
    setBusy(true)
    const payload = { ...form, title: form.title.trim(), updated_at: new Date().toISOString() }
    const result = active
      ? await supabase.from('canvas_decision_projects').update(payload).eq('id', active.id).eq('owner_id', user.id).select().single()
      : await supabase.from('canvas_decision_projects').insert({ ...payload, owner_id: user.id }).select().single()
    if (result.error) setNotice('Lagring feilet: ' + result.error.message)
    else {
      setSelected((result.data as DecisionProject).id)
      setEditor(null)
      setNotice('Lagret i din private idébank.')
      await load()
    }
    setBusy(false)
  }
  const deleteProject = async () => {
    if (!supabase || !active || !confirm('Slette denne ideen og alle oppgavene permanent?')) return
    const { error } = await supabase.from('canvas_decision_projects').delete().eq('id', active.id).eq('owner_id', user.id)
    if (error) setNotice(error.message)
    else { setSelected(null); setEditor(null); await load() }
  }
  const addTask = async (title: string) => {
    if (!supabase || !active || !title.trim()) return
    const { error } = await supabase.from('canvas_decision_tasks').insert({ project_id: active.id, owner_id: user.id, title: title.trim() })
    if (error) setNotice(error.message)
    else await load()
  }
  const updateTask = async (task: DecisionTask, status: DecisionTask['status']) => {
    if (!supabase) return
    const { error } = await supabase.from('canvas_decision_tasks').update({ status }).eq('id', task.id).eq('owner_id', user.id)
    if (error) setNotice(error.message)
    else await load()
  }
  const approve = async () => {
    if (!supabase || !active) return
    const { error } = await supabase.from('canvas_decision_projects')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', active.id).eq('owner_id', user.id)
    if (error) { setNotice(error.message); return }
    const existingTitles = new Set(tasks.filter(t => t.project_id === active.id).map(t => t.title))
    const missing = INITIAL_APPROVAL_TASKS.filter(title => !existingTitles.has(title))
    if (missing.length) {
      const { error: taskError } = await supabase.from('canvas_decision_tasks').insert(
        missing.map(title => ({ project_id: active.id, owner_id: user.id, title })))
      if (taskError) setNotice('Idéen er godkjent, men oppgaver kunne ikke opprettes.')
    }
    await load()
  }
  const ordered = useMemo(() => items.filter(item =>
    (statusFilter === 'all' || item.status === statusFilter) &&
    (item.title.toLowerCase().includes(query.toLowerCase()) || item.category.toLowerCase().includes(query.toLowerCase()))
  ).sort((a,b) => riceScore(b) - riceScore(a)), [items, statusFilter, query])
  const base = form && estimateProfit(form, form.customers_base)
  const scenarios = form ? [
    { label: 'Forsiktig', count: form.customers_low },
    { label: 'Basis', count: form.customers_base },
    { label: 'Optimistisk', count: form.customers_high },
  ] : []
  const activeTasks = tasks.filter(t => t.project_id === active?.id)
  const completed = activeTasks.filter(t => t.status === 'done').length
  return <main className="min-h-screen bg-[#0b1018] px-4 py-5 text-white sm:px-7 lg:px-10">
    <div className="mx-auto max-w-7xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><Link href="/" className="mb-3 inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white"><ArrowLeft className="size-4"/> Tilbake til Canvas</Link>
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#777df5]/20"><Sparkles className="size-6 text-[#b4b7ff]"/></span>
            <div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">Vedoy Infinite Canvas</h1><p className="text-xs text-slate-400">Decision Engine · One Canvas. Infinite Possibilities.</p></div></div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300"><ShieldCheck className="size-4"/> Internal Membership</div>
      </header>
      {notice && <div role="status" className="mb-5 flex items-center justify-between rounded-xl border border-[#8c93ff]/30 bg-[#8c93ff]/10 px-4 py-3 text-sm">
        <span>{notice}</span><button aria-label="Lukk melding" onClick={() => setNotice('')}><X className="size-4"/></button></div>}
      <div className="mb-6 flex flex-wrap gap-2">{[
        { id: 'overview' as const, label: 'Idébank og analyse', icon: Lightbulb },
        { id: 'compare' as const, label: 'Sammenlign', icon: TrendingUp },
        { id: 'tasks' as const, label: 'Gjennomføring', icon: ListChecks },
      ].map(entry => <button key={entry.id} onClick={() => setTab(entry.id)} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm transition ${tab === entry.id ? 'bg-[#777df5] text-white shadow-lg shadow-indigo-500/15' : 'border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}><entry.icon className="size-4"/>{entry.label}</button>)}</div>
      {loading ? <p className="py-16 text-center text-slate-400">Laster din private arbeidsflate …</p> : <div className="grid gap-5 lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className={card + ' self-start'}>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Idébanken</h2><p className="text-xs text-slate-500">{items.length} prosjekter</p></div>
            <button title="Ny idé" onClick={() => { setSelected(null); setEditor({ ...DEFAULT_DECISION }); setTab('overview') }} className="rounded-lg bg-[#777df5] p-2"><Plus className="size-4"/></button></div>
          <input aria-label="Søk ideer" placeholder="Søk etter prosjekter …" className={control + ' mb-3'} value={query} onChange={e => setQuery(e.target.value)}/>
          <select aria-label="Filtrer status" className={control + ' mb-3'} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Alle statuser</option>{statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <div className="max-h-[58vh] space-y-2 overflow-y-auto">
            {ordered.map(project => <button key={project.id} onClick={() => { setSelected(project.id); setEditor(null) }}
              className={`w-full rounded-xl border p-3 text-left transition ${project.id === selected ? 'border-[#8c93ff]/75 bg-[#777df5]/15' : 'border-white/10 bg-white/[.025] hover:bg-white/10'}`}>
              <span className="block text-sm font-medium">{project.title}</span><span className="mt-1 block text-xs text-slate-400">{project.category} · {statuses.find(s => s.id === project.status)?.label}</span>
              <span className="mt-2 flex items-center justify-between text-xs"><span className="text-slate-400">RICE {digits(riceScore(project))}</span><span className={estimateProfit(project,project.customers_base).profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{money(estimateProfit(project,project.customers_base).profit)}/mnd</span></span>
            </button>)}
            {!ordered.length && <p className="px-2 py-5 text-center text-xs text-slate-500">Ingen ideer matcher filteret. Opprett din første idé.</p>}
          </div>
        </aside>
        <section className="min-w-0">
          {tab === 'compare' ? <div className={card}><h2 className="mb-2 text-xl font-semibold">Prioriteringsoversikt</h2><p className="mb-4 text-sm leading-6 text-slate-400">RICE rangerer innsats opp mot rekkevidde, effekt og sikkerhet. Overskudd er et separat estimat. Tallene er antakelser frem til de er validert.</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[580px] text-left text-sm"><thead className="border-b border-white/15 text-xs text-slate-400"><tr><th className="pb-3">Prosjekt</th><th>RICE</th><th>Basisresultat/mnd</th><th>Investering</th><th>Energi</th></tr></thead><tbody>{ordered.map(p => <tr key={p.id} onClick={() => { setSelected(p.id); setEditor(null); setTab('overview') }} className="cursor-pointer border-b border-white/5 hover:bg-white/5"><td className="py-4 font-medium">{p.title}</td><td>{digits(riceScore(p))}</td><td className={estimateProfit(p,p.customers_base).profit>=0?'text-emerald-400':'text-rose-400'}>{money(estimateProfit(p,p.customers_base).profit)}</td><td>{money(estimateProfit(p,p.customers_base).investment)}</td><td>{p.energy}/5</td></tr>)}</tbody></table></div>
          </div> : tab === 'tasks' ? <div className={card}><h2 className="text-xl font-semibold">Fra idé til gjennomføring</h2>
            {!active ? <p className="mt-4 text-sm text-slate-400">Velg et prosjekt i idébanken for å se oppgaver.</p> : <>
              <p className="mt-2 text-sm text-slate-400">{active.title} · {completed} av {activeTasks.length} oppgaver fullført</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div style={{width:(activeTasks.length?completed/activeTasks.length*100:0)+'%'}} className="h-full rounded-full bg-emerald-400"/></div>
              <form onSubmit={e=>{e.preventDefault();void addTask(newTask);setNewTask('')}} className="mt-6 flex gap-2"><input aria-label="Ny oppgave" className={control} value={newTask} maxLength={240} onChange={e=>setNewTask(e.target.value)} placeholder="Neste konkrete steg …"/><button className="rounded-xl bg-[#777df5] px-4" aria-label="Legg til oppgave"><Plus className="size-4"/></button></form>
              <div className="mt-5 space-y-2">{activeTasks.map(t=><div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><span className={t.status==='done'?'text-sm text-slate-500 line-through':'text-sm'}>{t.title}</span><select className="rounded-lg border border-white/10 bg-[#222736] p-2 text-xs" aria-label={'Status for '+t.title} value={t.status} onChange={e=>void updateTask(t,e.target.value as DecisionTask['status'])}><option value="planned">Planlagt</option><option value="in_progress">I gang</option><option value="done">Fullført</option></select></div>)}{!activeTasks.length&&<p className="py-5 text-sm text-slate-500">Ingen oppgaver ennå. Godkjenn ideen for å få forslag til tre første steg.</p>}</div>
            </>}
          </div> : !form ? <div className={card+' flex min-h-[350px] flex-col items-center justify-center text-center'}><Target className="size-10 text-[#a1a6ff]"/><h2 className="mt-5 text-xl font-semibold">Fra idé til beslutning</h2><p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">Registrer en idé, sammenlign lønnsomhet og bygg en realistisk handlingsplan. Ingen endringer godkjennes automatisk.</p><button onClick={()=>setEditor({...DEFAULT_DECISION})} className="mt-6 rounded-xl bg-[#777df5] px-5 py-3 text-sm font-medium">Opprett din første idé</button></div>
          : <div className="space-y-5">
            <div className={card}><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="text-xs font-semibold uppercase tracking-widest text-[#a1a6ff]">Prosjektanalyse</span><h2 className="mt-1 text-xl font-semibold">{active?.title||'Ny idé'}</h2></div><div className="flex gap-2">{active&&<button title="Slett prosjekt" onClick={()=>void deleteProject()} className="rounded-xl border border-rose-500/30 p-2 text-rose-400"><Trash2 className="size-4"/></button>}<button onClick={()=>void save()} disabled={busy||!form.title.trim()} className="flex items-center gap-2 rounded-xl bg-[#777df5] px-4 py-2.5 text-sm font-medium disabled:opacity-40"><Save className="size-4"/>{busy?'Lagrer …':'Lagre idé'}</button></div></div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className={tinyLabel}>Navn på idéen</span><input className={control} maxLength={160} value={form.title} onChange={e=>update('title',e.target.value)} placeholder="For eksempel: Vedoy Studio – kundeportal"/></label>
                <label className="sm:col-span-2"><span className={tinyLabel}>Beskrivelse og kundebehov</span><textarea className={control+' min-h-20'} value={form.description} onChange={e=>update('description',e.target.value)} placeholder="Hvilket problem løser dette?"/></label>
                <label><span className={tinyLabel}>Forretningsområde</span><select className={control} value={form.category} onChange={e=>update('category',e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></label>
                <label><span className={tinyLabel}>Beslutningsstatus</span><select className={control} value={form.status} onChange={e=>update('status',e.target.value as DecisionStatus)}>{statuses.map(s=><option value={s.id} key={s.id}>{s.label}</option>)}</select></label>
              </div>
            </div>
            <div className={card}><h3 className="mb-1 flex items-center gap-2 font-semibold"><Target className="size-4 text-[#a1a6ff]"/> RICE og kapasitet</h3><p className="mb-5 text-xs text-slate-400">Bruk sammenlignbar rekkevidde per kvartal. Sikkerhet er et anslag fra 0–100 %, og effekt følger RICE-skalaen 0,25–3.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Rekkevidde / kvartal" value={form.reach} onChange={v=>update('reach',v)}/>
                <Field label="Effekt" value={form.impact} min={0} max={3} step={0.25} onChange={v=>update('impact',v)}/>
                <Field label="Sikkerhet (%)" value={form.confidence} max={100} onChange={v=>update('confidence',v)}/>
                <Field label="Utviklingstimer (engangs)" value={form.build_hours} onChange={v=>update('build_hours',v)}/>
                <Field label="Vedlikeholdstimer per måned" value={form.monthly_hours} onChange={v=>update('monthly_hours',v)}/>
                <Field label="Energibehov (1–5)" value={form.energy} min={1} max={5} onChange={v=>update('energy',v)}/>
              </div>
            </div>
            <div className={card}><h3 className="mb-1 flex items-center gap-2 font-semibold"><Coins className="size-4 text-[#a1a6ff]"/> Profittsimulator</h3><p className="mb-5 text-xs text-slate-400">Beregner månedlig resultat eks. mva. og skatt, inkludert anslått verdi av arbeidstiden. Ikke en garanti for faktisk inntjening.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Inntekt per kunde per måned (kr)" value={form.price_per_customer} onChange={v=>update('price_per_customer',v)}/>
                <Field label="Variabel kostnad per kunde (kr)" value={form.variable_cost_per_customer} onChange={v=>update('variable_cost_per_customer',v)}/>
                <Field label="Faste månedlige kostnader (kr)" value={form.fixed_monthly_cost} onChange={v=>update('fixed_monthly_cost',v)}/>
                <Field label="Timekostnad / alternativverdi (kr)" value={form.hourly_cost} onChange={v=>update('hourly_cost',v)}/>
                <Field label="Forsiktig: kunder" value={form.customers_low} onChange={v=>update('customers_low',Math.floor(v))}/>
                <Field label="Basis: kunder" value={form.customers_base} onChange={v=>update('customers_base',Math.floor(v))}/>
                <Field label="Optimistisk: kunder" value={form.customers_high} onChange={v=>update('customers_high',Math.floor(v))}/>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Meter label="RICE-score" value={digits(riceScore(form))} note="Høyere betyr mer effekt per utviklingstime"/>
              <Meter label="Månedlig resultat · basis" value={money(base?.profit??0)} note="Etter estimerte drifts- og timekostnader"/>
              <Meter label="Break-even" value={breakEvenCustomers(form)===null?'Ikke mulig':(breakEvenCustomers(form)+' kunder')} note="Estimert månedlig nullpunkt"/>
              <Meter label="Engangsinnsats" value={money(base?.investment??0)} note="Utviklingstimer × intern timekostnad"/>
            </div>
            <div className={card}><h3 className="font-semibold">Tre scenarier</h3><div className="mt-4 grid gap-3 sm:grid-cols-3">{scenarios.map(s=>{const p=estimateProfit(form,s.count);return <div key={s.label} className="rounded-xl border border-white/10 bg-white/[.025] p-4"><span className="text-xs text-slate-400">{s.label}</span><div className="mt-1 text-sm">{s.count} kunder · {money(p.revenue)} omsetning</div><div className={`mt-3 text-lg font-semibold ${p.profit>=0?'text-emerald-400':'text-rose-400'}`}>{money(p.profit)}/mnd</div><div className="mt-1 text-xs text-slate-500">{p.margin===null?'Ukjent margin':digits(p.margin*100)+' % driftsmargin'}</div></div>})}</div>
              <p className="mt-4 text-xs text-slate-500">Tilbakebetalingstid i basis: {base?.paybackMonths===null?'Kan ikke estimeres ved ikke-positivt overskudd':digits(base?.paybackMonths??0)+' måneder'}. Modellen antar stabile kundetall og ingen kundetilgangskostnader utover oppgitte kostnader.</p>
            </div>
            <div className={card}><div className="flex items-center gap-2"><Sparkles className="size-4 text-[#a1a6ff]"/><h3 className="font-semibold">Beslutningsassistent</h3></div>
              <p className="mt-2 text-xs text-slate-400">Regelbaserte anbefalinger, ikke generert av KI. Ingen automatisk godkjenning eller endringer.</p>
              <label className="mt-4 block"><span className={tinyLabel}>Kundevalidering og bevis</span><textarea className={control+' min-h-20'} value={form.validation_note} onChange={e=>update('validation_note',e.target.value)} placeholder="Kundeintervjuer, tilbud, signerte avtaler eller salg …"/></label>
              <ul className="mt-4 space-y-2">{priorityAdvice(form).map(text=><li key={text} className="flex gap-2 rounded-lg bg-white/5 px-3 py-3 text-sm text-slate-200"><ArrowRight className="mt-0.5 size-4 shrink-0 text-[#a1a6ff]"/>{text}</li>)}</ul>
              <div className="mt-5 flex flex-wrap gap-2"><button onClick={()=>void save()} disabled={busy||!form.title.trim()} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm disabled:opacity-50">Lagre vurdering</button>
                {active && form.status!=='approved' && <button disabled={Boolean(editor)} onClick={()=>void approve()} title={editor?'Lagre endringene først':'Godkjenn denne ideen og opprett oppgaver'} className="flex items-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm text-emerald-300 disabled:opacity-40"><CheckCheck className="size-4"/> Godkjenn og lag oppgaver</button>}
                {active && <button onClick={()=>setTab('tasks')} className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm"><ListChecks className="size-4"/> Oppgaver</button>}
              </div>
            </div>
          </div>}
        </section>
      </div>}
      <footer className="mt-10 border-t border-white/10 py-5 text-xs text-slate-500">Kun for godkjente interne medlemmer · Resultater er scenarioestimater · Data er isolert med Supabase RLS.</footer>
    </div>
  </main>
}
function toInput(project: DecisionProject): DecisionInput {
  const { id: _id, owner_id: _owner, created_at: _created, updated_at: _updated, ...fields } = project
  return fields
}
export default function DecisionPage() { return <InternalCanvasGate>{user => <DecisionWorkspace user={user}/>}</InternalCanvasGate> }
