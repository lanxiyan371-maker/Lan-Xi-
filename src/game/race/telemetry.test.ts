import { expect, it, vi } from 'vitest';
import { createMatch } from './match';
import { PyramidController } from './pyramid';

it('reports NPU tactics separately from executed inputs and clears held keys on invalidation', async () => {
  const c = new PyramidController(
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tactic: 'attack',
          model: 'laya-multilingual',
          provider: 'AxEngineExecutionProvider',
          npuMs: 29,
        }),
      ),
    ),
  );
  const g = createMatch(1).ai;
  g.player.weaponId = 'shotgun';
  g.enemies = [{ ...createMatch(1).schedule[0].enemy, x: g.player.x, y: 250 }];
  c.update(g, 0, 0);
  for (let n = 0; n < 8; n++) await Promise.resolve();
  const d = c.update(g, 1, 50);
  expect(c.telemetry.tactic).toBe('对准敌机');
  expect(c.telemetry.action).toBe(d.label.includes('进入散弹射程') ? '进入散弹射程' : '对准敌机');
  expect(c.telemetry.input).toEqual(d.input);
  expect(c.telemetry.input.up).toBe(true);
  expect(c.telemetry.history.length).toBeGreaterThan(0);
  c.invalidate();
  expect(c.telemetry.input.up).toBe(false);
  expect(c.telemetry.input.shoot).toBe(false);
  c.reset();
  expect(c.telemetry.history).toHaveLength(0);
});

it('labels fallback honestly and bounds recent decision history', async () => {
  const c = new PyramidController(vi.fn().mockRejectedValue(new Error('offline')));
  const g = createMatch(2).ai;
  c.update(g, 0, 0);
  for (let n = 0; n < 8; n++) await Promise.resolve();
  for (let n = 1; n < 30; n++) {
    g.player.x = n % 2 ? 50 : 350;
    c.update(g, n, n * 160);
  }
  expect(c.telemetry.tactic).toBe('规则接管');
  expect(c.telemetry.history.length).toBeLessThanOrEqual(6);
  c.invalidate();
});
