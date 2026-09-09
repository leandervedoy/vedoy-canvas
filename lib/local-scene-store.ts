import type { CanvasSnapshot } from '@/components/canvas-editor'

const databaseName = 'vedoy-canvas'
const storeName = 'scenes'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getLocalScene(key: string): Promise<CanvasSnapshot | null> {
  try {
    const database = await openDatabase()
    return await new Promise((resolve, reject) => {
      const request = database.transaction(storeName, 'readonly').objectStore(storeName).get(key)
      request.onsuccess = () => resolve((request.result as CanvasSnapshot | undefined) ?? null)
      request.onerror = () => reject(request.error)
    })
  } catch {
    return null
  }
}

export async function saveLocalScene(key: string, snapshot: CanvasSnapshot): Promise<void> {
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(snapshot, key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch {
    // The canvas remains usable if a browser has disabled local storage.
  }
}
