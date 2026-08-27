<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import {
  createControls,
  lockScreenOrientation,
  unlockScreenOrientation
} from '@webgamekit/controls'
import type { DeviceAim } from '@webgamekit/controls'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { fetchNearbyPlaces } from './places'
import {
  formatDistance,
  getDistanceMeters,
  getVerticalFieldOfView,
  placeLabels,
  smoothBearing
} from './projection'
import {
  DEFAULT_HORIZONTAL_FIELD_OF_VIEW,
  EYE_HEIGHT_METERS,
  GEOLOCATION_OPTIONS,
  LABEL_COLUMN_WIDTH_PERCENT,
  LABEL_ROW_HEIGHT_PERCENT,
  MAXIMUM_FIELD_OF_VIEW,
  MAXIMUM_HEADING_OFFSET,
  MAX_PLACES,
  MAX_VISIBLE_LABELS,
  MINIMUM_FIELD_OF_VIEW,
  REFETCH_DISTANCE_METERS,
  SEARCH_RADIUS_METERS
} from './config'
import type { GeoPoint, PermissionStage, Place } from './types'

/** Enough to settle a magnetometer without the labels lagging behind the phone. */
const AIM_SMOOTHING = 0.15

const stage = ref<PermissionStage>('idle')
const cameraMessage = ref<string | null>(null)
const placesMessage = ref<string | null>(null)
const isLoadingPlaces = ref(false)

const videoElement = ref<HTMLVideoElement | null>(null)
const cameraStream = shallowRef<MediaStream | null>(null)

const origin = ref<GeoPoint | null>(null)
const accuracyMeters = ref<number | null>(null)
const places = ref<Place[]>([])
const selectedPlaceId = ref<string | null>(null)

const aim = ref<DeviceAim>({ headingDegrees: 0, pitchDegrees: 0, rollDegrees: 0 })
const sensorPermission = ref<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')
// Counted, because a permission that was never asked and one that was answered no look
// identical from the outcome alone, and they need opposite advice.
const sensorPromptCount = ref(0)
const hasSensor = ref(false)
const headingOffsetDegrees = ref(0)
const horizontalFieldOfView = ref(DEFAULT_HORIZONTAL_FIELD_OF_VIEW)
const isCalibrating = ref(false)
const viewportAspectRatio = ref(1)
const screenAngleDegrees = ref(0)

const { destroyControls, motion } = createControls({
  mapping: {},
  keyboard: false,
  gamepad: false,
  touch: false,
  mouse: false
})

const fieldOfView = computed(() => ({
  horizontalDegrees: horizontalFieldOfView.value,
  verticalDegrees: getVerticalFieldOfView(horizontalFieldOfView.value, viewportAspectRatio.value)
}))

const labels = computed(() =>
  origin.value
    ? placeLabels(
        places.value,
        origin.value,
        {
          headingDegrees: aim.value.headingDegrees + headingOffsetDegrees.value,
          pitchDegrees: aim.value.pitchDegrees
        },
        fieldOfView.value,
        {
          eyeHeightMeters: EYE_HEIGHT_METERS,
          maximumLabels: MAX_VISIBLE_LABELS,
          rowHeightPercent: LABEL_ROW_HEIGHT_PERCENT,
          columnWidthPercent: LABEL_COLUMN_WIDTH_PERCENT
        }
      )
    : []
)

/**
 * The labels turn with the world, not with the phone, which is what makes them read as fixed
 * to the street rather than painted on the glass. Where the browser has rotated the page
 * itself, that turn has already happened and is taken back out here.
 */
const worldTransform = computed(
  () => `rotate(${(aim.value.rollDegrees - screenAngleDegrees.value).toFixed(2)}deg)`
)

const selectedPlace = computed(
  () => places.value.find(({ id }) => id === selectedPlaceId.value) ?? null
)

const selectedDistance = computed(() =>
  selectedPlace.value && origin.value
    ? formatDistance(getDistanceMeters(origin.value, selectedPlace.value))
    : null
)

const openStreetMapUrl = computed(() =>
  selectedPlace.value
    ? `https://www.openstreetmap.org/${selectedPlace.value.id}`
    : 'https://www.openstreetmap.org'
)

/**
 * A compass that was never asked, one that was refused and one that answers all read
 * differently. Collapsing them into "no compass" hid a permission that was never requested.
 */
const headingReadout = computed(() => {
  if (hasSensor.value) {
    return `${Math.round(aim.value.headingDegrees + headingOffsetDegrees.value)}°`
  }

  const states = {
    idle: 'not asked',
    granted: 'no reading yet',
    denied: 'refused',
    unsupported: 'none on this device'
  }

  return states[sensorPermission.value]
})

