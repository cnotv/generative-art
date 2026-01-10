import * as THREE from 'three';

/**
 * Configuration interface for zigzag texture parameters
 */
interface ZigzagTextureOptions {
  size?: number;
  backgroundColor?: string;
  zigzagColor?: string;
  secondaryColor?: string;
  zigzagHeight?: number;
  zigzagWidth?: number;
  primaryThickness?: number;
  secondaryThickness?: number;
  repeatX?: number;
  repeatY?: number;
}

/**
 * Creates a procedural zigzag pattern texture using Canvas API
 * @param options Configuration options for the zigzag pattern
 * @returns THREE.CanvasTexture with zigzag pattern
 */
export const createZigzagTexture = (options: ZigzagTextureOptions = {}): THREE.CanvasTexture => {
  const {
    size = 64,
    backgroundColor = '#68b469',
    zigzagColor = '#4a7c59',
    zigzagHeight = 16,
    zigzagWidth = 8,
    primaryThickness = 3,
    repeatX = 50,
    repeatY = 50
  } = options;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = zigzagColor;
  ctx.lineWidth = primaryThickness;
  ctx.beginPath();

  const numZigzags = Math.ceil(size / zigzagWidth);

  for (let i = 0; i <= numZigzags; i++) {
    const x = i * zigzagWidth;
    const y = (i % 2 === 0) ? size / 2 - zigzagHeight / 2 : size / 2 + zigzagHeight / 2;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  
  return texture;
};
