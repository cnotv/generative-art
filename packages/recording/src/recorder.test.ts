import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recordCreate } from './recorder';

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

describe('recordCreate', () => {
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
      const recorder = recordCreate({ canvas: mockCanvas });
      const state = recorder.recordGetState();

      expect(state.isRecording).toBe(false);
      expect(state.elapsed).toBe(0);
      expect(state.blob).toBeNull();

      recorder.recordDestroy();
    });

    it('should accept custom frame rate', () => {
      const recorder = recordCreate({ canvas: mockCanvas, frameRate: 60 });

      recorder.recordStart();
      expect(mockCanvas.captureStream).toHaveBeenCalledWith(60);

      recorder.recordDestroy();
    });

    it('should use default frame rate of 30 when not specified', () => {
      const recorder = recordCreate({ canvas: mockCanvas });

      recorder.recordStart();
      expect(mockCanvas.captureStream).toHaveBeenCalledWith(30);

      recorder.recordDestroy();
    });
  });

  describe('start', () => {
    it('should start recording and update state', () => {
      const recorder = recordCreate({ canvas: mockCanvas });

      recorder.recordStart();
      const state = recorder.recordGetState();

      expect(state.isRecording).toBe(true);
      expect(mockMediaRecorderClass.getInstance()?.start).toHaveBeenCalled();

      recorder.recordDestroy();
    });

    it('should not start if already recording', () => {
      const recorder = recordCreate({ canvas: mockCanvas });

      recorder.recordStart();
      const instance = mockMediaRecorderClass.getInstance();
      recorder.recordStart();

      expect(instance?.start).toHaveBeenCalledTimes(1);

      recorder.recordDestroy();
    });

    it('should track elapsed time while recording', () => {
      const recorder = recordCreate({ canvas: mockCanvas });

      recorder.recordStart();
      vi.advanceTimersByTime(1000);

      const state = recorder.recordGetState();
      expect(state.elapsed).toBe(1000);

      recorder.recordDestroy();
    });
  });

  describe('stop', () => {
    it('should stop recording and return blob', async () => {
      const recorder = recordCreate({ canvas: mockCanvas });

      recorder.recordStart();
      const blob = await recorder.recordStop();

      expect(blob).toBeInstanceOf(Blob);
      expect(recorder.recordGetState().isRecording).toBe(false);

      recorder.recordDestroy();
    });

    it('should update state with blob after stop', async () => {
      const recorder = recordCreate({ canvas: mockCanvas });

      recorder.recordStart();
      await recorder.recordStop();

      const state = recorder.recordGetState();
      expect(state.blob).toBeInstanceOf(Blob);

      recorder.recordDestroy();
    });

    it('should reject if not recording', async () => {
      const recorder = recordCreate({ canvas: mockCanvas });

      await expect(recorder.recordStop()).rejects.toThrow('Not recording');

      recorder.recordDestroy();
    });
  });

  describe('auto-stop with duration', () => {
    it('should auto-stop after specified duration', async () => {
      const recorder = recordCreate({ canvas: mockCanvas, duration: 5000 });

      recorder.recordStart();
      vi.advanceTimersByTime(5000);

      await vi.waitFor(() => {
        expect(recorder.recordGetState().isRecording).toBe(false);
      });

      recorder.recordDestroy();
    });

    it('should not auto-stop if duration is not specified', () => {
      const recorder = recordCreate({ canvas: mockCanvas });

      recorder.recordStart();
      vi.advanceTimersByTime(10000);

      expect(recorder.recordGetState().isRecording).toBe(true);

      recorder.recordDestroy();
    });
  });

  describe('onStateChange', () => {
    it('should notify listeners when state changes', () => {
      const recorder = recordCreate({ canvas: mockCanvas });
      const callback = vi.fn();

      recorder.recordOnStateChange(callback);
      recorder.recordStart();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ isRecording: true })
      );

      recorder.recordDestroy();
    });

    it('should return unsubscribe function', () => {
      const recorder = recordCreate({ canvas: mockCanvas });
      const callback = vi.fn();

      const unsubscribe = recorder.recordOnStateChange(callback);
      unsubscribe();
      recorder.recordStart();

      expect(callback).not.toHaveBeenCalled();

      recorder.recordDestroy();
    });

    it('should notify on elapsed time updates', () => {
      const recorder = recordCreate({ canvas: mockCanvas });
      const callback = vi.fn();

      recorder.recordOnStateChange(callback);
      recorder.recordStart();
      callback.mockClear();

      vi.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ elapsed: 100 })
      );

      recorder.recordDestroy();
    });
  });

  describe('destroy', () => {
    it('should stop recording if active', () => {
      const recorder = recordCreate({ canvas: mockCanvas });

      recorder.recordStart();
      const instance = mockMediaRecorderClass.getInstance();
      recorder.recordDestroy();

      expect(instance?.stop).toHaveBeenCalled();
    });

    it('should clear all listeners', () => {
      const recorder = recordCreate({ canvas: mockCanvas });
      const callback = vi.fn();

      recorder.recordOnStateChange(callback);
      recorder.recordDestroy();
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
        const recorder = recordCreate({ canvas: mockCanvas, format });

        recorder.recordStart();

        expect(mockMediaRecorderClass.MockMediaRecorder).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ mimeType })
        );

        recorder.recordDestroy();
      }
    );

    it('should default to webm format', () => {
      const recorder = recordCreate({ canvas: mockCanvas });

      recorder.recordStart();

      expect(mockMediaRecorderClass.MockMediaRecorder).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ mimeType: 'video/webm' })
      );

      recorder.recordDestroy();
    });
  });
});
