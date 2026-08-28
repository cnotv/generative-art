import { describe, it, expect } from 'vitest'
import {
  getBearingDegrees,
  getDistanceMeters,
  getGroundElevation,
  getScreenPlacement,
  getVerticalFieldOfView,
  formatDistance,
  placeLabels,
  projectStreets,
  smoothBearing,
  spreadLabels
} from './projection'
import { buildPlacesUrl, parsePlaces } from './places'
import { parseStreetPaths } from './streets'
import { PLACE_GROUPS, getPlaceGroup } from './config'
import type { FieldOfView, Place, PlacedLabel } from './types'

const AMSTERDAM = { latitude: 52.3676, longitude: 4.9041 }
const FIELD_OF_VIEW: FieldOfView = { horizontalDegrees: 60, verticalDegrees: 40 }
const LEVEL_AIM = { headingDegrees: 0, pitchDegrees: 0, rollDegrees: 0 }

const makePlace = (id: string, latitude: number, longitude: number): Place => ({
  id,
  name: `Place ${id}`,
  category: 'cafe',
  group: 'food',
  latitude,
  longitude
})

describe('getDistanceMeters', () => {
  it('measures nothing between a point and itself', () => {
    expect(getDistanceMeters(AMSTERDAM, AMSTERDAM)).toBeCloseTo(0)
  })

  it('measures a degree of latitude as its known length', () => {
    const northward = { latitude: AMSTERDAM.latitude + 1, longitude: AMSTERDAM.longitude }

    expect(getDistanceMeters(AMSTERDAM, northward)).toBeCloseTo(111_195, -2)
  })

  it('measures the same distance in either direction', () => {
    const other = { latitude: 52.372, longitude: 4.897 }

    expect(getDistanceMeters(AMSTERDAM, other)).toBeCloseTo(getDistanceMeters(other, AMSTERDAM))
  })

  it('shortens a degree of longitude by the latitude it is measured at', () => {
    const eastward = { latitude: AMSTERDAM.latitude, longitude: AMSTERDAM.longitude + 1 }

    expect(getDistanceMeters(AMSTERDAM, eastward)).toBeLessThan(111_195)
  })
})

describe('getBearingDegrees', () => {
  it.each([
    ['north', 0.01, 0, 0],
    ['east', 0, 0.01, 90],
    ['south', -0.01, 0, 180],
    ['west', 0, -0.01, 270]
  ])('points %s', (_direction, latitudeStep, longitudeStep, expected) => {
    const target = {
      latitude: AMSTERDAM.latitude + latitudeStep,
      longitude: AMSTERDAM.longitude + longitudeStep
    }

    expect(getBearingDegrees(AMSTERDAM, target)).toBeCloseTo(expected, 1)
  })

  it('reports a bearing inside a single turn', () => {
    const southWest = { latitude: AMSTERDAM.latitude - 0.01, longitude: AMSTERDAM.longitude - 0.01 }

    const bearing = getBearingDegrees(AMSTERDAM, southWest)

    expect(bearing).toBeGreaterThan(180)
    expect(bearing).toBeLessThan(270)
  })
})

