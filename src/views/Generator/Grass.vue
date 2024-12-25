<script setup lang="ts">
import * as THREE from 'three';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createLights, getRenderer, instanceMatrixMesh, setThirdPersonCamera } from '@/utils/threeJs';
import { times } from '@/utils/lodash';
import { step } from 'three/examples/jsm/nodes/Nodes.js';

interface GenerateConfig {
  density: number;
  scale: number;
  scaleMin: number;
  area: number;
  points: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  lengthCurve: {
    base1: number;
    base2: number;
    base3: number;
    mid1: number;
    mid2: number;
    mid3: number;
    tip1: number;
    tip2: number;
    tip3: number;
  };
  sideCurve: {
    base1: number;
    base2: number;
    base3: number;
    mid1: number;
    mid2: number;
    mid3: number;
    tip1: number;
    tip2: number;
    tip3: number;
  };
}

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();
const animationId = ref(0);

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement,
  ), statsEl.value!;
})

onBeforeUnmount(() => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value);
  }
});

const init = (canvas: HTMLCanvasElement, statsEl: HTMLElement, ) => {
  const config = {
    grass: {
      density: 250,
      scale: 1.5,
      scaleMin: 0.5,
      area: 4,
      points: 10,
      offsetX: -2,
      offsetY: 0,
      offsetZ: 0,
      lengthCurve: {
        base1: 0.01,
        base2: 0.00,
        base3: 0.05,
        mid1: 0.00,
        mid2: 0.4,
        mid3: 0.15,
        tip1: 0.0,
        tip2: 0.7,
        tip3: 0.005,
      },
      sideCurve: {
        base1: 0.05,
        base2: 0.0,
        base3: 0.0,
        mid1: 0.04,
        mid2: 0.25,
        mid3: 0.0,
        tip1: 0,
        tip2: 1,
        tip3: 0,
      },
    },
    camera: {
      fixed: true,
      near: 2,
      aspect: window.innerWidth / window.innerHeight,
      far: 1000,
      fov: 8,
      offset: {
        x: -20,
        y: 20,
        z: 40
      },
      lookAt: {
        x: 0,
        y: 0,
        z: 0,
      },
    },
  }
  // Set stats
  stats.init(route, statsEl);

  // Set configuration and start setup
  controls.create(config, route, {
    grass: {
      // density: { min: 0 },
      // scale: { min: 0 },
      // scaleMin: { min: 0 },
      // area: { min: 0 },
      // points: { min: 0 },
      // offsetX: {},
      // offsetY: {},
      // offsetZ: {},
      lengthCurve: {
        base1: { min: 0, step: 0.01 },
        base2: { min: 0, step: 0.01 },
        base3: { min: 0, step: 0.01 },
        mid1: { min: 0, step: 0.01 },
        mid2: { min: 0, step: 0.01 },
        mid3: { min: 0, step: 0.01 },
        tip1: { min: 0, step: 0.01 },
        tip2: { min: 0, step: 0.01 },
        tip3: { min: 0, step: 0.01 },
      },
      sideCurve: {
        base1: { min: 0, step: 0.01 },
        base2: { min: 0, step: 0.01 },
        base3: { min: 0, step: 0.01 },
        mid1: { min: 0, step: 0.01 },
        mid2: { min: 0, step: 0.01 },
        mid3: { min: 0, step: 0.01 },
        tip1: { min: 0, step: 0.01 },
        tip2: { min: 0, step: 0.01 },
        tip3: { min: 0, step: 0.01 },
      },
    },
    camera: {
      fixed: {},
      near: {},
      aspect: {},
      far: {},
      fov: {},
      // offset: {
      //   x: {},
      //   y: {},
      //   z: {},
      // },
    },
  }, () => {
    if (animationId.value) {
      cancelAnimationFrame(animationId.value);
    }
    setup()
  });

  const setup = async () => {
    const renderer = getRenderer(canvas);
    const camera = new THREE.PerspectiveCamera(config.camera.fov, config.camera.aspect, config.camera.near, config.camera.far);
    const scene = new THREE.Scene();
    const orbit = new OrbitControls(camera, renderer.domElement);
    const matrixProps = [
      ...generateProps(config.grass),
      {
        position: [3, 1, 0],
        rotation: [0, -0.45, 0],
        scale: [config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin]
      }, // Flat front view
      {
        position: [3, -1, 0],
        rotation: [0, 1, 0],
        scale: [config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin]
      },// Flat side view
      {
        position: [3, -3, 0],
        rotation: [0, 0, 0],
        scale: [config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin]
      },// Perspective view
    ] as ModelOptions[]

    camera.position.set(-30, 25, 30);
    createLights(scene);

    // Populate grass
    const grass = getGrass(config.grass);
    instanceMatrixMesh(grass, scene, matrixProps);

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      animationId.value = requestAnimationFrame(animate);
      if (config.camera.fixed) {
        setThirdPersonCamera(camera, config.camera, grass);
      }

      orbit.update();

      renderer.render( scene, camera );
      video.stop(renderer.info.render.frame ,route);
      stats.end(route);
    }
    animate();
  }
  setup();
}

