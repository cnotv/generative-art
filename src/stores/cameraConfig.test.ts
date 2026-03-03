import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { CameraPreset } from '@webgamekit/threejs';
import type { CoordinateTuple } from '@webgamekit/threejs';
import { useCameraConfigStore } from './cameraConfig';

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

describe('useCameraConfigStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  describe('registerCameraHandlers', () => {
    it('populates slots and sets activeSlotId to first slot', async () => {
      const store = useCameraConfigStore();
      const handlers = makeHandlers();
      const slot = makeSlot('cam-1', 'Camera 1');

      store.registerCameraHandlers([slot], handlers);
      await nextTick();

      expect(store.cameraSlots).toHaveLength(1);
      expect(store.cameraSlots[0]).toEqual(slot);
      expect(store.activeSlotId).toBe('cam-1');
    });

    it('handles empty slots array — activeSlotId is null', async () => {
      const store = useCameraConfigStore();

      store.registerCameraHandlers([], makeHandlers());
      await nextTick();

      expect(store.cameraSlots).toHaveLength(0);
      expect(store.activeSlotId).toBeNull();
    });

    it('sets activeSlotId to first slot when multiple slots provided', async () => {
      const store = useCameraConfigStore();

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2', CameraPreset.Orbit)],
        makeHandlers()
      );
      await nextTick();

      expect(store.activeSlotId).toBe('cam-1');
    });
  });

  describe('unregisterCameraHandlers', () => {
    it('calls onCleanup once and restores default slot', async () => {
      const store = useCameraConfigStore();
      const handlers = makeHandlers();

      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], handlers);
      store.unregisterCameraHandlers();
      await nextTick();

      expect(handlers.onCleanup).toHaveBeenCalledTimes(1);
      expect(store.cameraSlots).toHaveLength(1);
      expect(store.activeSlotId).toBe('cam-default');
    });

    it('does not throw when called before register', () => {
      const store = useCameraConfigStore();
      expect(() => store.unregisterCameraHandlers()).not.toThrow();
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
        const store = useCameraConfigStore();
        const slots = Array.from({ length: existingCount }, (_, i) =>
          makeSlot(`cam-${i + 1}`, `Camera ${i + 1}`)
        );

        store.registerCameraHandlers(slots, makeHandlers());
        store.addCameraSlot();
        await nextTick();

        const newSlot = store.cameraSlots[store.cameraSlots.length - 1];
        expect(newSlot.label).toBe(expectedLabel);
        expect(store.cameraSlots).toHaveLength(existingCount + 1);
      }
    );

    it('new slot has a unique id', async () => {
      const store = useCameraConfigStore();

      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], makeHandlers());
      store.addCameraSlot();
      await nextTick();

      const ids = store.cameraSlots.map(s => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('removeCameraSlot', () => {
    it('removes the specified slot', async () => {
      const store = useCameraConfigStore();

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        makeHandlers()
      );
      store.removeCameraSlot('cam-2');
      await nextTick();

      expect(store.cameraSlots).toHaveLength(1);
      expect(store.cameraSlots[0].id).toBe('cam-1');
    });

    it('activates first remaining slot and calls onSlotActivate when active slot is removed', async () => {
      const store = useCameraConfigStore();
      const handlers = makeHandlers();

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        handlers
      );

      store.removeCameraSlot('cam-1');
      await nextTick();

      expect(store.activeSlotId).toBe('cam-2');
      expect(handlers.onSlotActivate).toHaveBeenCalledWith('cam-2');
    });

    it('does not call onSlotActivate when a non-active slot is removed', async () => {
      const store = useCameraConfigStore();
      const handlers = makeHandlers();

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        handlers
      );

      store.removeCameraSlot('cam-2');
      await nextTick();

      expect(handlers.onSlotActivate).not.toHaveBeenCalled();
    });

    it('does not crash when removing a nonexistent id', async () => {
      const store = useCameraConfigStore();

      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], makeHandlers());
      expect(() => store.removeCameraSlot('nonexistent')).not.toThrow();
      await nextTick();

      expect(store.cameraSlots).toHaveLength(1);
    });
  });

  describe('renameCameraSlot', () => {
    it.each([
      ['New Name'],
      ['Camera Updated'],
      [''],
      ['A very long camera name that describes the view in detail'],
    ])('renames slot label to "%s"', async newLabel => {
      const store = useCameraConfigStore();

      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], makeHandlers());
      store.renameCameraSlot('cam-1', newLabel);
      await nextTick();

      expect(store.cameraSlots[0].label).toBe(newLabel);
    });

    it('only renames the targeted slot', async () => {
      const store = useCameraConfigStore();

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        makeHandlers()
      );
      store.renameCameraSlot('cam-1', 'Renamed');
      await nextTick();

      expect(store.cameraSlots[0].label).toBe('Renamed');
      expect(store.cameraSlots[1].label).toBe('Camera 2');
    });
  });

  describe('activateCameraSlot', () => {
    it('updates activeSlotId and calls onSlotActivate', async () => {
      const store = useCameraConfigStore();
      const handlers = makeHandlers();

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2')],
        handlers
      );

      store.activateCameraSlot('cam-2');
      await nextTick();

      expect(store.activeSlotId).toBe('cam-2');
      expect(handlers.onSlotActivate).toHaveBeenCalledWith('cam-2');
    });

    it('calls onSlotActivate with the correct id', async () => {
      const store = useCameraConfigStore();
      const handlers = makeHandlers();

      store.registerCameraHandlers(
        [makeSlot('cam-1', 'Camera 1'), makeSlot('cam-2', 'Camera 2'), makeSlot('cam-3', 'Camera 3')],
        handlers
      );

      store.activateCameraSlot('cam-3');
      await nextTick();

      expect(handlers.onSlotActivate).toHaveBeenCalledTimes(1);
      expect(handlers.onSlotActivate).toHaveBeenCalledWith('cam-3');
    });
  });

  describe('applyPresetToActiveSlot', () => {
    it.each(Object.values(CameraPreset))(
      'applies preset "%s" to active slot and calls onPresetChange',
      async preset => {
        const store = useCameraConfigStore();
        const handlers = makeHandlers();

        store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1')], handlers);
        store.applyPresetToActiveSlot(preset);
        await nextTick();

        expect(store.activeSlot?.preset).toBe(preset);
        expect(handlers.onPresetChange).toHaveBeenCalledWith('cam-1', preset);
      }
    );

    it('is a no-op and does not call onPresetChange when activeSlotId is null', async () => {
      const store = useCameraConfigStore();
      const handlers = makeHandlers();

      store.registerCameraHandlers([], handlers);
      store.applyPresetToActiveSlot(CameraPreset.Perspective);
      await nextTick();

      expect(handlers.onPresetChange).not.toHaveBeenCalled();
    });
  });

  describe('activeSlot computed', () => {
    it('returns the slot matching activeSlotId', async () => {
      const store = useCameraConfigStore();
      const slot2 = makeSlot('cam-2', 'Camera 2', CameraPreset.TopDown);

      store.registerCameraHandlers([makeSlot('cam-1', 'Camera 1'), slot2], makeHandlers());
      store.activateCameraSlot('cam-2');
      await nextTick();

      expect(store.activeSlot).toEqual(slot2);
    });

    it('returns the default slot on init', () => {
      const store = useCameraConfigStore();
      expect(store.activeSlot).not.toBeNull();
      expect(store.activeSlot?.id).toBe('cam-default');
    });
  });
});
