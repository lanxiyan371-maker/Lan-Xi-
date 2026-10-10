import { expect, it, vi, afterEach } from 'vitest';
import { createMatch } from './match';
import { decideLocal } from './controller';
import { update } from '../engine';
import { PyramidController } from './pyramid';

afterEach(() => vi.unstubAllGlobals());
function scene() {
  const g = createMatch(42).ai;
  g.player.x = 200;
  g.player.y = 575;
  g.player.weaponId = 'shotgun';
  g.player.skillCooldown = 999;
  g.enemies = [
    {
      ...g.enemies[0],
      ...createMatch(42).schedule[0].enemy,
      x: 200,
      y: 250,
      speed: 0,
      movePattern: 'straight',
      shootTimer: 9999,
      hp: 100,
      maxHp: 100,
    },
  ];
  return g;
}
it('approaches into actual shotgun range and lands pellets without colliding', () => {
  const g = scene();
  expect(decideLocal(g, 'attack').input.up).toBe(true);
  const hp = g.player.hp;
  for (let n = 0; n < 180; n++) update(g, decideLocal(g, 'attack').input, 1 / 60);
  expect(g.enemies[0].hp).toBeLessThan(100);
  expect(g.player.hp).toBe(hp);
  expect(g.player.y - g.enemies[0].y).toBeGreaterThan((g.player.height + g.enemies[0].height) / 2);
});
it('can pursue an enemy near the top with shotgun while keeping long-range weapons back', () => {
  const g = scene();
  g.enemies[0].y = 60;
  for (let n = 0; n < 180; n++) update(g, decideLocal(g, 'attack').input, 1 / 60);
  expect(g.enemies[0].hp).toBeLessThan(100);
  const standard = scene();
  standard.player.weaponId = 'standard';
  expect(decideLocal(standard, 'attack').input.up).toBe(false);
  const laser = scene();
  laser.player.weaponId = 'laser';
  expect(decideLocal(laser, 'attack').input.up).toBe(false);
});
it('keeps evade and hold from pursuing a short-range attack', () => {
  const g = scene();
  expect(decideLocal(g, 'evade').input.up).toBe(false);
  expect(decideLocal(g, 'hold').input.up).toBe(false);
});
it('avoids an incoming bullet instead of charging into it for shotgun range', () => {
  const g = scene();
  g.bullets = [
    {
      x: 200,
      y: 555,
      vx: 0,
      vy: 3,
      width: 6,
      height: 6,
      damage: 1,
      isPlayer: false,
      color: '#f00',
    },
  ];
  const decision = decideLocal(g, 'attack');
  expect(decision.input.up && !decision.input.left && !decision.input.right).toBe(false);
  expect(decision.label).toBe('躲避弹幕');
});
it('sends the current weapon and range to Pyramid and applies an attack response', async () => {
  const g = scene();
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        tactic: 'attack',
        model: 'laya-multilingual',
        provider: 'AxEngineExecutionProvider',
        npuMs: 29,
      }),
    ),
  );
  const c = new PyramidController(fetcher);
  c.update(g, 0, 0);
  for (let n = 0; n < 8; n++) await Promise.resolve();
  const state = JSON.parse(fetcher.mock.calls[0][1].body).state;
  expect(state.武器).toEqual({ 类型: '散弹炮', 射程: 95 });
  expect(c.update(g, 1, 50).input.up).toBe(true);
  c.invalidate();
});
