<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import {
  createControls,
  lockScreenOrientation,
  unlockScreenOrientation
} from '@webgamekit/controls'
import type { DeviceAim, MotionReading } from '@webgamekit/controls'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  CameraOff,
  Landmark,
  MapPin,
  ShoppingBag,
  SlidersHorizontal,
  UtensilsCrossed
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import IconButton from '@/components/IconButton.vue'
import { clusterPlacesByAddress, fetchNearbyPlaces } from './places'
import { fetchPlaceImage } from './imagery'
import { buildMinimap } from './minimap'
import { fetchStreetPaths } from './streets'
import {
  countOffScreenVenues,
  formatDistance,
  getDistanceMeters,
  placeLabels,
  projectStreetLines,
  selectNearbyStreetPaths,
  smoothBearing
} from './projection'
import {
  ADJACENT_STREET_METERS,
  DEFAULT_HORIZONTAL_FIELD_OF_VIEW,
  GEOLOCATION_OPTIONS,
  IMAGE_SEARCH_RADIUS_METERS,
  IMAGE_THUMBNAIL_WIDTH,
  LABEL_BASE_ROW_PERCENT,
  LABEL_COLUMN_WIDTH_PERCENT,
  LABEL_ROW_HEIGHT_PERCENT,
  MAXIMUM_FIELD_OF_VIEW,
  MAXIMUM_HEADING_OFFSET,
  MAX_PLACES,
  MAX_VISIBLE_LABELS,
  MINIMUM_FIELD_OF_VIEW,
  MINIMAP_RADIUS_METERS,
  MINIMUM_STREET_COUNT,
  OPENSTREETMAP_BASE,
  MINIMUM_HORIZON_STRENGTH,
  PLACE_GROUPS,
  REFETCH_DISTANCE_METERS,
  SEARCH_RADIUS_METERS,
  STREET_RADIUS_METERS,
  STREET_ROW_PERCENT
} from './config'
import type { GeoPoint, PermissionStage, Place, PlaceImage, StreetPath } from './types'

/** Enough to settle a magnetometer without the labels lagging behind the phone. */
const AIM_SMOOTHING = 0.15

/** Named in the config so the groups stay data, and resolved to components only here. */
const GROUP_ICONS = { UtensilsCrossed, ShoppingBag, Landmark, MapPin }

const stage = ref<PermissionStage>('idle')
const cameraMessage = ref<string | null>(null)
const placesMessage = ref<string | null>(null)
const streetsMessage = ref<string | null>(null)
const isLoadingStreets = ref(false)
const imageMessage = ref<string | null>(null)
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
// Off by default: the streets and cards read the same way without it, and asking for it up
// front is one more permission dialog before the person has even seen what the view offers.
const isCameraEnabled = ref(false)

const { destroyControls, motion } = createControls({
  mapping: {},
  keyboard: false,
  gamepad: false,
  touch: false,
  mouse: false
})

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
 * Tenants sharing a building get one card between them, its rows still independently tappable,
 * so a shop directory reads as one spot rather than a pin per name stacked on top of itself.
 *
 * Clustered from what is currently shown, not from everything found: clustering across a
 * filtered group would draw a tenant the filter is hiding.
 */
const placeClusters = computed(() => clusterPlacesByAddress(visiblePlaces.value))

/** How many of each kind were found, so a toggle says what turning it off would cost. */
const groupCounts = computed(() =>
  places.value.reduce<Record<string, number>>(
    (counts, { group }) => ({ ...counts, [group]: (counts[group] ?? 0) + 1 }),
    {}
  )
)

/**
 * Both the streets and the cards sweep by this alone: the phone's own tilt no longer moves
 * anything, only turning on the spot does.
 */
const correctedHeadingDegrees = computed(
  () => aim.value.headingDegrees + headingOffsetDegrees.value
)

const labels = computed(() =>
  origin.value
    ? placeLabels(
        placeClusters.value,
        origin.value,
        correctedHeadingDegrees.value,
        horizontalFieldOfView.value,
        {
          maximumLabels: MAX_VISIBLE_LABELS,
          rowHeightPercent: LABEL_ROW_HEIGHT_PERCENT,
          columnWidthPercent: LABEL_COLUMN_WIDTH_PERCENT,
          baseRowPercent: LABEL_BASE_ROW_PERCENT
        }
      )
    : []
)

