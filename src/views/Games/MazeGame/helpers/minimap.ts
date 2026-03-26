import * as THREE from 'three';
import type { ComplexModel } from '@webgamekit/threejs';
import { ISLAND_SIZE, MAZE_CELL_SIZE } from '../config';
import type { MazeWallSegment } from './maze';

const BG_COLOR = '#1a1a2e';
const WALL_COLOR = '#4a4a6a';
const BORDER_COLOR = 'rgba(255,255,255,0.25)';
const PLAYER_COLOR = '#00ff88';
const COIN_COLOR = '#ffd700';
const PLANE_COLOR = '#ff4444';
const PLAYER_RADIUS = 5;
const ENTITY_RADIUS = 3;
const WALL_THICKNESS = 2;

const toMini = (wx: number, wz: number, size: number): [number, number] => {
  const half = ISLAND_SIZE / 2;
  return [
    ((wx + half) / ISLAND_SIZE) * size,
    ((wz + half) / ISLAND_SIZE) * size,
  ];
};

const buildStaticLayer = (segments: MazeWallSegment[], size: number): HTMLCanvasElement => {
  const offscreen = Object.assign(document.createElement('canvas'), { width: size, height: size });
  const ctx = offscreen.getContext('2d')!;

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, size - 1, size - 1);

  ctx.fillStyle = WALL_COLOR;
  const segLength = (MAZE_CELL_SIZE / ISLAND_SIZE) * size;
  segments.forEach(({ position, horizontal }) => {
    const [mx, mz] = toMini(position[0], position[2], size);
    if (horizontal) {
      ctx.fillRect(mx - segLength / 2, mz - WALL_THICKNESS / 2, segLength, WALL_THICKNESS);
    } else {
      ctx.fillRect(mx - WALL_THICKNESS / 2, mz - segLength / 2, WALL_THICKNESS, segLength);
    }
  });

  return offscreen;
};

export const createMinimap = (
  canvas: HTMLCanvasElement,
  segments: MazeWallSegment[],
): ((playerPos: THREE.Vector3, coins: ComplexModel[], planes: ComplexModel[]) => void) => {
  const size = canvas.width;
  const ctx = canvas.getContext('2d')!;
  const staticLayer = buildStaticLayer(segments, size);

  return (playerPos: THREE.Vector3, coins: ComplexModel[], planes: ComplexModel[]): void => {
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(staticLayer, 0, 0);

    ctx.fillStyle = COIN_COLOR;
    coins.forEach((coin) => {
      const [cx, cz] = toMini(coin.position.x, coin.position.z, size);
      ctx.beginPath();
      ctx.arc(cx, cz, ENTITY_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = PLANE_COLOR;
    planes.forEach((plane) => {
      const [px, pz] = toMini(plane.position.x, plane.position.z, size);
      ctx.beginPath();
      ctx.arc(px, pz, ENTITY_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = PLAYER_COLOR;
    const [ppx, ppz] = toMini(playerPos.x, playerPos.z, size);
    ctx.beginPath();
    ctx.arc(ppx, ppz, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  };
};