describe('getScreenPlacement', () => {
  it('centres what the camera points straight at', () => {
    const placement = getScreenPlacement(0, 0, LEVEL_AIM, FIELD_OF_VIEW)

    expect(placement).toEqual({ xPercent: 50, yPercent: 50, isInView: true, isInFront: true })
  })

  it.each([
    ['right', 30, 100],
    ['left', 330, 0]
  ])('puts a bearing a half view to the %s at the frame edge', (_side, bearing, expected) => {
    const placement = getScreenPlacement(bearing, 0, LEVEL_AIM, FIELD_OF_VIEW)

    expect(placement.xPercent).toBeCloseTo(expected)
    expect(placement.isInView).toBe(true)
  })

  it('drops what sits behind the camera', () => {
    expect(getScreenPlacement(180, 0, LEVEL_AIM, FIELD_OF_VIEW).isInView).toBe(false)
  })

  it('crosses the wrap at north without jumping to the far edge', () => {
    const placement = getScreenPlacement(
      350,
      0,
      { ...LEVEL_AIM, headingDegrees: 10 },
      FIELD_OF_VIEW
    )

    expect(placement.xPercent).toBeGreaterThan(0)
    expect(placement.xPercent).toBeLessThan(50)
  })

  it('draws the frame in perspective, not in proportion', () => {
    const quarterOff = getScreenPlacement(15, 0, LEVEL_AIM, FIELD_OF_VIEW)

    expect(quarterOff.xPercent).toBeCloseTo(
      50 + (Math.tan(Math.PI / 12) / Math.tan(Math.PI / 6)) * 50
    )
  })

  it('drives labels down the frame as the camera is raised', () => {
    const raised = getScreenPlacement(0, 0, { ...LEVEL_AIM, pitchDegrees: 10 }, FIELD_OF_VIEW)

    expect(raised.yPercent).toBeGreaterThan(50)
  })

  it('drives labels up the frame as the camera is lowered', () => {
    const lowered = getScreenPlacement(0, 0, { ...LEVEL_AIM, pitchDegrees: -10 }, FIELD_OF_VIEW)

    expect(lowered.yPercent).toBeLessThan(50)
  })

  it('drops what the camera has been raised past', () => {
    const overhead = getScreenPlacement(0, 0, { ...LEVEL_AIM, pitchDegrees: 80 }, FIELD_OF_VIEW)

    expect(overhead.isInView).toBe(false)
  })

  it('leaves the roll to the layer, which turns as a whole', () => {
    const rolled = getScreenPlacement(0, 0, { ...LEVEL_AIM, rollDegrees: 45 }, FIELD_OF_VIEW)

    expect(rolled).toEqual({ xPercent: 50, yPercent: 50, isInView: true, isInFront: true })
  })
})

describe('smoothBearing', () => {
  it('closes part of the gap toward the reported bearing', () => {
    expect(smoothBearing(100, 120, 0.5)).toBeCloseTo(110)
  })

  it('crosses north the short way rather than the whole turn round', () => {
    expect(smoothBearing(350, 10, 0.5)).toBeCloseTo(0)
  })

  it('stays inside a single turn on the way back past north', () => {
    const blended = smoothBearing(10, 350, 0.5)

    expect(blended).toBeCloseTo(0)
    expect(blended).toBeGreaterThanOrEqual(0)
  })

  it('holds still when there is nothing to close', () => {
    expect(smoothBearing(42, 42, 0.2)).toBeCloseTo(42)
  })
})

describe('getVerticalFieldOfView', () => {
  it('matches the horizontal view on a square frame', () => {
    expect(getVerticalFieldOfView(60, 1)).toBeCloseTo(60)
  })

  it('narrows on a frame wider than it is tall', () => {
    expect(getVerticalFieldOfView(60, 16 / 9)).toBeLessThan(60)
  })

  it('widens on a portrait frame, which is how a phone is held', () => {
    expect(getVerticalFieldOfView(60, 9 / 16)).toBeGreaterThan(60)
  })
})

describe('getGroundElevation', () => {
  it('puts what is streets away on the horizon', () => {
    expect(getGroundElevation(400, 1.6)).toBeCloseTo(0, 0)
  })

  it('puts what is a stride away down near your feet', () => {
    expect(getGroundElevation(1.6, 1.6)).toBeCloseTo(-45)
  })

  it('drops further below the horizon the closer a place gets', () => {
    expect(getGroundElevation(10, 1.6)).toBeLessThan(getGroundElevation(100, 1.6))
  })

  it('looks straight down at something underfoot', () => {
    expect(getGroundElevation(0, 1.6)).toBeCloseTo(-90)
  })
})

