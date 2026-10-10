import { describe, expect, it } from 'vitest';
import { animationFrame, fitSprite } from './art-math';
import { SPRITES } from './art-atlas';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('V2 art geometry', () => {
  it('clamps non-looping explosions and wraps looping exhaust', () => {
    expect(animationFrame(0, 6)).toBe(0);
    expect(animationFrame(0.5, 6)).toBe(3);
    expect(animationFrame(1, 6)).toBe(5);
    expect(animationFrame(-0.2, 6)).toBe(0);
    expect(animationFrame(1.25, 4, true)).toBe(1);
  });
  it('contains wide and tall sprites in their unchanged game bounds', () => {
    expect(fitSprite(200, 100, 40, 40)).toEqual([40, 20]);
    expect(fitSprite(100, 200, 40, 40)).toEqual([20, 40]);
  });
  it('all atlas rectangles lie inside actual source PNGs', () => {
    for (const sprite of Object.values(SPRITES)) {
      const path = resolve('public', 'art-v2', sprite.file);
      expect(existsSync(path), path).toBe(true);
      const bytes = readFileSync(path);
      const w = bytes.readUInt32BE(16),
        h = bytes.readUInt32BE(20);
      const [x, y, width, height] = sprite.rect;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(x + width, path).toBeLessThanOrEqual(w);
      expect(y + height, path).toBeLessThanOrEqual(h);
    }
  });
});
