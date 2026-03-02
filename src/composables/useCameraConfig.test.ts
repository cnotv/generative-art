import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { CameraPreset } from '@webgamekit/threejs';
import type { CoordinateTuple } from '@webgamekit/threejs';

// Import after — composable doesn't exist yet so tests will fail
import { useCameraConfig, _resetCameraConfig } from './useCameraConfig';

const makeHandlers = () => ({
  onPresetChange: vi.fn(),
  onSlotActivate: vi.fn(),
  onCleanup: vi.fn(),
});

const makeSlot = (id: string, label: string, preset = CameraPreset.Perspective) => ({
  id,
  label,
  preset,
  position: [0, 50, 100] as CoordinateTuple,
  fov: 60,
});

describe('useCameraConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetCameraConfig();
  });

  describe('registerCameraHandlers', () => {
    it('populates slots and sets activeSlotId to first slot', async () => {
      const { registerCameraHandlers, cameraSlots, activeSlotId } = useCameraConfig();
      const handlers = makeHandlers();
      const slot = makeSlot('cam-1', 'Camera 1');

      registerCameraHandlers([slot], handlers);
      await nextTick();

      expect(cameraSlots.value).toHaveLength(1);
      expect(cameraSlots.value[0]).toEqual(slot);
      expect(activeSlotId.value).toBe('cam-1');
    });

    it('handles empty slots array — activeSlotId is null', async () => {
      const { registerCameraHandlers, cameraSlots, activeSlotId } = useCameraConfig();

      registerCameraHandlers([], makeHandlers());
      await nextTick();

      expect(cameraSlots.value).toHaveLength(0);
      expect(activeSlotId.value).toBeNull();
    });

    it('sets activeSlotId to first slot when multiple slots provided', async () => {
      const { registerCameraHandlers, activeSlotId } = useCameraConfig();

      registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2', CameraPreset.Orbit)],
        makeHandlers()
      );
      await nextTick();

      expect(activeSlotId.value).toBe('cam-1');
    });
  });

  describe('unregisterCameraHandlers', () => {
    it('calls onCleanup once and restores default slot', async () => {
      const { registerCameraHandlers, unregisterCameraHandlers, cameraSlots, activeSlotId } =
        useCameraConfig();
      const handlers = makeHandlers();

      registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], handlers);
      unregisterCameraHandlers();
      await nextTick();

      expect(handlers.onCleanup).toHaveBeenCalledTimes(1);
      expect(cameraSlots.value).toHaveLength(1);
      expect(activeSlotId.value).toBe('cam-default');
    });

    it('does not throw when called before register', () => {
      const { unregisterCameraHandlers } = useCameraConfig();
      expect(() => unregisterCameraHandlers()).not.toThrow();
    });
  });

  describe('addCameraSlot', () => {
    it.each([
      [1, 'Camera 2'],
      [2, 'Camera 3'],
      [3, 'Camera 4'],
    ])(
      'appends slot with label "Camera N" when %d slots already exist',
      async (existingCount, expectedLabel) => {
        const { registerCameraHandlers, addCameraSlot, cameraSlots } = useCameraConfig();
        const slots = Array.from({ length: existingCount }, (_, i) =>
          makeSlot(`cam-${i + 1}`, `Camera ${i + 1}`)
        );

        registerCameraHandlers(slots, makeHandlers());
        addCameraSlot();
        await nextTick();

        const newSlot = cameraSlots.value[cameraSlots.value.length - 1];
        expect(newSlot.label).toBe(expectedLabel);
        expect(cameraSlots.value).toHaveLength(existingCount + 1);
      }
    );

    it('new slot has a unique id', async () => {
      const { registerCameraHandlers, addCameraSlot, cameraSlots } = useCameraConfig();

      registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], makeHandlers());
      addCameraSlot();
      await nextTick();

      const ids = cameraSlots.value.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('removeCameraSlot', () => {
    it('removes the specified slot', async () => {
      const { registerCameraHandlers, removeCameraSlot, cameraSlots } = useCameraConfig();

      registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        makeHandlers()
      );
      removeCameraSlot('cam-2');
      await nextTick();

      expect(cameraSlots.value).toHaveLength(1);
      expect(cameraSlots.value[0].id).toBe('cam-1');
    });

    it('activates first remaining slot and calls onSlotActivate when active slot is removed', async () => {
      const { registerCameraHandlers, removeCameraSlot, activeSlotId } = useCameraConfig();
      const handlers = makeHandlers();

      registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        handlers
      );

      removeCameraSlot('cam-1');
      await nextTick();

      expect(activeSlotId.value).toBe('cam-2');
      expect(handlers.onSlotActivate).toHaveBeenCalledWith('cam-2');
    });

    it('does not call onSlotActivate when a non-active slot is removed', async () => {
      const { registerCameraHandlers, removeCameraSlot } = useCameraConfig();
      const handlers = makeHandlers();

      registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        handlers
      );

      removeCameraSlot('cam-2');
      await nextTick();

      expect(handlers.onSlotActivate).not.toHaveBeenCalled();
    });

    it('does not crash when removing a nonexistent id', async () => {
      const { registerCameraHandlers, removeCameraSlot, cameraSlots } = useCameraConfig();

      registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], makeHandlers());
      expect(() => removeCameraSlot('nonexistent')).not.toThrow();
      await nextTick();

      expect(cameraSlots.value).toHaveLength(1);
    });
  });

  describe('renameCameraSlot', () => {
    it.each([
      ['New Name'],
      ['Camera Updated'],
      [''],
      ['A very long camera name that describes the view in detail'],
    ])('renames slot label to "%s"', async newLabel => {
      const { registerCameraHandlers, renameCameraSlot, cameraSlots } = useCameraConfig();

      registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], makeHandlers());
      renameCameraSlot('cam-1', newLabel);
      await nextTick();

      expect(cameraSlots.value[0].label).toBe(newLabel);
    });

    it('only renames the targeted slot', async () => {
      const { registerCameraHandlers, renameCameraSlot, cameraSlots } = useCameraConfig();

      registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        makeHandlers()
      );
      renameCameraSlot('cam-1', 'Renamed');
      await nextTick();

      expect(cameraSlots.value[0].label).toBe('Renamed');
      expect(cameraSlots.value[1].label).toBe('Camera 2');
    });
  });

  describe('activateCameraSlot', () => {
    it('updates activeSlotId and calls onSlotActivate', async () => {
      const { registerCameraHandlers, activateCameraSlot, activeSlotId } = useCameraConfig();
      const handlers = makeHandlers();

      registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        handlers
      );

      activateCameraSlot('cam-2');
      await nextTick();

      expect(activeSlotId.value).toBe('cam-2');
      expect(handlers.onSlotActivate).toHaveBeenCalledWith('cam-2');
    });

    it('calls onSlotActivate with the correct id', async () => {
      const { registerCameraHandlers, activateCameraSlot } = useCameraConfig();
      const handlers = makeHandlers();

      registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2'), makeSlot('cam-3', 'Camera 3')],
        handlers
      );

      activateCameraSlot('cam-3');
      await nextTick();

      expect(handlers.onSlotActivate).toHaveBeenCalledTimes(1);
      expect(handlers.onSlotActivate).toHaveBeenCalledWith('cam-3');
    });
  });

  describe('applyPresetToActiveSlot', () => {
    it.each(Object.values(CameraPreset))(
      'applies preset "%s" to active slot and calls onPresetChange',
      async preset => {
        const { registerCameraHandlers, applyPresetToActiveSlot, activeSlot } = useCameraConfig();
        const handlers = makeHandlers();

        registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], handlers);
        applyPresetToActiveSlot(preset);
        await nextTick();

        expect(activeSlot.value?.preset).toBe(preset);
        expect(handlers.onPresetChange).toHaveBeenCalledWith('cam-1', preset);
      }
    );

    it('is a no-op and does not call onPresetChange when activeSlotId is null', async () => {
      const { registerCameraHandlers, applyPresetToActiveSlot } = useCameraConfig();
      const handlers = makeHandlers();

      // Register empty slots to force null activeSlotId
      registerCameraHandlers([], handlers);
      applyPresetToActiveSlot(CameraPreset.Perspective);
      await nextTick();

      expect(handlers.onPresetChange).not.toHaveBeenCalled();
    });
  });

  describe('activeSlot computed', () => {
    it('returns the slot matching activeSlotId', async () => {
      const { registerCameraHandlers, activateCameraSlot, activeSlot } = useCameraConfig();
      const slot2 = makeSlot('cam-2', 'Camera 2', CameraPreset.TopDown);

      registerCameraHandlers([makeSlot('cam-1', 'Camera 1'), slot2], makeHandlers());
      activateCameraSlot('cam-2');
      await nextTick();

      expect(activeSlot.value).toEqual(slot2);
    });

    it('returns the default slot on init', () => {
      const { activeSlot } = useCameraConfig();
      expect(activeSlot.value).not.toBeNull();
      expect(activeSlot.value?.id).toBe('cam-default');
    });
  });
});
