import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark,
  type PoseLandmarkerResult
} from '@mediapipe/tasks-vision'
import type { HandSide, QuaternionData } from '@webgamekit/rig'
import {
  CAMERA_CROP_CANVAS_SIZE,
  CAMERA_FACE_CROP_SPAN_MULTIPLIER,
  CAMERA_HAND_CROP_SPAN_MULTIPLIER,
  MEDIAPIPE_FACE_MODEL_URL,
  MEDIAPIPE_HAND_MODEL_URL,
  MEDIAPIPE_POSE_MODEL_URL,
  MEDIAPIPE_WASM_BASE_PATH
} from './config'
import { CAMERA_LANDMARK_INDEX, CAMERA_LANDMARK_VISIBILITY_THRESHOLD } from './cameraPoseMapping'
import { resolveCameraHandSide } from './cameraHandPoseMapping'
import {
  assignHandSides,
  cropLandmarksToFrame,
  cropSquareAroundLandmark,
  faceMatrixToHeadRotation,
  hideLandmarksOutsideFrame,
  isInsideFrame
} from './cameraPoseFrame'
import type {
  CameraCropSquare,
  CameraDetection,
  CameraDetectionContext,
  CameraHandLandmark,
  CameraLandmarkers
} from './types'

type DetectionContext = CameraDetectionContext

const NO_WRISTS: Record<HandSide, NormalizedLandmark | null> = { Left: null, Right: null }

interface DetectedHand {
  side: HandSide
  worldLandmarks: CameraHandLandmark[]
  imageLandmarks: NormalizedLandmark[]
}

const RIG_SIDES: HandSide[] = ['Left', 'Right']

/** The pose landmarks that outline each hand, wrist first, so a crop centres on the whole hand. */
const HAND_OUTLINE_LANDMARKS: Record<HandSide, number[]> = {
  Left: [
    CAMERA_LANDMARK_INDEX.leftWrist,
    CAMERA_LANDMARK_INDEX.leftPinky,
    CAMERA_LANDMARK_INDEX.leftIndex
  ],
  Right: [
    CAMERA_LANDMARK_INDEX.rightWrist,
    CAMERA_LANDMARK_INDEX.rightPinky,
    CAMERA_LANDMARK_INDEX.rightIndex
  ]
}

/**
 * Load the pose, hand and face detectors for one capture source. Only the pose detector follows
 * the source's running mode: the hand and face detectors always read single images, since they
 * run on a different crop of the frame every time.
 * @param poseRunningMode VIDEO for a playing video or webcam, IMAGE for a still photo
 * @returns The three detectors
 */
export const createCameraLandmarkers = async (
  poseRunningMode: 'IMAGE' | 'VIDEO'
): Promise<CameraLandmarkers> => {
  const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE_PATH)
  const pose = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MEDIAPIPE_POSE_MODEL_URL, delegate: 'CPU' },
    runningMode: poseRunningMode,
    numPoses: 1
  })
  const hand = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MEDIAPIPE_HAND_MODEL_URL, delegate: 'CPU' },
    runningMode: 'IMAGE',
    numHands: 2
  })
  const face = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MEDIAPIPE_FACE_MODEL_URL, delegate: 'CPU' },
    runningMode: 'IMAGE',
    numFaces: 1,
    outputFacialTransformationMatrixes: true
  })
  return { pose, hand, face }
}

/**
 * Release every detector. Safe to call with nothing loaded.
 * @param landmarkers The detectors to release, or null
 */
export const closeCameraLandmarkers = (landmarkers: CameraLandmarkers | null): void => {
  const detectors = [landmarkers?.pose, landmarkers?.hand, landmarkers?.face]
  detectors.forEach((detector) => {
    // A throw closing one must never skip closing the others.
    try {
      detector?.close()
    } catch {
      // Nothing to recover: the detector is being thrown away either way.
    }
  })
}

/**
 * The canvas face and hand crops are drawn into before their detectors read them.
 * @returns A square canvas at the crop resolution
 */
