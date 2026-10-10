import { expect, it, vi } from 'vitest';
import { SoloPilot } from './solo-pilot';
import { PyramidController } from '../game/race/pyramid';
import { createGameData, resetGame } from '../game/engine';
import { createInputState } from './input';
import { onEnemyKilled, killPlayer } from '../game/combat';
import { createMatch } from '../game/race/match';
it('manual mode does not request NPU; AI uses ordinary controls and resets after restart', () => {
  const controller = new PyramidController(vi.fn().mockResolvedValue(new Response('{}')));
  const reset = vi.spyOn(controller, 'reset'),
    invalidate = vi.spyOn(controller, 'invalidate'),
    update = vi.spyOn(controller, 'update');
  const pilot = new SoloPilot(controller),
    g = createGameData(),
    manual = createInputState();
  resetGame(g);
  expect(pilot.drive(g, manual, 0)).toBe(manual);
  expect(update).not.toHaveBeenCalled();
  pilot.enabled = true;
  pilot.drive(g, manual, 1);
  expect(update).toHaveBeenCalled();
  expect(g.aiDemo).toBe(true);
  g.frameCount = 100;
  pilot.drive(g, manual, 10);
  g.state = 'paused';
  pilot.drive(g, manual, 20);
  expect(invalidate).toHaveBeenCalled();
  resetGame(g);
  pilot.drive(g, manual, 30);
  expect(reset).toHaveBeenCalled();
  pilot.enabled = false;
  expect(pilot.drive(g, manual, 40)).toBe(manual);
  pilot.dispose();
});
it('AI solo demonstration does not write normal progression or high scores', () => {
  const saved = vi.fn();
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: saved });
  const g = createGameData();
  resetGame(g);
  g.aiDemo = true;
  const e = { ...createMatch(42).schedule[0].enemy };
  onEnemyKilled(g, e, e.x, e.y);
  killPlayer(g);
  expect(saved).not.toHaveBeenCalled();
});
