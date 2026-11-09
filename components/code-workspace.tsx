'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Code2, Download, Eye, FileCode2, FolderOpen, Monitor, PanelRightClose, PanelRightOpen, Save, Smartphone, X } from 'lucide-react'
import { createExportBundle, targets, type SourceFiles, type Target } from '@/lib/project-export'
import { createZip } from '@/lib/zip'

const defaults: SourceFiles = {
  'index.html': `<!doctype html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Min Canvas-side</title>
</head>
<body>
  <main class="hero">
    <p class="eyebrow">Bygget i Vedøy Canvas</p>
    <h1>Hei, verden.</h1>
    <p>Rediger koden, så ser du endringene i forhåndsvisningen.</p>
    <button id="hello-button">Prøv knappen</button>
  </main>
</body>
</html>`,
  'styles.css': `* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: #18212f; }
.hero { min-height: 100vh; display: grid; align-content: center; justify-items: center; gap: 1rem; padding: 2rem; text-align: center; background: linear-gradient(135deg, #f4f1ff, #e8f5ff); }
h1 { margin: 0; font-size: clamp(3rem, 9vw, 6rem); letter-spacing: -.06em; }
p { max-width: 36rem; color: #586174; line-height: 1.6; }
.eyebrow { color: #7657dc; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; font-size: .75rem; }
button { border: 0; border-radius: 999px; padding: .8rem 1.2rem; color: white; background: #7357d7; font-weight: 700; cursor: pointer; }`,
  'script.js': `document.querySelector('#hello-button')?.addEventListener('click', () => {
  alert('Koden din kjører!')
})`,
}
const editorFiles = Object.keys(defaults) as Array<keyof SourceFiles>
const storageKey = 'vedoy-canvas-code-project-v1'

function renderDocument(files: SourceFiles) {
  const body = files['index.html'].match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? files['index.html']
  return `<!doctype html><html lang="no"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Canvas forhåndsvisning</title><style>${files['styles.css']}</style></head><body>${body}<script>${files['script.js']}</script></body></html>`
}

