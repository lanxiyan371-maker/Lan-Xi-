import type { GameData } from '../types';
import { getWeapon, getWeaponRange } from '../weapons';
import { decideLocal, pickupTarget, type Tactic } from './controller';
import { emptyTelemetry, pressedKeys } from './telemetry';

const labels = { evade: '躲避弹幕', attack: '对准敌机', supply: '接近补给', hold: '保持安全航线' };
export interface PyramidStats {
  successes: number;
  failures: number;
  fallbackUsed: boolean;
  npuMs: number;
  endToEndMs: number;
  model: string;
  status: string;
}
function initialStats(): PyramidStats {
  return {
    successes: 0,
    failures: 0,
    fallbackUsed: false,
    npuMs: 0,
    endToEndMs: 0,
    model: '',
    status: '等待 NPU 决策',
  };
}
/** NPU chooses a tactic; identical local movement limits and hazard avoidance still apply. */
export class PyramidController {
  stats = initialStats();
  telemetry = emptyTelemetry();
  private generation = 0;
  private pending: AbortController | null = null;
  private tactic: Exclude<Tactic, 'auto'> | null = null;
  private lastRequest = -Infinity;
  private lastAnswer = -Infinity;
  private tick = 0;
  private now = 0;
  private warmSince: number | null = null;
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  invalidate() {
    this.generation++;
    this.pending?.abort();
    this.pending = null;
    this.tactic = null;
    this.lastRequest = this.lastAnswer = -Infinity;
    this.warmSince = null;
    this.stats.status = '等待 NPU 决策';
    this.telemetry.input = emptyTelemetry().input;
    this.telemetry.tactic = '未执行';
    this.telemetry.action = '已停止控制';
  }
  reset() {
    this.invalidate();
    this.stats = initialStats();
    this.telemetry = emptyTelemetry();
  }
  update(g: GameData, tick: number, now: number) {
    this.tick = tick;
    this.now = now;
    if (this.warmSince === null) this.warmSince = now;
    if (!this.pending && now - this.lastRequest >= 150) this.request(g, tick, now);
    const valid = this.tactic !== null && now - this.lastAnswer <= 750;
    const warming = !this.tactic && this.stats.failures === 0 && now - this.warmSince <= 800;
    if (!valid && !warming) {
      this.stats.fallbackUsed = true;
      this.stats.status = '规则接管 · 混合练习';
    }
    const decision = decideLocal(g, valid ? this.tactic! : warming ? 'hold' : 'auto');
    const tacticLabel = valid ? labels[this.tactic!] : warming ? '等待 NPU' : '规则接管';
    this.telemetry.tactic = tacticLabel;
    this.telemetry.action = decision.label + (decision.pickupAssist ? ' · 本地拾取辅助' : '');
    this.telemetry.input = { ...decision.input };
    const entry = {
      tick,
      tactic: tacticLabel,
      action: this.telemetry.action,
      keys: pressedKeys(decision.input),
    };
    const last = this.telemetry.history[0];
    if (
      (!last ||
        last.tactic !== entry.tactic ||
        last.action !== entry.action ||
        last.keys !== entry.keys) &&
      (!last || tick - last.tick >= 6)
    )
      this.telemetry.history = [entry, ...this.telemetry.history].slice(0, 6);
    return {
      ...decision,
      source: valid ? ('pyramid-npu' as const) : ('local-rules' as const),
      label: valid
        ? `NPU 战术：${labels[this.tactic!]}${decision.pickupAssist ? ' · 本地拾取辅助' : decision.label === '进入散弹射程' ? ' · 进入散弹射程' : ''}`
        : warming
          ? '等待 NPU · 本地避弹'
          : '规则接管：' + decision.label,
    };
  }
  private request(g: GameData, tick: number, now: number) {
    const controller = new AbortController(),
      generation = this.generation;
    this.pending = controller;
    this.lastRequest = now;
    const timer = setTimeout(() => controller.abort(), 800);
    const p = g.player;
    const enemies = g.enemies
      .filter((e) => e.y >= 0 && e.y <= 700 && e.x >= 0 && e.x <= 400)
      .slice(0, 3);
    const threats = g.bullets
      .filter((b) => !b.isPlayer && Math.hypot(b.x - p.x, b.y - p.y) < 220)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))
      .slice(0, 3);
    const state = {
      生命: `${p.hp}/${p.maxHp}`,
      武器: { 类型: getWeapon(p.weaponId).name, 射程: getWeaponRange(p.weaponId) ?? '全屏' },
      位置: [Math.round(p.x), Math.round(p.y)],
      附近子弹: threats.map((b) => [
        Math.round(b.x - p.x),
        Math.round(b.y - p.y),
        Math.round(b.vx * 10) / 10,
        Math.round(b.vy * 10) / 10,
      ]),
      敌机: enemies.map((e) => [Math.round(e.x), Math.round(e.y)]),
      补给: (() => {
        const t = pickupTarget(g);
        return t
          ? {
              类型: t.pickup.type,
              位置: [Math.round(t.x), Math.round(t.pickup.y)],
              预计拦截位置: [Math.round(t.x), Math.round(t.y)],
              到达帧数: Math.round(t.ticks),
            }
          : null;
      })(),
      敌机移动倍率: g.enemySpeedScale ?? 1,
      障碍: g.hazards
        .filter((h) => h.type !== 'teleporter' && Math.hypot(h.x - p.x, h.y - p.y) < 220)
        .slice(0, 2)
        .map((h) => [h.type, Math.round(h.x), Math.round(h.y)]),
    };
    const started = performance.now();
    this.fetcher('/api/pyramid/decide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('推理服务不可用');
        const body = await response.json();
        if (generation !== this.generation) return;
        if (this.tick - tick > 30 || this.now - now > 750) throw new Error('决策已过期');
        if (
          !Object.prototype.hasOwnProperty.call(labels, body.tactic) ||
          body.provider !== 'AxEngineExecutionProvider' ||
          typeof body.npuMs !== 'number' ||
          !Number.isFinite(body.npuMs) ||
          body.npuMs < 0 ||
          typeof body.model !== 'string'
        )
          throw new Error('无效的 NPU 决策');
        this.tactic = body.tactic;
        this.lastAnswer = this.now;
        this.stats.successes++;
        this.stats.npuMs = body.npuMs;
        this.stats.endToEndMs = performance.now() - started;
        this.stats.model = body.model;
        this.stats.status = this.stats.fallbackUsed ? 'NPU 协同 · 本局混合练习' : 'NPU 协同驾驶';
      })
      .catch(() => {
        if (generation !== this.generation) return;
        this.tactic = null;
        this.stats.failures++;
        this.stats.fallbackUsed = true;
        this.stats.status = '规则接管 · 混合练习';
      })
      .finally(() => {
        clearTimeout(timer);
        if (generation === this.generation) this.pending = null;
      });
  }
}
