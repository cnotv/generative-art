import * as THREE from 'three';
import {
  ISLAND_SIZE,
  POSTER_CANVAS_SIZE,
  POSTER_WIDTH,
  POSTER_HEIGHT,
  POSTER_Y,
  POSTER_WALL_OFFSET,
  POSTER_FRAME_THICKNESS,
  POSTER_FRAME_DEPTH,
  POSTER_LABEL_FONT_SIZE,
  POSTER_NUMBER_FONT_SIZE,
} from '../config';


const drawPoster = (ctx: CanvasRenderingContext2D, score: number, level: number): void => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, POSTER_CANVAS_SIZE, POSTER_CANVAS_SIZE);

  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.font = `bold ${POSTER_LABEL_FONT_SIZE}px Impact, 'Arial Black', sans-serif`;

  ctx.textBaseline = 'alphabetic';
  ctx.fillText('COINS', POSTER_CANVAS_SIZE / 2, Math.round(POSTER_CANVAS_SIZE * 0.17));

  ctx.font = `bold ${POSTER_NUMBER_FONT_SIZE}px Impact, 'Arial Black', sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(String(score), POSTER_CANVAS_SIZE / 2, Math.round(POSTER_CANVAS_SIZE * 0.18));

  ctx.font = `bold ${POSTER_LABEL_FONT_SIZE}px Impact, 'Arial Black', sans-serif`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`LEVEL ${level}`, POSTER_CANVAS_SIZE / 2, POSTER_CANVAS_SIZE - 8);
};

const addPosterGroup = (
  parent: THREE.Object3D,
  texture: THREE.CanvasTexture,
  position: THREE.Vector3,
  rotationY: number
): void => {
  const group = new THREE.Group();
  group.name = 'ScorePoster';
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

  parent.add(group);
};

export const createScorePoster = (scene: THREE.Scene) => {
  const canvas = Object.assign(document.createElement('canvas'), {
    width: POSTER_CANVAS_SIZE,
    height: POSTER_CANVAS_SIZE,
  });
  const ctx = canvas.getContext('2d')!;

  drawPoster(ctx, 0, 1);
  const texture = new THREE.CanvasTexture(canvas);

  const half = ISLAND_SIZE / 2;
  const postersGroup = new THREE.Group();
  postersGroup.name = 'ScorePosters';
  scene.add(postersGroup);

  addPosterGroup(postersGroup, texture, new THREE.Vector3(0, POSTER_Y, -half + POSTER_WALL_OFFSET), 0);
  addPosterGroup(postersGroup, texture, new THREE.Vector3(-half + POSTER_WALL_OFFSET, POSTER_Y, 0), Math.PI / 2);
  addPosterGroup(postersGroup, texture, new THREE.Vector3(half - POSTER_WALL_OFFSET, POSTER_Y, 0), -Math.PI / 2);

  return (score: number, level: number): void => {
    drawPoster(ctx, score, level);
    texture.needsUpdate = true;
  };
};
