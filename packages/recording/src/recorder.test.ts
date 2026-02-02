import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRecorder } from './recorder';

const createMockCanvas = () => {
  const mockStream = {
    getTracks: () => [{ stop: vi.fn() }],
  } as unknown as MediaStream;

  const canvas = {
    width: 800,
    height: 600,
    captureStream: vi.fn(() => mockStream),
  } as unknown as HTMLCanvasElement;

  return canvas;
};

type MockMediaRecorderInstance = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  state: 'inactive' | 'recording' | 'paused';
  ondataavailable: ((event: BlobEvent) => void) | null;
  onstop: (() => void) | null;
};

const createMockMediaRecorderClass = () => {
  let instance: MockMediaRecorderInstance | null = null;

  const MockMediaRecorder = vi.fn(function (
    this: MockMediaRecorderInstance
  ) {
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onstop = null;

    this.start = vi.fn(() => {
      this.state = 'recording';
    });

    this.stop = vi.fn(() => {
      this.state = 'inactive';
      const blob = new Blob(['test-data'], { type: 'video/webm' });
      this.ondataavailable?.({ data: blob } as BlobEvent);
      this.onstop?.();
    });

    instance = this;
    return this;
  });

  return {
    MockMediaRecorder,
    getInstance: () => instance,
  };
};

describe('createRecorder', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockMediaRecorderClass: ReturnType<typeof createMockMediaRecorderClass>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockCanvas = createMockCanvas();
    mockMediaRecorderClass = createMockMediaRecorderClass();

    vi.stubGlobal('MediaRecorder', mockMediaRecorderClass.MockMediaRecorder);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create a recorder with default state', () => {
      const recorder = createRecorder({ canvas: mockCanvas });
      const state = recorder.getState();

      expect(state.isRecording).toBe(false);
      expect(state.elapsed).toBe(0);
      expect(state.blob).toBeNull();

      recorder.destroy();
    });

    it('should accept custom frame rate', () => {
      const recorder = createRecorder({ canvas: mockCanvas, frameRate: 60 });

      recorder.start();
      expect(mockCanvas.captureStream).toHaveBeenCalledWith(60);

      recorder.destroy();
    });

    it('should use default frame rate of 30 when not specified', () => {
      const recorder = createRecorder({ canvas: mockCanvas });

      recorder.start();
      expect(mockCanvas.captureStream).toHaveBeenCalledWith(30);

      recorder.destroy();
    });
  });

  describe('start', () => {
    it('should start recording and update state', () => {
      const recorder = createRecorder({ canvas: mockCanvas });

      recorder.start();
      const state = recorder.getState();

      expect(state.isRecording).toBe(true);
      expect(mockMediaRecorderClass.getInstance()?.start).toHaveBeenCalled();

      recorder.destroy();
    });

    it('should not start if already recording', () => {
      const recorder = createRecorder({ canvas: mockCanvas });

      recorder.start();
      const instance = mockMediaRecorderClass.getInstance();
      recorder.start();

      expect(instance?.start).toHaveBeenCalledTimes(1);

      recorder.destroy();
    });

    it('should track elapsed time while recording', () => {
      const recorder = createRecorder({ canvas: mockCanvas });

      recorder.start();
      vi.advanceTimersByTime(1000);

      const state = recorder.getState();
      expect(state.elapsed).toBe(1000);

      recorder.destroy();
    });
  });

  describe('stop', () => {
    it('should stop recording and return blob', async () => {
      const recorder = createRecorder({ canvas: mockCanvas });

      recorder.start();
      const blob = await recorder.stop();

      expect(blob).toBeInstanceOf(Blob);
      expect(recorder.getState().isRecording).toBe(false);

      recorder.destroy();
    });

    it('should update state with blob after stop', async () => {
      const recorder = createRecorder({ canvas: mockCanvas });

      recorder.start();
      await recorder.stop();

      const state = recorder.getState();
      expect(state.blob).toBeInstanceOf(Blob);

      recorder.destroy();
    });

    it('should reject if not recording', async () => {
      const recorder = createRecorder({ canvas: mockCanvas });

      await expect(recorder.stop()).rejects.toThrow('Not recording');

      recorder.destroy();
    });
  });

  describe('auto-stop with duration', () => {
    it('should auto-stop after specified duration', async () => {
      const recorder = createRecorder({ canvas: mockCanvas, duration: 5000 });

      recorder.start();
      vi.advanceTimersByTime(5000);

      await vi.waitFor(() => {
        expect(recorder.getState().isRecording).toBe(false);
      });

      recorder.destroy();
    });

    it('should not auto-stop if duration is not specified', () => {
      const recorder = createRecorder({ canvas: mockCanvas });

      recorder.start();
      vi.advanceTimersByTime(10000);

      expect(recorder.getState().isRecording).toBe(true);

      recorder.destroy();
    });
  });

  describe('onStateChange', () => {
    it('should notify listeners when state changes', () => {
      const recorder = createRecorder({ canvas: mockCanvas });
      const callback = vi.fn();

      recorder.onStateChange(callback);
      recorder.start();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ isRecording: true })
      );

      recorder.destroy();
    });

    it('should return unsubscribe function', () => {
      const recorder = createRecorder({ canvas: mockCanvas });
      const callback = vi.fn();

      const unsubscribe = recorder.onStateChange(callback);
      unsubscribe();
      recorder.start();

      expect(callback).not.toHaveBeenCalled();

      recorder.destroy();
    });

    it('should notify on elapsed time updates', () => {
      const recorder = createRecorder({ canvas: mockCanvas });
      const callback = vi.fn();

      recorder.onStateChange(callback);
      recorder.start();
      callback.mockClear();

      vi.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ elapsed: 100 })
      );

      recorder.destroy();
    });
  });

  describe('destroy', () => {
    it('should stop recording if active', () => {
      const recorder = createRecorder({ canvas: mockCanvas });

      recorder.start();
      const instance = mockMediaRecorderClass.getInstance();
      recorder.destroy();

      expect(instance?.stop).toHaveBeenCalled();
    });

    it('should clear all listeners', () => {
      const recorder = createRecorder({ canvas: mockCanvas });
      const callback = vi.fn();

      recorder.onStateChange(callback);
      recorder.destroy();
      callback.mockClear();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('format support', () => {
    it.each([
      ['webm', 'video/webm'],
      ['mp4', 'video/mp4'],
    ] as const)(
      'should create MediaRecorder with %s format',
      (format, mimeType) => {
        const recorder = createRecorder({ canvas: mockCanvas, format });

        recorder.start();

        expect(mockMediaRecorderClass.MockMediaRecorder).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ mimeType })
        );

        recorder.destroy();
      }
    );

    it('should default to webm format', () => {
      const recorder = createRecorder({ canvas: mockCanvas });

      recorder.start();

      expect(mockMediaRecorderClass.MockMediaRecorder).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ mimeType: 'video/webm' })
      );

      recorder.destroy();
    });
  });
});