export function CodeWorkspace() {
  const [files, setFiles] = useState<SourceFiles>(defaults)
  const [activeFile, setActiveFile] = useState<keyof SourceFiles>('index.html')
  const [previewOpen, setPreviewOpen] = useState(true)
  const [exportOpen, setExportOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [lineScroll, setLineScroll] = useState(0)
  const editorRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as SourceFiles
        if (parsed['index.html'] && parsed['styles.css'] !== undefined && parsed['script.js'] !== undefined) setFiles(parsed)
      }
    } catch { /* Ignore a damaged local draft and start with the example project. */ }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(files))
      setSaved(true)
      const done = window.setTimeout(() => setSaved(false), 1600)
      return () => window.clearTimeout(done)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [files])

  const preview = useMemo(() => renderDocument(files), [files])
  const updateFile = (value: string) => setFiles((current) => ({ ...current, [activeFile]: value }))
  const exportTarget = (target: Target) => {
    const bundle = createExportBundle(target, files)
    const fileList = target === 'html' ? bundle.files : [...bundle.files.filter((file) => file.path !== 'README.md'), { path: 'README.md', content: bundle.readme }]
    const blob = target === 'html' ? new Blob([bundle.files[0].content], { type: 'text/html;charset=utf-8' }) : createZip(fileList)
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = target === 'html' ? 'index.html' : `${bundle.name}.zip`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExportOpen(false)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      const input = event.currentTarget
      const start = input.selectionStart
      const end = input.selectionEnd
      const value = files[activeFile]
      setFiles((current) => ({ ...current, [activeFile]: value.slice(0, start) + '  ' + value.slice(end) }))
      requestAnimationFrame(() => { input.selectionStart = input.selectionEnd = start + 2 })
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      localStorage.setItem(storageKey, JSON.stringify(files))
      setSaved(true)
    }
  }

  return <main className="code-app">
    <header className="code-topbar">
      <a href="https://vedoy-canvas.vercel.app" className="code-brand" aria-label="Vedøy Canvas"><span className="brand-mark"><Code2 size={18} /></span><span>Vedøy <b>Canvas</b></span></a>
      <div className="project-label"><span className="project-dot" /> Ny nettside <span className="muted">/</span> Kodeeditor</div>
      <div className="top-actions">
        <span className="save-state"><span className={saved ? 'save-dot is-saved' : 'save-dot'} />{saved ? 'Lagret lokalt' : 'Autosave'}</span>
        <button className="toolbar-button preview-toggle" onClick={() => setPreviewOpen((value) => !value)} title={previewOpen ? 'Skjul forhåndsvisning' : 'Åpne forhåndsvisning'}><Eye size={16} /> <span>Forhåndsvisning</span>{previewOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}</button>
        <button className="export-button" onClick={() => setExportOpen(true)}><Download size={16} /> Eksporter</button>
      </div>
    </header>

    <div className="workspace">
      <aside className="file-sidebar">
        <div className="sidebar-heading"><span>UTFORSKER</span><FolderOpen size={15} /></div>
        <div className="project-folder"><span className="folder-chevron">⌄</span><span className="folder-icon">▰</span> canvas-project</div>
        <div className="file-list">{editorFiles.map((file) => <button key={file} className={activeFile === file ? 'file-row active' : 'file-row'} onClick={() => setActiveFile(file)}><FileCode2 size={15} className={file === 'index.html' ? 'file-html' : file === 'styles.css' ? 'file-css' : 'file-js'} />{file}</button>)}</div>
        <div className="sidebar-bottom"><span className="tiny-pill">3 filer</span><span>Canvas Editor</span></div>
      </aside>

      <section className="editor-column">
        <div className="file-tabs">{editorFiles.map((file) => <button key={file} onClick={() => setActiveFile(file)} className={activeFile === file ? 'file-tab active' : 'file-tab'}><FileCode2 size={14} className={file === 'index.html' ? 'file-html' : file === 'styles.css' ? 'file-css' : 'file-js'} />{file}{activeFile === file && <span className="tab-unsaved" />}</button>)}</div>
        <div className="editor-meta"><div><span className="crumb">canvas-project</span><span className="slash">/</span><strong>{activeFile}</strong></div><span className="language-tag">{activeFile === 'index.html' ? 'HTML' : activeFile === 'styles.css' ? 'CSS' : 'JavaScript'}</span></div>
        <div className="code-editor">
          <div className="line-gutter" aria-hidden="true">{files[activeFile].split('\\n').map((_, index) => <div key={index}>{index + 1}</div>)}</div>
          <textarea
            ref={editorRef}
            className="code-input"
            value={files[activeFile]}
            onChange={(event) => updateFile(event.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={(event) => setLineScroll(event.currentTarget.scrollTop)}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label={`Rediger ${activeFile}`}
          />
          <style>{`.line-gutter { transform: translateY(-${lineScroll}px); }`}</style>
        </div>
        <footer className="editor-status"><span><span className="status-light" /> Klar</span><span>Linjer: {files[activeFile].split('\\n').length}</span><span>UTF-8</span><span>{activeFile === 'index.html' ? 'HTML' : activeFile === 'styles.css' ? 'CSS' : 'JavaScript'}</span></footer>
      </section>

      {previewOpen && <section className="preview-column">
        <div className="preview-head"><div className="preview-title"><Eye size={15} /><strong>Forhåndsvisning</strong><span className="live-pill">LIVE</span></div><div className="preview-actions"><button title="Desktopvisning"><Monitor size={15} /></button><button title="Mobilvisning"><Smartphone size={15} /></button><button title="Lukk forhåndsvisning" onClick={() => setPreviewOpen(false)}><X size={16} /></button></div></div>
        <div className="preview-address"><span className="secure-icon">●</span><span>canvas.local/preview</span><span className="refresh-label">oppdateres mens du skriver</span></div>
        <div className="preview-frame-wrap"><iframe title="Live forhåndsvisning av nettsiden" className="preview-frame" srcDoc={preview} sandbox="allow-scripts" /></div>
        <div className="preview-foot"><span><span className="live-indicator" /> Live fra editor</span><span>Oppdateres automatisk</span></div>
      </section>}
    </div>

    {exportOpen && <div className="export-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExportOpen(false) }}>
      <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="export-dialog-head"><div><span className="export-kicker">EKSPORTER PROSJEKT</span><h2 id="export-title">Velg format</h2><p>Last ned nettsiden som et prosjekt du kan fortsette å utvikle.</p></div><button className="dialog-close" onClick={() => setExportOpen(false)} aria-label="Lukk eksport"><X size={18} /></button></div>
        <div className="export-options">{targets.map((target) => <button className="export-option" key={target.id} onClick={() => exportTarget(target.id)}><span className={target.id === 'html' ? 'export-format format-html' : 'export-format'}>{target.id === 'html' ? 'HTML' : target.id === 'forge' ? 'V' : target.id === 'react-native' ? 'RN' : target.label.slice(0, 2).toUpperCase()}</span><span className="export-option-copy"><strong>{target.label}</strong><small>{target.id === 'html' ? 'Én selvstendig HTML-fil' : target.id === 'react-native' ? 'Expo-app med WebView-visning' : target.id === 'forge' ? 'Forge-prosjekt med .vdy-fil og webressurser' : `Prosjektmappe for ${target.label}`}</small></span><span className="zip-label">{target.extension}</span></button>)}</div>
        <p className="export-note"><Save size={14} /> Prosjektet lagres automatisk i denne nettleseren.</p>
      </section>
    </div>}
  </main>
}