/**
 * How many venues are off to the left and right, summarised from every direction to the one
 * axis turning the phone actually moves them along.
 */
const offScreenCounts = computed(() =>
  origin.value
    ? countOffScreenVenues(
        placeClusters.value,
        new Set(labels.value.map((label) => label.id)),
        origin.value,
        correctedHeadingDegrees.value
      )
    : { left: 0, right: 0 }
)

/**
 * The streets actually at the corner you are standing on, not everything named within the
 * wider fetch radius: a block can hold half a dozen roads, and only one or two of them are the
 * one underfoot. Padded out to a minimum count so a quiet corner still reads as a street scene.
 */
const adjacentStreetPaths = computed(() =>
  origin.value
    ? selectNearbyStreetPaths(
        streetPaths.value,
        origin.value,
        ADJACENT_STREET_METERS,
        MINIMUM_STREET_COUNT
      )
    : []
)

const streetLines = computed(() =>
  origin.value
    ? projectStreetLines(
        adjacentStreetPaths.value,
        origin.value,
        correctedHeadingDegrees.value,
        horizontalFieldOfView.value,
        STREET_ROW_PERCENT
      )
    : []
)

/** One name per street, on the run of it that comes nearest, so a road is not written twice. */
const streetNames = computed(() =>
  streetLines.value.reduce<{ id: string; name: string; xPercent: number; yPercent: number }[]>(
    (named, line) =>
      !line.name || named.some(({ name }) => name === line.name)
        ? named
        : [...named, { id: line.id, name: line.name, ...line.namePoint }],
    []
  )
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
    ? buildMinimap(
        adjacentStreetPaths.value,
        visiblePlaces.value,
        origin.value,
        MINIMAP_RADIUS_METERS
      )
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
  const half = (horizontalFieldOfView.value / 2) * (Math.PI / 180)
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
  imageMessage.value = null
  isLoadingImage.value = true

  try {
    placeImage.value = await fetchPlaceImage(
      place,
      place.name,
      IMAGE_SEARCH_RADIUS_METERS,
      IMAGE_THUMBNAIL_WIDTH,
      request.signal
    )
  } catch (error) {
    if (!request.signal.aborted) {
      placeImage.value = null
      imageMessage.value = `The picture service did not answer (${
        error instanceof Error ? error.message : 'unknown'
      }).`
    }
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
  selectedPlace.value?.osmReference
    ? `${OPENSTREETMAP_BASE}${selectedPlace.value.osmReference}`
    : null
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

  return `${raw}, compass ${compass} · ${applied}`
})

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
  streetsMessage.value = null
  isLoadingStreets.value = true
  // Its own controller, not the one the places request uses. Sharing it meant the next position
  // update aborted a street query that was still in flight, and the lines vanished at random.
  pendingStreets?.abort()
  const request = new AbortController()
  pendingStreets = request

  try {
    streetPaths.value = await fetchStreetPaths(from, STREET_RADIUS_METERS, request.signal)
    if (streetPaths.value.length === 0) {
      streetsMessage.value = 'No named streets came back for here.'
    }
  } catch (error) {
    if (request.signal.aborted) return
    streetPaths.value = []
    streetsMessage.value = `Street shapes did not load (${
      error instanceof Error ? error.message : 'unknown'
    }).`
  } finally {
    if (!request.signal.aborted) isLoadingStreets.value = false
  }
}

/**
 * Ask again by hand. The street service is a shared free one and queues under load, so a failed
 * or slow query is worth another go without waiting to walk far enough to trigger one.
 */
