import { createGameData, resetGame, update } from '../engine';
import { spawnEnemy } from '../enemies';
import { createRng } from '../core/rng';
import { applyChapterToGame, CHAPTER_ORDER } from '../chapters';
import { initChapterHazards } from '../hazards';
import type { ChapterId, Enemy, GameData } from '../types';
import type { InputState } from '../../app/input';

export const MATCH_TICKS = 180 * 60;
export const ENEMY_SPEEDS = [0.5, 1, 1.5, 2, 3] as const;
export interface Encounter {
  tick: number;
  chapter: ChapterId;
  wave: number;
  enemy: Enemy;
}
export interface Match {
  seed: number;
  player: GameData;
  ai: GameData;
  schedule: Encounter[];
  tick: number;
  playerTicks: number;
  aiTicks: number;
  cursor: number;
  spawned: number;
  paused: boolean;
  finished: boolean;
  demo: boolean;
  enemySpeed: number;
}

function mix(seed: number, id: number): number {
  return (seed ^ Math.imul(id + 1, 0x9e3779b1)) >>> 0;
}

export function buildSchedule(seed: number): Encounter[] {
  const template = createGameData();
  const result: Encounter[] = [];
  const waves = [3, 7, 12, 17];
  for (let stage = 0; stage < 4; stage++) {
    for (let second = 0; second <= 30; second += 2) {
      const boss = second === 30;
      template.wave = boss ? (stage + 1) * 5 : waves[stage];
      template.chapterId = CHAPTER_ORDER[stage];
      template.enemies = [];
      template.enemiesSpawned = boss ? 0 : 1;
      const id = mix(seed, result.length);
      template.rng = createRng(id);
      spawnEnemy(template);
      result.push({
        tick: (stage * 45 + second) * 60 + 30,
        chapter: template.chapterId,
        wave: template.wave,
        enemy: { ...template.enemies[0], raceSeed: id },
      });
    }
  }
  return result;
}

function createSide(seed: number, enemySpeed: number): GameData {
  const g = createGameData();
  g.selectedAircraft = 'falcon';
  g.selectedWeapon = 'standard';
  g.gameMode = 'endless';
  g.difficulty = 'normal';
  resetGame(g);
  g.race = true;
  g.enemySpeedScale = enemySpeed;
  g.raceDamageTaken = 0;
  g.raceBombs = 3;
  g.rng = createRng(seed);
  g.autoFire = true;
  g.practiceInvincible = false;
  return g;
}

export function createMatch(seed: number, demo = false, speed = 1): Match {
  const enemySpeed = ENEMY_SPEEDS.some((v) => v === speed) ? speed : 1;
  return {
    seed: seed >>> 0,
    player: createSide(seed, enemySpeed),
    ai: createSide(seed, enemySpeed),
    schedule: buildSchedule(seed),
    tick: 0,
    playerTicks: 0,
    aiTicks: 0,
    cursor: 0,
    spawned: 0,
    paused: false,
    finished: false,
    demo,
    enemySpeed,
  };
}

function enterStage(g: GameData, stage: number, seed: number): void {
  g.enemies = [];
  g.bullets = [];
  g.powerUpsMissed = (g.powerUpsMissed ?? 0) + g.powerUps.length;
  g.powerUps = [];
  g.wave = [3, 7, 12, 17][stage];
  applyChapterToGame(g, CHAPTER_ORDER[stage]);
  g.rng = createRng(mix(seed, stage + 1000));
  initChapterHazards(g);
  g.waveAnnounceTimer = 90;
}

export function stepMatch(m: Match, playerInput: InputState, aiInput: InputState): void {
  if (m.paused || m.finished) return;
  if (m.player.state === 'gameover' && m.ai.state === 'gameover') {
    m.finished = true;
    return;
  }
  const stage = Math.min(3, Math.floor(m.tick / (45 * 60)));
  for (const g of [m.player, m.ai]) {
    if (g.state !== 'playing') continue;
    if (m.tick % (45 * 60) === 0) enterStage(g, stage, m.seed);
    // Metal debris follows the shared clock, never kill-dependent randomness.
    if (stage === 1 && m.tick % 120 === 30) {
      const r = createRng(mix(m.seed, m.tick));
      const size = 20 + r.next() * 12;
      g.hazards.push({
        type: 'asteroid',
        x: 30 + r.next() * 340,
        y: -size,
        width: size,
        height: size,
        vx: (r.next() - 0.5) * 1.2,
        vy: 2 + r.next() * 2,
        rot: r.next() * 6.28,
        rotSpeed: 0.02,
      });
    }
  }
  while (m.cursor < m.schedule.length && m.schedule[m.cursor].tick <= m.tick) {
    const event = m.schedule[m.cursor++];
    for (const g of [m.player, m.ai]) {
      if (g.state === 'playing') {
        g.wave = event.wave;
        g.enemies.push({ ...event.enemy });
        if (event.enemy.type === 'boss') g.waveAnnounceTimer = 90;
      }
    }
    m.spawned++;
  }
  if (m.player.state === 'playing') {
    update(m.player, playerInput, 1 / 60);
    m.playerTicks++;
  }
  if (m.ai.state === 'playing') {
    update(m.ai, aiInput, 1 / 60);
    m.aiTicks++;
  }
  m.tick++;
  if (m.tick >= MATCH_TICKS || (m.player.state === 'gameover' && m.ai.state === 'gameover'))
    m.finished = true;
}

export function winner(
  playerScore: number,
  playerTicks: number,
  aiScore: number,
  aiTicks: number,
): 'player' | 'ai' | 'tie' {
  if (playerScore !== aiScore) return playerScore > aiScore ? 'player' : 'ai';
  return playerTicks === aiTicks ? 'tie' : playerTicks > aiTicks ? 'player' : 'ai';
}
