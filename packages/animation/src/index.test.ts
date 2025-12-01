import { describe, it, expect, vi } from 'vitest';
import { animateTimeline, getTimelineLoopModel } from './index';

describe('animation', () => {
  describe('animateTimeline', () => {
    it('should execute action when frame matches start', () => {
      const action = vi.fn();
      const timeline = [{ start: 10, action }];
      animateTimeline(timeline, 10);
      expect(action).toHaveBeenCalled();
    });

    it('should not execute action when frame is before start', () => {
      const action = vi.fn();
      const timeline = [{ start: 10, action }];
      animateTimeline(timeline, 5);
      expect(action).not.toHaveBeenCalled();
    });

    it('should execute action within interval', () => {
      const action = vi.fn();
      // interval: [length, pause]
      // cycle = 20
      const timeline = [{ interval: [10, 10] as [number, number], action }];
      
      // Frame 5: 5 % 20 = 5. 5 < 10. Run.
      animateTimeline(timeline, 5);
      expect(action).toHaveBeenCalledTimes(1);

      // Frame 15: 15 % 20 = 15. 15 >= 10. Skip.
      action.mockClear();
      animateTimeline(timeline, 15);
      expect(action).not.toHaveBeenCalled();

      // Frame 25: 25 % 20 = 5. 5 < 10. Run.
      action.mockClear();
      animateTimeline(timeline, 25);
      expect(action).toHaveBeenCalled();
    });
  });

  describe('getTimelineLoopModel', () => {
    it('should generate correct timeline from loop definition', () => {
      const action = vi.fn();
      const loop = {
        loop: 0,
        length: 10,
        action,
        list: [
          [1, 'forward'],
          [2, 'left']
        ] as [number, any][]
      };

      const timeline = getTimelineLoopModel(loop);
      
      expect(timeline).toHaveLength(2);
      
      // Check first item
      // interval: [1 * 10, total]
      // total = 1*10 + 2*10 = 30
      expect(timeline[0].interval).toEqual([10, 30]);
      
      // Check second item
      // interval: [2 * 10, total]
      expect(timeline[1].interval).toEqual([20, 30]);
    });
  });
});
