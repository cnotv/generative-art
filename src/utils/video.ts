import type { RouteLocationNormalizedLoaded } from "vue-router";

// Outside your setup function
let chunks: Blob[] = [];
let mediaRecorder: MediaRecorder;
const totalFrames = 400;


const saveVideo = () => {
  const blob = new Blob(chunks, { 'type': 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'animation.webm';
  a.click();
  window.URL.revokeObjectURL(url);
};

const record = (canvas: HTMLCanvasElement, route: RouteLocationNormalizedLoaded) => {
  const isRecording = route.query.record === 'true';
  if (isRecording) {
    chunks = [];
    const stream = canvas.captureStream(30);
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm', bitsPerSecond: 100000000 });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) {
        chunks.push(e.data);
      }
    };
    mediaRecorder.onstop = saveVideo;
    mediaRecorder.start();
  };
};

const stop = (frameCount: number, route: RouteLocationNormalizedLoaded) => {
  const isRecording = route.query.record === 'true';
  if (isRecording) {
    if (frameCount >= totalFrames) {
      if (mediaRecorder) {
        mediaRecorder.stop();
      }
    }
  }
}

export const video = {
  record,
  stop
}