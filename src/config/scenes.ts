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
  },
  mushroom: {
    show: true,
    amount: 500,
    size: 5,
    sizeDelta: 3,
    area: 1,
  },
}
