import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFauxPadController } from './fauxpad';
import type { ControlMapping, ControlHandlers } from './types';

// Helper to create mock touch event
const createTouchEvent = (type: string, clientX: number, clientY: number): TouchEvent => {
  const touch = {
    clientX,
    clientY,
    identifier: 0,
    target: null,
    screenX: clientX,
    screenY: clientY,
    pageX: clientX,
    pageY: clientY,
    radiusX: 0,
    radiusY: 0,
    rotationAngle: 0,
    force: 1,
  } as Touch;

  return new TouchEvent(type, {
    touches: type === 'touchend' ? [] : [touch],
    targetTouches: type === 'touchend' ? [] : [touch],
    changedTouches: [touch],
    bubbles: true,
    cancelable: true,
  });
};

// Helper to create mock HTML element with dimensions
const createMockElement = (width: number, height: number): HTMLElement => {
  const element = document.createElement('div');
  Object.defineProperty(element, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(element, 'offsetHeight', { value: height, configurable: true });
  element.style.transform = '';
  return element;
};

describe('createFauxPadController', () => {
  let mappingReference: { current: ControlMapping };
  let handlers: ControlHandlers;
  let onActionMock: ReturnType<typeof vi.fn>;
  let onReleaseMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onActionMock = vi.fn();
    onReleaseMock = vi.fn();

    mappingReference = {
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
    const controller = createFauxPadController(mappingReference, handlers);
    expect(controller).toBeDefined();
    expect(controller.bind).toBeInstanceOf(Function);
    expect(controller.unbind).toBeInstanceOf(Function);
    expect(controller.getPosition).toBeInstanceOf(Function);
    expect(controller.reset).toBeInstanceOf(Function);
  });

  it('should return initial position as centered', () => {
    const controller = createFauxPadController(mappingReference, handlers);
    const position = controller.getPosition();
    
    expect(position.x).toBe(0);
    expect(position.y).toBe(0);
    expect(position.distance).toBe(0);
  });

  it('should not be active initially', () => {
    const controller = createFauxPadController(mappingReference, handlers);
    expect(controller.isActive()).toBe(false);
  });

  it('should respect deadzone setting', () => {
    const controller = createFauxPadController(mappingReference, handlers, {
      deadzone: 0.2,
    });
    
    expect(controller).toBeDefined();
  });

  it('should support 8-way direction mode', () => {
    const controller = createFauxPadController(mappingReference, handlers, {
      enableEightWay: true,
    });
    
    expect(controller).toBeDefined();
  });

  it('should reset position correctly', () => {
    const controller = createFauxPadController(mappingReference, handlers);
    controller.reset();
    
    const position = controller.getPosition();
    expect(position.x).toBe(0);
    expect(position.y).toBe(0);
    expect(controller.isActive()).toBe(false);
  });

  describe('touch interaction', () => {
    it('should become active on touchstart', () => {
      const edgeElement = createMockElement(100, 100);
      const insideElement = createMockElement(50, 50);
      
      const controller = createFauxPadController(mappingReference, handlers);
      controller.bind(edgeElement, insideElement);
      
      const touchStart = createTouchEvent('touchstart', 50, 50);
      insideElement.dispatchEvent(touchStart);
      
      expect(controller.isActive()).toBe(true);
      console.log('[TEST] touchstart - isActive:', controller.isActive());
    });

    it('should trigger RIGHT action when moving right', () => {
      const edgeElement = createMockElement(100, 100);
      const insideElement = createMockElement(50, 50);
      
      const controller = createFauxPadController(mappingReference, handlers, { deadzone: 0.1 });
      controller.bind(edgeElement, insideElement);
      
      // Start at center
      const touchStart = createTouchEvent('touchstart', 50, 50);
      insideElement.dispatchEvent(touchStart);
      
      // Move right (increase X)
      const touchMove = createTouchEvent('touchmove', 100, 50);
      insideElement.dispatchEvent(touchMove);
      
      console.log('[TEST] Move RIGHT - onAction calls:', onActionMock.mock.calls);
      console.log('[TEST] Position:', controller.getPosition());
      
      expect(onActionMock).toHaveBeenCalledWith('move-right', 'right', 'faux-pad');
    });

    it('should trigger LEFT action when moving left', () => {
      const edgeElement = createMockElement(100, 100);
      const insideElement = createMockElement(50, 50);
      
      const controller = createFauxPadController(mappingReference, handlers, { deadzone: 0.1 });
      controller.bind(edgeElement, insideElement);
      
      // Start at center
      const touchStart = createTouchEvent('touchstart', 50, 50);
      insideElement.dispatchEvent(touchStart);
      
      // Move left (decrease X)
      const touchMove = createTouchEvent('touchmove', 0, 50);
      insideElement.dispatchEvent(touchMove);
      
      console.log('[TEST] Move LEFT - onAction calls:', onActionMock.mock.calls);
      console.log('[TEST] Position:', controller.getPosition());
      
      expect(onActionMock).toHaveBeenCalledWith('move-left', 'left', 'faux-pad');
    });

    it('should trigger UP action when moving up', () => {
      const edgeElement = createMockElement(100, 100);
      const insideElement = createMockElement(50, 50);
      
      const controller = createFauxPadController(mappingReference, handlers, { deadzone: 0.1 });
      controller.bind(edgeElement, insideElement);
      
      // Start at center
      const touchStart = createTouchEvent('touchstart', 50, 50);
      insideElement.dispatchEvent(touchStart);
      
      // Move up (decrease Y - screen coords, up is negative Y)
      const touchMove = createTouchEvent('touchmove', 50, 0);
      insideElement.dispatchEvent(touchMove);
      
      console.log('[TEST] Move UP - onAction calls:', onActionMock.mock.calls);
      console.log('[TEST] Position:', controller.getPosition());
      
      expect(onActionMock).toHaveBeenCalledWith('move-up', 'up', 'faux-pad');
    });

    it('should trigger DOWN action when moving down', () => {
      const edgeElement = createMockElement(100, 100);
      const insideElement = createMockElement(50, 50);
      
      const controller = createFauxPadController(mappingReference, handlers, { deadzone: 0.1 });
      controller.bind(edgeElement, insideElement);
      
      // Start at center
      const touchStart = createTouchEvent('touchstart', 50, 50);
      insideElement.dispatchEvent(touchStart);
      
      // Move down (increase Y)
      const touchMove = createTouchEvent('touchmove', 50, 100);
      insideElement.dispatchEvent(touchMove);
      
      console.log('[TEST] Move DOWN - onAction calls:', onActionMock.mock.calls);
      console.log('[TEST] Position:', controller.getPosition());
      
      expect(onActionMock).toHaveBeenCalledWith('move-down', 'down', 'faux-pad');
    });

    it('should update inside element transform on move', () => {
      const edgeElement = createMockElement(100, 100);
      const insideElement = createMockElement(50, 50);
      
      const controller = createFauxPadController(mappingReference, handlers);
      controller.bind(edgeElement, insideElement);
      
      const touchStart = createTouchEvent('touchstart', 50, 50);
      insideElement.dispatchEvent(touchStart);
      
      const touchMove = createTouchEvent('touchmove', 80, 50);
      insideElement.dispatchEvent(touchMove);
      
      console.log('[TEST] Inside element transform:', insideElement.style.transform);
      
      expect(insideElement.style.transform).toContain('translate');
    });

    it('should release actions on touchend', () => {
      const edgeElement = createMockElement(100, 100);
      const insideElement = createMockElement(50, 50);
      
      const controller = createFauxPadController(mappingReference, handlers, { deadzone: 0.1 });
      controller.bind(edgeElement, insideElement);
      
      // Start and move right
      const touchStart = createTouchEvent('touchstart', 50, 50);
      insideElement.dispatchEvent(touchStart);
      
      const touchMove = createTouchEvent('touchmove', 100, 50);
      insideElement.dispatchEvent(touchMove);
      
      // End touch
      const touchEnd = createTouchEvent('touchend', 100, 50);
      insideElement.dispatchEvent(touchEnd);
      
      console.log('[TEST] touchend - onRelease calls:', onReleaseMock.mock.calls);
      console.log('[TEST] isActive after touchend:', controller.isActive());
      
      expect(onReleaseMock).toHaveBeenCalled();
      expect(controller.isActive()).toBe(false);
    });

    it('should not trigger action within deadzone', () => {
      const edgeElement = createMockElement(100, 100);
      const insideElement = createMockElement(50, 50);

      const controller = createFauxPadController(mappingReference, handlers, { deadzone: 0.5 });
      controller.bind(edgeElement, insideElement);

      // Start at center
      const touchStart = createTouchEvent('touchstart', 50, 50);
      insideElement.dispatchEvent(touchStart);

      // Move only slightly (within deadzone)
      const touchMove = createTouchEvent('touchmove', 55, 50);
      insideElement.dispatchEvent(touchMove);

      console.log('[TEST] Deadzone test - onAction calls:', onActionMock.mock.calls);
      console.log('[TEST] Position:', controller.getPosition());

      expect(onActionMock).not.toHaveBeenCalled();
    });

    describe('8-way direction detection', () => {
      it.each([
        // [label, moveToX, moveToY, expectedDirections]
        // touchstart at (50,50); move-to coords relative to a 100×100 edge element
        ['up-right diagonal', 100, 0, ['up', 'right']],
        ['down-right diagonal', 100, 100, ['down', 'right']],
        ['down-left diagonal', 0, 100, ['down', 'left']],
        ['up-left diagonal', 0, 0, ['up', 'left']],
      ] as const)('triggers both directions for %s', (_label, moveX, moveY, expectedDirections) => {
        const edgeElement = createMockElement(100, 100);
        const insideElement = createMockElement(50, 50);

        const controller = createFauxPadController(mappingReference, handlers, {
          deadzone: 0.1,
          enableEightWay: true,
        });
        controller.bind(edgeElement, insideElement);

        insideElement.dispatchEvent(createTouchEvent('touchstart', 50, 50));
        insideElement.dispatchEvent(createTouchEvent('touchmove', moveX, moveY));

        const triggeredDirections = onActionMock.mock.calls.map((call: [string, string, string]) => call[1]);
        expectedDirections.forEach((direction) => {
          expect(triggeredDirections).toContain(direction);
        });
        expect(onActionMock).toHaveBeenCalledTimes(expectedDirections.length);
      });
    });
  });
});
