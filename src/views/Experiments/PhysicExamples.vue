<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { video } from '@/utils/video';
import { controls } from '@/utils/control';
import { stats } from '@/utils/stats';
import RAPIER from '@dimforge/rapier3d';
import { animateTimeline, createLights, getEnvironment, getGround, getModel } from '@/utils/threeJs';
import { getBall, getCube } from '@/utils/models';
import { times } from '@/utils/lodash';

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
    const { renderer, scene, camera, clock, orbit } = getEnvironment(canvas, { camera: { position: [-7, 16, -23] } });
    createLights(scene, {directionalLightIntensity: config.directional.intensity });
    getGround(scene, world, { worldSize: 1000.0 });

    const length = 40;
    const height = 10;
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
    
    const experiments = [
      getBall(scene, world, { weight: 10,restitution: 0.7, metalness: 0.3, reflectivity: 0.2, roughness: 0.8, transmission: 0.5, color: 0xff3333 }), // Rubber
      await getModel(scene, world, 'balloon.glb', {rotation: [-0.5,0,1], scale: [15,15,15], size: 0.5, damping: 1.5, restitution: -0.5, weight: 1, color: 0xff2222, opacity: 0.9}), // Balloon
      await getModel(scene, world, 'bowling.glb', {scale: [0.4,0.4,0.4], size: 0.8, weight: 50, restitution: -0.3}), // Bowling
      await getModel(scene, world, 'paper_low.glb', {rotation: [1,3,0], scale: [3,3,3], size: 2, damping: 1.5, restitution: -0.5, weight: 6}), // Paper
      await getModel(scene, world, 'tennis.glb', {scale: [1.8,1.8,1.8], size: 2, weight: 10, restitution: 0.5}), // Tennis
      getBall(scene, world, {size: 0.6, weight: 6, restitution: 0.2, color: 0xffffff, roughness: 0.9}), // Ping Pong
    ];

    const rows = 3;
    const gaps = { x: 15, y: 0, z: 15 };
    times(experiments.length, (i) => {
      const x = -17 + (i % rows) * gaps.x;
      const y = 15;
      const z = 5 + Math.floor(i / rows) * -gaps.z;
      experiments[i].initialValues.position = [x, y, z];
      experiments[i].rigidBody.setTranslation({ x, y, z }, true);
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
        interval: [10, 300], action: () => {
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

