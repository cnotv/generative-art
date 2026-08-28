<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import {
  createControls,
  lockScreenOrientation,
  unlockScreenOrientation
} from '@webgamekit/controls'
import type { DeviceAim, MotionReading } from '@webgamekit/controls'
import {
  Landmark,
  MapPin,
  Route,
  ShoppingBag,
  SlidersHorizontal,
  UtensilsCrossed
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import IconButton from '@/components/IconButton.vue'
import { fetchNearbyPlaces } from './places'
import { fetchPlaceImage } from './imagery'
import { buildMinimap } from './minimap'
import { fetchStreetPaths } from './streets'
import {
  formatDistance,
  getDistanceMeters,
  getVerticalFieldOfView,
  placeLabels,
  projectStreetRibbons,
  smoothBearing
} from './projection'
import {
  DEFAULT_HORIZONTAL_FIELD_OF_VIEW,
  EYE_HEIGHT_METERS,
  GEOLOCATION_OPTIONS,
  IMAGE_SEARCH_RADIUS_METERS,
  IMAGE_THUMBNAIL_WIDTH,
  LABEL_COLUMN_WIDTH_PERCENT,
  LABEL_ROW_HEIGHT_PERCENT,
  MAXIMUM_FIELD_OF_VIEW,
  MAXIMUM_HEADING_OFFSET,
  MAX_PLACES,
  MAX_VISIBLE_LABELS,
  MINIMUM_FIELD_OF_VIEW,
  MINIMAP_RADIUS_METERS,
  MINIMUM_HORIZON_STRENGTH,
  PLACE_MARKER_METERS,
  PLACE_GROUPS,
  REFETCH_DISTANCE_METERS,
  SEARCH_RADIUS_METERS,
  STREET_RADIUS_METERS,
  STREET_WIDTH_METERS
} from './config'
import type { GeoPoint, PermissionStage, Place, PlaceImage, StreetPath } from './types'

/** Enough to settle a magnetometer without the labels lagging behind the phone. */
const AIM_SMOOTHING = 0.15

/** Named in the config so the groups stay data, and resolved to components only here. */
const GROUP_ICONS = { Route, UtensilsCrossed, ShoppingBag, Landmark, MapPin }

const stage = ref<PermissionStage>('idle')
const cameraMessage = ref<string | null>(null)
const placesMessage = ref<string | null>(null)
const isLoadingPlaces = ref(false)

const videoElement = ref<HTMLVideoElement | null>(null)
const cameraStream = shallowRef<MediaStream | null>(null)

const origin = ref<GeoPoint | null>(null)
const accuracyMeters = ref<number | null>(null)
const places = ref<Place[]>([])
const streetPaths = ref<StreetPath[]>([])
const selectedPlaceId = ref<string | null>(null)
const placeImage = ref<PlaceImage | null>(null)
const isLoadingImage = ref(false)

const aim = ref<DeviceAim>({
  headingDegrees: 0,
  pitchDegrees: 0,
  rollDegrees: 0,
  horizonStrength: 0
})
const sensorPermission = ref<'idle' | 'granted' | 'denied' | 'unsupported'>('idle')
// Counted, because a permission that was never asked and one that was answered no look
// identical from the outcome alone, and they need opposite advice.
const sensorPromptCount = ref(0)
const hasSensor = ref(false)
const lastReading = ref<MotionReading | null>(null)
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

const hiddenGroups = ref<string[]>([])

const toggleGroup = (id: string): void => {
  hiddenGroups.value = hiddenGroups.value.includes(id)
    ? hiddenGroups.value.filter((hidden) => hidden !== id)
    : [...hiddenGroups.value, id]
}

const visiblePlaces = computed(() =>
  places.value.filter(({ group }) => !hiddenGroups.value.includes(group))
)

/**
 * How many of each kind were found, so a toggle says what turning it off would cost.
 *
 * Streets count their drawn centre lines as well as their named points, because the lines are
 * most of what that toggle governs and they come from a service that fails often enough to be
 * worth telling apart from an empty street.
 */
const groupCounts = computed(() => {
  const byGroup = places.value.reduce<Record<string, number>>(
    (counts, { group }) => ({ ...counts, [group]: (counts[group] ?? 0) + 1 }),
    {}
  )

  return { ...byGroup, streets: (byGroup.streets ?? 0) + streetPaths.value.length }
})

const labels = computed(() =>
  origin.value
    ? placeLabels(
        visiblePlaces.value,
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
          columnWidthPercent: LABEL_COLUMN_WIDTH_PERCENT,
          markerMeters: PLACE_MARKER_METERS
        }
      )
    : []
)

