import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createInputState } from '../../app/input';
import { killPlayer } from '../combat';
import { render } from '../engine';
import { createMatch, stepMatch } from './match';

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
});
afterEach(() => vi.restoreAllMocks());

it('keeps the death overlay still while the opponent continues and after both die', () => {
  const m = createMatch(42);
  killPlayer(m.player);
  expect(m.player.screenShake.timer).toBeGreaterThan(0);
  let offset = [0, 0];
  const stack: number[][] = [];
  const overlays: number[][] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === 'save') return () => stack.push([...offset]);
        if (key === 'restore')
          return () => {
            offset = stack.pop()!;
          };
        if (key === 'translate')
          return (x: number, y: number) => {
            offset = [offset[0] + x, offset[1] + y];
          };
        if (key === 'fillText')
          return (text: string) => {
            if (text === '本方战斗结束') overlays.push([...offset]);
          };
        if (key === 'measureText') return () => ({ width: 20 });
        if (key === 'createLinearGradient' || key === 'createRadialGradient')
          return () => ({ addColorStop: () => {} });
        return () => {};
      },
      set: () => true,
    },
  ) as CanvasRenderingContext2D;
  vi.spyOn(Math, 'random').mockReturnValue(0.75);
  for (let n = 0; n < 60; n++) {
    stepMatch(m, createInputState(), createInputState());
    render(ctx, m.player, 400, 700);
  }
  expect(m.aiTicks).toBe(60);
  expect(m.playerTicks).toBe(0);
  killPlayer(m.ai);
  stepMatch(m, createInputState(), createInputState());
  expect(m.finished).toBe(true);
  render(ctx, m.player, 400, 700);
  render(ctx, m.ai, 400, 700);
  expect(overlays).toHaveLength(62);
  expect(overlays.every(([x, y]) => x === 0 && y === 0)).toBe(true);
});
