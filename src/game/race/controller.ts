import { createInputState } from '../../app/input';
import type { GameData } from '../types';
import { getWeaponRange } from '../weapons';

export interface LocalDecision {
  input: ReturnType<typeof createInputState>;
  label: string;
  source: 'local-rules';
  pickupAssist: boolean;
}

/** Predict an intercept using normal ship speed and the crate's actual fall speed. */
export function pickupTarget(g: GameData) {
  const p = g.player;
  return g.powerUps
    .filter(
      (u) =>
        u.x >= 20 && u.x <= 380 && u.y >= 0 && u.y < 700 && (u.type !== 'heal' || p.hp < p.maxHp),
    )
    .map((pickup) => {
      let ticks = Math.hypot(pickup.x - p.x, pickup.y - p.y) / p.speed;
      for (let n = 0; n < 4; n++)
        ticks = Math.hypot(pickup.x - p.x, pickup.y + pickup.vy * ticks - p.y) / p.speed;
      return { pickup, x: pickup.x, y: pickup.y + pickup.vy * ticks, ticks };
    })
    .filter((t) => t.y >= 220 && t.y <= 690)
    .sort((a, b) => a.ticks - b.ticks)[0];
}

/** A current-state local baseline, never reads the match seed or future schedule. */
export type Tactic = 'auto' | 'evade' | 'attack' | 'supply' | 'hold';
export function decideLocal(g: GameData, tactic: Tactic = 'auto'): LocalDecision {
  const p = g.player;
  const visibleEnemies = g.enemies.filter((e) => e.x >= 0 && e.x <= 400 && e.y >= 0 && e.y <= 700);
  const range = getWeaponRange(p.weaponId);
  const target = visibleEnemies
    .filter((e) => e.y < p.y - 60)
    .sort((a, b) =>
      range === null
        ? Math.abs(a.x - p.x) - Math.abs(b.x - p.x)
        : Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
    )[0];
  const pickup = pickupTarget(g);
  const threats = g.bullets.filter((b) => !b.isPlayer && b.y > p.y - 220 && b.y < p.y + 100);
  const pickupAssist =
    !!pickup &&
    tactic !== 'supply' &&
    tactic !== 'auto' &&
    Math.hypot(pickup.x - p.x, pickup.y - p.y) < 180 &&
    !threats.some(
      (b) =>
        Math.hypot(b.x - p.x, b.y - p.y) < 90 || Math.hypot(b.x - pickup.x, b.y - pickup.y) < 75,
    ) &&
    !visibleEnemies.some((e) => Math.hypot(e.x - pickup.x, e.y - pickup.y) < 100) &&
    !g.hazards.some(
      (h) => h.type !== 'teleporter' && Math.hypot(h.x - pickup.x, h.y - pickup.y) < 90,
    );
  const seekPickup = tactic === 'supply' || tactic === 'auto' || pickupAssist;
  const urgentThreat = threats.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 90);
  const seekEnemy = (tactic === 'attack' || tactic === 'auto') && !urgentThreat;
  const goalX =
    (seekPickup ? pickup?.x : undefined) ??
    (seekEnemy ? target?.x : undefined) ??
    (tactic === 'evade' ? p.x : 200);
  const attackY =
    seekEnemy && target && range !== null
      ? target.y + target.height / 2 + p.height / 2 + range * 0.7
      : 575;
  const goalY = (seekPickup ? pickup?.y : undefined) ?? attackY;
  // Short-range pursuit can enter the upper battlefield; evasion remains available there.
  const minY = range !== null ? p.height / 2 + 8 : Math.min(220, p.y - p.speed * 14);
  const closeAttack = seekEnemy && !!target && range !== null && !(seekPickup && pickup);
  // Re-plan close approaches more often instead of predicting a long uninterrupted charge.
  const movementTicks = closeAttack ? 4 : 14;
  let best = { x: 0, y: 0 },
    bestScore = Infinity,
    bestRisk = 0;
  for (const dx of [-1, 0, 1])
    for (const dy of [-1, 0, 1]) {
      const l = Math.hypot(dx, dy) || 1;
      const vx = (dx / l) * p.speed,
        vy = (dy / l) * p.speed;
      const endX = p.x + vx * movementTicks,
        endY = p.y + vy * movementTicks;
      if (endX < 22 || endX > 378 || endY < minY || endY > 682) continue;
      let risk = 0;
      for (const t of [4, 8, 14]) {
        const x = p.x + vx * Math.min(t, movementTicks),
          y = p.y + vy * Math.min(t, movementTicks);
        for (const b of threats) {
          const d = Math.hypot(x - b.x - b.vx * t, y - b.y - b.vy * t);
          risk += 1600 * Math.exp((-d * d) / (2 * 23 * 23));
        }
        for (const e of visibleEnemies) {
          const d =
            Math.hypot(x - e.x, y - e.y - e.speed * t * (g.enemySpeedScale ?? 1)) -
            Math.max(e.width, e.height) / 2;
          risk += 1800 * Math.exp(-(Math.max(0, d) ** 2) / (2 * 28 * 28));
        }
        for (const h of g.hazards) {
          if (h.type === 'teleporter') continue;
          const d = Math.hypot(x - h.x - (h.vx ?? 0) * t, y - h.y - (h.vy ?? 0) * t) - h.width / 2;
          risk += 1800 * Math.exp(-(Math.max(0, d) ** 2) / (2 * 25 * 25));
        }
      }
      const score =
        risk +
        Math.abs(endX - goalX) * 0.45 +
        Math.abs(endY - goalY) * (closeAttack ? 2 : 0.32) +
        (dx || dy ? 2 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = { x: dx, y: dy };
        bestRisk = risk;
      }
    }
  const input = createInputState();
  input.left = best.x < 0;
  input.right = best.x > 0;
  input.up = best.y < 0;
  input.down = best.y > 0;
  input.shoot = true;
  input.skill =
    (tactic === 'attack' || tactic === 'auto') &&
    p.skillCooldown <= 0 &&
    !!target &&
    Math.abs(target.x - p.x) < 65;
  input.bomb =
    (g.raceBombs ?? 0) > 0 &&
    threats.length >= 6 &&
    threats.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 38);
  return {
    input,
    source: 'local-rules',
    pickupAssist,
    label:
      bestRisk > 120
        ? '躲避弹幕'
        : pickup && seekPickup
          ? '接近补给'
          : target && seekEnemy
            ? range !== null
              ? '进入散弹射程'
              : '对准敌机'
            : '保持安全航线',
  };
}
