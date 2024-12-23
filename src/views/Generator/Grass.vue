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

interface GenerateConfig {
  density: number;
  scale: number;
  scaleMin: number;
  area: number;
  points: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
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
      density: { min: 0 },
      scale: { min: 0 },
      scaleMin: { min: 0 },
      area: { min: 0 },
      points: { min: 0 },
      offsetX: {},
      offsetY: {},
      offsetZ: {},
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
        rotation: [0, -0.5, 0],
        scale: [config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin]
      }, // Flat front
      {
        position: [3, -1, 0],
        rotation: [0, 1, 0],
        scale: [config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin]
      },// Flat side
      {
        position: [3, -3, 0],
        rotation: [0, 0, 0],
        scale: [config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin, config.grass.scale + config.grass.scaleMin]
      },// Flat side
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

const getGrass = (config: GenerateConfig) => {
  // Define the control points for the length curve (curvature along the length)
  // Vector values respectively: bend sides, blade silhouette, bend front 
  const lengthCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.01, 0, 0.05),  // Base
    new THREE.Vector3(0, 0.40, 0.15),  // Midpoint 1
    // new THREE.Vector3(0, 0.50, 0.1),  // Midpoint 2
    // new THREE.Vector3(0, 0.60, 0.1),  // Midpoint 3
    new THREE.Vector3(0, 0.7, 0.05)  // Tip
  ]);

  // Define the control points for the side curve (curvature on the sides)
  // Vector values respectively: Width blade
  const sideCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.05, 0, 0),  // Base
    new THREE.Vector3(0.04, 0.25, 0),  // Midpoint 1
    // new THREE.Vector3(0.03, 0.5, 0),  // Midpoint 2
    // new THREE.Vector3(0.02, 0.75, 0),  // Midpoint 3
    new THREE.Vector3(0, 1, 0)  // Tip
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

