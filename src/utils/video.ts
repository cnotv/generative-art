import type { RouteLocationNormalizedLoaded } from "vue-router";

// TODO: Use state management?
const config = {
  chunks: [] as Blob[],
  isRecording: false,
  mediaRecorder: null as MediaRecorder | null
};

const convertToMp4 = async (webmBlob: Blob, filename: string = 'animation'): Promise<void> => {
  try {
    // Convert blob to base64
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });
    reader.readAsDataURL(webmBlob);
    const base64Data = await base64Promise;

    // Send to serverless function for conversion
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

    if (!response.ok) {
      throw new Error(`Conversion failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      // Download the converted MP4
      const url = result.videoData;
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
    } else {
      throw new Error(result.message || 'Conversion failed');
    }
  } catch (error) {
    console.error('MP4 conversion failed:', error);
    // Fallback to WebM download
    const url = URL.createObjectURL(webmBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.webm`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
};

const saveVideo = async () => {
  // Use WebM with VP9 codec for better compatibility
  const blob = new Blob(config.chunks, { 'type': 'video/webm; codecs=vp9' });
  
  // Try to convert to MP4, fallback to WebM if conversion fails
  await convertToMp4(blob, 'animation');
};

const record = (canvas: HTMLCanvasElement, route: RouteLocationNormalizedLoaded) => {
  stop(0, route);
  const shouldRecord = !!route.query.record;
  if (shouldRecord) {
    const stream = canvas.captureStream(30);
    
    // Check for supported MIME types and use the best available
    let mimeType = 'video/webm; codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm; codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }
    }
    
    config.mediaRecorder = new MediaRecorder(
      stream,
      { mimeType, bitsPerSecond: 100000000 });
    config.isRecording = true;
    config.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) {
        config.chunks.push(e.data);
      }
    };
    config.mediaRecorder.onstop = () => {
      saveVideo().catch(console.error);
    };
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