describe('placeLabels', () => {
  const LIMITS = {
    eyeHeightMeters: 1.6,
    maximumLabels: 12,
    rowHeightPercent: 0,
    columnWidthPercent: 0
  }
  const ahead = makePlace('ahead', AMSTERDAM.latitude + 0.001, AMSTERDAM.longitude)
  const behind = makePlace('behind', AMSTERDAM.latitude - 0.001, AMSTERDAM.longitude)
  const far = makePlace('far', AMSTERDAM.latitude + 0.004, AMSTERDAM.longitude)

  it('keeps only what falls inside the frame', () => {
    const labels = placeLabels([ahead, behind], AMSTERDAM, LEVEL_AIM, FIELD_OF_VIEW, LIMITS)

    expect(labels.map(({ place }) => place.id)).toEqual(['ahead'])
  })

  it('orders the furthest first, so the nearest label draws over it', () => {
    const labels = placeLabels([ahead, far], AMSTERDAM, LEVEL_AIM, FIELD_OF_VIEW, LIMITS)

    expect(labels.map(({ place }) => place.id)).toEqual(['far', 'ahead'])
  })

  it('keeps only the nearest, once the frame is full', () => {
    const labels = placeLabels([far, ahead], AMSTERDAM, LEVEL_AIM, FIELD_OF_VIEW, {
      ...LIMITS,
      maximumLabels: 1
    })

    expect(labels.map(({ place }) => place.id)).toEqual(['ahead'])
  })

  it('carries the distance and bearing it placed each label by', () => {
    const [label] = placeLabels([ahead], AMSTERDAM, LEVEL_AIM, FIELD_OF_VIEW, LIMITS)

    expect(label.bearingDegrees).toBeCloseTo(0, 1)
    expect(label.distanceMeters).toBeCloseTo(111, 0)
  })

  it('draws a nearer place lower in the frame than a far one', () => {
    const [distant, near] = placeLabels([ahead, far], AMSTERDAM, LEVEL_AIM, FIELD_OF_VIEW, LIMITS)

    expect(near.yPercent).toBeGreaterThan(distant.yPercent)
  })

  it('turns the whole frame when the heading is corrected', () => {
    const corrected = placeLabels(
      [ahead],
      AMSTERDAM,
      { ...LEVEL_AIM, headingDegrees: 15 },
      FIELD_OF_VIEW,
      LIMITS
    )

    expect(corrected[0].xPercent).toBeLessThan(50)
  })

  it('lifts the further of two labels sharing a column clear of the nearer one', () => {
    const [distant, near] = placeLabels([ahead, far], AMSTERDAM, LEVEL_AIM, FIELD_OF_VIEW, {
      ...LIMITS,
      rowHeightPercent: 7,
      columnWidthPercent: 30
    })

    expect(near.yPercent - distant.yPercent).toBeGreaterThan(7)
  })
})

describe('getPlaceGroup', () => {
  it.each([
    ['a street by its kind', '', '', 'street', 'streets'],
    ['a road by its tag', 'highway', 'residential', 'house', 'streets'],
    ['a restaurant', 'amenity', 'restaurant', 'house', 'food'],
    ['a bakery, which is tagged as a shop', 'shop', 'bakery', 'house', 'food'],
    ['a clothes shop', 'shop', 'clothes', 'house', 'shops'],
    ['a museum', 'tourism', 'museum', 'house', 'landmarks'],
    ['a memorial', 'historic', 'memorial', 'house', 'landmarks'],
    ['a bench', 'amenity', 'bench', 'house', 'other']
  ])('files %s under %s', (_description, key, value, kind, expected) => {
    expect(getPlaceGroup(key, value, kind)).toBe(expected)
  })

  it('offers a group for everything it can return', () => {
    const offered = PLACE_GROUPS.map(({ id }) => id)
    const produced = [
      getPlaceGroup('', '', 'street'),
      getPlaceGroup('amenity', 'restaurant', 'house'),
      getPlaceGroup('shop', 'clothes', 'house'),
      getPlaceGroup('tourism', 'museum', 'house'),
      getPlaceGroup('amenity', 'bench', 'house')
    ]

    produced.forEach((group) => expect(offered).toContain(group))
  })
})

