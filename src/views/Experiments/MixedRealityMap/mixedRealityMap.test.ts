import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getBearingDegrees,
  getDistanceMeters,
  getHorizontalPlacement,
  formatDistance,
  isAdjacentStreetPath,
  placeLabels,
  offsetGeoPoint,
  projectStreetLines,
  smoothBearing,
  spreadLabels
} from './projection'
import { buildPlacesUrl, clusterPlacesByAddress, parsePlaces } from './places'
import { fetchStreetPaths, parseStreetPaths } from './streets'
import { buildMinimap, getMinimapPoint } from './minimap'
import { buildImageUrl, parsePlaceImage } from './imagery'
import { OVERPASS_ENDPOINTS, PLACE_GROUPS, getPlaceGroup } from './config'
import type { Place, PlacedLabel } from './types'

const AMSTERDAM = { latitude: 52.3676, longitude: 4.9041 }
const HORIZONTAL_FIELD_OF_VIEW = 60

const makePlace = (id: string, latitude: number, longitude: number): Place => ({
  id,
  name: `Place ${id}`,
  category: 'cafe',
  group: 'food',
  osmReference: `node/${id}`,
  houseNumber: null,
  street: null,
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

describe('getHorizontalPlacement', () => {
  it('centres what the camera points straight at', () => {
    const placement = getHorizontalPlacement(0, 0, HORIZONTAL_FIELD_OF_VIEW)

    expect(placement).toEqual({ xPercent: 50, isInView: true, isInFront: true })
  })

  it.each([
    ['right', 30, 100],
    ['left', 330, 0]
  ])('puts a bearing a half view to the %s at the frame edge', (_side, bearing, expected) => {
    const placement = getHorizontalPlacement(bearing, 0, HORIZONTAL_FIELD_OF_VIEW)

    expect(placement.xPercent).toBeCloseTo(expected)
    expect(placement.isInView).toBe(true)
  })

  it('drops what sits behind the camera', () => {
    expect(getHorizontalPlacement(180, 0, HORIZONTAL_FIELD_OF_VIEW).isInView).toBe(false)
  })

  it('crosses the wrap at north without jumping to the far edge', () => {
    const placement = getHorizontalPlacement(350, 10, HORIZONTAL_FIELD_OF_VIEW)

    expect(placement.xPercent).toBeGreaterThan(0)
    expect(placement.xPercent).toBeLessThan(50)
  })

  it('draws the frame in perspective, not in proportion', () => {
    const quarterOff = getHorizontalPlacement(15, 0, HORIZONTAL_FIELD_OF_VIEW)

    expect(quarterOff.xPercent).toBeCloseTo(
      50 + (Math.tan(Math.PI / 12) / Math.tan(Math.PI / 6)) * 50
    )
  })

  it('bounds a point near the side plane rather than letting the divide explode', () => {
    // Just short of a right angle off centre, the tangent that turns a bearing into a screen
    // position would otherwise send this to a six-figure percent.
    const edgeOn = getHorizontalPlacement(89.99, 0, HORIZONTAL_FIELD_OF_VIEW)

    expect(edgeOn.isInFront).toBe(true)
    expect(Math.abs(edgeOn.xPercent)).toBeLessThanOrEqual(1050)
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

describe('placeLabels', () => {
  const LIMITS = {
    maximumLabels: 12,
    rowHeightPercent: 0,
    columnWidthPercent: 0,
    baseRowPercent: 50
  }
  const ahead = makePlace('ahead', AMSTERDAM.latitude + 0.001, AMSTERDAM.longitude)
  const behind = makePlace('behind', AMSTERDAM.latitude - 0.001, AMSTERDAM.longitude)
  const far = makePlace('far', AMSTERDAM.latitude + 0.004, AMSTERDAM.longitude)
  const cluster = (place: Place): Place[] => [place]

  it('keeps only what falls inside the frame', () => {
    const labels = placeLabels(
      [cluster(ahead), cluster(behind)],
      AMSTERDAM,
      0,
      HORIZONTAL_FIELD_OF_VIEW,
      LIMITS
    )

    expect(labels.map((label) => label.places[0].id)).toEqual(['ahead'])
  })

  it('orders the furthest first, so the nearest label draws over it', () => {
    const labels = placeLabels(
      [cluster(ahead), cluster(far)],
      AMSTERDAM,
      0,
      HORIZONTAL_FIELD_OF_VIEW,
      LIMITS
    )

    expect(labels.map((label) => label.places[0].id)).toEqual(['far', 'ahead'])
  })

  it('keeps only the nearest, once the frame is full', () => {
    const labels = placeLabels(
      [cluster(far), cluster(ahead)],
      AMSTERDAM,
      0,
      HORIZONTAL_FIELD_OF_VIEW,
      {
        ...LIMITS,
        maximumLabels: 1
      }
    )

    expect(labels.map((label) => label.places[0].id)).toEqual(['ahead'])
  })

  it('carries the distance and bearing it placed each label by', () => {
    const [label] = placeLabels([cluster(ahead)], AMSTERDAM, 0, HORIZONTAL_FIELD_OF_VIEW, LIMITS)

    expect(label.bearingDegrees).toBeCloseTo(0, 1)
    expect(label.distanceMeters).toBeCloseTo(111, 0)
  })

  it('draws every card on the same fixed row, whatever the distance', () => {
    const [distant, near] = placeLabels(
      [cluster(ahead), cluster(far)],
      AMSTERDAM,
      0,
      HORIZONTAL_FIELD_OF_VIEW,
      LIMITS
    )

    expect(near.yPercent).toBe(LIMITS.baseRowPercent)
    expect(distant.yPercent).toBe(LIMITS.baseRowPercent)
  })

  it('turns the whole frame when the heading is corrected', () => {
    const corrected = placeLabels([cluster(ahead)], AMSTERDAM, 15, HORIZONTAL_FIELD_OF_VIEW, LIMITS)

    expect(corrected[0].xPercent).toBeLessThan(50)
  })

  it('pushes the further of two labels sharing a column clear of the nearer one', () => {
    const [distant, near] = placeLabels(
      [cluster(ahead), cluster(far)],
      AMSTERDAM,
      0,
      HORIZONTAL_FIELD_OF_VIEW,
      { ...LIMITS, rowHeightPercent: 7, columnWidthPercent: 30 }
    )

    expect(near.yPercent - distant.yPercent).toBe(7)
  })

  it('gives a cluster of several tenants a taller card, so it pushes the next one further', () => {
    const shop = makePlace('shop', AMSTERDAM.latitude + 0.001, AMSTERDAM.longitude)
    const cafe = makePlace('cafe', AMSTERDAM.latitude + 0.001, AMSTERDAM.longitude)

    const [distant, near] = placeLabels(
      [[shop, cafe], cluster(far)],
      AMSTERDAM,
      0,
      HORIZONTAL_FIELD_OF_VIEW,
      { ...LIMITS, rowHeightPercent: 7, columnWidthPercent: 30 }
    )

    expect(near.places).toHaveLength(2)
    expect(near.yPercent - distant.yPercent).toBe(14)
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

describe('offsetGeoPoint', () => {
  it.each([
    ['north', 0, 1, 0],
    ['south', 180, -1, 0],
    ['east', 90, 0, 1],
    ['west', 270, 0, -1]
  ])('steps %s', (_direction, bearing, latitudeSign, longitudeSign) => {
    const stepped = offsetGeoPoint(AMSTERDAM, bearing, 50)

    expect(Math.sign(stepped.latitude - AMSTERDAM.latitude)).toBe(latitudeSign)
    expect(Math.sign(stepped.longitude - AMSTERDAM.longitude)).toBe(longitudeSign)
  })

  it('steps the distance it was asked for', () => {
    const stepped = offsetGeoPoint(AMSTERDAM, 37, 50)

    expect(getDistanceMeters(AMSTERDAM, stepped)).toBeCloseTo(50, 0)
  })

  it('goes nowhere when asked for nothing', () => {
    expect(offsetGeoPoint(AMSTERDAM, 90, 0)).toEqual(AMSTERDAM)
  })
})

describe('projectStreetLines', () => {
  const ROW_PERCENT = 75
  const northward = {
    id: 'way/1',
    name: 'Damrak',
    points: [
      { latitude: AMSTERDAM.latitude + 0.0005, longitude: AMSTERDAM.longitude },
      { latitude: AMSTERDAM.latitude + 0.002, longitude: AMSTERDAM.longitude }
    ]
  }
  const project = (paths: (typeof northward)[], headingDegrees = 0) =>
    projectStreetLines(paths, AMSTERDAM, headingDegrees, HORIZONTAL_FIELD_OF_VIEW, ROW_PERCENT)

  it('keeps one point per node of the path', () => {
    const [line] = project([northward])

    expect(line.points).toHaveLength(northward.points.length)
    expect(line.name).toBe('Damrak')
  })

  it('draws every point of the line on the same fixed row', () => {
    const [line] = project([northward])

    line.points.forEach((point) => expect(point.yPercent).toBe(ROW_PERCENT))
    expect(line.namePoint.yPercent).toBe(ROW_PERCENT)
  })

  it('drops a street entirely behind the camera', () => {
    const behind = {
      ...northward,
      points: northward.points.map(({ latitude, longitude }) => ({
        latitude: AMSTERDAM.latitude - (latitude - AMSTERDAM.latitude),
        longitude
      }))
    }

    expect(project([behind])).toEqual([])
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

    const lines = project([throughTheViewer])

    expect(lines).toHaveLength(1)
    expect(lines[0].points).toHaveLength(2)
  })
})

describe('isAdjacentStreetPath', () => {
  const throughTheViewer = {
    id: 'way/1',
    name: 'Damstraat',
    points: [
      { latitude: AMSTERDAM.latitude - 0.001, longitude: AMSTERDAM.longitude },
      { latitude: AMSTERDAM.latitude + 0.001, longitude: AMSTERDAM.longitude }
    ]
  }

  it('keeps a street whose nearest stretch passes right by the viewer', () => {
    expect(isAdjacentStreetPath(throughTheViewer, AMSTERDAM, 20)).toBe(true)
  })

  it('drops a street that only comes close between two far-apart nodes, not at either one', () => {
    const passingBetweenNodes = {
      id: 'way/2',
      name: 'Nieuwezijds Voorburgwal',
      points: [
        { latitude: AMSTERDAM.latitude, longitude: AMSTERDAM.longitude + 0.002 },
        { latitude: AMSTERDAM.latitude, longitude: AMSTERDAM.longitude - 0.002 }
      ]
    }

    // Both nodes sit roughly 150m out to either side, well past the threshold, but the segment
    // between them runs directly past the viewer: the nearest point is on the segment.
    expect(isAdjacentStreetPath(passingBetweenNodes, AMSTERDAM, 20)).toBe(true)
  })

  it('drops a street that stays out of reach along its whole length', () => {
    const farAway = {
      id: 'way/3',
      name: 'Prinsengracht',
      points: [
        { latitude: AMSTERDAM.latitude + 0.0005, longitude: AMSTERDAM.longitude },
        { latitude: AMSTERDAM.latitude + 0.002, longitude: AMSTERDAM.longitude }
      ]
    }

    expect(isAdjacentStreetPath(farAway, AMSTERDAM, 20)).toBe(false)
  })
})

describe('getMinimapPoint', () => {
  it('puts the viewer at the middle of their own map', () => {
    expect(getMinimapPoint(AMSTERDAM, AMSTERDAM, 200)).toEqual({ x: 50, y: 50 })
  })

  it.each([
    ['north', 0.001, 0, 50, 'above'],
    ['south', -0.001, 0, 50, 'below'],
    ['east', 0, 0.001, 0, 'right'],
    ['west', 0, -0.001, 0, 'left']
  ])('draws what is %s of you %s the middle', (_direction, latitudeStep, longitudeStep) => {
    const point = getMinimapPoint(
      AMSTERDAM,
      {
        latitude: AMSTERDAM.latitude + latitudeStep,
        longitude: AMSTERDAM.longitude + longitudeStep
      },
      200
    )

    if (latitudeStep > 0) expect(point.y).toBeLessThan(50)
    if (latitudeStep < 0) expect(point.y).toBeGreaterThan(50)
    if (longitudeStep > 0) expect(point.x).toBeGreaterThan(50)
    if (longitudeStep < 0) expect(point.x).toBeLessThan(50)
  })

  it('puts the map edge exactly a radius away', () => {
    const northEdge = {
      latitude: AMSTERDAM.latitude + 200 / 111_320,
      longitude: AMSTERDAM.longitude
    }

    expect(getMinimapPoint(AMSTERDAM, northEdge, 200).y).toBeCloseTo(0, 1)
  })

  it('shrinks what it draws when the map covers more ground', () => {
    const point = { latitude: AMSTERDAM.latitude + 0.001, longitude: AMSTERDAM.longitude }
    const near = getMinimapPoint(AMSTERDAM, point, 100)
    const far = getMinimapPoint(AMSTERDAM, point, 400)

    expect(Math.abs(far.y - 50)).toBeLessThan(Math.abs(near.y - 50))
  })
})

describe('buildMinimap', () => {
  const nearby = makePlace('nearby', AMSTERDAM.latitude + 0.0005, AMSTERDAM.longitude)
  const distant = makePlace('distant', AMSTERDAM.latitude + 0.05, AMSTERDAM.longitude)
  const street = {
    id: 'way/1',
    name: 'Damrak',
    points: [
      { latitude: AMSTERDAM.latitude + 0.0005, longitude: AMSTERDAM.longitude },
      { latitude: AMSTERDAM.latitude + 0.001, longitude: AMSTERDAM.longitude }
    ]
  }

  it('keeps what falls on the map and drops what does not', () => {
    const view = buildMinimap([street], [nearby, distant], AMSTERDAM, 200)

    expect(view.places.map(({ id }) => id)).toEqual(['nearby'])
    expect(view.streets.map(({ id }) => id)).toEqual(['way/1'])
  })

  it('keeps a street whole when only part of it lands, so the map clips it', () => {
    const crossing = {
      ...street,
      points: [
        { latitude: AMSTERDAM.latitude, longitude: AMSTERDAM.longitude },
        { latitude: AMSTERDAM.latitude + 0.05, longitude: AMSTERDAM.longitude }
      ]
    }

    const [drawn] = buildMinimap([crossing], [], AMSTERDAM, 200).streets

    expect(drawn.points).toHaveLength(2)
  })

  it('drops a street that is nowhere near', () => {
    const elsewhere = {
      ...street,
      points: street.points.map(({ latitude, longitude }) => ({
        latitude: latitude + 0.05,
        longitude
      }))
    }

    expect(buildMinimap([elsewhere], [], AMSTERDAM, 200).streets).toEqual([])
  })

  it('carries the group, so the map can be filtered like the labels', () => {
    const [place] = buildMinimap([], [nearby], AMSTERDAM, 200).places

    expect(place.group).toBe('food')
  })
})

describe('buildImageUrl', () => {
  it('asks around the place, at the size it will be shown', () => {
    const url = new URL(buildImageUrl(AMSTERDAM, 120, 480))

    expect(url.searchParams.get('ggscoord')).toBe('52.3676|4.9041')
    expect(url.searchParams.get('ggsradius')).toBe('120')
    expect(url.searchParams.get('pithumbsize')).toBe('480')
  })

  it('asks for a cross-origin answer, without which a browser is refused', () => {
    const url = new URL(buildImageUrl(AMSTERDAM, 120, 480))

    expect(url.searchParams.get('origin')).toBe('*')
  })
})

describe('parsePlaceImage', () => {
  const page = (index: number, title: string, source?: string) => ({
    index,
    title,
    ...(source ? { thumbnail: { source } } : {})
  })

  it('reads the picture and where it came from', () => {
    const image = parsePlaceImage(
      { query: { pages: { '1': page(0, 'Dam Square', 'https://example.test/dam.jpg') } } },
      'Dam Square'
    )

    expect(image).toEqual({
      title: 'Dam Square',
      thumbnailUrl: 'https://example.test/dam.jpg',
      pageUrl: 'https://en.wikipedia.org/wiki/Dam_Square'
    })
  })

  it('takes the nearest article that actually has a picture', () => {
    const image = parsePlaceImage(
      {
        query: {
          pages: {
            '1': page(0, 'No Picture Here'),
            '2': page(1, 'Has One', 'https://example.test/one.jpg')
          }
        }
      },
      'Has One'
    )

    expect(image?.title).toBe('Has One')
  })

  it('prefers the nearer of two that both have pictures', () => {
    const image = parsePlaceImage(
      {
        query: {
          pages: {
            '1': page(3, 'Further Bakery', 'https://example.test/far.jpg'),
            '2': page(1, 'Nearer Bakery', 'https://example.test/near.jpg')
          }
        }
      },
      'Bakery'
    )

    expect(image?.title).toBe('Nearer Bakery')
  })

  it('drops a nearby picture that is not actually of the place', () => {
    const image = parsePlaceImage(
      {
        query: {
          pages: { '1': page(0, 'Trafalgar Square', 'https://example.test/square.jpg') }
        }
      },
      'Bakerloo Line'
    )

    expect(image).toBeNull()
  })

  it.each([[null], [{}], [{ query: {} }], [{ query: { pages: {} } }], [{ query: { pages: 42 } }]])(
    'reads nothing out of a response with no picture in it',
    (payload) => {
      expect(parsePlaceImage(payload, 'Anywhere')).toBeNull()
    }
  )
})

describe('fetchStreetPaths across mirrors', () => {
  const way = {
    type: 'way',
    id: 1,
    geometry: [
      { lat: 52.1, lon: 4.2 },
      { lat: 52.2, lon: 4.3 }
    ],
    tags: { name: 'Damrak' }
  }
  const ok = () =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ elements: [way] }) })
  const failing = (status: number) => () => Promise.resolve({ ok: false, status })
  const htmlUnder200 = () =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error('not JSON')) })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('takes the first mirror that answers', async () => {
    const fetchMock = vi.fn(ok)
    vi.stubGlobal('fetch', fetchMock)

    const paths = await fetchStreetPaths(AMSTERDAM, 120)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(paths).toHaveLength(1)
  })

  it('moves on from a mirror that is refusing work', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(failing(504)).mockImplementationOnce(ok)
    vi.stubGlobal('fetch', fetchMock)

    const paths = await fetchStreetPaths(AMSTERDAM, 120)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(paths).toHaveLength(1)
  })

  it('moves on from an error page served under a success status', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(htmlUnder200).mockImplementationOnce(ok)
    vi.stubGlobal('fetch', fetchMock)

    await fetchStreetPaths(AMSTERDAM, 120)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up with the last complaint once every mirror has been tried', async () => {
    const fetchMock = vi.fn(failing(500))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchStreetPaths(AMSTERDAM, 120)).rejects.toThrow('answered 500')
    expect(fetchMock).toHaveBeenCalledTimes(OVERPASS_ENDPOINTS.length)
  })

  it('stops walking the mirrors when the caller has changed its mind', async () => {
    const controller = new AbortController()
    const fetchMock = vi.fn(() => {
      controller.abort()
      return Promise.reject(new Error('aborted'))
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchStreetPaths(AMSTERDAM, 120, controller.signal)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('spreadLabels', () => {
  const at = (id: string, xPercent: number, heightPercent = 7): PlacedLabel => ({
    id,
    places: [makePlace(id, 0, 0)],
    distanceMeters: 10,
    bearingDegrees: 0,
    xPercent,
    yPercent: 50,
    heightPercent
  })

  it('leaves the first label exactly where it landed', () => {
    expect(spreadLabels([at('one', 50)], 30)[0].yPercent).toBe(50)
  })

  it('pushes each label that shares a column with one already placed', () => {
    const spread = spreadLabels([at('one', 50), at('two', 52), at('three', 54)], 30)

    expect(spread.map(({ yPercent }) => yPercent)).toEqual([50, 43, 36])
  })

  it('leaves a label in its own column alone', () => {
    const spread = spreadLabels([at('left', 10), at('right', 90)], 30)

    expect(spread.map(({ yPercent }) => yPercent)).toEqual([50, 50])
  })

  it('stops pushing at the top of the frame rather than off it', () => {
    const stack = Array.from({ length: 12 }, (_unused, index) => at(`label-${index}`, 50))

    const spread = spreadLabels(stack, 30)

    spread.forEach(({ yPercent }) => expect(yPercent).toBeGreaterThanOrEqual(7))
  })

  it('keeps the labels and their order', () => {
    const spread = spreadLabels([at('one', 50), at('two', 52)], 30)

    expect(spread.map(({ id }) => id)).toEqual(['one', 'two'])
  })

  it('pushes a taller card by its own height rather than a fixed guess', () => {
    const spread = spreadLabels([at('tall', 50, 21), at('next', 52)], 30)

    expect(spread[1].yPercent).toBe(50 - 21)
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
        osmReference: 'node/12',
        name: 'Cafe Bruin',
        category: 'cafe',
        group: 'food',
        houseNumber: null,
        street: null,
        latitude: 52.3,
        longitude: 4.9
      }
    ])
  })

  it('reads the house number and street, for grouping tenants of one address', () => {
    const [place] = parsePlaces({
      features: [
        feature({
          osm_type: 'N',
          osm_id: 12,
          name: 'Cafe Bruin',
          type: 'house',
          housenumber: '12',
          street: 'Damstraat'
        })
      ]
    })

    expect(place.houseNumber).toBe('12')
    expect(place.street).toBe('Damstraat')
  })

  it.each([
    ['N', 'node/12'],
    ['W', 'way/12'],
    ['R', 'relation/12']
  ])('spells out a %s reference for the map link', (osmType, expected) => {
    const [place] = parsePlaces({
      features: [feature({ osm_type: osmType, osm_id: 12, name: 'Somewhere', type: 'house' })]
    })

    expect(place.osmReference).toBe(expected)
  })

  it.each([
    ['an unknown type', { osm_type: 'Z', osm_id: 12 }],
    ['no type at all', { osm_id: 12 }],
    ['no id', { osm_type: 'N' }],
    ['an id that is not a number', { osm_type: 'N', osm_id: 'twelve' }]
  ])('links nowhere rather than to a broken page, given %s', (_case, identity) => {
    const [place] = parsePlaces({
      features: [feature({ ...identity, name: 'Somewhere', type: 'house' })]
    })

    expect(place.osmReference).toBeNull()
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
      {
        id: 'X4',
        osmReference: null,
        name: 'Dam',
        category: 'square',
        group: 'other',
        houseNumber: null,
        street: null,
        latitude: 52.3,
        longitude: 4.9
      }
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

describe('clusterPlacesByAddress', () => {
  const tenant = (id: string, name: string, houseNumber: string | null, street: string | null) => ({
    ...makePlace(id, AMSTERDAM.latitude, AMSTERDAM.longitude),
    name,
    houseNumber,
    street
  })

  it('clusters tenants of the same street and house number, neither renamed nor merged', () => {
    const itsu = tenant('a', 'itsu', '554', 'Oxford Street')
    const pret = tenant('b', 'Pret A Manger', '554', 'Oxford Street')

    const clusters = clusterPlacesByAddress([itsu, pret])

    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toEqual(expect.arrayContaining([itsu, pret]))
  })

  it('leaves a place with no house number standing on its own', () => {
    const clusters = clusterPlacesByAddress([
      tenant('a', 'itsu', '554', 'Oxford Street'),
      tenant('b', 'Wafflemeister', null, 'Oxford Street')
    ])

    expect(clusters).toHaveLength(2)
    expect(clusters.map((cluster) => cluster.length)).toEqual([1, 1])
  })

  it('never clusters the same number on two different streets', () => {
    const clusters = clusterPlacesByAddress([
      tenant('a', 'itsu', '12', 'Oxford Street'),
      tenant('b', 'The Cumberland Hotel', '12', 'Great Cumberland Place')
    ])

    expect(clusters).toHaveLength(2)
  })
})
