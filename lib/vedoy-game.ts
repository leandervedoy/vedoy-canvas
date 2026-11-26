/**
 * Vedoy Game: small Three.js runtime for React/Next.js clients.
 * Install three and @types/three before importing this module.
 * The animation layer is a lightweight adapter; connect the canonical Vedoy Motion package when available.
 */
import * as THREE from 'three'

export type GameShape = 'cube' | 'sphere' | 'plane'
export type GameEntity = { id: string; mesh: THREE.Mesh }
export class VedoyGame {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000)
  readonly renderer: THREE.WebGLRenderer
  private entities = new Map<string, GameEntity>()
  private frame = 0
  private running = false
  private resizeObserver: ResizeObserver
  private readonly container: HTMLElement
  private readonly clock = new THREE.Clock()
  private updates = new Set<(dt: number) => void>()

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    container.appendChild(this.renderer.domElement)
    this.camera.position.set(0, 2, 7)
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2))
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
  }

  create(id: string, shape: GameShape = 'cube', color = '#2563eb'): GameEntity {
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(id) || this.entities.has(id)) throw new Error('Invalid or duplicate entity ID')
    const geometry = shape === 'sphere' ? new THREE.SphereGeometry(0.65, 24, 16) : shape === 'plane' ? new THREE.PlaneGeometry(1.5, 1.5) : new THREE.BoxGeometry(1, 1, 1)
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color }))
    mesh.name = id
    this.scene.add(mesh)
    const entity = { id, mesh }
    this.entities.set(id, entity)
    return entity
  }

  get(id: string) { return this.entities.get(id) }
  position(id: string, x: number, y: number, z: number) {
    const entity = this.entities.get(id)
    if (!entity) throw new Error('Unknown entity: ' + id)
    entity.mesh.position.set(x, y, z)
    return entity
  }
  onUpdate(callback: (dt: number) => void) {
    this.updates.add(callback)
    return () => { this.updates.delete(callback) }
  }
  start() {
    if (this.running) return
    this.running = true
    this.clock.start()
    const tick = () => {
      if (!this.running) return
      const dt = Math.min(this.clock.getDelta(), 0.05)
      for (const update of this.updates) update(dt)
      this.renderer.render(this.scene, this.camera)
      this.frame = requestAnimationFrame(tick)
    }
    tick()
  }
  stop() { this.running = false; cancelAnimationFrame(this.frame) }
  private resize() {
    const width = Math.max(this.container.clientWidth, 1)
    const height = Math.max(this.container.clientHeight, 1)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }
  dispose() {
    this.stop()
    this.resizeObserver.disconnect()
    this.updates.clear()
    for (const entity of this.entities.values()) {
      entity.mesh.geometry.dispose()
      const material = entity.mesh.material
      if (Array.isArray(material)) material.forEach(m => m.dispose())
      else material.dispose()
      this.scene.remove(entity.mesh)
    }
    this.entities.clear()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}

/** Minimal Vedoy Motion adapter; does not depend on an unverified external package API. */
export function motionSpin(game: VedoyGame, id: string, speed = 1) {
  return game.onUpdate(dt => {
    const entity = game.get(id)
    if (entity) entity.mesh.rotation.y += dt * speed
  })
}
