import type { RouteLocationNormalizedLoaded } from "vue-router";

// TODO: Use state management?
const config = {
  chunks: [] as Blob[],
  isRecording: false,
  mediaRecorder: null as MediaRecorder | null
};

const saveVideo = () => {
  const blob = new Blob(config.chunks, { 'type': 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'animation.webm';
  a.click();
  window.URL.revokeObjectURL(url);
};

const record = (canvas: HTMLCanvasElement, route: RouteLocationNormalizedLoaded) => {
  stop(0, route);
  const shouldRecord = !!route.query.record;
  if (shouldRecord) {
    const stream = canvas.captureStream(30);
    config.mediaRecorder = new MediaRecorder(
      stream,
      { mimeType: 'video/webm', bitsPerSecond: 100000000 });
    config.isRecording = true;
    config.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) {
        config.chunks.push(e.data);
      }
    };
    config.mediaRecorder.onstop = saveVideo;
    config.mediaRecorder.start();
  };
};

const stop = (frameCount: number, route: RouteLocationNormalizedLoaded) => {
  const shouldRecord = !!route.query.record;
  const totalFrames = isNaN(Number(route.query.record)) ? 800 : Number(route.query.record);
  if (shouldRecord) {
    if (frameCount === totalFrames) {
      if (config.mediaRecorder) {
        config.mediaRecorder.stop();
        config.chunks = [];
        config.isRecording = true;
        config.mediaRecorder = null;
      }
    }
  }
}

export const video = {
  record,
  stop
}
