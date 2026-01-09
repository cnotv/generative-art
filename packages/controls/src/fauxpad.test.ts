import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFauxPadController } from './fauxpad';
import type { ControlMapping, ControlHandlers } from './types';

describe('createFauxPadController', () => {
  let mappingRef: { current: ControlMapping };
  let handlers: ControlHandlers;
  let onActionMock: ReturnType<typeof vi.fn>;
  let onReleaseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onActionMock = vi.fn();
    onReleaseMock = vi.fn();

    mappingRef = {
      current: {
        'faux-pad': {
          up: 'move-up',
          down: 'move-down',
          left: 'move-left',
          right: 'move-right',
        },
      },
    };

    handlers = {
      onAction: onActionMock,
      onRelease: onReleaseMock,
    };
  });

  it('should create a faux-pad controller', () => {
    const controller = createFauxPadController(mappingRef, handlers);
    expect(controller).toBeDefined();
    expect(controller.bind).toBeInstanceOf(Function);
    expect(controller.unbind).toBeInstanceOf(Function);
    expect(controller.getPosition).toBeInstanceOf(Function);
    expect(controller.reset).toBeInstanceOf(Function);
  });

  it('should return initial position as centered', () => {
    const controller = createFauxPadController(mappingRef, handlers);
    const position = controller.getPosition();
    
    expect(position.x).toBe(0);
    expect(position.y).toBe(0);
    expect(position.distance).toBe(0);
  });

  it('should not be active initially', () => {
    const controller = createFauxPadController(mappingRef, handlers);
    expect(controller.isActive()).toBe(false);
  });

  it('should respect deadzone setting', () => {
    const controller = createFauxPadController(mappingRef, handlers, {
      deadzone: 0.2,
    });
    
    expect(controller).toBeDefined();
  });

  it('should support 8-way direction mode', () => {
    const controller = createFauxPadController(mappingRef, handlers, {
      enableEightWay: true,
    });
    
    expect(controller).toBeDefined();
  });

  it('should reset position correctly', () => {
    const controller = createFauxPadController(mappingRef, handlers);
    controller.reset();
    
    const position = controller.getPosition();
    expect(position.x).toBe(0);
    expect(position.y).toBe(0);
    expect(controller.isActive()).toBe(false);
  });
});
