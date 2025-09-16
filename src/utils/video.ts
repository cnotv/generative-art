import type { RouteLocationNormalizedLoaded } from "vue-router";

// TODO: Use state management?
const config = {
  chunks: [] as Blob[],
  isRecording: false,
  mediaRecorder: null as MediaRecorder | null
};

const download = (blob: Blob, type: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `animation.${type}`; // TODO: Set filename dynamically from title
  a.click();
  window.URL.revokeObjectURL(url);
}

const packVideo = async () => {
  try {
    const type = 'mp4';
    const blob = new Blob(config.chunks, { 'type': `video/${type}` });
    await convertToMp4(blob, 'animation');
    download(blob, type);
  } catch {
    const type = 'webm';
    const blob = new Blob(config.chunks, { 'type': `video/${type}` });
    download(blob, type);
  }
};

const convertToMp4 = async (webmBlob: Blob, filename: string = 'animation'): Promise<void> => {
  // Convert blob to base64
  console.log('Preparing file');
  const reader = new FileReader();
  const base64Promise = new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
  reader.readAsDataURL(webmBlob);
  const base64Data = await base64Promise;

  // Send to serverless function for conversion
  console.log('Requesting conversion');
  const response = await fetch('/.netlify/functions/convert-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      videoData: base64Data,
      filename
    })
  });

  return response.json();
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
    config.mediaRecorder.onstop = packVideo;
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
