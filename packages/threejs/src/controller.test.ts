import { describe, it, expect, vi } from 'vitest';
import { moveController } from './controller';
import type { ComplexModel } from './types';

const createMockModel = (
  position = { x: 0, y: 0, z: 0 },
  computedMovement = { x: 1, y: 0, z: 0 }
): ComplexModel => {
  const colliderTranslation = { ...position };
  const model = {
    position: {
      x: position.x,
      y: position.y,
      z: position.z,
      set: vi.fn((x: number, y: number, z: number) => {
        model.position.x = x;
        model.position.y = y;
        model.position.z = z;
      }),
    },
    userData: {
      characterController: {
        computeColliderMovement: vi.fn(),
        computedMovement: vi.fn(() => computedMovement),
      },
      collider: {
        translation: vi.fn(() => ({ ...colliderTranslation })),
        setTranslation: vi.fn((pos: { x: number; y: number; z: number }) => {
          colliderTranslation.x = pos.x;
          colliderTranslation.y = pos.y;
          colliderTranslation.z = pos.z;
        }),
      },
    },
  } as unknown as ComplexModel;
  return model;
};

describe('moveController', () => {
  it.each([
    {
      direction: { x: 1, y: 0, z: 0 },
      startPos: { x: 5, y: 0, z: 0 },
      computed: { x: 1, y: 0, z: 0 },
      expected: { x: 6, y: 0, z: 0 },
      description: 'moves along positive X',
    },
    {
      direction: { x: 0, y: 0, z: -2 },
      startPos: { x: 0, y: 3, z: 10 },
      computed: { x: 0, y: 0, z: -2 },
      expected: { x: 0, y: 3, z: 8 },
      description: 'moves along negative Z',
    },
    {
      direction: { x: 0.5, y: 0, z: 0.5 },
      startPos: { x: 1, y: 1, z: 1 },
      computed: { x: 0.5, y: 0, z: 0.5 },
      expected: { x: 1.5, y: 1, z: 1.5 },
      description: 'moves diagonally',
    },
  ])('$description', ({ direction, startPos, computed, expected }) => {
    const model = createMockModel(startPos, computed);
    const result = moveController(model, direction);

    expect(model.userData.characterController.computeColliderMovement).toHaveBeenCalledWith(
      model.userData.collider,
      direction
    );
    expect(model.position.x).toBeCloseTo(expected.x);
    expect(model.position.y).toBeCloseTo(expected.y);
    expect(model.position.z).toBeCloseTo(expected.z);
    expect(result).toEqual(computed);
  });

  it('returns zero movement when character controller is missing', () => {
    const model = createMockModel();
    model.userData.characterController = undefined;
    const result = moveController(model, { x: 1, y: 0, z: 0 });

    expect(result).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('returns zero movement when collider is missing', () => {
    const model = createMockModel();
    model.userData.collider = undefined;
    const result = moveController(model, { x: 1, y: 0, z: 0 });

    expect(result).toEqual({ x: 0, y: 0, z: 0 });
  });
});
