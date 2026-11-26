export type Action = { element: string; kind: 'go' | 'say' | 'show' | 'hide'; value: string }
export type CompileResult = { actions: Action[]; javascript: string; errors: string[] }
const identifier = /^[a-zA-Z_][a-zA-Z0-9_-]*$/
export function compileVedoyScript(source: string): CompileResult {
  const actions: Action[] = [], errors: string[] = []
  let current: string | null = null
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const start = /^When\s+([A-Za-z_][A-Za-z0-9_-]*)\.Clicked$/i.exec(line)
    if (start) { if (current) errors.push(`Line ${index + 1}: close the previous block with a dot`); current = start[1]; if (!identifier.test(current)) errors.push(`Line ${index + 1}: invalid element ID`); return }
    if (line === '.') { if (!current) errors.push(`Line ${index + 1}: unexpected end`); current = null; return }
    if (!current) { errors.push(`Line ${index + 1}: expected When element.Clicked`); return }
    const command = /^(go|say|show|hide)\s+(.+)\.$/i.exec(line)
    if (!command) { errors.push(`Line ${index + 1}: unknown command`); return }
    const kind = command[1].toLowerCase() as Action['kind']
    let value = command[2].trim()
    if (kind === 'go' || kind === 'say') {
      try { const parsed: unknown = JSON.parse(value); if (typeof parsed !== 'string') throw new Error(); value = parsed } catch { errors.push(`Line ${index + 1}: use a quoted string`); return }
    } else if (!identifier.test(value)) { errors.push(`Line ${index + 1}: invalid element ID`); return }
    if (kind === 'go' && !(value.startsWith('/') && !value.startsWith('//'))) { errors.push(`Line ${index + 1}: navigation must use an internal /path`); return }
    actions.push({ element: current, kind, value })
  })
  if (current) errors.push('Missing closing dot')
  const javascript = errors.length ? '' : actions.map(a => {
    const target = JSON.stringify(a.element)
    const action = a.kind === 'go' ? `window.location.assign(${JSON.stringify(a.value)});` : a.kind === 'say' ? `window.alert(${JSON.stringify(a.value)});` : `document.getElementById(${JSON.stringify(a.value)})?.style.setProperty("display", "${a.kind === 'hide' ? 'none' : ''}");`
    return `document.getElementById(${target})?.addEventListener("click", () => { ${action} });`
  }).join('\n')
  return { actions: errors.length ? [] : actions, javascript, errors }
}