const streetRibbons = computed(() =>
  origin.value && !hiddenGroups.value.includes('streets')
    ? projectStreetRibbons(
        streetPaths.value,
        origin.value,
        {
          headingDegrees: aim.value.headingDegrees + headingOffsetDegrees.value,
          pitchDegrees: aim.value.pitchDegrees
        },
        fieldOfView.value,
        { eyeHeightMeters: EYE_HEIGHT_METERS, widthMeters: STREET_WIDTH_METERS }
      )
    : []
)

/** One name per street, on the run of it that comes nearest, so a road is not written twice. */
const streetNames = computed(() =>
  streetRibbons.value.reduce<{ id: string; name: string; xPercent: number; yPercent: number }[]>(
    (named, ribbon) =>
      !ribbon.name || named.some(({ name }) => name === ribbon.name)
        ? named
        : [...named, { id: ribbon.id, name: ribbon.name, ...ribbon.namePoint }],
    []
  )
)

/**
 * The labels stay square to the world, which is what makes them read as fixed to the street
 * rather than painted on the glass.
 *
 * Square to the world is not the same as turning with the phone, and which one it looks like
 * depends on something the page does not control. When the browser rotates the page, it rotates
 * the camera picture with it, so the world is already upright in the frame and the labels have
 * to be upright too; the page's own rotation is taken back off for exactly that. When the page
 * stays put — locked to portrait, or a browser that does not turn — the picture leans with the
 * phone and the labels lean with it, which is the turning motion the feature is named for.
 *
 * The angle is only believed when the viewport has visibly taken it: some browsers report the
 * angle the device is held at rather than the one the document was turned by.
 */
const worldTransform = computed(
  () => `rotate(${(aim.value.rollDegrees - screenAngleDegrees.value).toFixed(2)}deg)`
)

const selectedPlace = computed(
  () => places.value.find(({ id }) => id === selectedPlaceId.value) ?? null
)

/**
 * The plan view in the corner, turned so the way you are facing points up.
 *
 * North-up would be the conventional choice and the wrong one here: the whole point is to line
 * the map up with what the camera is showing, and a map you have to mentally rotate does not do
 * that.
 */
const minimap = computed(() =>
  origin.value
    ? buildMinimap(streetPaths.value, visiblePlaces.value, origin.value, MINIMAP_RADIUS_METERS)
    : { streets: [], places: [] }
)

const minimapTransform = computed(
  () => `rotate(${(-(aim.value.headingDegrees + headingOffsetDegrees.value)).toFixed(1)} 50 50)`
)

/**
 * The wedge showing how much of the plan the camera actually takes in.
 *
 * Drawn straight up the map, because the map is turned to face the same way and the cone is the
 * one thing on it that belongs to the screen rather than to the ground.
 */
const minimapCone = computed(() => {
  const half = (fieldOfView.value.horizontalDegrees / 2) * (Math.PI / 180)
  const reach = 50
  const left = { x: 50 - Math.sin(half) * reach, y: 50 - Math.cos(half) * reach }
  const right = { x: 50 + Math.sin(half) * reach, y: 50 - Math.cos(half) * reach }

  return `M 50 50 L ${left.x.toFixed(1)} ${left.y.toFixed(1)} L ${right.x.toFixed(1)} ${right.y.toFixed(1)} Z`
})

const selectImage = async (place: Place): Promise<void> => {
  pendingImage?.abort()
  const request = new AbortController()
  pendingImage = request
  placeImage.value = null
  isLoadingImage.value = true

  try {
    placeImage.value = await fetchPlaceImage(
      place,
      IMAGE_SEARCH_RADIUS_METERS,
      IMAGE_THUMBNAIL_WIDTH,
      request.signal
    )
  } catch {
    if (!request.signal.aborted) placeImage.value = null
  } finally {
    if (!request.signal.aborted) isLoadingImage.value = false
  }
}

const selectPlace = (place: Place): void => {
  selectedPlaceId.value = place.id
  selectImage(place)
}

