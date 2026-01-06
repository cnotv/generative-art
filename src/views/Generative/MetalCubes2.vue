<script setup lang="ts">
import * as THREE from "three";
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useRoute } from "vue-router";
import { video } from "@/utils/video";
import { controls } from "@/utils/control";
import { stats } from "@/utils/stats";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { animateTimeline } from "@webgamekit/animation";
import { getLights, instanceMatrixMesh } from "@webgamekit/threejs";
import { getRoundedBox } from "@/utils/custom-models";
import { times } from "@/utils/lodash";

const statsEl = ref(null);
const canvas = ref(null);
const route = useRoute();
const animationId = ref(0);

/**
 * Reflection
 * https://github.com/mrdoob/three.js/blob/master/examples/webgl_materials_cubemap.html
 * https://threejs.org/examples/#webgl_animation_skinning_ik
 * https://paulbourke.net/panorama/cubemaps/
 */
const cubeFaces = ["px", "nx", "py", "ny", "pz", "nz"];
const urls = cubeFaces.map(
  (code) => new URL(`../../assets/cubemaps/stairs/${code}.jpg`, import.meta.url).href
);
const reflection = new THREE.CubeTextureLoader().load(urls);

onMounted(() => {
  init(
    (canvas.value as unknown) as HTMLCanvasElement,
    (statsEl.value as unknown) as HTMLElement
  ),
    statsEl.value!;
});

onBeforeUnmount(() => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value);
  }
});

const init = (canvas: HTMLCanvasElement, statsEl: HTMLElement) => {
  const config = {
    size: 20,
    intervals: 90,
    cameraDistance: 50,
    reflection: true,
    reflectivity: 0.2,
    roughness: 0.3,
    metalness: 0.8,
    transmission: 1,
  };
  // Set stats
  stats.init(route, statsEl);

  // Set configuration and start setup
  controls.create(
    config,
    route,
    {
      size: {},
      reflectivity: {},
      roughness: {},
      metalness: {},
      transmission: {},
    },
    () => {
      if (animationId.value) {
        cancelAnimationFrame(animationId.value);
      }
      setup();
    }
  );
  const positions = generatePositions();

  const setup = () => {
    // Init canvas
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000); // Set background color to black
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      400
    );
    const orbit = new OrbitControls(camera, renderer.domElement);
    camera.position.set(config.size / 2, 0, config.cameraDistance);
    // camera.lookAt(20, 0, 0);

    // Define the timeline and animations
    const cubesTimeline: Timeline[] = [
      {
        interval: [config.intervals, config.intervals],
        action: (cube) => {
          cube.rotation.x += THREE.MathUtils.degToRad(1);
        },
      },
      {
        delay: config.intervals,
        interval: [config.intervals, config.intervals],
        action: (cube) => {
          cube.rotation.y += THREE.MathUtils.degToRad(1);
        },
      },
    ];

    const cubeMesh = getCube(config);
    const cubes = instanceMatrixMesh(
      cubeMesh,
      scene,
      positions.map((position) => ({
        position,
        scale: [config.size, config.size, config.size],
      }))
    );

    getLights(scene, { directionalLightIntensity: 10 });

    // Start recording video if URL has query string ?video=true
    video.record(canvas, route);

    const animate = () => {
      stats.start(route); // Stats counter start if URL has query string ?stats=true
      animationId.value = requestAnimationFrame(animate) / 1;

      cubesUpdates(cubes, camera, scene, positions, config);

      // cubes.forEach((cube, i) => {
      //   animateTimeline(cubesTimeline, animationId.value, cube);
      // });

      animateTimeline(
        [{ start: 0, action: () => (camera.position.z += -1) }],
        animationId.value
      );
      renderer.render(scene, camera);

      // Stop recording after X frames
      video.stop(renderer.info.render.frame, route);

      stats.end(route); // Stats counter finish
    };
    animate();
  };
  setup();
};

const cubesUpdates = (
  cubes: THREE.Mesh[],
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  positions: CoordinateTuple[],
  config: any
) => {};

const generatePositions = (): CoordinateTuple[] => {
  const size = 20;
  const gap = size * 2;
  const scale = 11;
  const xCount = Math.ceil(window.innerWidth / scale / gap) * 2 + 1;
  const yCount = Math.ceil(window.innerHeight / scale / gap) * 2 + 1;

  const positions = times(xCount, (xi) => {
    const x = -window.innerWidth / scale + xi * gap;
    return times(yCount, (yi) => {
      const y = -window.innerHeight / scale + yi * gap;
      return times(100, (i) => [x, y, -i * size * 2]);
    }).flat();
  }).flat();

  return positions;
};

const getCube = (
  config: any,
  { size, position }: { size?: CoordinateTuple; position?: CoordinateTuple } = {}
) => {
  const depth = 0.02 * (size ? size[0] : 1);
  const geometry = getRoundedBox(size ?? [1, 1, 1], depth, 10);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x333333,
    envMap: reflection,
    reflectivity: config.reflectivity,
    roughness: config.roughness,
    metalness: config.metalness,
    transmission: config.transmission,
  });
  const cube = new THREE.Mesh(geometry, material);

  if (position) cube.position.set(...position);

  return cube;
};
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>
