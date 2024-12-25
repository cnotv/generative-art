export const complexAnimation = {
  walk: true,
  camera: {
    fixed: true,
    near: 2,
    aspect: window.innerWidth / window.innerHeight,
    far: 1000,
    fov: 60,
    offset: {
      x: -20,
      y: 20,
      z: 40
    },
    lookAt: {
      x: 0,
      y: 0,
      z: 0
    },
  },
  tree: {
    show: true,
    amount: 300,
    size: 5,
    sizeDelta: 3,
    area: 1,
  },
  grass: {
    show: true,
    amount: 1000000,
    size: 2,
    sizeDelta: 2,
    area: 1,
    lengthCurve: {
      baseX: 0,
      baseY: 0,
      baseZ: 0,
      midX: 0,
      midY: 0.28,
      midZ: 0.04,
      tipX: 0,
      tipY: 0.5,
      tipZ: -0.07,
    },
    sideCurve: {
      baseX: 0.04,
      baseY: 0,
      baseZ: 0,
      midX: 0.04,
      midY: 0,
      midZ: 0,
      tipX: 0,
      tipY: 0.5,
      tipZ: 0,
    },
  },
  mushroom: {
    show: true,
    amount: 500,
    size: 5,
    sizeDelta: 3,
    area: 1,
  },
}
