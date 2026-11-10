import type { SourceFiles } from './project-export'

export const FORGE_CHANNEL = 'vedoy-forge-canvas' as const
export const FORGE_PROTOCOL_VERSION = 1 as const
const MAX_PROJECT_BYTES = 256 * 1024

/** Only a configured Forge origin may read private browser-local Canvas drafts. */
export function allowedForgeOrigins(value: string | undefined): Set<string> {
  const origins = new Set(['http://localhost:3000', 'http://127.0.0.1:3000'])
  for (const raw of (value ?? '').split(',')) {
    const candidate = raw.trim()
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
      if ((url.protocol === 'https:' || (url.protocol === 'http:' && local)) && !url.username && !url.password) {
        origins.add(url.origin)
      }
    } catch { /* Ignore invalid configuration values. */ }
  }
  return origins
}

export function isForgeProjectRequest(value: unknown): value is { channel: typeof FORGE_CHANNEL; version: 1; type: 'request-project' } {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  return message.channel === FORGE_CHANNEL && message.version === FORGE_PROTOCOL_VERSION && message.type === 'request-project'
}

export function isCanvasSourceFiles(value: unknown): value is SourceFiles {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const files = [record['index.html'], record['styles.css'], record['script.js']]
  return files.every((item) => typeof item === 'string') &&
    files.reduce<number>((size, item) => size + (item as string).length, 0) <= MAX_PROJECT_BYTES
}