describe('parseStreetPaths', () => {
  const way = (geometry: unknown, id = 1): unknown => ({
    type: 'way',
    id,
    geometry,
    tags: { name: 'Damrak', highway: 'residential' }
  })

  it('reads the node chain a way is drawn through', () => {
    const paths = parseStreetPaths({
      elements: [
        way([
          { lat: 52.1, lon: 4.2 },
          { lat: 52.2, lon: 4.3 }
        ])
      ]
    })

    expect(paths).toEqual([
      {
        id: 'way/1',
        name: 'Damrak',
        points: [
          { latitude: 52.1, longitude: 4.2 },
          { latitude: 52.2, longitude: 4.3 }
        ]
      }
    ])
  })

  it('drops a way with only one point, which draws no line', () => {
    expect(parseStreetPaths({ elements: [way([{ lat: 52.1, lon: 4.2 }])] })).toEqual([])
  })

  it('drops a point whose coordinates are not numbers', () => {
    const paths = parseStreetPaths({
      elements: [
        way([
          { lat: 52.1, lon: 4.2 },
          { lat: 'north', lon: 4.3 },
          { lat: 52.3, lon: 4.4 }
        ])
      ]
    })

    expect(paths[0].points).toHaveLength(2)
  })

  it.each([[null], [{}], [{ elements: 'not a list' }], [{ elements: [42, null] }]])(
    'reads nothing out of a malformed response',
    (payload) => {
      expect(parseStreetPaths(payload)).toEqual([])
    }
  )
})

describe('projectStreets', () => {
  const northward = {
    id: 'way/1',
    name: 'Damrak',
    points: [
      { latitude: AMSTERDAM.latitude + 0.001, longitude: AMSTERDAM.longitude },
      { latitude: AMSTERDAM.latitude + 0.002, longitude: AMSTERDAM.longitude }
    ]
  }

  it('projects a street ahead into a drawable run', () => {
    const [run] = projectStreets([northward], AMSTERDAM, LEVEL_AIM, FIELD_OF_VIEW, 1.6)

    expect(run.name).toBe('Damrak')
    expect(run.points).toHaveLength(2)
  })

  it('draws the further point higher, so the street runs toward the horizon', () => {
    const [run] = projectStreets([northward], AMSTERDAM, LEVEL_AIM, FIELD_OF_VIEW, 1.6)
    const [near, far] = run.points

    expect(far.yPercent).toBeLessThan(near.yPercent)
  })

  it('drops a street entirely behind the camera', () => {
    const behind = {
      ...northward,
      points: northward.points.map(({ latitude, longitude }) => ({
        latitude: AMSTERDAM.latitude - (latitude - AMSTERDAM.latitude),
        longitude
      }))
    }

    expect(projectStreets([behind], AMSTERDAM, LEVEL_AIM, FIELD_OF_VIEW, 1.6)).toEqual([])
  })

  it('cuts a street that passes the camera into separate runs', () => {
    const throughTheViewer = {
      ...northward,
      points: [
        { latitude: AMSTERDAM.latitude + 0.002, longitude: AMSTERDAM.longitude },
        { latitude: AMSTERDAM.latitude + 0.001, longitude: AMSTERDAM.longitude },
        { latitude: AMSTERDAM.latitude - 0.001, longitude: AMSTERDAM.longitude },
        { latitude: AMSTERDAM.latitude - 0.002, longitude: AMSTERDAM.longitude }
      ]
    }

    const runs = projectStreets([throughTheViewer], AMSTERDAM, LEVEL_AIM, FIELD_OF_VIEW, 1.6)

    expect(runs).toHaveLength(1)
    expect(runs[0].points).toHaveLength(2)
  })
})

describe('spreadLabels', () => {
  const at = (id: string, xPercent: number): PlacedLabel => ({
    place: makePlace(id, 0, 0),
    distanceMeters: 10,
    bearingDegrees: 0,
    xPercent,
    yPercent: 50
  })

  it('leaves the first label exactly where it landed', () => {
    expect(spreadLabels([at('one', 50)], 7, 30)[0].yPercent).toBe(50)
  })

  it('lifts each label that shares a column with one already placed', () => {
    const spread = spreadLabels([at('one', 50), at('two', 52), at('three', 54)], 7, 30)

    expect(spread.map(({ yPercent }) => yPercent)).toEqual([50, 43, 36])
  })

  it('leaves a label in its own column alone', () => {
    const spread = spreadLabels([at('left', 10), at('right', 90)], 7, 30)

    expect(spread.map(({ yPercent }) => yPercent)).toEqual([50, 50])
  })

  it('keeps the labels and their order', () => {
    const spread = spreadLabels([at('one', 50), at('two', 52)], 7, 30)

    expect(spread.map(({ place }) => place.id)).toEqual(['one', 'two'])
  })
})

