import * as THREE from 'three';

const PANEL_SIZE = 8;
const FLIP_SPEED = 2.5;
const FLIP_TARGET = -Math.PI / 2;
const TITLE_Y_RATIO = 0.82;
const CANVAS_SIZE = 512;
const BORDER_INSET = 16;
const BORDER_INSET_DOUBLE = 32;
const LOGO_SIZE_RATIO = 0.55;
const LOGO_Y_RATIO = 0.1;

interface LogoPanel {
  group: THREE.Group;
  flip: () => void;
  update: (delta: number) => void;
}

const buildPanelCanvas = (title: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 2;
  ctx.strokeRect(BORDER_INSET, BORDER_INSET, CANVAS_SIZE - BORDER_INSET_DOUBLE, CANVAS_SIZE - BORDER_INSET_DOUBLE);

  ctx.fillStyle = '#cccccc';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, CANVAS_SIZE / 2, CANVAS_SIZE * TITLE_Y_RATIO);

  return canvas;
};

const loadLogoOntoCanvas = (
  canvas: HTMLCanvasElement,
  logoUrl: string,
  texture: THREE.CanvasTexture,
): void => {
  const ctx = canvas.getContext('2d')!;
  const image = new Image();

  image.onload = () => {
    const logoSize = CANVAS_SIZE * LOGO_SIZE_RATIO;
    ctx.drawImage(image, (CANVAS_SIZE - logoSize) / 2, CANVAS_SIZE * LOGO_Y_RATIO, logoSize, logoSize);
    texture.needsUpdate = true;
  };

  image.src = logoUrl;
};

export const createLogoPanel = (logoUrl: string, title: string): LogoPanel => {
  const canvas = buildPanelCanvas(title);
  const texture = new THREE.CanvasTexture(canvas);
  loadLogoOntoCanvas(canvas, logoUrl, texture);

  const geometry = new THREE.PlaneGeometry(PANEL_SIZE, PANEL_SIZE);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.4,
    metalness: 0.1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = PANEL_SIZE / 2;
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  const group = new THREE.Group();
  group.add(mesh);

  let targetRotationX = 0;

  const flip = (): void => {
    targetRotationX = FLIP_TARGET;
  };

  const update = (delta: number): void => {
    const diff = targetRotationX - group.rotation.x;
    if (Math.abs(diff) > 0.001) {
      group.rotation.x += diff * Math.min(1, FLIP_SPEED * delta);
    } else {
      group.rotation.x = targetRotationX;
    }
  };

  return { group, flip, update };
};