export const createCameraCropCanvas = (): HTMLCanvasElement =>
  Object.assign(document.createElement('canvas'), {
    width: CAMERA_CROP_CANVAS_SIZE,
    height: CAMERA_CROP_CANVAS_SIZE
  })

const drawCrop = (context: DetectionContext, crop: CameraCropSquare): void => {
  const { cropCanvas, source } = context
  const canvasContext = cropCanvas.getContext('2d')
  if (!canvasContext) return
  // A crop reaching past the frame edge leaves that part undrawn; the last crop must not show there.
  canvasContext.clearRect(0, 0, cropCanvas.width, cropCanvas.height)
  canvasContext.drawImage(
    source,
    crop.left,
    crop.top,
    crop.size,
    crop.size,
    0,
    0,
    cropCanvas.width,
    cropCanvas.height
  )
}

const cropAroundBody = (
  context: DetectionContext,
  bodyImage: NormalizedLandmark[],
  center: { x: number; y: number },
  spanMultiplier: number
): CameraCropSquare =>
  cropSquareAroundLandmark({
    center,
    shoulders: [
      bodyImage[CAMERA_LANDMARK_INDEX.leftShoulder],
      bodyImage[CAMERA_LANDMARK_INDEX.rightShoulder]
    ],
    frameWidth: context.frameSize.width,
    frameHeight: context.frameSize.height,
    spanMultiplier
  })

const isVisibleInFrame = (landmark: NormalizedLandmark | undefined): boolean =>
  landmark !== undefined &&
  landmark.visibility >= CAMERA_LANDMARK_VISIBILITY_THRESHOLD &&
  isInsideFrame(landmark)

/** The body's wrists, where they are actually in view. */
const visibleWrists = (
  bodyImage: NormalizedLandmark[] | null
): Record<HandSide, NormalizedLandmark | null> => {
  const wrist = (side: HandSide): NormalizedLandmark | null => {
    const landmark = bodyImage?.[HAND_OUTLINE_LANDMARKS[side][0]]
    return landmark && isVisibleInFrame(landmark) ? landmark : null
  }
  return { Left: wrist('Left'), Right: wrist('Right') }
}

const handClosestToCropCentre = (result: HandLandmarkerResult): number | null => {
  const distances = result.landmarks.map(([wrist]) => Math.hypot(wrist.x - 0.5, wrist.y - 0.5))
  return distances.length > 0 ? distances.indexOf(Math.min(...distances)) : null
}

const averageImagePoint = (points: NormalizedLandmark[]): { x: number; y: number } => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  y: points.reduce((sum, point) => sum + point.y, 0) / points.length
})

/** Every hand the whole frame shows, each sided by the body's nearer wrist or else by its label. */
const detectHandsInWholeFrame = (
  context: DetectionContext,
  bodyImage: NormalizedLandmark[] | null
): DetectedHand[] => {
  const result = context.landmarkers.hand.detect(context.source)
  const sides = assignHandSides(
    result.landmarks.map(([wrist]) => wrist),
    result.handedness.map((categories) => resolveCameraHandSide(categories[0]?.categoryName ?? '')),
    context.options.sideHandsByNearestWrist ? visibleWrists(bodyImage) : NO_WRISTS
  )
  return result.worldLandmarks.flatMap((worldLandmarks, index) => {
    const side = sides[index]
    return side ? [{ side, worldLandmarks, imageLandmarks: result.landmarks[index] }] : []
  })
}

/** Look for a hand the whole frame missed in a crop around that side's own visible wrist. */
const detectHandAroundWrist = (
  context: DetectionContext,
  bodyImage: NormalizedLandmark[],
  side: HandSide
): DetectedHand[] => {
  const outline = HAND_OUTLINE_LANDMARKS[side].map((index) => bodyImage[index])
  if (!isVisibleInFrame(outline[0])) return []
  const crop = cropAroundBody(
    context,
    bodyImage,
    averageImagePoint(outline),
    CAMERA_HAND_CROP_SPAN_MULTIPLIER
  )
  drawCrop(context, crop)
  const result = context.landmarkers.hand.detect(context.cropCanvas)
  const closest = handClosestToCropCentre(result)
  if (closest === null) return []
  const { width, height } = context.frameSize
  return [
    {
      side,
      worldLandmarks: result.worldLandmarks[closest],
      imageLandmarks: cropLandmarksToFrame(result.landmarks[closest], crop, width, height)
    }
  ]
}