// Orientation and camera both fail silently off a secure page, on every platform rather than
// only iOS, so the state is surfaced rather than guessed at from a failure that looks the same.
const isSecurePage = window.isSecureContext

const measureViewport = (): void => {
  viewportAspectRatio.value = window.innerWidth / Math.max(1, window.innerHeight)
  screenAngleDegrees.value = window.screen?.orientation?.angle ?? 0
}

let frameId = 0
let watchId: number | null = null
let pendingRequest: AbortController | null = null

const blend = (current: number, target: number): number =>
  current + (target - current) * AIM_SMOOTHING

const readAim = (): void => {
  frameId = requestAnimationFrame(readAim)
  const reading = motion.getAim()
  if (!reading) return

  hasSensor.value = true
  aim.value = {
    headingDegrees: smoothBearing(aim.value.headingDegrees, reading.headingDegrees, AIM_SMOOTHING),
    pitchDegrees: blend(aim.value.pitchDegrees, reading.pitchDegrees),
    rollDegrees: blend(aim.value.rollDegrees, reading.rollDegrees)
  }
}

const loadPlaces = async (from: GeoPoint): Promise<void> => {
  pendingRequest?.abort()
  const request = new AbortController()
  pendingRequest = request
  isLoadingPlaces.value = true
  placesMessage.value = null

  try {
    places.value = await fetchNearbyPlaces(from, SEARCH_RADIUS_METERS, MAX_PLACES, request.signal)
    if (places.value.length === 0) placesMessage.value = 'Nothing named within reach.'
  } catch {
    if (!request.signal.aborted) placesMessage.value = 'The map service did not answer.'
  } finally {
    if (!request.signal.aborted) isLoadingPlaces.value = false
  }
}

const receivePosition = (position: GeolocationPosition): void => {
  const next = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  }
  const previous = origin.value
  origin.value = next
  accuracyMeters.value = position.coords.accuracy

  // Overpass is a shared public service, so it is asked again only once the walk has been far
  // enough that the answer would actually differ.
  if (!previous || getDistanceMeters(previous, next) > REFETCH_DISTANCE_METERS) loadPlaces(next)
}

/**
 * Say what actually went wrong, by the name the platform used.
 *
 * A camera can fail for reasons the person can fix and reasons they cannot, and the two look
 * identical from a single "it did not open" line. Naming the cause is the difference between
 * a setting they can change and a browser they have to leave.
 */
const describeCameraFailure = (error: unknown): string => {
  const name = error instanceof Error ? error.name : 'Unknown'
  const reasons: Record<string, string> = {
    NotAllowedError: 'Camera access was refused. Allow it for this site and press Start again.',
    NotFoundError: 'This device reports no camera.',
    NotReadableError: 'Another app is holding the camera. Close it and press Start again.',
    OverconstrainedError: 'No rear camera. The front one will be tried on the next attempt.',
    SecurityError: 'The camera needs a secure page.'
  }

  return reasons[name] ?? `The camera did not open (${name}).`
}

/**
 * Open the rear camera, reporting rather than throwing.
 *
 * Playback is started separately and its failure ignored: the element also carries `autoplay`,
 * and a stream that is live but not yet playing is not a camera failure.
 * @returns A message when it did not open, null when it did
 */
const startCamera = async (): Promise<string | null> => {
  // Absent on an insecure page, and on more than one iOS browser that is not Safari.
  if (!navigator.mediaDevices?.getUserMedia) {
    return 'This browser exposes no camera to the page. Safari or Chrome will.'
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    })
    cameraStream.value = stream
    if (videoElement.value) {
      videoElement.value.srcObject = stream
      videoElement.value.play().catch(() => undefined)
    }
    return null
  } catch (error) {
    return describeCameraFailure(error)
  }
}

const startLocation = (): void => {
  if (!navigator.geolocation) {
    placesMessage.value = 'This browser reports no location at all.'
    return
  }

  watchId = navigator.geolocation.watchPosition(
    receivePosition,
    (error) => {
      placesMessage.value = `Location is unavailable, so there is nothing to place (${error.message}).`
    },
    GEOLOCATION_OPTIONS
  )
}

/**
 * Ask for the orientation sensor, from whatever tap is calling.
 *
 * Kept callable twice: on the platform that gates this, a request made while another dialog
 * was on screen comes back denied without having asked, and the only way through is a fresh
 * tap with nothing else competing for it.
 */
const requestSensor = async (): Promise<void> => {
  sensorPermission.value = await motion.requestMotionPermission()
  sensorPromptCount.value = motion.getPromptCount()
}

const retryCamera = async (): Promise<void> => {
  cameraMessage.value = await startCamera()
}

