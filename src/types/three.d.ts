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

type Model = THREE.Group<THREE.Object3DEventMap>

interface CommonOptions {
  boundary?: number
  damping?: number;
  angular?: number;
  density?: number
  dominance?: number
  friction?: number
  mass?: number
  position?: CoordinateTuple,
  restitution?: number
  restitution?: number
  rotation?: Rotation
  size?: number | CoordinateTuple,
  type?: 'fixed' | 'dynamic' | 'kinematicVelocityBased' | 'kinematicPositionBased'
  weight?: number
}

interface ModelOptions extends CommonOptions{
  color?: number;
  opacity?: number;
  reflectivity?: number;
  roughness?: number;
  metalness?: number;
  transmission?: number;
  rotation?: CoordinateTuple;
  scale?: CoordinateTuple;
  shape?: 'cuboid' | 'ball'
  castShadow?: boolean;
  receiveShadow?: boolean;
  texture?: string;
  textures?: {
    random: boolean;
    list: THREE.Texture[];
  };
}

interface ModelConditions {
  randomize?: string[];
}

interface Timeline {
  action: (element?: any) => void;
  actionStart?: (loop: number, element?: any) => void;
  start?: number;
  end?: number;
  frequency?: number;
  interval?: [number, number]; // Interval as a range [start, end]
  delay?: number;
}

interface PhysicOptions extends CommonOptions {
  shape?: 'cuboid' | 'ball'
}

interface AnimatedComplexModel extends ComplexModel {
  actions: {
    run?: THREE.AnimationAction;
  },
  mixer: THREE.AnimationMixer
}

interface ComplexModel {
  mesh: Model,
  rigidBody: RAPIER.RigidBody,
  collider: RAPIER.Collider,
  initialValues: {
    size: number | CoordinateTuple;
    rotation: CoordinateTuple;
    position: CoordinateTuple;
    color: number | undefined;
  },
}
