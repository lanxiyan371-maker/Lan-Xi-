import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInputState } from '../../app/input';
import { onEnemyKilled, killPlayer, activateBomb } from '../combat';
import { _resetProgressCache } from '../progress';
import { buildSchedule, createMatch, stepMatch, winner, MATCH_TICKS } from './match';
import { decideLocal } from './controller';
import { recordRace, RACE_HISTORY_KEY } from './history';

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() });
  _resetProgressCache();
});

describe('fair local score race', () => {
  it('has a reproducible encounter schedule with all four chapters and bosses', () => {
    expect(buildSchedule(42)).toEqual(buildSchedule(42));
    expect(buildSchedule(42)).not.toEqual(buildSchedule(43));
    expect(new Set(buildSchedule(42).map((e) => e.chapter)).size).toBe(4);
    expect(buildSchedule(42).filter((e) => e.enemy.type === 'boss')).toHaveLength(4);
  });
  it('player kills and random drops cannot change future encounters', () => {
    const a = createMatch(42),
      b = createMatch(42);
    for (const m of [a, b]) for (const g of [m.player, m.ai]) g.player.hp = 1000;
    for (let n = 0; n < 900; n++) {
      stepMatch(a, createInputState(), createInputState());
      stepMatch(b, createInputState(), createInputState());
      if (a.player.enemies.length) {
        const e = a.player.enemies.shift()!;
        onEnemyKilled(a.player, e, e.x, e.y);
      }
    }
    expect(a.schedule).toEqual(b.schedule);
    expect(a.spawned).toEqual(b.spawned);
    expect(a.player.state).toBe('playing');
  });
  it('same input produces identical gameplay in independent scenes', () => {
    const m = createMatch(9);
    for (let n = 0; n < 600; n++) stepMatch(m, createInputState(), createInputState());
    expect(m.player.player).toEqual(m.ai.player);
    expect(m.player.enemies).toEqual(m.ai.enemies);
    expect(m.player.bullets).toEqual(m.ai.bullets);
    expect(m.player.score).toBe(m.ai.score);
  });
  it('pause freezes both sides and the match clock', () => {
    const m = createMatch(1);
    m.paused = true;
    stepMatch(m, createInputState(), createInputState());
    expect(m.tick).toBe(0);
    expect(m.player.frameCount).toBe(0);
    expect(m.ai.frameCount).toBe(0);
  });
  it('one death freezes that score while the other side continues', () => {
    const m = createMatch(2);
    m.player.state = 'gameover';
    stepMatch(m, createInputState(), createInputState());
    expect(m.finished).toBe(false);
    expect(m.player.frameCount).toBe(0);
    expect(m.ai.frameCount).toBe(1);
    m.ai.state = 'gameover';
    stepMatch(m, createInputState(), createInputState());
    expect(m.finished).toBe(true);
  });
  it('ends at exactly 180 seconds and then stays frozen', () => {
    const m = createMatch(3);
    m.tick = MATCH_TICKS - 1;
    stepMatch(m, createInputState(), createInputState());
    expect(m.finished).toBe(true);
    expect(m.tick).toBe(180 * 60);
    stepMatch(m, createInputState(), createInputState());
    expect(m.tick).toBe(MATCH_TICKS);
  });
  it('ranks by score then survival ticks, with an exact tie', () => {
    expect(winner(100, 10, 90, 100)).toBe('player');
    expect(winner(100, 10, 100, 100)).toBe('ai');
    expect(winner(100, 100, 100, 100)).toBe('tie');
  });
  it('kills and deaths never write normal coins, achievements, stats or high scores', () => {
    const m = createMatch(4);
    const e = { ...m.schedule[0].enemy };
    onEnemyKilled(m.player, e, 100, 100);
    onEnemyKilled(m.ai, e, 100, 100);
    killPlayer(m.player);
    killPlayer(m.ai);
    expect(localStorage.setItem).not.toHaveBeenCalled();
  });
  it('rule AI returns only normal controls and cannot teleport or grant health', () => {
    const m = createMatch(5),
      before = { ...m.ai.player };
    const decision = decideLocal(m.ai);
    expect(m.ai.player).toEqual(before);
    expect(decision.input.shoot).toBe(true);
    expect(typeof decision.input.left).toBe('boolean');
    expect(decision.label.length).toBeGreaterThan(0);
  });
  it('both sides have three manual bombs; pickups do not spend them', () => {
    const m = createMatch(8);
    expect(m.player.raceBombs).toBe(3);
    expect(m.ai.raceBombs).toBe(3);
    activateBomb(m.player, m.player.player, true);
    expect(m.player.raceBombs).toBe(3);
    for (let i = 0; i < 4; i++) activateBomb(m.player);
    expect(m.player.raceBombs).toBe(0);
    expect(m.ai.raceBombs).toBe(3);
  });
  it('per-enemy drops are independent of previous kills and RNG calls', () => {
    const m = createMatch(80),
      e = { ...m.schedule[0].enemy };
    for (let i = 0; i < 100; i++) m.player.rng.next();
    onEnemyKilled(m.player, e, 200, 300);
    onEnemyKilled(m.ai, e, 200, 300);
    expect(m.player.powerUps).toEqual(m.ai.powerUps);
  });
  it('runs the full three-minute schedule with identical rule inputs on both sides', () => {
    const m = createMatch(20261010, true);
    // Large test-only health keeps this test exercising all stages and the deadline.
    m.player.player.hp = m.ai.player.hp = 10000;
    for (let i = 0; i < MATCH_TICKS; i++) {
      stepMatch(m, decideLocal(m.player).input, decideLocal(m.ai).input);
    }
    expect(m.tick).toBe(MATCH_TICKS);
    expect(m.spawned).toBe(m.schedule.length);
    expect(m.player.score).toBe(m.ai.score);
    expect(m.player.player).toEqual(m.ai.player);
    expect(m.player.enemies).toEqual(m.ai.enemies);
    expect(m.finished).toBe(true);
    expect(localStorage.setItem).not.toHaveBeenCalled();
    recordRace(m);
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
    expect(vi.mocked(localStorage.setItem).mock.calls[0][0]).toBe(RACE_HISTORY_KEY);
  }, 15000);
  it('AI cannot aim at enemies that have not entered the visible scene', () => {
    const m = createMatch(8);
    const before = decideLocal(m.ai);
    m.ai.enemies.push({ ...m.schedule[0].enemy, x: 20, y: -60 });
    expect(decideLocal(m.ai)).toEqual(before);
  });
});
