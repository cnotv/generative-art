importScripts(new URL("simplex.js", self.location));

let config;
let simplex = createNoise4D();

const draw = (canvas) => {
  postMessage({ begin: true });

  const ctx = canvas.getContext("2d");
  config.frameCount++;
  canvas.width = config.width * config.windowSize;
  canvas.height = config.height * config.windowSize;

  ctx.fillStyle = "#b4e1e9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let x, y;
  const waveLenght = (Math.PI * 2 * config.frameCount) / config.speed;
  const z = config.fluidity * Math.cos(waveLenght);
  const w = config.fluidity * Math.sin(waveLenght);

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

  postMessage({ end: true });
};

onmessage = (event) => {
  if (event.data) {
    const { canvas, workerConfig } = event.data;

    if (workerConfig) {
      config = { ...workerConfig };
    }

    if (canvas) {
      postMessage({ message: "Worker up!" });
      setInterval(draw, 1, canvas);
    }
  }
};