const closePlace = (): void => {
  pendingImage?.abort()
  selectedPlaceId.value = null
  placeImage.value = null
  isLoadingImage.value = false
}

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
    // Both the blend and the offset can push the sum onto or past a full turn, and a compass
    // that reads 360 rather than 0 looks broken.
    const heading = (((aim.value.headingDegrees + headingOffsetDegrees.value) % 360) + 360) % 360
    return `${Math.round(heading) % 360}°`
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

/**
 * The raw angles beside what was made of them. Every wrong-looking overlay is one of these two
 * halves, and from the outside they produce the same picture.
 */
const orientationDiagnostics = computed(() => {
  const reading = lastReading.value
  if (!reading) return 'No orientation reading.'

  const round = (value: number): string => value.toFixed(0)
  const raw = `a${round(reading.alpha)} b${round(reading.beta)} g${round(reading.gamma)}`
  const compass = reading.compassHeading === null ? 'none' : round(reading.compassHeading)
  // The blended roll is kept inside a single turn, where level reads as 360 rather than 0.
  const signedRoll = ((aim.value.rollDegrees + 180) % 360) - 180
  const applied = `${round(signedRoll)}° roll, horizon ${aim.value.horizonStrength.toFixed(2)}`

  return `${raw}, compass ${compass}, screen ${screenAngleDegrees.value}° · ${applied}`
})

const measureViewport = (): void => {
  const width = window.innerWidth
  const height = Math.max(1, window.innerHeight)
  viewportAspectRatio.value = width / height

  // Only believe a rotation the page has visibly taken. Some browsers report the angle the
  // device is held at rather than the one the document was turned by, and taking that at its
  // word turns the whole overlay a quarter turn while the page is plainly still portrait.
  const reported = window.screen?.orientation?.angle ?? 0
  screenAngleDegrees.value = width > height ? reported : 0
}

let frameId = 0
let watchId: number | null = null
let pendingRequest: AbortController | null = null
let pendingStreets: AbortController | null = null
let pendingImage: AbortController | null = null

const blend = (current: number, target: number): number =>
  current + (target - current) * AIM_SMOOTHING

