import * as THREE from "three";
import type { ComplexModel } from "@webgamekit/threejs";
import type { TimelineManager } from "@webgamekit/animation";
import { updateAnimation } from "@webgamekit/animation";
import type { Position } from "./pathfinding";
import { gridToWorld } from "./grid";
import type { GridConfig } from "./grid";

const GROUND_Y = -1;
const PATH_LINE_Y_OFFSET = GROUND_Y + 0.1;

type PathAnimationConfig = {
  path: Position[];
  character: ComplexModel;
  gridConfig: GridConfig;
  timelineManager: TimelineManager;
  getDelta: () => number;
  framesPerCell: number;
  startFrame?: number;
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
    startFrame: baseFrame = 0,
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
    const startFrame = baseFrame + index * framesPerCell;

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

const WORMHOLE_DASH_SIZE = 0.3;
const WORMHOLE_GAP_SIZE = 0.2;

type PathSegment = { isWormhole: boolean; pointIndices: number[] };

/**
 * Groups path edges into contiguous segments: normal edges merge into polylines,
 * wormhole edges become their own two-point dashed segment.
 */
const buildPathSegments = (path: Position[]): PathSegment[] =>
  path.slice(1).reduce<PathSegment[]>((accumulator, _pt, edgeIndex) => {
    const toIndex = edgeIndex + 1;
    const isWarp = isWormholeJump(path[edgeIndex], path[toIndex]);

    if (isWarp) {
      return [...accumulator, { isWormhole: true, pointIndices: [edgeIndex, toIndex] }];
    }

    const last = accumulator[accumulator.length - 1];
    if (last && !last.isWormhole) {
      return [...accumulator.slice(0, -1), { isWormhole: false, pointIndices: [...last.pointIndices, toIndex] }];
    }
    return [...accumulator, { isWormhole: false, pointIndices: [edgeIndex, toIndex] }];
  }, []);

/**
 * Draws path lines: solid for normal moves, dashed for wormhole jumps.
 * Returns a THREE.Group containing all segment lines.
 */
export const createPathLine = (
  scene: THREE.Scene,
  path: Position[],
  gridConfig: GridConfig,
  color: number
): THREE.Group => {
  const group = new THREE.Group();

  const worldPoints = path.map(({ x, z }) => {
    const [wx, , wz] = gridToWorld(x, z, gridConfig);
    return new THREE.Vector3(wx, PATH_LINE_Y_OFFSET, wz);
  });

  buildPathSegments(path).forEach(({ isWormhole, pointIndices }) => {
    const pts = pointIndices.map((i) => worldPoints[i]);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);

    if (isWormhole) {
      const mat = new THREE.LineDashedMaterial({ color, dashSize: WORMHOLE_DASH_SIZE, gapSize: WORMHOLE_GAP_SIZE });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      group.add(line);
    } else {
      group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })));
    }
  });

  scene.add(group);
  return group;
};

/**
 * Removes a previously drawn path line group from the scene and disposes its resources.
 */
export const removePathLine = (scene: THREE.Scene, group: THREE.Group): void => {
  scene.remove(group);
  group.children.forEach((child) => {
    if (child instanceof THREE.Line) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
};
