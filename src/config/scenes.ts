export const complexAnimation = {
  tree: {
    show: true,
    amount: 500,
    size: 5,
    sizeDelta: 3,
    area: 1,
  },
  grass: {
    show: true,
    amount: 2000000,
    size: 0.8,
    sizeDelta: 3,
    area: 1,
  },
  mushroom: {
    show: true,
    amount: 1000,
    size: 5,
    sizeDelta: 3,
    area: 1,
  },
  fov: 60,
  walk: false,
  aspect: window.innerWidth / window.innerHeight,
  near: 0.1,
  far: 1000.0,
  offset: {
    x: -20,
    y: 20,
    z: 40
  },
  lookAt: {
    x: 0,
    y: 10,
    z: 50
  },
}
