<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import RAPIER from '@dimforge/rapier3d';
import { animateTimeline, createLights, getEnvironment, getGround, getModel } from '@/utils/threeJs';
import { getBall, getWalls } from '@/utils/models';
import { times } from '@/utils/lodash';
import bowlingTexture from '@/assets/bowling.png';

const statsEl = ref(null)
const canvas = ref(null)
const route = useRoute();
let gravity = { x: 0.0, y: -9.81, z: 0.0 };
let world = new RAPIER.World(gravity);

onMounted(() => {
  init(
    canvas.value as unknown as HTMLCanvasElement,
    statsEl.value as unknown as HTMLElement,
  ), statsEl.value!;
})

const init = async (canvas: HTMLCanvasElement, statsEl: HTMLElement, ) => {
  const config = {
    directional: {
      enabled: true,
      helper: false,
      intensity: 2,
    },
    ambient: {
      enabled: true,
      intensity: 2,
    },
  }
  stats.init(route, statsEl);
  controls.create(config, route, {
  }, () => {
    setup()
  });

  const setup = async () => {
    const { renderer, scene, camera, clock, orbit } = getEnvironment(canvas, { camera: { position: [-35, 80, -115] } });
    createLights(scene, {directionalLightIntensity: config.directional.intensity });
    getGround(scene, world, { worldSize: 1000.0 });
    getWalls(scene, world, { length: 200, height: 50, depth: 0.2 });

    const length = 200;
    const height = 50;
    const depth = 0.2;
    const walls = [
      { position: [0, 0, 0], size: [length, depth, length] },
      { position: [-length/2, height/2, 0], size: [depth, height, length] },
      { position: [length/2, height/2, 0], size: [depth, height, length] },
      { position: [0, height/2, length/2], size: [length, height, depth] },
      { position: [0, height/2, -length/2], size: [length, height, depth] },
      ].map(({ position, size }) => {
      getCube(scene, world, {
        color: 0xcccccc,
        size,
        position,
        type: 'fixed',
      })
    });
    
    const experiments = [] as any[];
    const balls = [
      async (position) => getBall(scene, world, { position, size: 4, weight: 120,restitution: 0.75, metalness: 0.3, reflectivity: 0.2, roughness: 0.8, transmission: 0.5, color: 0xff3333 }), // Rubber
      async (position) => await getModel(scene, world, 'balloon.glb', { position, rotation: [-0.5,0,1], scale: [70,70,70], size: 10, damping: 0.8, restitution: -0.5, weight: 5, color: Math.floor(Math.random() * 16777215), opacity: 0.9}), // Balloon
      // async (position) => await getModel(scene, world, 'bowling.glb', { position, scale: [2,2,2], size: 2, weight: 50, restitution: -0.3}), // Bowling
      async (position) => getBall(scene, world, { position, size: 15, weight: 50, restitution: -0.3, texture: bowlingTexture, color: 0xffffff, friction: 10}), // Bowling
      async (position) => await getModel(scene, world, 'paper_low.glb', { position, rotation: [Math.random() * 100,Math.random() * 100,Math.random() * 100], scale: [5,5,5], size: 3, friction: 100, angular: 10, damping: 0.2, restitution: -0.5, weight: 8}), // Paper
      async (position) => await getModel(scene, world, 'tennis.glb', { position, scale: [6,6,6], size: 6, weight: 50, friction: 5, angular: 1, restitution: 0.6}), // Tennis
      async (position) => getBall(scene, world, {position, size: 3, weight: 40, restitution: 0.8, damping: 0.1, color: 0xffffff, roughness: 0.9}), // Ping Pong
    ];
    const addBall = async (position: CoordinateTuple, pick: number) => {
      experiments.push(await balls[pick](position));
    }
      
    document.addEventListener('click', async (event) => {
      const x = - (event.clientX - window.innerWidth / 2) / 50;
      const y = - (event.clientY - window.innerHeight) / 50;

      const pick = Math.floor(Math.random() * balls.length);
      addBall([x, 70, y], pick);
    });

    const rows = 3;
    const gaps = { x: 50, y: 10, z: 50 };
    // const gaps = { x: 20, y: 10, z: 20 };
    const getSign = () => Math.random() > 0.5 ? 1 : -1;
    times(6, (i) => {
      // const x = getSign() * Math.floor(Math.random() * length / 2 - gaps.x)
      // const z = getSign() * Math.floor(Math.random() * length / 2 - gaps.z)
      
      const x = -(length / 2 - gaps.x) + (i % rows) * gaps.x;
      const y = 50 + (i + gaps.y);
      const z = 5 + Math.floor(i / rows) * -gaps.z;

      const pick = i % balls.length
      addBall([x, y, z], pick);
    });

    video.record(canvas, route);

    function animate() {
      stats.start(route);
      const delta = clock.getDelta();
      const frame = requestAnimationFrame(animate);
      world.step();

      experiments.forEach(({ mesh, rigidBody }) => {
        let position = rigidBody.translation();
        mesh.position.set(position.x, position.y, position.z);
        let rotation = rigidBody.rotation();
        mesh.rotation.set(rotation.x, rotation.y, rotation.z);
      });
      // experiments[0].mesh.position.y -= 0.1;
      animateTimeline([{
        interval: [10, 3000], action: () => {
          experiments.forEach(({ rigidBody, initialValues: { position: [x, y, z]} }) => {
            rigidBody.resetForces(true);
            rigidBody.resetTorques(true);
            rigidBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
            rigidBody.setTranslation({ x, y, z }, true);
          });
        }},
      ], frame);

      orbit.update();
      renderer.render( scene, camera );
      video.stop(renderer.info.render.frame ,route);
      stats.end(route);
    }
    animate();
  }
  setup();
}
</script>

<template>
  <div ref="statsEl"></div>
  <canvas ref="canvas"></canvas>
</template>

