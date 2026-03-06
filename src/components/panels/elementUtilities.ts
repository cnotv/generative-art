import { Box, Camera, Image, Lightbulb, Mountain, Sun } from 'lucide-vue-next';
import type { Component } from 'vue';
import type { SceneElement } from '@/stores/debugScene';

export const getElementIcon = (element: SceneElement): Component => {
  const name = element.name.toLowerCase();
  const type = element.type.toLowerCase();
  if (name.includes('camera') || type.includes('camera')) return Camera;
  if (name.includes('light') || type.includes('light')) return Lightbulb;
  if (name.includes('sky')) return Sun;
  if (name.includes('ground')) return Mountain;
  if (type.includes('mesh') || name.includes('wireframe')) return Box;
  return Image;
};

export const getElementColor = (element: SceneElement): string => {
  const name = element.name.toLowerCase();
  const type = element.type.toLowerCase();
  if (name.includes('camera') || type.includes('camera')) return 'text-blue-300';
  if (name.includes('light') || type.includes('light')) return 'text-yellow-400';
  if (name.includes('sky')) return 'text-blue-400';
  if (name.includes('ground')) return 'text-green-600';
  if (name.includes('wireframe')) return 'text-green-400';
  return 'text-gray-400';
};
