import type {
  RecorderConfig,
  RecorderState,
  StateChangeCallback,
  Recorder,
  RecorderFormat,
} from './types';

const getMimeType = (format: RecorderFormat): string =>
  format === 'mp4' ? 'video/mp4' : 'video/webm';

export const createRecorder = (config: RecorderConfig): Recorder => {
  const { canvas, duration, format = 'webm', frameRate = 30 } = config;

  let state: RecorderState = {
    isRecording: false,
    elapsed: 0,
    blob: null,
  };

  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  const listeners: Set<StateChangeCallback> = new Set();
  let elapsedInterval: ReturnType<typeof setInterval> | null = null;
  let autoStopTimeout: ReturnType<typeof setTimeout> | null = null;
  let startTime = 0;
  let resolveStop: ((blob: Blob) => void) | null = null;

  const notifyListeners = () => {
    listeners.forEach((callback) => callback({ ...state }));
  };

  const updateState = (updates: Partial<RecorderState>) => {
    state = { ...state, ...updates };
    notifyListeners();
  };

  const clearTimers = () => {
    if (elapsedInterval) {
      clearInterval(elapsedInterval);
      elapsedInterval = null;
    }
    if (autoStopTimeout) {
      clearTimeout(autoStopTimeout);
      autoStopTimeout = null;
    }
  };

  const start = () => {
    if (state.isRecording) return;

    const stream = canvas.captureStream(frameRate);
    const mimeType = getMimeType(format);

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    chunks = [];

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      updateState({ isRecording: false, blob });
      clearTimers();

      if (resolveStop) {
        resolveStop(blob);
        resolveStop = null;
      }
    };

    mediaRecorder.start();
    startTime = Date.now();

    updateState({ isRecording: true, elapsed: 0, blob: null });

    elapsedInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      updateState({ elapsed });
    }, 100);

    if (duration) {
      autoStopTimeout = setTimeout(() => {
        stop();
      }, duration);
    }
  };

  const stop = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!state.isRecording || !mediaRecorder) {
        reject(new Error('Not recording'));
        return;
      }

      resolveStop = resolve;
      mediaRecorder.stop();
    });
  };

  const getState = (): RecorderState => ({ ...state });

  const onStateChange = (callback: StateChangeCallback): (() => void) => {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  };

  const destroy = () => {
    if (state.isRecording && mediaRecorder) {
      mediaRecorder.stop();
    }
    clearTimers();
    listeners.clear();
    mediaRecorder = null;
  };

  return {
    start,
    stop,
    getState,
    onStateChange,
    destroy,
  };
};
