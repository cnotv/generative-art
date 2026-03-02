import { ref, computed } from 'vue';
import { CameraPreset } from '@webgamekit/threejs';
import type { CoordinateTuple } from '@webgamekit/threejs';

export interface CameraSlot {
  id: string;
  label: string;
  preset: CameraPreset;
  position: CoordinateTuple;
  fov: number;
  orbitTarget: CoordinateTuple;
}

export interface CameraConfigHandlers {
  onPresetChange: (slotId: string, preset: CameraPreset) => void;
  onSlotActivate: (slotId: string) => void;
  onCleanup: () => void;
  onUpdate?: (slotId: string) => void;
}

const DEFAULT_CAMERA_SLOT_ID = 'cam-default';
const DEFAULT_CAMERA_POSITION: CoordinateTuple = [0, 5, 20];
const DEFAULT_CAMERA_FOV = 75;
const DEFAULT_CAMERA_ORBIT_TARGET: CoordinateTuple = [0, 0, 0];

const DEFAULT_CAMERA_SLOT: CameraSlot = {
  id: DEFAULT_CAMERA_SLOT_ID,
  label: 'Camera 1',
  preset: CameraPreset.Perspective,
  position: DEFAULT_CAMERA_POSITION,
  fov: DEFAULT_CAMERA_FOV,
  orbitTarget: DEFAULT_CAMERA_ORBIT_TARGET,
};

// Module-level state — shared across all composable calls (same pattern as useDebugScene)
const cameraSlots = ref<CameraSlot[]>([DEFAULT_CAMERA_SLOT]);
const activeSlotId = ref<string | null>(DEFAULT_CAMERA_SLOT_ID);
const handlers = ref<CameraConfigHandlers | null>(null);

export const _resetCameraConfig = () => {
  cameraSlots.value = [DEFAULT_CAMERA_SLOT];
  activeSlotId.value = DEFAULT_CAMERA_SLOT_ID;
  handlers.value = null;
};

export const useCameraConfig = () => {
  const activeSlot = computed<CameraSlot | null>(
    () => cameraSlots.value.find(s => s.id === activeSlotId.value) ?? null
  );

  const registerCameraHandlers = (
    initialSlots: CameraSlot[],
    newHandlers: CameraConfigHandlers
  ) => {
    cameraSlots.value = [...initialSlots];
    handlers.value = newHandlers;
    activeSlotId.value = initialSlots.length > 0 ? initialSlots[0].id : null;
  };

  const unregisterCameraHandlers = () => {
    handlers.value?.onCleanup();
    cameraSlots.value = [DEFAULT_CAMERA_SLOT];
    activeSlotId.value = DEFAULT_CAMERA_SLOT_ID;
    handlers.value = null;
  };

  const addCameraSlot = () => {
    const nextNumber = cameraSlots.value.length + 1;
    const newSlot: CameraSlot = {
      id: `cam-${Date.now()}-${nextNumber}`,
      label: `Camera ${nextNumber}`,
      preset: CameraPreset.Perspective,
      position: DEFAULT_CAMERA_POSITION,
      fov: DEFAULT_CAMERA_FOV,
      orbitTarget: DEFAULT_CAMERA_ORBIT_TARGET,
    };
    cameraSlots.value = [...cameraSlots.value, newSlot];
  };

  const removeCameraSlot = (id: string) => {
    const wasActive = activeSlotId.value === id;
    cameraSlots.value = cameraSlots.value.filter(s => s.id !== id);

    if (wasActive && cameraSlots.value.length > 0) {
      const nextId = cameraSlots.value[0].id;
      activeSlotId.value = nextId;
      handlers.value?.onSlotActivate(nextId);
    }
  };

  const renameCameraSlot = (id: string, label: string) => {
    cameraSlots.value = cameraSlots.value.map(s => (s.id === id ? { ...s, label } : s));
  };

  const activateCameraSlot = (id: string) => {
    activeSlotId.value = id;
    handlers.value?.onSlotActivate(id);
  };

  const applyPresetToActiveSlot = (preset: CameraPreset) => {
    if (!activeSlotId.value) return;

    const slotId = activeSlotId.value;
    cameraSlots.value = cameraSlots.value.map(s =>
      s.id === slotId ? { ...s, preset } : s
    );
    handlers.value?.onPresetChange(slotId, preset);
  };

  const updateActiveSlotField = (field: keyof CameraSlot, value: unknown) => {
    if (!activeSlotId.value) return;

    const slotId = activeSlotId.value;
    cameraSlots.value = cameraSlots.value.map(s =>
      s.id === slotId ? { ...s, [field]: value } : s
    );
    if (field === 'position' || field === 'fov' || field === 'orbitTarget') {
      handlers.value?.onUpdate?.(slotId);
    }
  };

  const syncActiveSlotPosition = (position: CoordinateTuple) => {
    if (!activeSlotId.value) return;
    const slotId = activeSlotId.value;
    cameraSlots.value = cameraSlots.value.map(s =>
      s.id === slotId ? { ...s, position } : s
    );
  };

  return {
    cameraSlots,
    activeSlotId,
    activeSlot,
    registerCameraHandlers,
    unregisterCameraHandlers,
    addCameraSlot,
    removeCameraSlot,
    renameCameraSlot,
    activateCameraSlot,
    applyPresetToActiveSlot,
    updateActiveSlotField,
    syncActiveSlotPosition,
  };
};