const generateProps = (config: GenerateConfig) => times(config.density * config.area, () => {
  const size = Math.random() * config.scale + config.scaleMin;
  const getPosition = () => Math.random() * config.area - config.area/2;

  return {
    position: [getPosition() + config.offsetX, 0, getPosition() + config.offsetY + config.offsetZ],
    rotation: [0, Math.random() * 360, 0],
    scale: [size, size, size]
  }
});


// const lengthCurve = new THREE.CatmullRomCurve3([
//     // new THREE.Vector3(0.01, 0, 0.05),  // Base
//     // new THREE.Vector3(0, 0.40, 0.15),  // Midpoint 1
//     // // new THREE.Vector3(0, 0.50, 0.1),  // Midpoint 2
//     // // new THREE.Vector3(0, 0.60, 0.1),  // Midpoint 3
//     // new THREE.Vector3(0, 0.7, 0.05)  // Tip
//     new THREE.Vector3(config.lengthCurve.base, 0, config.lengthCurve.mid1),  // Base
//     new THREE.Vector3(0, config.lengthCurve.mid2, config.lengthCurve.mid3),  // Midpoint 1
//     // new THREE.Vector3(0, 0.50, 0.1),  // Midpoint 2
//     // new THREE.Vector3(0, 0.60, 0.1),  // Midpoint 3
//   ]);

//   // Define the control points for the side curve (curvature on the sides)
//   // Vector values respectively: Width blade
//   const sideCurve = new THREE.CatmullRomCurve3([
//     new THREE.Vector3(0.05, 0, 0),  // Base
//     new THREE.Vector3(0.04, 0.25, 0),  // Midpoint 1
//     // new THREE.Vector3(0.03, 0.5, 0),  // Midpoint 2
//     // new THREE.Vector3(0.02, 0.75, 0),  // Midpoint 3
//     new THREE.Vector3(0, 1, 0)  // Tip
//   ]);

const getGrass = (config: GenerateConfig) => {
  // Define the control points for the length curve (curvature along the length)
  // Vector values respectively: bend sides, blade silhouette, bend front 
  const lengthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(config.lengthCurve.base1, config.lengthCurve.base2, config.lengthCurve.base3),  // Base
    new THREE.Vector3(config.lengthCurve.mid1, config.lengthCurve.mid2, config.lengthCurve.mid3),  // Midpoint 1
    // new THREE.Vector3(0, 0.50, 0.1),  // Midpoint 2
    // new THREE.Vector3(0, 0.60, 0.1),  // Midpoint 3
    new THREE.Vector3(config.lengthCurve.tip1, config.lengthCurve.tip2, config.lengthCurve.tip3)  // Tip
  ]);

  // Define the control points for the side curve (curvature on the sides)
  // Vector values respectively: Width blade
  const sideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(config.sideCurve.base1, config.sideCurve.base2, config.sideCurve.base3),  // Base
    new THREE.Vector3(config.sideCurve.mid1, config.sideCurve.mid2, config.sideCurve.mid3),  // Midpoint 1
    // new THREE.Vector3(0.03, 0.5, 0),  // Midpoint 2
    // new THREE.Vector3(0.02, 0.75, 0),  // Midpoint 3
    new THREE.Vector3(config.sideCurve.tip1, config.sideCurve.tip2, config.sideCurve.tip3)  // Tip
  ]);

  // Define the control points for the length curve (curvature along the length)
  const lengthPoints = lengthCurve.getPoints(config.points);

  // Define the control points for the side curve (curvature on the sides)
  const sidePoints = sideCurve.getPoints(config.points);

  // Define the vertices for the grass blade
  const vertices = [];
  for (let i = 0; i < lengthPoints.length; i++) {
    const lengthPoint = lengthPoints[i];
    const sidePoint = sidePoints[i];
    vertices.push(lengthPoint.x - sidePoint.x, lengthPoint.y, lengthPoint.z);
    vertices.push(lengthPoint.x + sidePoint.x, lengthPoint.y, lengthPoint.z);
  }

  // Define the indices for the triangular faces
  const indices = [];
  for (let i = 0; i < lengthPoints.length - 1; i++) {
    const baseIndex = i * 2;
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
    indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
  }

  // Define the geometry for the grass blade
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Define the material for the grass blade
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x33bb33,
    side: THREE.DoubleSide,
  });

  // Create the mesh for the grass blade
  const blade = new THREE.Mesh(geometry, material);
  blade.castShadow = false;
  blade.receiveShadow = true;

  return blade;
};

</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>