const start = async (): Promise<void> => {
  stage.value = 'requesting'
  measureViewport()

  // One prompt at a time, sensor first. iOS grants the orientation sensor only from a live tap,
  // and it will not raise a second dialog while one is already up — asking for both in the same
  // tick returns the sensor denied without its prompt ever appearing, which looks from the
  // outside exactly like the person having said no.
  await requestSensor()
  cameraMessage.value = await startCamera()

  // The three are independent: a refused camera still leaves a usable compass and a usable
  // location, which is a black screen with the street named on it rather than nothing at all.
  startLocation()

  // The overlay turns with the world by itself; letting the page turn as well would take the
  // labels round twice, and the compensation for it is guesswork on the devices that lie.
  lockScreenOrientation('portrait')
  window.addEventListener('resize', measureViewport)
  stage.value = 'ready'
  readAim()
}

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  pendingRequest?.abort()
  window.removeEventListener('resize', measureViewport)
  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  cameraStream.value?.getTracks().forEach((track) => track.stop())
  unlockScreenOrientation()
  destroyControls()
})
</script>

<template>
  <div class="mrm">
    <video ref="videoElement" class="mrm__feed" playsinline muted autoplay></video>

    <div class="mrm__world" :style="{ transform: worldTransform }">
      <Button
        v-for="label in labels"
        :key="label.place.id"
        variant="ghost"
        class="mrm__label"
        :style="{ left: `${label.xPercent}%`, top: `${label.yPercent}%` }"
        @click="selectedPlaceId = label.place.id"
      >
        <span class="mrm__label-name">{{ label.place.name }}</span>
        <span class="mrm__label-detail">
          {{ label.place.category }} · {{ formatDistance(label.distanceMeters) }}
        </span>
      </Button>
    </div>

    <div class="mrm__chrome">
      <dl class="mrm__readout">
        <dt>Heading</dt>
        <dd>{{ headingReadout }}</dd>
        <dt>Places</dt>
        <dd>{{ isLoadingPlaces ? 'searching' : `${labels.length} of ${places.length}` }}</dd>
        <dt>Accuracy</dt>
        <dd>{{ accuracyMeters === null ? 'waiting' : formatDistance(accuracyMeters) }}</dd>
      </dl>

      <div class="mrm__notices">
        <p v-if="cameraMessage" class="mrm__notice">
          {{ cameraMessage }}
          <Button variant="secondary" size="sm" @click="retryCamera">Try the camera again</Button>
        </p>
        <p v-if="stage === 'ready' && sensorPermission !== 'granted'" class="mrm__notice">
          The compass was not granted, so the labels cannot follow where you turn.
          <Button
            v-if="sensorPermission === 'denied'"
            variant="secondary"
            size="sm"
            @click="requestSensor"
          >
            Ask for the compass again
          </Button>
        </p>
        <p v-if="placesMessage" class="mrm__notice">{{ placesMessage }}</p>
      </div>

      <article v-if="selectedPlace" class="mrm__detail">
        <h2 class="mrm__detail-name">{{ selectedPlace.name }}</h2>
        <p class="mrm__detail-line">{{ selectedPlace.category }} · {{ selectedDistance }}</p>
        <a class="mrm__detail-link" :href="openStreetMapUrl" target="_blank" rel="noreferrer">
          Open in OpenStreetMap
        </a>
        <Button variant="secondary" size="sm" @click="selectedPlaceId = null">Close</Button>
      </article>

      <section v-if="isCalibrating" class="mrm__calibration">
        <label class="mrm__field">
          <span>Field of view · {{ Math.round(horizontalFieldOfView) }}°</span>
          <Slider
            :model-value="[horizontalFieldOfView]"
            :min="MINIMUM_FIELD_OF_VIEW"
            :max="MAXIMUM_FIELD_OF_VIEW"
            :step="1"
            @update:model-value="horizontalFieldOfView = $event?.[0] ?? horizontalFieldOfView"
          />
        </label>
        <label class="mrm__field">
          <span>Compass offset · {{ Math.round(headingOffsetDegrees) }}°</span>
          <Slider
            :model-value="[headingOffsetDegrees]"
            :min="-MAXIMUM_HEADING_OFFSET"
            :max="MAXIMUM_HEADING_OFFSET"
            :step="1"
            @update:model-value="headingOffsetDegrees = $event?.[0] ?? headingOffsetDegrees"
          />
        </label>
        <p class="mrm__hint">
          Widen the view until a label sits on the thing it names. Without a compass, the offset
          sweeps the horizon by hand.
        </p>
        <p class="mrm__hint">
          Sensor {{ sensorPermission }}, prompted {{ sensorPromptCount }}×, readings
          {{ hasSensor ? 'arriving' : 'none' }}. Camera {{ cameraMessage ? 'blocked' : 'open' }}.
          Secure page {{ isSecurePage ? 'yes' : 'no' }}.
        </p>
      </section>

      <div class="mrm__actions">
        <Button variant="secondary" size="sm" @click="isCalibrating = !isCalibrating">
          {{ isCalibrating ? 'Done' : 'Calibrate' }}
        </Button>
      </div>
    </div>

    <div v-if="stage !== 'ready'" class="mrm__gate">
      <h1 class="mrm__gate-title">Mixed reality map</h1>
      <p class="mrm__gate-body">
        Names the streets, shops and landmarks around you, over the camera, where they actually
        stand. It asks for the camera, your location and the compass at once, and carries on with
        whichever of the three it is given.
      </p>
      <Button size="lg" :disabled="stage === 'requesting'" @click="start">
        {{ stage === 'requesting' ? 'Asking…' : 'Start' }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.mrm {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: hsl(0deg 0% 0%);
  color: var(--color-canvas-overlay-foreground);
  text-shadow: var(--shadow-text-canvas-overlay);
}

.mrm__feed {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mrm__world {
  position: absolute;
  inset: 0;
  transform-origin: center;
}

.mrm__label {
  position: absolute;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
  height: auto;
  padding: var(--spacing-1-5) var(--spacing-3);
  border: var(--spacing-px) solid var(--color-canvas-overlay-border);
  border-radius: var(--radius-full);
  background: var(--color-canvas-overlay-surface);
  color: var(--color-canvas-overlay-foreground);
  text-shadow: var(--shadow-text-canvas-overlay);
  transform: translate(-50%, -50%);
}

.mrm__label-name {
  font-size: var(--font-size-base);
  font-weight: 600;
}

.mrm__label-detail {
  font-size: var(--font-size-xs);
  opacity: 0.8;
}

.mrm__chrome {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-areas:
    'readout'
    'notice'
    'detail'
    'calibration'
    'actions';
  grid-template-rows: auto auto 1fr auto auto;
  gap: var(--spacing-2);
  padding: var(--nav-height) var(--spacing-4) var(--spacing-6);
  pointer-events: none;
}

.mrm__readout {
  grid-area: readout;
  display: grid;
  grid-template-columns: auto auto;
  justify-content: start;
  gap: var(--spacing-0-5) var(--spacing-3);
  margin: 0;
  font-size: var(--font-size-xs);
}

.mrm__readout dt {
  opacity: 0.7;
}

.mrm__readout dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.mrm__notices {
  grid-area: notice;
  display: grid;
  gap: var(--spacing-1);
}

.mrm__notice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-2);
  margin: 0;
  font-size: var(--font-size-sm);
  pointer-events: auto;
}

