export type RecorderFormat = 'webm' | 'mp4';

export type RecorderConfig = {
  canvas: HTMLCanvasElement;
  duration?: number;
  format?: RecorderFormat;
  frameRate?: number;
};

export type RecorderState = {
  isRecording: boolean;
  elapsed: number;
  blob: Blob | null;
};

export type StateChangeCallback = (state: RecorderState) => void;

export type Recorder = {
  start: () => void;
  stop: () => Promise<Blob>;
  getState: () => RecorderState;
  onStateChange: (callback: StateChangeCallback) => () => void;
  destroy: () => void;
};
