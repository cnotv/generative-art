interface ThreeRotation {
  _x: number
  _y: number
  _z: number
}

interface ThreePosition {
  x: number
  y: number
  z: number
}
type CoordinateTuple = [number, number, number]

interface BidimensionalCoords {
  x: number
  y: number
}

type Model = THREE.Group<THREE.Object3DEventMap>
type BlockTypes = 'ground' | 'characters' | 'blocks'
type PhysicObject = {
  model: THREE.Object3D
  rigidBody: RAPIER.RigidBody
  helper?: THREE.Object3D
  collider: RAPIER.Collider
}

type Model = THREE.Group<THREE.Object3DEventMap>

interface CommonOptions {
  boundary?: number
  damping?: number;
  density?: number
  dominance?: number
  friction?: number
  mass?: number
  position?: CoordinateTuple,
  restitution?: number
  restitution?: number
  rotation?: Rotation
  size?: number | CoordinateTuple,
  type?: 'fixed' | 'dynamic'
  weight?: number
}

interface ModelOptions extends CommonOptions{
  color?: number;
  rotation?: CoordinateTuple;
  scale?: CoordinateTuple;
  shape?: 'cuboid' | 'ball'
  textures?: {
    random: boolean;
    list: THREE.Texture[];
  };
}

interface ModelConditions {
  randomize?: string[];
}

interface Timeline {
  action: (element: any) => void;
  start?: number;
  end?: number;
  frequency?: number;
  interval?: [number, number]; // Interval as a range [start, end]
  delay?: number;
}

interface PhysicOptions extends CommonOptions {
  shape?: 'cuboid' | 'ball'
}
