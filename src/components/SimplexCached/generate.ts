// Based on the Coding Train video https://youtu.be/Lv9gyZZJPE0
import Stats from "stats.js";
import * as dat from "dat.gui";
import { createNoise4D } from '../../utils/simplex.js';
let simplex = createNoise4D();
// Create a cache for the frames
let frameCache: ImageBitmap[] = [];
const totalFrames = 400;

interface Config {
  pixelSize: number;
  noiseSize: number;
  speed: number;
  lightAmount: number;
  fluidity: number;
  windowSize: number;
  frameCount: number;
  width: number;
  height: number;
}

export const init = (canvas: HTMLCanvasElement, statsEl: HTMLElement): void => {
  const config: Config = {
    pixelSize: 4,
    noiseSize: 0.03,
    speed: 200,
    lightAmount: 2.2,
    fluidity: 0.2,
    windowSize: 1,
    frameCount: 0,
    width: window.innerWidth,
    height: window.innerHeight
  };
  
  const gui = new dat.GUI();
  const control = gui.addFolder("control");
  
  // FPS stats
  const stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  statsEl.appendChild(stats.dom);

  // Create an offscreen canvas
  let offscreenCanvas = new OffscreenCanvas(config.width, config.height);

  // Function to generate a frame
  function generateFrame(frameCount: number) {
    console.log(frameCount);

    stats.begin();

    const ctx = offscreenCanvas.getContext("2d");
    if (!ctx) return;

    canvas.width = config.width * config.windowSize;
    canvas.height = config.height * config.windowSize;

    ctx.fillStyle = "#ccc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let x, y;
    const waveLength = (Math.PI * 2 * config.frameCount) / config.speed;
    const z = config.fluidity * Math.cos(waveLength);
    const w = config.fluidity * Math.sin(waveLength);

    for (y = 0; y < canvas.height / config.pixelSize; y++) {
      for (x = 0; x < canvas.width / config.pixelSize; x++) {
        const lightness = Math.round(
          (simplex(x * config.noiseSize, y * config.noiseSize, z, w) + 1) /
            config.lightAmount
        );
        // const lightness = Math.round(Math.random());
        // const lightness = Math.random();

        ctx.fillStyle = `rgba(212, 241, 249, ${lightness})`;
        ctx.fillRect(
          x * config.pixelSize,
          y * config.pixelSize,
          config.pixelSize,
          config.pixelSize
        );
      }
    }

    stats.end();

    // Convert the offscreen canvas to an ImageBitmap and store it in the cache
    frameCache[frameCount] = offscreenCanvas.transferToImageBitmap();
  }

  // Generate all frames ahead of time
  for (let frameCount = 0; frameCount < totalFrames; frameCount++) {
    generateFrame(frameCount);
  }

  // Now you can use the pre-calculated frames in your draw function
  function draw() {
    if (!frameCache[totalFrames -1]) return;
    // console.log(config.frameCount)
    config.frameCount++;
    let ctx = canvas.getContext('2d');
    if (!ctx) return;
    const count = config.frameCount % totalFrames
    // console.log(count)
    // console.log(frameCache[count])
    ctx.drawImage(frameCache[count], 0, 0);
  }
    
  const onChangeConfig = () => console.log('ok');
  control.open();
  control.add(config, "pixelSize").min(1).max(10).onChange(onChangeConfig);
  control
    .add(config, "noiseSize")
    .min(0.0001)
    .max(0.1)
    .onChange(onChangeConfig);
  control.add(config, "speed").min(80).max(500).onChange(onChangeConfig);
  control.add(config, "lightAmount").min(1).max(5).onChange(onChangeConfig);
  control.add(config, "fluidity").min(0).max(1).onChange(onChangeConfig);
  control.add(config, "windowSize").min(0.1).max(1).onChange(onChangeConfig);

  setInterval(draw, 1);
  // draw();
};

// Synchronous mode
// https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas#synchronous_display_of_frames_produced_by_an_offscreencanvas
// const canvas = document.getElementById("app").getContext("bitmaprenderer");
// const offscreen = new OffscreenCanvas(256, 256);
// const ctx = offscreen.getContext("2d");
// ctx.fillRect(0, 0, 10, 10);
// const bitmap = offscreen.transferToImageBitmap();
// canvas.transferFromImageBitmap(bitmap);
