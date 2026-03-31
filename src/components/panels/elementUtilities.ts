import { Box, Camera, Image, Lightbulb, Mountain, Sun } from 'lucide-vue-next'
import type { Component } from 'vue'
import type { SceneElement } from '@/stores/debugScene'

export type ElementCategory = 'camera' | 'light' | 'sky' | 'ground' | 'mesh' | 'textureArea'

export const ELEMENT_CATEGORIES: { category: ElementCategory; icon: Component; label: string }[] = [
  { category: 'camera', icon: Camera, label: 'Camera' },
  { category: 'light', icon: Lightbulb, label: 'Light' },
  { category: 'ground', icon: Mountain, label: 'Ground' },
  { category: 'sky', icon: Sun, label: 'Sky' },
  { category: 'mesh', icon: Box, label: 'Mesh' },
  { category: 'textureArea', icon: Image, label: 'Texture Area' }
]

export const getElementCategory = (element: SceneElement): ElementCategory => {
  const name = element.name.toLowerCase()
  const type = element.type.toLowerCase()
  if (name.includes('camera') || type.includes('camera')) return 'camera'
  if (name.includes('light') || type.includes('light')) return 'light'
  if (name.includes('sky')) return 'sky'
  if (name.includes('ground')) return 'ground'
  if (type === 'texturearea' || element.groupId !== undefined) return 'textureArea'
  return 'mesh'
}

export const getElementIcon = (element: SceneElement): Component => {
  const category = getElementCategory(element)
  const match = ELEMENT_CATEGORIES.find((c) => c.category === category)
  return match?.icon ?? Image
}

export const getElementColor = (element: SceneElement): string => {
  const name = element.name.toLowerCase()
  const type = element.type.toLowerCase()
  if (name.includes('camera') || type.includes('camera')) return 'text-blue-300'
  if (name.includes('light') || type.includes('light')) return 'text-yellow-400'
  if (name.includes('sky')) return 'text-blue-400'
  if (name.includes('ground')) return 'text-green-600'
  if (name.includes('wireframe')) return 'text-green-400'
  return 'text-gray-400'
}
