import * as THREE from "three";
import type { ComplexModel } from "@webgamekit/threejs";
import type { TimelineManager } from "@webgamekit/animation";
import { updateAnimation } from "@webgamekit/animation";
import type { Position } from "./pathfinding";
import { gridToWorld } from "./grid";
import type { GridConfig } from "./grid";

const PATH_LINE_Y_OFFSET = 0.15;

type PathAnimationConfig = {
  path: Position[];
  character: ComplexModel;
  gridConfig: GridConfig;
  timelineManager: TimelineManager;
  getDelta: () => number;
  framesPerCell: number;
  onComplete?: () => void;
};

const WORMHOLE_JUMP_THRESHOLD = 1;

const calculateRotationAngle = (from: Position, to: Position): number =>
  Math.atan2(to.x - from.x, to.z - from.z);

const isWormholeJump = (from: Position, to: Position): boolean =>
  Math.abs(to.x - from.x) + Math.abs(to.z - from.z) > WORMHOLE_JUMP_THRESHOLD;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const syncPhysicsBody = (character: ComplexModel): void => {
  const body = character.userData?.body;
  if (body) {
    body.setTranslation(
      { x: character.position.x, y: character.position.y, z: character.position.z },
      true
    );
  }
};

/**
 * Animates a character along a computed path using the timeline system.
 * Each grid cell traversal is a separate timeline action, sequenced by start frame.
 */
export const animateAlongPath = (config: PathAnimationConfig): void => {
  const {
    path,
    character,
    gridConfig,
    timelineManager,
    getDelta,
    framesPerCell,
    onComplete,
  } = config;

  if (path.length <= 1) {
    onComplete?.();
    return;
  }

  const WORMHOLE_DURATION = 1;

  path.slice(1).forEach((targetCell, index) => {
    const fromCell = path[index];
    const toCell = targetCell;
    const isLast = index === path.length - 2;
    const isWormhole = isWormholeJump(fromCell, toCell);
    const duration = isWormhole ? WORMHOLE_DURATION : framesPerCell;
    const startFrame = index * framesPerCell;

    const fromWorld = gridToWorld(fromCell.x, fromCell.z, gridConfig);
    const toWorld = gridToWorld(toCell.x, toCell.z, gridConfig);
    const angle = isWormhole ? null : calculateRotationAngle(fromCell, toCell);

    timelineManager.addAction({
      name: `path-move-${index}`,
      category: "pathfinding",
      start: startFrame,
      duration,
      autoRemove: true,
      actionStart: () => {
        if (angle !== null) character.rotation.y = angle;
      },
      action: (frame?: number) => {
        const elapsed = (frame ?? startFrame) - startFrame;
        const progress = Math.min(elapsed / duration, 1);

        character.position.x = lerp(fromWorld[0], toWorld[0], progress);
        character.position.z = lerp(fromWorld[2], toWorld[2], progress);
        syncPhysicsBody(character);

        if (!isWormhole) {
          updateAnimation({
            actionName: "Esqueleto|walking",
            player: character,
            delta: getDelta(),
            speed: 20,
            distance: 0.5,
          });
        }
      },
      onComplete: () => {
        if (isLast) {
          updateAnimation({
            actionName: "Esqueleto|idle",
            player: character,
            delta: getDelta(),
          });
          onComplete?.();
        }
      },
    });
  });
};

/**
 * Draws a THREE.Line visualizing the computed path at a slight Y offset above ground.
 */
export const createPathLine = (
  scene: THREE.Scene,
  path: Position[],
  gridConfig: GridConfig,
  color: number
): THREE.Line => {
  const points = path.map(({ x, z }) => {
    const [wx, , wz] = gridToWorld(x, z, gridConfig);
    return new THREE.Vector3(wx, PATH_LINE_Y_OFFSET, wz);
  });

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  return line;
};

/**
 * Removes a previously drawn path line from the scene and disposes its resources.
 */
export const removePathLine = (scene: THREE.Scene, line: THREE.Line): void => {
  scene.remove(line);
  line.geometry.dispose();
  (line.material as THREE.LineBasicMaterial).dispose();
};
