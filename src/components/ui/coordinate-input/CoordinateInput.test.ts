import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CoordinateInput from './CoordinateInput.vue';
import type { CoordinateTuple } from '@webgamekit/threejs';

describe('CoordinateInput', () => {
  describe('Array Format (CoordinateTuple)', () => {
    it('should render with array values', () => {
      const wrapper = mount(CoordinateInput, {
        props: {
          modelValue: [10, 20, 30] as CoordinateTuple,
          label: 'Position',
        },
      });

      expect(wrapper.text()).toContain('Position');
      expect(wrapper.text()).toContain('X: 10.00');
      expect(wrapper.text()).toContain('Y: 20.00');
      expect(wrapper.text()).toContain('Z: 30.00');
    });

    it('should emit array format when updated', async () => {
      const wrapper = mount(CoordinateInput, {
        props: {
          modelValue: [10, 20, 30] as CoordinateTuple,
        },
      });

      const sliders = wrapper.findAll('input[type="range"]');
      await sliders[0].setValue(15);

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([[15, 20, 30]]);
    });
  });

  describe('Object Format', () => {
    it('should render with object values', () => {
      const wrapper = mount(CoordinateInput, {
        props: {
          modelValue: { x: 10, y: 20, z: 30 },
          label: 'Scale',
        },
      });

      expect(wrapper.text()).toContain('Scale');
      expect(wrapper.text()).toContain('X: 10.00');
      expect(wrapper.text()).toContain('Y: 20.00');
      expect(wrapper.text()).toContain('Z: 30.00');
    });

    it('should emit object format when updated', async () => {
      const wrapper = mount(CoordinateInput, {
        props: {
          modelValue: { x: 10, y: 20, z: 30 },
        },
      });

      const sliders = wrapper.findAll('input[type="range"]');
      await sliders[1].setValue(25);

      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')![0]).toEqual([{ x: 10, y: 25, z: 30 }]);
    });
  });

  describe('Min/Max/Step Configuration', () => {
    it('should support uniform min/max/step', () => {
      const wrapper = mount(CoordinateInput, {
        props: {
          modelValue: [50, 50, 50] as CoordinateTuple,
          min: 0,
          max: 100,
          step: 5,
        },
      });

      const sliders = wrapper.findAll('input[type="range"]');
      expect(sliders[0].attributes('min')).toBe('0');
      expect(sliders[0].attributes('max')).toBe('100');
      expect(sliders[0].attributes('step')).toBe('5');
    });

    it('should support per-coordinate min/max/step', () => {
      const wrapper = mount(CoordinateInput, {
        props: {
          modelValue: [10, 20, 30] as CoordinateTuple,
          min: { x: 0, y: 10, z: 20 },
          max: { x: 100, y: 200, z: 300 },
          step: { x: 1, y: 5, z: 10 },
        },
      });

      const sliders = wrapper.findAll('input[type="range"]');

      // X slider
      expect(sliders[0].attributes('min')).toBe('0');
      expect(sliders[0].attributes('max')).toBe('100');
      expect(sliders[0].attributes('step')).toBe('1');

      // Y slider
      expect(sliders[1].attributes('min')).toBe('10');
      expect(sliders[1].attributes('max')).toBe('200');
      expect(sliders[1].attributes('step')).toBe('5');

      // Z slider
      expect(sliders[2].attributes('min')).toBe('20');
      expect(sliders[2].attributes('max')).toBe('300');
      expect(sliders[2].attributes('step')).toBe('10');
    });
  });

  describe('Slider Values', () => {
    it('should show X, Y, Z values above sliders', () => {
      const wrapper = mount(CoordinateInput, {
        props: {
          modelValue: [10, 20, 30] as CoordinateTuple,
        },
      });

      const groups = wrapper.findAll('.coordinate-input__slider-group');
      expect(groups).toHaveLength(3);

      const values = wrapper.findAll('.coordinate-input__value');
      expect(values).toHaveLength(3);
      expect(values[0].text()).toBe('X: 10.00');
      expect(values[1].text()).toBe('Y: 20.00');
      expect(values[2].text()).toBe('Z: 30.00');
    });
  });
});
