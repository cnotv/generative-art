import * as THREE from 'three'
import { getBall } from '@webgamekit/threejs'
import { createNameLabel, updateNameLabelPosition, disposeNameLabel } from './nameLabels'
import type { BallPosPayload } from '../types'
import { MARBLE_RADIUS } from '../../MarbleMadness/config'

type GhostEntry = {
  mesh: THREE.Mesh
  label: THREE.Sprite | null
}

export type GhostRegistry = {
  entries: Map<string, GhostEntry>
  scene: THREE.Scene | null
}

export const createGhostRegistry = (): GhostRegistry => ({ entries: new Map(), scene: null })

const makeGhostMesh = (scene: THREE.Scene, colorHex: number, texture?: string): THREE.Mesh =>
  getBall(scene, undefined, {
    size: MARBLE_RADIUS,
    color: colorHex,
    texture,
    transparent: true,
    opacity: 0.85,
    segments: 24
  })

export type GhostPlacement = {
  peerId: string
  colorHex: number
  pos: BallPosPayload
  texture?: string
  name?: string
  nameColor?: string
}

export const placeGhost = (registry: GhostRegistry, placement: GhostPlacement): void => {
  if (!registry.scene) return
  const { peerId, colorHex, pos, texture, name, nameColor } = placement
  const existing = registry.entries.get(peerId)
  const entry: GhostEntry = existing ?? {
    mesh: makeGhostMesh(registry.scene, colorHex, texture),
    label: name ? createNameLabel(registry.scene, name, nameColor ?? '#ffffff') : null
  }
  if (!existing) registry.entries.set(peerId, entry)
  entry.mesh.position.set(pos.x, pos.y, pos.z)
  entry.mesh.quaternion.set(pos.rx, pos.ry, pos.rz, pos.rw)
  if (entry.label) updateNameLabelPosition(entry.label, pos)
}

export const removeGhost = (registry: GhostRegistry, peerId: string): void => {
  const entry = registry.entries.get(peerId)
  if (!entry || !registry.scene) return
  registry.scene.remove(entry.mesh)
  entry.mesh.geometry.dispose()
  if (entry.mesh.material instanceof THREE.Material) entry.mesh.material.dispose()
  if (entry.label) disposeNameLabel(registry.scene, entry.label)
  registry.entries.delete(peerId)
}

export const clearGhosts = (registry: GhostRegistry): void => {
  ;[...registry.entries.keys()].forEach((peerId) => removeGhost(registry, peerId))
  registry.scene = null
}
