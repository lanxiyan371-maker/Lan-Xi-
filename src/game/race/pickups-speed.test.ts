import { describe, expect, it, vi } from 'vitest';
import { createMatch, stepMatch } from './match';
import { decideLocal } from './controller';
import { createInputState } from '../../app/input';
import { updateEnemies } from '../enemies';
import { updatePowerUps } from '../systems/power-up-system';
import { recordRace } from './history';
import { update } from '../engine';
describe('pickup pursuit and enemy-only speed', () => {
  it('intercepts a falling weapon crate even under the attack tactic', () => {
    const g = createMatch(1).ai;
    g.player.x = 200;
    g.player.y = 575;
    g.powerUps = [
      { x: 275, y: 525, width: 22, height: 22, vy: 1.4, type: 'weapon', weaponId: 'standard' },
    ];
    for (let n = 0; n < 120; n++) {
      const input = decideLocal(g, 'attack').input;
      update(g, input, 1 / 60);
      if (!g.powerUps.length) break;
    }
    expect(g.powerUps).toHaveLength(0);
    expect(g.powerUpsCollected).toBe(1);
  });
  it('can collect a nearby crate below the old 40-pixel cutoff', () => {
    const g = createMatch(3).ai;
    g.player.x = 200;
    g.player.y = 575;
    g.powerUps = [{ x: 200, y: 640, width: 20, height: 20, vy: 1.5, type: 'spread' }];
    expect(decideLocal(g, 'attack').input.down).toBe(true);
  });
  it('does not seek a useless heal or sacrifice avoidance for a crate', () => {
    const g = createMatch(4).ai;
    g.player.x = 200;
    g.player.y = 575;
    g.player.hp = g.player.maxHp;
    g.powerUps = [{ x: 300, y: 575, width: 20, height: 20, vy: 1.5, type: 'heal' }];
    expect(decideLocal(g, 'hold').pickupAssist).toBe(false);
    g.powerUps[0].type = 'spread';
    g.bullets = [
      {
        x: 215,
        y: 575,
        vx: 0,
        vy: 2,
        width: 5,
        height: 5,
        damage: 1,
        isPlayer: false,
        color: '#f00',
      },
    ];
    expect(decideLocal(g, 'attack').pickupAssist).toBe(false);
  });
  it('changes both enemy movement speeds but not shooting timers or match time', () => {
    const normal = createMatch(5, false, 1),
      fast = createMatch(5, false, 3);
    for (const m of [normal, fast]) {
      const e = {
        ...m.schedule[0].enemy,
        x: 100,
        y: 200,
        movePattern: 'straight' as const,
        speed: 2,
        type: 'basic' as const,
        shootTimer: 100,
      };
      m.player.enemies = [{ ...e }];
      m.ai.enemies = [{ ...e }];
      m.tick = 1;
    }
    updateEnemies(normal.ai, 1 / 60, 1);
    updateEnemies(fast.ai, 1 / 60, 1);
    expect(fast.ai.enemies[0].y - 200).toBe(3 * (normal.ai.enemies[0].y - 200));
    expect(fast.ai.enemies[0].shootTimer).toBe(normal.ai.enemies[0].shootTimer);
    stepMatch(fast, createInputState(), createInputState());
    expect(fast.tick).toBe(2);
    expect(fast.player.enemySpeedScale).toBe(3);
    expect(fast.ai.enemySpeedScale).toBe(3);
    expect(normal.schedule).toEqual(fast.schedule);
  });
  it('counts naturally missed supplies and stores the speed with the result', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
    const m = createMatch(6, false, 2);
    m.ai.powerUps = [{ x: 30, y: 730, width: 20, height: 20, vy: 1.5, type: 'spread' }];
    updatePowerUps(m.ai);
    expect(m.ai.powerUpsMissed).toBe(1);
    expect(recordRace(m)[0].enemySpeed).toBe(2);
  });
});
