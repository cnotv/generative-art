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
  collider: RAPIER.Collider
}

type Model = THREE.Group<THREE.Object3DEventMap>
interface ModelOptions {
  position?: CoordinateTuple;
  scale?: CoordinateTuple;
  rotation?: CoordinateTuple;
}
interface ModelConditions {
  randomize?: string[];
}

interface Timeline {
  action: (cube: THREE.Mesh<any, THREE.Material | THREE.Material[], THREE.Object3DEventMap>) => void;
  start?: number;
  end?: number;
  frequency?: number;
  pause?: number;
  delay?: number;
}
