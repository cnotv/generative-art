// Based on the Coding Train video https://youtu.be/Lv9gyZZJPE0
import Stats from "stats.js";
import * as dat from "dat.gui";

export const init = (canvas, statsEl) => {
  const config = {
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

  const onChangeConfig = () => worker.postMessage({ workerConfig: config });
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

  // Detached mode
  // https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas#asynchronous_display_of_frames_produced_by_an_offscreencanvas
  const offscreen = canvas.transferControlToOffscreen();
  const worker = new Worker("../src/worker.js"); // <-- path has to be set like this
  worker.postMessage(
    {
      canvas: offscreen,
      workerConfig: config
    },
    [offscreen]
  );

  worker.onmessage = (event) => {
    if (event.data.begin) {
      stats.begin();
    }
    if (event.data.end) {
      stats.end();
    }
    if (event.data.message) {
      console.log(event.data.message);
    }
  };

  // Synchronous mode
  // https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas#synchronous_display_of_frames_produced_by_an_offscreencanvas
  // const canvas = document.getElementById("app").getContext("bitmaprenderer");
  // const offscreen = new OffscreenCanvas(256, 256);
  // const ctx = offscreen.getContext("2d");
  // ctx.fillStyle = `rgba(212, 241, 249, 1`;
  // ctx.fillRect(0, 0, 10, 10);
  // const bitmap = offscreen.transferToImageBitmap();
  // canvas.transferFromImageBitmap(bitmap);
  // worker.postMessage(config);
  // worker.onmessage = (event) => canvas.transferFromImageBitmap(event.data);
};
export const stop = clearInterval(init);
