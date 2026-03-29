import * as THREE from "three";
import type { CoordinateTuple } from "@webgamekit/animation";
import type { SetupConfig, ModelOptions } from "@webgamekit/threejs";

// Island
export const ISLAND_SIZE = 80;
export const ISLAND_COLOR = 0xffffff;
export const MAZE_CELL_SIZE = 16;


// Walls
export const WALL_CELL_SIZE = 4;
export const WALL_SCALE: CoordinateTuple = [0.02, 0.02, 0.02];
export const OFFICE_WALL_HEIGHT = 10;

// Desk models
export const DESK_MODEL = "minimal_office.glb";
export const SHELF_MODEL = "office-shelf.glb";
const SHELF_SCALE = 2.5;
export const SHELF_MODEL_SCALE: CoordinateTuple = [SHELF_SCALE, SHELF_SCALE, SHELF_SCALE];
const SHELF_WALL_OFFSET = 0.75;
export const SHELF_WALL_GAP = SHELF_WALL_OFFSET;
const DESK_SCALE = 2.5;
export const DESK_MODEL_SCALE: CoordinateTuple = [DESK_SCALE, DESK_SCALE, DESK_SCALE];
const DESK_PHYSICS_WIDTH = 6;
const DESK_PHYSICS_HEIGHT = 5;
export const DESK_PHYSICS_SIZE: CoordinateTuple = [DESK_PHYSICS_WIDTH, DESK_PHYSICS_HEIGHT, DESK_PHYSICS_WIDTH];
const DESK_CORNER = 25;
const DESK_SIDE = 28;
const DESK_FRONT = 22;
const DESK_Y = 0.2;
export const DESK_POSITIONS: CoordinateTuple[] = [
  [-DESK_CORNER, DESK_Y, -DESK_CORNER],
  [0, DESK_Y, -DESK_SIDE],
  [DESK_CORNER, DESK_Y, -DESK_CORNER],
  [-DESK_SIDE, DESK_Y, 0],
  [DESK_SIDE, DESK_Y, 0],
  [-DESK_FRONT, DESK_Y, DESK_FRONT],
  [DESK_FRONT, DESK_Y, DESK_FRONT],
];

// Collision helpers
export const HELPER_COLOR_PLAYER = 0x00ff88;
export const HELPER_COLOR_PLANE = 0xff4444;
export const HELPER_COLOR_DESK = 0xff8800;
export const HELPER_COLOR_ELEVATOR = 0x0088ff;

// Player
export const PLAYER_SPEED = 10;
export const PLAYER_DISTANCE = 0.5;
export const PLAYER_MODEL = "stickboy.glb";
const PLAYER_Y = -1.15;
const MAZE_HALF = ISLAND_SIZE / 2;
export const MAZE_ENTRANCE_OFFSET = MAZE_HALF - MAZE_CELL_SIZE / 2;
export const PLAYER_START: CoordinateTuple = [-MAZE_ENTRANCE_OFFSET, PLAYER_Y, -MAZE_ENTRANCE_OFFSET];
export const MAZE_EXIT_POSITION: CoordinateTuple = [MAZE_ENTRANCE_OFFSET, PLAYER_Y, MAZE_ENTRANCE_OFFSET];
export const PLAYER_MODEL_SCALE = 2.5;

export const playerModelOptions: ModelOptions = {
  position: PLAYER_START,
  scale: [PLAYER_MODEL_SCALE, PLAYER_MODEL_SCALE, PLAYER_MODEL_SCALE] as CoordinateTuple,
  type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  boundary: 0.5,
  showHelper: true,
  helperColor: HELPER_COLOR_PLAYER,
};

export const playerMovement = {
  requireGround: false,
  maxGroundDistance: 5,
  maxStepHeight: 0.5,
  characterRadius: 2,
  collisionDistance: 2,
};

// Elevator
export const ELEVATOR_MODEL = 'office_elevator_door.glb';
const ELEVATOR_SCALE = 4;
export const ELEVATOR_MODEL_SCALE: CoordinateTuple = [ELEVATOR_SCALE, ELEVATOR_SCALE, ELEVATOR_SCALE];
export const ELEVATOR_Y = 0;
export const ELEVATOR_OPEN_ANIM = 'Open';
export const ELEVATOR_CLOSE_ANIM = 'Close';
export const ELEVATOR_CLOSE_DELAY = 1;
export const ELEVATOR_TRIGGER_RADIUS = 8;
export const ELEVATOR_OPEN_FALLBACK_DELAY = 2;
export const ELEVATOR_START_COLOR = 0x88ff88;
export const ELEVATOR_EXIT_COLOR = 0xff8888;
const ELEVATOR_PHYSICS_WIDTH = 6;
const ELEVATOR_PHYSICS_HEIGHT = 10;
const ELEVATOR_PHYSICS_DEPTH = 1;
export const ELEVATOR_PHYSICS_SIZE: CoordinateTuple = [ELEVATOR_PHYSICS_WIDTH, ELEVATOR_PHYSICS_HEIGHT, ELEVATOR_PHYSICS_DEPTH];

// Enemies
export const PAPER_PLANE_COUNT = 3;
export const PAPER_PLANE_SPEED = 10;
export const PAPER_PLANE_MODEL = "paper_airplane.glb";
export const CATCH_RADIUS = 2;
export const PAPER_PLANE_COLLISION_DISTANCE = 2;

export const paperPlaneModelOptions: ModelOptions = {
  scale: [0.66, 0.66, 0.66] as CoordinateTuple,
  type: "kinematicPositionBased",
  hasGravity: false,
  castShadow: true,
  boundary: 1,
  showHelper: true,
  helperColor: HELPER_COLOR_PLANE,
};

