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

interface InstanceConfig {
  show: boolean;
  amount: number;
  size: number;
  sizeDelta: number;
  area: number;
  rotation?: number;
}
