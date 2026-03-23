import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { createLogoPanel } from './logoPanel';

beforeAll(() => {
  const mockContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    mockContext as unknown as ReturnType<HTMLCanvasElement['getContext']>,
  );
});

describe('createLogoPanel', () => {
  const PANEL_HEIGHT = 8;

  it('returns a THREE.Group', () => {
    const { group } = createLogoPanel('logo.svg', 'Test Title');
    expect(group).toBeInstanceOf(THREE.Group);
  });

  it('group contains exactly one mesh child', () => {
    const { group } = createLogoPanel('logo.svg', 'Test Title');
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toBeInstanceOf(THREE.Mesh);
  });

  it('mesh is offset up by half panel height so pivot is at bottom', () => {
    const { group } = createLogoPanel('logo.svg', 'Test Title');
    const mesh = group.children[0] as THREE.Mesh;
    expect(mesh.position.y).toBeCloseTo(PANEL_HEIGHT / 2);
  });

  it('group starts with rotation.x = 0', () => {
    const { group } = createLogoPanel('logo.svg', 'Test Title');
    expect(group.rotation.x).toBe(0);
  });

  it('flip() moves rotation toward -Math.PI/2 after update', () => {
    const { group, flip, update } = createLogoPanel('logo.svg', 'Test Title');
    flip();
    update(10); // large delta to reach target
    expect(group.rotation.x).toBeCloseTo(-Math.PI / 2, 1);
  });

  it('flip() is idempotent — calling twice does not overshoot', () => {
    const { group, flip, update } = createLogoPanel('logo.svg', 'Test Title');
    flip();
    flip();
    update(10);
    expect(group.rotation.x).toBeCloseTo(-Math.PI / 2, 1);
  });
});