const readAim = (): void => {
  frameId = requestAnimationFrame(readAim)
  const reading = motion.getAim()
  if (!reading) return

  hasSensor.value = true
  lastReading.value = motion.getReading()
  aim.value = {
    headingDegrees: smoothBearing(aim.value.headingDegrees, reading.headingDegrees, AIM_SMOOTHING),
    pitchDegrees: blend(aim.value.pitchDegrees, reading.pitchDegrees),
    // Roll is an angle and wraps, so it is blended the short way round. Averaging it as a plain
    // number sends the overlay the long way through half a turn every time it crosses the wrap.
    // Below the threshold the phone is too flat for a horizon to exist, and the last good roll
    // is held rather than following noise a quarter turn out.
    rollDegrees:
      reading.horizonStrength < MINIMUM_HORIZON_STRENGTH
        ? aim.value.rollDegrees
        : smoothBearing(aim.value.rollDegrees, reading.rollDegrees, AIM_SMOOTHING),
    horizonStrength: reading.horizonStrength
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

/**
 * Street geometry is a bonus, not a dependency: Overpass is the only free source of it and its
 * mirrors fail often, so a failure leaves the labels alone and simply draws no lines.
 */
const loadStreets = async (from: GeoPoint): Promise<void> => {
  // Its own controller, not the one the places request uses. Sharing it meant the next position
  // update aborted a street query that was still in flight, and the lines vanished at random.
  pendingStreets?.abort()
  const request = new AbortController()
  pendingStreets = request

  try {
    streetPaths.value = await fetchStreetPaths(from, STREET_RADIUS_METERS, request.signal)
  } catch {
    if (!request.signal.aborted) streetPaths.value = []
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
  if (!previous || getDistanceMeters(previous, next) > REFETCH_DISTANCE_METERS) {
    loadPlaces(next)
    loadStreets(next)
  }
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
  // Both, because a browser that turns the page does not reliably resize it, and one that
  // resizes does not always report a turn.
  window.addEventListener('resize', measureViewport)
  window.addEventListener('orientationchange', measureViewport)
  stage.value = 'ready'
  readAim()
}

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  pendingRequest?.abort()
  pendingStreets?.abort()
  pendingImage?.abort()
  window.removeEventListener('resize', measureViewport)
  window.removeEventListener('orientationchange', measureViewport)
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
      <svg
        v-if="streetRibbons.length > 0"
        class="mrm__streets"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polygon
          v-for="ribbon in streetRibbons"
          :key="ribbon.id"
          class="mrm__street"
          :points="
            ribbon.points.map(({ xPercent, yPercent }) => `${xPercent},${yPercent}`).join(' ')
          "
        />
      </svg>

      <span
        v-for="street in streetNames"
        :key="street.id"
        class="mrm__street-name"
        :style="{ left: `${street.xPercent}%`, top: `${street.yPercent}%` }"
      >
        {{ street.name }}
      </span>

      <span
        v-for="label in labels"
        :key="`${label.place.id}-marker`"
        class="mrm__marker"
        :style="{
          left: `${label.groundPoint.xPercent}%`,
          top: `${label.groundPoint.yPercent}%`,
          width: `${label.boxPercent}%`,
          height: `${label.boxPercent}%`
        }"
      ></span>

      <Button
        v-for="label in labels"
        :key="label.place.id"
        variant="ghost"
        class="mrm__label"
        :style="{ left: `${label.xPercent}%`, top: `${label.yPercent}%` }"
        @click="selectPlace(label.place)"
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

      <svg
        v-if="origin"
        class="mrm__minimap"
        viewBox="0 0 100 100"
        role="img"
        aria-label="Plan of the streets around you, turned so the way you face is up"
      >
        <circle class="mrm__minimap-ground" cx="50" cy="50" r="49" />
        <g :transform="minimapTransform">
          <polyline
            v-for="street in minimap.streets"
            :key="street.id"
            class="mrm__minimap-street"
            :points="street.points.map(({ x, y }) => `${x},${y}`).join(' ')"
          />
          <circle
            v-for="place in minimap.places"
            :key="place.id"
            class="mrm__minimap-place"
            :cx="place.x"
            :cy="place.y"
            r="2"
          />
        </g>
        <!-- Fixed to the frame rather than turned with the map: it is where the camera looks. -->
        <path class="mrm__minimap-cone" :d="minimapCone" />
        <circle class="mrm__minimap-viewer" cx="50" cy="50" r="3" />
      </svg>

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
        <img
          v-if="placeImage"
          class="mrm__detail-image"
          :src="placeImage.thumbnailUrl"
          :alt="`Photograph captioned ${placeImage.title}`"
          loading="lazy"
        />
        <p v-else class="mrm__detail-line">
          {{ isLoadingImage ? 'Looking for a picture…' : 'No picture of this one.' }}
        </p>

        <h2 class="mrm__detail-name">{{ selectedPlace.name }}</h2>
        <p class="mrm__detail-line">{{ selectedPlace.category }} · {{ selectedDistance }}</p>
        <!-- Named plainly: the picture is of whatever Wikipedia has nearest, which for a shop
             is usually the street or the district rather than the shop itself. -->
        <p v-if="placeImage" class="mrm__detail-line">
          Nearest picture on Wikipedia:
          <a class="mrm__detail-link" :href="placeImage.pageUrl" target="_blank" rel="noreferrer">
            {{ placeImage.title }}
          </a>
        </p>
        <a class="mrm__detail-link" :href="openStreetMapUrl" target="_blank" rel="noreferrer">
          Open in OpenStreetMap
        </a>
        <Button variant="secondary" size="sm" @click="closePlace">Close</Button>
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
        <p class="mrm__hint">{{ orientationDiagnostics }}</p>
      </section>

      <div class="mrm__actions">
        <IconButton
          v-for="group in PLACE_GROUPS"
          :key="group.id"
          class="mrm__toggle"
          size="lg"
          :title="`${group.label} · ${groupCounts[group.id] ?? 0}`"
          :aria-label="`${group.label}, ${groupCounts[group.id] ?? 0} found`"
          :aria-pressed="!hiddenGroups.includes(group.id)"
          :active="!hiddenGroups.includes(group.id)"
          @click="toggleGroup(group.id)"
        >
          <component :is="GROUP_ICONS[group.icon]" />
        </IconButton>

        <IconButton
          class="mrm__toggle mrm__settings-toggle"
          size="lg"
          title="Calibrate"
          aria-label="Field of view and compass settings"
          :aria-pressed="isCalibrating"
          :active="isCalibrating"
          @click="isCalibrating = !isCalibrating"
        >
          <SlidersHorizontal />
        </IconButton>
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

.mrm__streets {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

/*
 * `non-scaling-stroke` measures the width in screen pixels rather than in the stretched user
 * units of the viewBox, so this is a real width and not a fraction of one.
 */

/*
 * A filled surface rather than a line, so the road lies on the ground and narrows into the
 * distance. `non-scaling-stroke` measures the kerb in screen pixels rather than in the
 * stretched user units of the viewBox, so it stays even along a road running away from you.
 */
.mrm__street {
  fill: var(--color-canvas-overlay-foreground);
  fill-opacity: 0.22;
  stroke: var(--color-canvas-overlay-foreground);
  stroke-opacity: 0.55;
  stroke-width: 1.5;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

/*
 * Where the place actually stands, drawn at its real footprint so it shrinks with distance.
 * Sized in percent of the frame width, which is why the height is set from the same number.
 */
.mrm__marker {
  position: absolute;
  border: var(--spacing-px) solid var(--color-canvas-overlay-foreground);
  border-radius: var(--radius-sm);
  background: var(--color-canvas-overlay-surface);
  opacity: 0.75;
  transform: translate(-50%, -50%);
}

.mrm__street-name {
  position: absolute;
  padding: var(--spacing-0-5) var(--spacing-2);
  border-radius: var(--radius-full);
  background: var(--color-canvas-overlay-surface);
  color: var(--color-canvas-overlay-foreground);
  font-size: var(--font-size-xs);
  text-shadow: var(--shadow-text-canvas-overlay);
  white-space: nowrap;
  transform: translate(-50%, -50%);
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
    'minimap'
    'notice'
    'detail'
    'calibration'
    'actions';
  grid-template-rows: auto auto auto 1fr auto auto;
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

/*
 * Drawn from the street geometry the overlay already holds, so there is nothing to fetch and
 * the plan cannot disagree with the labels.
 */
.mrm__minimap {
  grid-area: minimap;
  justify-self: end;
  width: 7.5rem;
  height: 7.5rem;
  border-radius: var(--radius-full);
  overflow: hidden;
}

.mrm__minimap-ground {
  fill: var(--color-canvas-overlay-surface-strong);
  stroke: var(--color-canvas-overlay-border);
  stroke-width: 1;
}

.mrm__minimap-street {
  fill: none;
  stroke: var(--color-canvas-overlay-foreground);
  stroke-opacity: 0.55;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.mrm__minimap-place {
  fill: var(--color-canvas-overlay-foreground);
  fill-opacity: 0.85;
}

.mrm__minimap-cone {
  fill: var(--color-canvas-overlay-foreground);
  fill-opacity: 0.16;
}

.mrm__minimap-viewer {
  fill: var(--color-canvas-overlay-foreground);
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

.mrm__detail-image {
  width: 100%;
  max-height: 40vh;
  border-radius: var(--radius-lg);
  object-fit: cover;
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
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-2);
  padding: var(--spacing-2);
  border: var(--spacing-px) solid var(--color-canvas-overlay-border);
  border-radius: var(--radius-full);
  background: var(--color-canvas-overlay-surface-strong);
  pointer-events: auto;
}

/*
 * The kit's icon button is drawn for themed chrome, and this one sits on a camera feed. Its
 * hover fill is a light theme colour, which swallowed a white icon whole.
 */
.mrm__toggle {
  border-radius: var(--radius-full);
  color: var(--color-canvas-overlay-foreground);
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/*
 * Whether it is on decides how it looks, and nothing else does. A tap leaves the hover state
 * behind on a touch screen, so a toggle switched off went on looking exactly like one still on
 * until something else was touched. Both states therefore answer for their own hover.
 */
.mrm__toggle[aria-pressed='true'],
.mrm__toggle[aria-pressed='true']:hover {
  background: var(--color-canvas-overlay-border);
  color: var(--color-canvas-overlay-foreground);
  opacity: 1;
}

.mrm__toggle[aria-pressed='false'],
.mrm__toggle[aria-pressed='false']:hover {
  background: transparent;
  color: var(--color-canvas-overlay-foreground);
  opacity: 0.5;
}

/* Only a pointer that can really hover gets the hover state back. */
@media (hover: hover) {
  .mrm__toggle[aria-pressed='false']:hover {
    background: var(--color-canvas-overlay-border);
    opacity: 1;
  }
}

.mrm__toggle:focus-visible {
  opacity: 1;
}

/* The last button changes what the bar shows rather than what the world does. */
.mrm__settings-toggle {
  margin-left: var(--spacing-2);
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
