import * as THREE from 'three';
import {
  ISLAND_SIZE,
  OFFICE_WALL_HEIGHT,
  POSTER_CANVAS_SIZE,
  POSTER_WIDTH,
  POSTER_HEIGHT,
  POSTER_WALL_OFFSET,
  POSTER_FRAME_THICKNESS,
  POSTER_FRAME_DEPTH,
  POSTER_LABEL_FONT_SIZE,
  POSTER_NUMBER_FONT_SIZE,
} from '../config';

const POSTER_Y = OFFICE_WALL_HEIGHT / 2;

const drawPoster = (ctx: CanvasRenderingContext2D, score: number): void => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, POSTER_CANVAS_SIZE, POSTER_CANVAS_SIZE);

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `bold ${POSTER_LABEL_FONT_SIZE}px Impact, 'Arial Black', sans-serif`;
  ctx.fillText('COINS', POSTER_CANVAS_SIZE / 2, POSTER_CANVAS_SIZE / 4);

  ctx.textBaseline = 'middle';
  ctx.font = `bold ${POSTER_NUMBER_FONT_SIZE}px Impact, 'Arial Black', sans-serif`;
  ctx.fillText(String(score), POSTER_CANVAS_SIZE / 2, (POSTER_CANVAS_SIZE * 2) / 3);
};

const addPosterGroup = (
  scene: THREE.Scene,
  texture: THREE.CanvasTexture,
  position: THREE.Vector3,
  rotationY: number
): void => {
  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = rotationY;

  group.add(new THREE.Mesh(
    new THREE.PlaneGeometry(POSTER_WIDTH, POSTER_HEIGHT),
    new THREE.MeshBasicMaterial({ map: texture })
  ));

  const frameMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const frameTotal = POSTER_WIDTH + POSTER_FRAME_THICKNESS * 2;
  [
    { w: frameTotal, h: POSTER_FRAME_THICKNESS, x: 0, y: POSTER_HEIGHT / 2 + POSTER_FRAME_THICKNESS / 2 },
    { w: frameTotal, h: POSTER_FRAME_THICKNESS, x: 0, y: -(POSTER_HEIGHT / 2 + POSTER_FRAME_THICKNESS / 2) },
    { w: POSTER_FRAME_THICKNESS, h: POSTER_HEIGHT, x: -(POSTER_WIDTH / 2 + POSTER_FRAME_THICKNESS / 2), y: 0 },
    { w: POSTER_FRAME_THICKNESS, h: POSTER_HEIGHT, x: POSTER_WIDTH / 2 + POSTER_FRAME_THICKNESS / 2, y: 0 },
  ].forEach(({ w, h, x, y }) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, POSTER_FRAME_DEPTH), frameMaterial);
    bar.position.set(x, y, -POSTER_FRAME_DEPTH / 2);
    group.add(bar);
  });

  scene.add(group);
};

export const createScorePoster = (scene: THREE.Scene, initialScore: number) => {
  const canvas = Object.assign(document.createElement('canvas'), {
    width: POSTER_CANVAS_SIZE,
    height: POSTER_CANVAS_SIZE,
  });
  const ctx = canvas.getContext('2d')!;

  drawPoster(ctx, initialScore);
  const texture = new THREE.CanvasTexture(canvas);

  const half = ISLAND_SIZE / 2;
  addPosterGroup(scene, texture, new THREE.Vector3(0, POSTER_Y, -half + POSTER_WALL_OFFSET), 0);
  addPosterGroup(scene, texture, new THREE.Vector3(-half + POSTER_WALL_OFFSET, POSTER_Y, 0), Math.PI / 2);
  addPosterGroup(scene, texture, new THREE.Vector3(half - POSTER_WALL_OFFSET, POSTER_Y, 0), -Math.PI / 2);

  return (score: number): void => {
    drawPoster(ctx, score);
    texture.needsUpdate = true;
  };
};
