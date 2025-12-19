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
type ModelType = 'fixed' | 'dynamic' | 'kinematicVelocityBased' | 'kinematicPositionBased'

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
  type?: ModelType
  weight?: number
  enabledRotations?: [boolean, boolean, boolean]
}

interface ModelOptions extends CommonOptions{
  color?: number;
  opacity?: number;
  reflectivity?: number;
  roughness?: number;
  metalness?: number;
  transmission?: number;
  material?: typeof THREE.Material | string;
  rotation?: CoordinateTuple;
  scale?: CoordinateTuple;
  shape?: 'cuboid' | 'ball'
  castShadow?: boolean;
  receiveShadow?: boolean;
  hasGravity?: boolean;
  showHelper?: boolean;
  texture?: string;
  textures?: {
    random: boolean;
    list: THREE.Texture[];
  };
  clearcoat?: number;
  clearcoatRoughness?: number;
  ior?: number;
  thickness?: number;
  envMapIntensity?: number;
}

interface ModelConditions {
  randomize?: string[];
}

interface Timeline {
  name?: string;
  action?: (element?: any) => void;
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

export interface ComplexModel extends Model {
  userData: Record<string, any> & {
    body: RAPIER.RigidBody;
    collider: RAPIER.Collider;
    initialValues: {
      size: number | CoordinateTuple;
      rotation: CoordinateTuple;
      position: CoordinateTuple;
      color: number | undefined;
    };
    type: ModelType;
    characterController?: RAPIER.KinematicCharacterController;
    helper?: THREE.SkeletonHelper;
    hasGravity?: boolean;
    actions: Record<string, THREE.AnimationAction | undefined>;
    mixer: THREE.AnimationMixer;
  };
}

type Direction = "forward" | "right" | "left" | "backward" | "jump";

interface RotationMap {
  forward: number;
  right: number;
  backward: number;
  left: number;
}

interface SetupConfig {
  global?: { frameRate?: number },
  camera?: {
    position?: CoordinateTuple | THREE.Vector3,
    fov?: number,
    rotation?: CoordinateTuple | THREE.Vector3,
    lookAt?: CoordinateTuple | THREE.Vector3
  },
  ground?: {
    size?: number,
    color?: number,
    texture?: string
  } | false
  sky?: {
    texture?: string,
    size?: number
  } | false
  lights?: {
    directional?: {
      intensity?: number
    }
  } | false
  orbit?: {
    target?: THREE.Vector
  } | false
}