const retryStreets = (): void => {
  if (origin.value) loadStreets(origin.value)
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

/** Stops the tracks rather than just hiding the picture, so turning it off actually lets go of it. */
const stopCamera = (): void => {
  cameraStream.value?.getTracks().forEach((track) => track.stop())
  cameraStream.value = null
  cameraMessage.value = null
  if (videoElement.value) videoElement.value.srcObject = null
}

const toggleCamera = async (): Promise<void> => {
  isCameraEnabled.value = !isCameraEnabled.value

  if (isCameraEnabled.value) {
    // The element the stream attaches to only exists once the `v-if` toggling it on has rendered.
    await nextTick()
    cameraMessage.value = await startCamera()
  } else {
    stopCamera()
  }
}

const start = async (): Promise<void> => {
  stage.value = 'requesting'

  // One prompt at a time, sensor first. iOS grants the orientation sensor only from a live tap,
  // and it will not raise a second dialog while one is already up — asking for both in the same
  // tick returns the sensor denied without its prompt ever appearing, which looks from the
  // outside exactly like the person having said no. The camera is not part of this at all: it
  // starts off, and only the toggle asks for it, from its own tap.
  await requestSensor()

  // Independent of the camera: a refused compass still leaves a usable location, which is a
  // black screen with the street named on it rather than nothing at all.
  startLocation()

  // Nothing here reads the page's own rotation any more, but the video feed and the layout
  // both still assume a portrait frame, and a browser that turns the page reflows both.
  lockScreenOrientation('portrait')
  stage.value = 'ready'
  readAim()
}

onBeforeUnmount(() => {
  cancelAnimationFrame(frameId)
  pendingRequest?.abort()
  pendingStreets?.abort()
  pendingImage?.abort()
  if (watchId !== null) navigator.geolocation.clearWatch(watchId)
  cameraStream.value?.getTracks().forEach((track) => track.stop())
  unlockScreenOrientation()
  destroyControls()
})
</script>

<template>
  <div class="mrm">
    <video
      v-if="isCameraEnabled"
      ref="videoElement"
      class="mrm__feed"
      playsinline
      muted
      autoplay
    ></video>

    <div class="mrm__world">
      <svg
        v-if="streetLines.length > 0"
        class="mrm__streets"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          v-for="line in streetLines"
          :key="line.id"
          class="mrm__street"
          :points="line.points.map(({ xPercent, yPercent }) => `${xPercent},${yPercent}`).join(' ')"
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

      <div
        v-for="label in labels"
        :key="label.id"
        class="mrm__label-group"
        :style="{ left: `${label.xPercent}%`, top: `${label.yPercent}%` }"
      >
        <Button
          v-for="place in label.places"
          :key="place.id"
          variant="ghost"
          class="mrm__label"
          @click="selectPlace(place)"
        >
          <Building2 class="mrm__label-icon" aria-hidden="true" />
          <span class="mrm__label-body">
            <span class="mrm__label-name">{{ place.name }}</span>
            <span class="mrm__label-detail">
              {{ place.category }} · {{ formatDistance(label.distanceMeters) }}
            </span>
          </span>
        </Button>
        <!-- One line for the whole group: every tenant clustered here shares the address. -->
        <span
          v-if="label.places[0].street && label.places[0].houseNumber"
          class="mrm__label-address"
        >
          {{ label.places[0].houseNumber }} {{ label.places[0].street }}
        </span>
      </div>
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

      <span
        v-if="offScreenCounts.left > 0"
        class="mrm__scan mrm__scan--left"
        :aria-label="`${offScreenCounts.left} more to the left`"
      >
        <ArrowLeft class="mrm__scan-icon" aria-hidden="true" />
        {{ offScreenCounts.left }}
      </span>
      <span
        v-if="offScreenCounts.right > 0"
        class="mrm__scan mrm__scan--right"
        :aria-label="`${offScreenCounts.right} more to the right`"
      >
        {{ offScreenCounts.right }}
        <ArrowRight class="mrm__scan-icon" aria-hidden="true" />
      </span>

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
        <p v-if="isLoadingStreets" class="mrm__notice">Loading street shapes…</p>
        <p v-else-if="streetsMessage" class="mrm__notice">
          {{ streetsMessage }}
          <Button variant="secondary" size="sm" @click="retryStreets">Try again</Button>
        </p>
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
          {{
            isLoadingImage
              ? 'Looking for a picture…'
              : (imageMessage ?? 'Nothing near here has a picture on Wikipedia.')
          }}
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
        <a
          v-if="openStreetMapUrl"
          class="mrm__detail-link"
          :href="openStreetMapUrl"
          target="_blank"
          rel="noreferrer"
        >
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
          {{ hasSensor ? 'arriving' : 'none' }}. Camera
          {{ cameraMessage ? 'blocked' : isCameraEnabled ? 'open' : 'off' }}. Secure page
          {{ isSecurePage ? 'yes' : 'no' }}.
        </p>
        <p class="mrm__hint">{{ orientationDiagnostics }}</p>
        <p class="mrm__hint">
          Streets {{ streetPaths.length }} fetched, {{ streetLines.length }} drawn. Places
          {{ places.length }} fetched, {{ labels.length }} in frame.
        </p>
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
          :title="isCameraEnabled ? 'Turn the camera off' : 'Turn the camera on'"
          :aria-label="isCameraEnabled ? 'Turn the camera off' : 'Turn the camera on'"
          :aria-pressed="isCameraEnabled"
          :active="isCameraEnabled"
          @click="toggleCamera"
        >
          <Camera v-if="isCameraEnabled" />
          <CameraOff v-else />
        </IconButton>

        <IconButton
          class="mrm__toggle"
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
        Names the streets, shops and landmarks around you, swept across the frame the way you are
        actually facing. It asks for your location and the compass to start; the camera stays off
        until its own toggle turns it on.
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
  background: linear-gradient(
    180deg,
    var(--color-canvas-overlay-background-start),
    var(--color-canvas-overlay-background-end)
  );
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
}