// Maze
export const MAZE_WALL_HEIGHT = 3;
export const MAZE_WALL_THICKNESS = 0.25;
export const MAZE_WALL_COLOR = 0xffffff;
export const PAPER_PLANE_REPLAN_INTERVAL = 1.0;
export const PAPER_PLANE_WAYPOINT_REACH_DISTANCE = 5;
export const PAPER_PLANE_TURN_SPEED = 8; // radians per second — limits rotation snap

// Coins
export const COLLECTION_RADIUS = 3;
export const LEVEL_COMPLETE_RADIUS = 3;
export const COIN_SPIN_SPEED = 2;
export const COIN_POSITIONS: CoordinateTuple[] = [
  [8, 3, 8],
  [-8, 3, -8],
  [12, 3, -4],
  [-12, 3, 4],
  [0, 3, 14],
  [0, 3, -14],
  [10, 3, 10],
  [-10, 3, -10],
];

// Score poster
export const POSTER_CANVAS_SIZE = 512;
const POSTER_SIZE_FACTOR = 0.7;
const POSTER_BASE_SIZE = 6;
export const POSTER_WIDTH = POSTER_BASE_SIZE * POSTER_SIZE_FACTOR;
export const POSTER_HEIGHT = POSTER_BASE_SIZE * POSTER_SIZE_FACTOR;
const POSTER_Y_FACTOR = 0.65;
export const POSTER_Y = OFFICE_WALL_HEIGHT * POSTER_Y_FACTOR;
export const POSTER_WALL_OFFSET = 0.2;
export const POSTER_FRAME_THICKNESS = 0.3;
export const POSTER_FRAME_DEPTH = 0.1;
export const MARKER_PILLAR_WIDTH = 0.8;
export const MARKER_PILLAR_HEIGHT = 10;
export const MARKER_SPREAD = (MAZE_CELL_SIZE - 4) / 2;
export const MARKER_START_COLOR = 0x00ff88;
export const MARKER_END_COLOR = 0xffd700;
const POSTER_LABEL_FONT_DIVISOR = 6;
const POSTER_NUMBER_FONT_DIVISOR = 1.5;
export const POSTER_LABEL_FONT_SIZE = Math.round(POSTER_CANVAS_SIZE / POSTER_LABEL_FONT_DIVISOR);
export const POSTER_NUMBER_FONT_SIZE = Math.round(POSTER_CANVAS_SIZE / POSTER_NUMBER_FONT_DIVISOR);

// Path visualization
export const PATH_DOT_RADIUS = 0.4;
export const PATH_DOT_SEGMENTS = 6;
export const PATH_DOT_HEIGHT = 1.5;
export const PATH_Y_STEP = 0.6;
export const PATH_COLOR_PLAYER = 0x00ff88;
const PATH_COLOR_PLANE_1 = 0xff4444;
const PATH_COLOR_PLANE_2 = 0xff8800;
const PATH_COLOR_PLANE_3 = 0xff44ff;
export const PATH_COLORS_PLANES = [PATH_COLOR_PLANE_1, PATH_COLOR_PLANE_2, PATH_COLOR_PLANE_3];

// Camera
const CAMERA_Y = 25;
const CAMERA_Z = 30;
export const CAMERA_OFFSET: CoordinateTuple = [0, CAMERA_Y, CAMERA_Z];

// Scene setup
export const setupConfig: SetupConfig = {
  orbit: {
    target: new THREE.Vector3(0, 0, 0),
  },
  camera: {
    position: CAMERA_OFFSET,
    lookAt: [0, 0, 0],
    fov: 45,
    near: 0.1,
    far: 500,
  },
  ground: false,
  sky: { color: 0x87ceeb },
  lights: {
    ambient: { intensity: 1 },
    directional: {
      intensity: 1,
      position: [20, 30, 20],
      castShadow: true,
    },
  },
};

// Controls
export const controlBindings = {
  mapping: {
    keyboard: {
      a: "move-left",
      d: "move-right",
      w: "move-down",
      s: "move-up",
    },
    gamepad: {
      "dpad-left": "move-left",
      "dpad-right": "move-right",
      "dpad-down": "move-up",
      "dpad-up": "move-down",
      "axis0-left": "move-left",
      "axis0-right": "move-right",
      "axis1-up": "move-down",
      "axis1-down": "move-up",
      "cross": "toggle-auto",
    },
    'faux-pad': {
      left: "move-left",
      right: "move-right",
      up: "move-down",
      down: "move-up",
    },
  },
  axisThreshold: 0.5,
};

// Config panel schema
export const configControls = {
  player: {
    speed: { min: 5, max: 60, step: 1, label: "Player Speed" },
  },
  paperPlane: {
    speed: { min: 1, max: 20, step: 0.5, label: "Paper Plane Speed" },
  },
  autoMode: {
    enabled: { boolean: true, label: "Auto Mode" },
  },
  debug: {
    showPath: { boolean: true, label: "Show Path" },
    showColliders: { boolean: true, label: "Show Colliders" },
    showDesks: { boolean: true, label: "Show Desks" },
  },
};

/**
 * Generate perimeter wall positions for the island.
 * Returns positions along the edges of a square island, avoiding corners.
 */
export const generateWallPositions = (
  islandSize: number,
  cellSize: number
): CoordinateTuple[] => {
  const half = islandSize / 2;
  const count = Math.floor(islandSize / cellSize);

  return Array.from({ length: count }, (_, i) => {
    const offset = -half + i * cellSize + cellSize / 2;
    return [
      [offset, 0.5, -half] as CoordinateTuple,
      [offset, 0.5, half] as CoordinateTuple,
      [-half, 0.5, offset] as CoordinateTuple,
      [half, 0.5, offset] as CoordinateTuple,
    ];
  }).flat();
};