describe('formatDistance', () => {
  it.each([
    [4, '4 m'],
    [420, '420 m'],
    [999, '999 m'],
    [1000, '1.0 km'],
    [2540, '2.5 km']
  ])('writes %i metres as %s', (meters, expected) => {
    expect(formatDistance(meters)).toBe(expected)
  })
})

describe('buildPlacesUrl', () => {
  it('asks around the given point', () => {
    const url = new URL(buildPlacesUrl(AMSTERDAM, 250, 40))

    expect(url.searchParams.get('lat')).toBe('52.3676')
    expect(url.searchParams.get('lon')).toBe('4.9041')
    expect(url.searchParams.get('limit')).toBe('40')
  })

  it('gives the radius in the kilometres the service expects', () => {
    const url = new URL(buildPlacesUrl(AMSTERDAM, 250, 40))

    expect(url.searchParams.get('radius')).toBe('0.25')
  })
})

describe('parsePlaces', () => {
  const feature = (
    properties: Record<string, unknown>,
    coordinates: unknown = [4.9, 52.3]
  ): unknown => ({ type: 'Feature', properties, geometry: { type: 'Point', coordinates } })

  it('reads a named feature and the tag that describes it', () => {
    const places = parsePlaces({
      features: [
        feature({ osm_type: 'N', osm_id: 12, name: 'Cafe Bruin', type: 'house', osm_value: 'cafe' })
      ]
    })

    expect(places).toEqual([
      {
        id: 'N12',
        name: 'Cafe Bruin',
        category: 'cafe',
        group: 'food',
        latitude: 52.3,
        longitude: 4.9
      }
    ])
  })

  it('reads longitude before latitude, which is the order GeoJSON writes them', () => {
    const [place] = parsePlaces({
      features: [feature({ osm_id: 1, name: 'Dam', type: 'locality' }, [4.8923, 52.3731])]
    })

    expect(place.latitude).toBeCloseTo(52.3731)
    expect(place.longitude).toBeCloseTo(4.8923)
  })

  it('drops anything with no name to show', () => {
    expect(parsePlaces({ features: [feature({ osm_id: 2, type: 'house' })] })).toEqual([])
  })

  it.each([['city'], ['state'], ['country'], ['other']])(
    'drops a %s, which is too large to stand anywhere',
    (type) => {
      expect(parsePlaces({ features: [feature({ osm_id: 3, name: 'Amsterdam', type })] })).toEqual(
        []
      )
    }
  )

  it('keeps only the first of a name, since one square is also its footway', () => {
    const places = parsePlaces({
      features: [
        feature({ osm_id: 4, name: 'Dam', type: 'locality', osm_value: 'square' }),
        feature({ osm_id: 5, name: 'Dam', type: 'street', osm_value: 'footway' })
      ]
    })

    expect(places).toEqual([
      { id: 'X4', name: 'Dam', category: 'square', group: 'other', latitude: 52.3, longitude: 4.9 }
    ])
  })

  it('falls back to the feature kind when no tag describes it', () => {
    const [place] = parsePlaces({
      features: [feature({ osm_id: 6, name: 'Unlabelled', type: 'street' })]
    })

    expect(place.category).toBe('street')
  })

  it.each([[null], [{}], [{ features: 'not a list' }], [{ features: [42, null] }]])(
    'reads nothing out of a malformed response',
    (payload) => {
      expect(parsePlaces(payload)).toEqual([])
    }
  )

  it('drops a feature whose coordinates are not numbers', () => {
    expect(parsePlaces({ features: [feature({ osm_id: 7, name: 'Broken' }, ['a', 'b'])] })).toEqual(
      []
    )
  })
})