.mrm__detail {
  grid-area: detail;
  align-self: end;
  display: grid;
  justify-items: start;
  gap: var(--spacing-2);
  padding: var(--spacing-4);
  border: var(--spacing-px) solid var(--color-canvas-overlay-border);
  border-radius: var(--radius-xl);
  background: var(--color-canvas-overlay-surface-strong);
  pointer-events: auto;
}

.mrm__detail-name {
  margin: 0;
  font-size: var(--font-size-lg);
}

.mrm__detail-line {
  margin: 0;
  font-size: var(--font-size-sm);
  opacity: 0.8;
}

.mrm__detail-link {
  color: inherit;
  font-size: var(--font-size-sm);
}

.mrm__calibration {
  grid-area: calibration;
  display: grid;
  gap: var(--spacing-3);
  padding: var(--spacing-4);
  border: var(--spacing-px) solid var(--color-canvas-overlay-border);
  border-radius: var(--radius-xl);
  background: var(--color-canvas-overlay-surface-strong);
  pointer-events: auto;
}

.mrm__field {
  display: grid;
  gap: var(--spacing-2);
  font-size: var(--font-size-sm);
}

.mrm__hint {
  margin: 0;
  font-size: var(--font-size-xs);
  opacity: 0.8;
}

.mrm__actions {
  grid-area: actions;
  justify-self: end;
  pointer-events: auto;
}

.mrm__gate {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--spacing-4);
  padding: var(--nav-height) var(--spacing-6) var(--spacing-6);
  background: var(--color-canvas-overlay-surface-strong);
  text-align: center;
}

.mrm__gate-title {
  margin: 0;
  font-size: var(--font-size-xl);
}

.mrm__gate-body {
  max-width: 32rem;
  margin: 0;
  font-size: var(--font-size-base);
}
</style>