.mrm__streets {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;

  /* Ground drawing, not a control: it must never swallow a tap meant for a label above it. */
  pointer-events: none;
}

/*
 * A single steady stroke, held to one row and swept only by the compass: it reads as a
 * continuous line rather than competing with the camera image underneath it, and cannot itself
 * bob with every small tilt of the phone the way a perspective-projected one did.
 * `non-scaling-stroke` measures the width in screen pixels rather than in the stretched user
 * units of the viewBox. The drop shadow is the same trick the labels use to stay legible over
 * whatever the camera happens to be pointed at, light pavement or dark.
 */
.mrm__street {
  fill: none;
  stroke: var(--color-street-overlay);
  stroke-opacity: 0.85;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  filter: drop-shadow(var(--shadow-text-canvas-overlay));
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
  pointer-events: none;
  transform: translate(-50%, -50%);
}

/*
 * One card, sitting on the frame's fixed label row. Its own rows are laid out by flex rather
 * than by percentage math, so a tenant added to the group grows the card instead of squeezing
 * its neighbours or overlapping them. Left-aligned rather than stretched or centred, so a
 * short name and a long one still share one edge to read down instead of each finding its own
 * centre.
 */
.mrm__label-group {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-1);
  text-align: left;
  transform: translate(-50%, -50%);
}

/* A building card: a shape with some architecture to it, rather than a plain rounded pill. */
.mrm__label {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
  height: auto;
  padding: var(--spacing-1-5) var(--spacing-3);
  border: var(--spacing-px) solid var(--color-canvas-overlay-border);
  border-radius: var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-sm);
  background: var(--color-canvas-overlay-surface);
  color: var(--color-canvas-overlay-foreground);
  text-shadow: var(--shadow-text-canvas-overlay);
}

.mrm__label-icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
}

.mrm__label-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-0-5);
  text-align: left;
}

.mrm__label-name {
  font-size: var(--font-size-base);
  font-weight: 600;
}

.mrm__label-detail {
  font-size: var(--font-size-xs);
  opacity: 0.8;
}

/* One line for the whole group, so a shared address is not repeated under every tenant. */
.mrm__label-address {
  padding: 0 var(--spacing-3);
  font-size: var(--font-size-xs);
  color: var(--color-canvas-overlay-foreground);
  text-shadow: var(--shadow-text-canvas-overlay);
  opacity: 0.6;
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
 * A small pastel chip meant to look pressable rather than flat: the gradient reads as a
 * rounded, lit-from-above surface, and the layered shadow is the same trick a physical rubber
 * button uses, a soft outer lift plus an inner sheen along the top edge and an inner shade
 * along the bottom. Held to the frame's edge, not the world, so it never moves with a card.
 */
.mrm__scan {
  position: absolute;
  top: 50%;
  display: flex;
  align-items: center;
  gap: var(--spacing-1);
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-full);
  background: linear-gradient(
    180deg,
    var(--color-scan-chip-highlight),
    var(--color-scan-chip-base)
  );
  color: var(--color-scan-chip-foreground);
  font-size: var(--font-size-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  box-shadow:
    0 3px 5px hsl(0deg 0% 0% / 30%),
    inset 0 1px 0 hsl(0deg 0% 100% / 60%),
    inset 0 -3px 4px hsl(0deg 0% 0% / 15%);
  transform: translateY(-50%);
  pointer-events: none;
}

.mrm__scan--left {
  left: var(--spacing-3);
}

.mrm__scan--right {
  right: var(--spacing-3);
}

.mrm__scan-icon {
  width: 1rem;
  height: 1rem;
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

/* These two change what the view shows and how it is fed, not which places it names. */
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