/**
 * Hands found on the whole frame come first: a hand clearly in view is what the performer is
 * showing, whatever the body detector guesses around it. Only a side the whole frame missed is
 * looked for again in a crop around its wrist, the case of a hand too small in a wide shot.
 */
const detectHands = (
  context: DetectionContext,
  bodyImage: NormalizedLandmark[] | null
): DetectedHand[] => {
  if (!context.options.trackHands) return []
  const wholeFrameHands = detectHandsInWholeFrame(context, bodyImage)
  if (!bodyImage || !context.options.searchHandsAroundWrists) return wholeFrameHands
  const missingSides = RIG_SIDES.filter(
    (side) => !wholeFrameHands.some((hand) => hand.side === side)
  )
  return [
    ...wholeFrameHands,
    ...missingSides.flatMap((side) => detectHandAroundWrist(context, bodyImage, side))
  ]
}

const readHeadRotation = (
  landmarkers: CameraLandmarkers,
  image: DetectionContext['source'] | HTMLCanvasElement
): QuaternionData | null => {
  const matrix = landmarkers.face.detect(image).facialTransformationMatrixes?.[0]
  return matrix ? faceMatrixToHeadRotation(matrix.data) : null
}

/**
 * Read the face on the whole frame first, which is all a webcam close-up needs, and only when
 * that finds nothing look again in a crop around the body's nose, the case of a face small in a
 * wide shot.
 */
const detectHead = (
  context: DetectionContext,
  bodyImage: NormalizedLandmark[] | null
): QuaternionData | null => {
  if (!context.options.trackFace) return null
  const wholeFrameRotation = readHeadRotation(context.landmarkers, context.source)
  if (wholeFrameRotation || !bodyImage || !context.options.searchFaceAroundBody) {
    return wholeFrameRotation
  }
  const nose = bodyImage[CAMERA_LANDMARK_INDEX.nose]
  if (!isVisibleInFrame(nose)) return null
  drawCrop(context, cropAroundBody(context, bodyImage, nose, CAMERA_FACE_CROP_SPAN_MULTIPLIER))
  return readHeadRotation(context.landmarkers, context.cropCanvas)
}

/**
 * Run the hand and face detectors against one frame whose pose was already detected. Both are
 * trained on close-ups, so with a body in view they also read crops around its wrists and nose,
 * the way MediaPipe's own holistic pipeline does, to find a hand or face small in a wide shot.
 * Every step can be switched off from the Config panel through `context.options`.
 * @param context The source, its size, the detectors, the crop canvas and the detection switches
 * @param poseResult The pose detector's result for this same frame
 * @returns The overlay landmarks and the frame to apply to the rig
 */
export const detectCameraPose = (
  context: CameraDetectionContext,
  poseResult: PoseLandmarkerResult
): CameraDetection => {
  const bodyImage = poseResult.landmarks[0] ?? null
  const bodyWorld = poseResult.worldLandmarks[0] ?? null
  const hands = detectHands(context, bodyImage)
  const bodyLandmarks =
    bodyWorld && bodyImage && context.options.ignoreLandmarksOutsideImage
      ? hideLandmarksOutsideFrame(bodyWorld, bodyImage)
      : bodyWorld
  return {
    previewLandmarks: bodyImage,
    previewHandLandmarks: hands.map((hand) => hand.imageLandmarks),
    frame: {
      bodyLandmarks,
      handLandmarks: Object.fromEntries(hands.map((hand) => [hand.side, hand.worldLandmarks])),
      headRotation: detectHead(context, bodyImage)
    }
  }
}
