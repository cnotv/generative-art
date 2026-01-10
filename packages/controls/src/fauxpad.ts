import type { ControlMapping, ControlHandlers } from './types';

export interface FauxPadPosition {
  x: number;
  y: number;
  distance: number;
  angle: number;
}

export interface FauxPadController {
  bind: (edgeElement: HTMLElement, insideElement: HTMLElement) => void;
  unbind: (edgeElement: HTMLElement, insideElement: HTMLElement) => void;
  getPosition: () => FauxPadPosition;
  reset: () => void;
  isActive: () => boolean;
}

export interface FauxPadOptions {
  deadzone?: number; // Minimum distance to trigger (0-1, default: 0.1)
  directionThreshold?: number; // Angle threshold for 4-way directions (default: 45 degrees)
  enableEightWay?: boolean; // Enable 8-way direction detection (default: false)
}

/**
 * Create a virtual faux-pad controller that interprets touch/mouse input into directional actions
 * 
 * @example
 * ```typescript
 * const fauxpad = createFauxPadController(
 *   mappingRef,
 *   handlers,
 *   { deadzone: 0.15, directionThreshold: 45 }
 * );
 * fauxpad.bind(edgeElement, insideElement);
 * ```
 */
export function createFauxPadController(
  mappingRef: { current: ControlMapping },
  handlers: ControlHandlers,
  options: FauxPadOptions = {}
): FauxPadController {
  const deadzone = options.deadzone ?? 0.1;
  const directionThreshold = options.directionThreshold ?? 45;
  const enableEightWay = options.enableEightWay ?? false;

  let initialPosition = { x: 0, y: 0 };
  let currentPosition = { x: 0, y: 0 };
  let threshold = { x: 0, y: 0 };
  let isActive = false;
  const activeDirections = new Set<string>();
  let insideEl: HTMLElement | null = null;

  /**
   * Calculate angle in degrees (0 = right, 90 = down, 180 = left, 270 = up)
   */
  const getAngle = (x: number, y: number): number => {
    const rad = Math.atan2(y, x);
    const deg = rad * (180 / Math.PI);
    return (deg + 360) % 360;
  };

  /**
   * Convert angle to directional action
   */
  const getDirectionFromAngle = (angle: number): string[] => {
    const dirs: string[] = [];
    
    if (enableEightWay) {
      // 8-way directions
      if (angle >= 337.5 || angle < 22.5) dirs.push('right');
      else if (angle >= 22.5 && angle < 67.5) dirs.push('down', 'right');
      else if (angle >= 67.5 && angle < 112.5) dirs.push('down');
      else if (angle >= 112.5 && angle < 157.5) dirs.push('down', 'left');
      else if (angle >= 157.5 && angle < 202.5) dirs.push('left');
      else if (angle >= 202.5 && angle < 247.5) dirs.push('up', 'left');
      else if (angle >= 247.5 && angle < 292.5) dirs.push('up');
      else if (angle >= 292.5 && angle < 337.5) dirs.push('up', 'right');
    } else {
      // 4-way directions
      if (angle >= 360 - directionThreshold || angle < directionThreshold) dirs.push('right');
      else if (angle >= 90 - directionThreshold && angle < 90 + directionThreshold) dirs.push('down');
      else if (angle >= 180 - directionThreshold && angle < 180 + directionThreshold) dirs.push('left');
      else if (angle >= 270 - directionThreshold && angle < 270 + directionThreshold) dirs.push('up');
    }

    return dirs;
  };

  /**
   * Get current faux-pad position and derived values
   */
  const getPosition = (): FauxPadPosition => {
    // Handle case when threshold hasn't been set (before bind is called)
    if (threshold.x === 0 || threshold.y === 0) {
      return { x: 0, y: 0, distance: 0, angle: 0 };
    }

    const x = currentPosition.x / threshold.x;
    const y = currentPosition.y / threshold.y;
    const distance = Math.min(Math.sqrt(x * x + y * y), 1);
    const angle = getAngle(x, y);

    return { x, y, distance, angle };
  };

  /**
   * Update directional actions based on position
   */
  const updateDirections = () => {
    const pos = getPosition();
    const directions = getDirectionFromAngle(pos.angle);
    
    // Check deadzone
    if (pos.distance < deadzone) {
      // Release all directions
      activeDirections.forEach(dir => {
        const action = mappingRef.current['faux-pad']?.[dir];
        if (action) {
          handlers.onRelease(action, dir, 'faux-pad');
        }
      });
      activeDirections.clear();
      return;
    }

    // Get current directions
    const currentDirections = new Set(directions);

    // Release directions that are no longer active
    activeDirections.forEach(dir => {
      if (!currentDirections.has(dir)) {
        const action = mappingRef.current['faux-pad']?.[dir];
        if (action) {
          handlers.onRelease(action, dir, 'faux-pad');
        }
        activeDirections.delete(dir);
      }
    });

    // Activate new directions
    currentDirections.forEach(dir => {
      if (!activeDirections.has(dir)) {
        const action = mappingRef.current['faux-pad']?.[dir];
        if (action) {
          handlers.onAction(action, dir, 'faux-pad');
        }
        activeDirections.add(dir);
      }
    });
  };

  /**
   * Reset faux-pad to center position
   */
  const reset = () => {
    currentPosition = { x: 0, y: 0 };
    if (insideEl) {
      insideEl.style.transform = 'translate(0, 0)';
    }
    
    // Release all active directions
    activeDirections.forEach(dir => {
      const action = mappingRef.current['faux-pad']?.[dir];
      if (action) {
        handlers.onRelease(action, dir, 'faux-pad');
      }
    });
    activeDirections.clear();
    isActive = false;
  };

  const onTouchStart = (event: TouchEvent) => {
    event.preventDefault();
    initialPosition = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    };
    isActive = true;
  };

  const onTouchMove = (event: TouchEvent) => {
    if (!isActive) return;
    event.preventDefault();

    let xDistance = event.touches[0].clientX - initialPosition.x;
    let yDistance = event.touches[0].clientY - initialPosition.y;

    // Limit movement to threshold
    xDistance = Math.max(Math.min(xDistance, threshold.x), -threshold.x);
    yDistance = Math.max(Math.min(yDistance, threshold.y), -threshold.y);

    currentPosition = { x: xDistance, y: yDistance };

    // Update visual position
    if (insideEl) {
      insideEl.style.transform = `translate(${xDistance}px, ${yDistance}px)`;
    }

    // Update directional actions
    updateDirections();
  };

  const onTouchEnd = () => {
    reset();
  };

  function bind(edgeElement: HTMLElement, insideElement: HTMLElement) {
    insideEl = insideElement;
    
    // Calculate threshold based on edge element size
    threshold = {
      x: edgeElement.offsetWidth / 2,
      y: edgeElement.offsetHeight / 2
    };

    // Bind to inside element - touch events stay attached even when finger moves outside
    insideElement.addEventListener('touchstart', onTouchStart as EventListener);
    insideElement.addEventListener('touchmove', onTouchMove as EventListener);
    insideElement.addEventListener('touchend', onTouchEnd);
  }

  function unbind(_edgeElement: HTMLElement, insideElement: HTMLElement) {
    insideElement.removeEventListener('touchstart', onTouchStart as EventListener);
    insideElement.removeEventListener('touchmove', onTouchMove as EventListener);
    insideElement.removeEventListener('touchend', onTouchEnd);
    insideEl = null;
  }

  return {
    bind,
    unbind,
    getPosition,
    reset,
    isActive: () => isActive
  };
}
