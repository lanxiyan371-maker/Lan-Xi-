import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createInputState } from '../input';
import { render } from '../../game/engine';
import { resumeAudio } from '../../game/audio';
import {
  createMatch,
  stepMatch,
  winner,
  MATCH_TICKS,
  ENEMY_SPEEDS,
  type Match,
} from '../../game/race/match';
import { decideLocal } from '../../game/race/controller';
import {
  loadRaceHistory,
  recordRace,
  raceSourceLabel,
  type RaceSource,
} from '../../game/race/history';
import { PyramidController } from '../../game/race/pyramid';
import { DecisionPanel } from '../DecisionPanel';
import './race.css';

function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
function seconds(ticks: number): string {
  return (ticks / 60).toFixed(1);
}
function clock(ticks: number): string {
  const s = Math.max(0, Math.ceil(ticks / 60));
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function RaceApp() {
  const [initial] = useState(() => createMatch(newSeed()));
  const matchRef = useRef<Match>(initial);
  const playerCanvas = useRef<HTMLCanvasElement>(null),
    aiCanvas = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef(createInputState());
  const pointerGoal = useRef<{ x: number; y: number } | null>(null);
  const runningRef = useRef(false);
  const [seedText, setSeedText] = useState(String(initial.seed));
  const [demo, setDemo] = useState(false);
  const [enemySpeed, setEnemySpeed] = useState(1);
  const [mode, setMode] = useState<'local' | 'pyramid'>(() =>
    new URLSearchParams(window.location.search).has('pyramid') ? 'pyramid' : 'local',
  );
  const modeRef = useRef(mode);
  const [controllers] = useState(() => ({
    ai: new PyramidController(),
    player: new PyramidController(),
  }));
  const [connection, setConnection] = useState({
    connected: false,
    message: '等待检测 Pyramid 服务',
  });
  const [mobileView, setMobileView] = useState<'player' | 'ai'>('player');
  const [history, setHistory] = useState(loadRaceHistory);
  const [, refresh] = useState(0);
  const decisionRef = useRef({ label: '等待开始', ms: 0 });
  const m = matchRef.current;
  const validSeed = /^\d+$/.test(seedText) && Number(seedText) <= 4294967295;
  const canStart = validSeed && (mode !== 'pyramid' || connection.connected);
  const source = (): RaceSource => {
    if (modeRef.current === 'local') return 'local-rules';
    const sides = m.demo
      ? [controllers.ai.stats, controllers.player.stats]
      : [controllers.ai.stats];
    return sides.every((s) => s.successes > 0 && !s.fallbackUsed) ? 'pyramid-npu' : 'mixed';
  };
  async function connect() {
    setConnection({ connected: false, message: '正在检测 Pyramid 服务…' });
    try {
      const response = await fetch('/api/pyramid/info', { signal: AbortSignal.timeout(4000) });
      const body = await response.json();
      if (
        !response.ok ||
        !body.connected ||
        !body.models?.some((model: { name: string }) => model.name === 'multilingual')
      )
        throw new Error();
      setConnection({ connected: true, message: 'Pyramid 已连接 · multilingual' });
    } catch {
      setConnection({ connected: false, message: '无法连接 · 请用“一键启动Pyramid竞技”打开游戏' });
    }
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('pyramid')) void connect();
  }, []);

  function start(seed: number) {
    if (mode === 'pyramid' && !connection.connected) return;
    modeRef.current = mode;
    controllers.ai.reset();
    controllers.player.reset();
    matchRef.current = createMatch(seed, demo, enemySpeed);
    inputRef.current = createInputState();
    pointerGoal.current = null;
    runningRef.current = true;
    decisionRef.current = { label: '保持安全航线', ms: 0 };
    setSeedText(String(seed));
    setMobileView('player');
    refresh((v) => v + 1);
    resumeAudio();
  }
  function pause() {
    if (!runningRef.current || matchRef.current.finished) return;
    matchRef.current.paused = !matchRef.current.paused;
    controllers.ai.invalidate();
    controllers.player.invalidate();
    inputRef.current = createInputState();
    pointerGoal.current = null;
    refresh((v) => v + 1);
  }

  useEffect(() => {
    let raf = 0,
      last = performance.now(),
      acc = 0,
      lastUi = 0,
      recorded: Match | null = null;
    const tick = (now: number) => {
      const current = matchRef.current;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (runningRef.current && !current.paused && !current.finished && !document.hidden) {
        acc += dt;
        while (acc >= 1 / 60 && !current.finished) {
          const t = performance.now();
          const decision =
            modeRef.current === 'pyramid' && current.ai.state !== 'gameover'
              ? controllers.ai.update(current.ai, current.tick, performance.now())
              : decideLocal(current.ai);
          decisionRef.current = { label: decision.label, ms: performance.now() - t };
          let human = inputRef.current;
          if (current.demo)
            human =
              modeRef.current === 'pyramid' && current.player.state !== 'gameover'
                ? controllers.player.update(current.player, current.tick, performance.now()).input
                : decideLocal(current.player).input;
          else if (pointerGoal.current) {
            const d = pointerGoal.current,
              p = current.player.player;
            human.left = d.x < p.x - 5;
            human.right = d.x > p.x + 5;
            human.up = d.y < p.y - 5;
            human.down = d.y > p.y + 5;
          }
          stepMatch(current, human, decision.input);
          acc -= 1 / 60;
        }
      } else acc = 0;
      if (current.finished && recorded !== current) {
        recorded = current;
        const sides = current.demo
          ? [controllers.ai.stats, controllers.player.stats]
          : [controllers.ai.stats];
        const source: RaceSource =
          modeRef.current === 'local'
            ? 'local-rules'
            : sides.every((s) => s.successes > 0 && !s.fallbackUsed)
              ? 'pyramid-npu'
              : 'mixed';
        setHistory(
          recordRace(current, {
            source,
            ...(modeRef.current === 'pyramid'
              ? {
                  model: controllers.ai.stats.model,
                  npuDecisions: sides.reduce((n, s) => n + s.successes, 0),
                  failures: sides.reduce((n, s) => n + s.failures, 0),
                }
              : {}),
          }),
        );
        controllers.ai.invalidate();
        controllers.player.invalidate();
      }
      for (const [c, g] of [
        [playerCanvas.current, current.player],
        [aiCanvas.current, current.ai],
      ] as const) {
        if (!c || !c.clientWidth || !c.clientHeight) continue;
        const w = c.clientWidth,
          h = c.clientHeight,
          dpr = Math.min(2, window.devicePixelRatio || 1);
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        }
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          render(ctx, g, w, h);
        }
      }
      if (now - lastUi > 100) {
        lastUi = now;
        refresh((v) => v + 1);
      }
      raf = requestAnimationFrame(tick);
    };
    const keys: Record<string, 'left' | 'right' | 'up' | 'down' | 'shoot'> = {
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      Space: 'shoot',
      KeyZ: 'shoot',
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLButtonElement
      )
        return;
      if (event.code in keys) {
        event.preventDefault();
        inputRef.current[keys[event.code]] = event.type === 'keydown';
      }
      if (event.type !== 'keydown' || event.repeat) return;
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        pause();
      }
      if (event.code === 'KeyC') inputRef.current.skill = true;
      if (event.code === 'KeyX' || event.code === 'KeyB') inputRef.current.bomb = true;
    };
    const loseFocus = () => {
      const current = matchRef.current;
      if (runningRef.current && !current.finished) current.paused = true;
      controllers.ai.invalidate();
      controllers.player.invalidate();
      inputRef.current = createInputState();
      pointerGoal.current = null;
      acc = 0;
      refresh((v) => v + 1);
    };
    const visibility = () => {
      if (document.hidden) loseFocus();
    };
    window.addEventListener('keydown', keyboard);
    window.addEventListener('keyup', keyboard);
    window.addEventListener('blur', loseFocus);
    document.addEventListener('visibilitychange', visibility);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      controllers.ai.invalidate();
      controllers.player.invalidate();
      window.removeEventListener('keydown', keyboard);
      window.removeEventListener('keyup', keyboard);
      window.removeEventListener('blur', loseFocus);
      document.removeEventListener('visibilitychange', visibility);
    };
    // The loop reads changing values from refs, never reinitializes a running match.
  }, []);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    if (
      !runningRef.current ||
      matchRef.current.paused ||
      matchRef.current.finished ||
      matchRef.current.demo
    )
      return;
    const r = event.currentTarget.getBoundingClientRect(),
      s = Math.min(r.width / 400, r.height / 700);
    pointerGoal.current = {
      x: Math.max(16, Math.min(384, (event.clientX - r.left - (r.width - 400 * s) / 2) / s)),
      y: Math.max(18, Math.min(682, (event.clientY - r.top - (r.height - 700 * s) / 2) / s)),
    };
  }
  const result = winner(m.player.score, m.playerTicks, m.ai.score, m.aiTicks);
  const ready = !runningRef.current;
  return (
    <main className="race-app">
      <header className="race-header">
        <div className="race-heading">
          <div>
            <span className="race-eyebrow">苍穹战机 · 竞技试玩</span>
            <h1>同关竞技</h1>
          </div>
          <div className="race-clock" data-testid="race-clock">
            {clock(MATCH_TICKS - m.tick)}
            <small>
              {m.finished
                ? '本局结束'
                : ready
                  ? '准备就绪'
                  : m.paused
                    ? '双方已暂停'
                    : '双方同步进行'}
            </small>
          </div>
          <a className="race-back" href="#">
            返回首页
          </a>
        </div>
        <div className="race-controls">
          <label>
            敌机速度{' '}
            <select
              aria-label="敌机速度"
              value={enemySpeed}
              disabled={!ready && !m.finished}
              onChange={(e) => setEnemySpeed(Number(e.target.value))}
            >
              {ENEMY_SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}×
                </option>
              ))}
            </select>
          </label>
          <label>
            对手{' '}
            <select
              aria-label="AI 来源"
              value={mode}
              disabled={!ready && !m.finished}
              onChange={(e) => setMode(e.target.value as 'local' | 'pyramid')}
            >
              <option value="local">本地规则 AI</option>
              <option value="pyramid">Pyramid NPU 协同</option>
            </select>
          </label>
          {mode === 'pyramid' && (
            <button onClick={() => void connect()} disabled={!ready && !m.finished}>
              检测连接
            </button>
          )}
          <label>
            关卡种子{' '}
            <input
              aria-label="关卡种子"
              value={seedText}
              inputMode="numeric"
              maxLength={10}
              disabled={!ready && !m.finished}
              onChange={(e) => setSeedText(e.target.value)}
            />
          </label>
          <label className="race-check">
            <input
              type="checkbox"
              checked={demo}
              disabled={!ready && !m.finished}
              onChange={(e) => setDemo(e.target.checked)}
            />
            双方自动驾驶演示
          </label>
          {ready ? (
            <button
              className="race-primary"
              disabled={!canStart}
              onClick={() => start(Number(seedText))}
            >
              开始比赛
            </button>
          ) : (
            <>
              <button onClick={pause} disabled={m.finished}>
                {m.paused ? '继续比赛' : '暂停双方'}
              </button>
              <button onClick={() => start(m.seed)}>同种子重赛</button>
              <button onClick={() => start(newSeed())}>新关卡</button>
            </>
          )}
        </div>
        <div className="race-source">
          <span className="race-status-dot" />
          {(ready ? mode : modeRef.current) === 'local'
            ? '本地规则 AI'
            : `${connection.message} · ${ready ? 'NPU 选战术 / 本地避弹' : m.finished ? raceSourceLabel(source()) : controllers.ai.stats.status}`}
          <span>
            同装备 / 同生命 / 同遭遇表 / 各 3 枚炸弹 · 敌机 {ready ? enemySpeed : m.enemySpeed}×
          </span>
        </div>
        {(ready ? mode : modeRef.current) === 'pyramid' && (
          <div className="race-device-stats" data-testid="pyramid-stats">
            NPU {controllers.ai.stats.npuMs.toFixed(1)} ms · 端到端{' '}
            {controllers.ai.stats.endToEndMs.toFixed(1)} ms · 有效决策{' '}
            {controllers.ai.stats.successes} · 失败 {controllers.ai.stats.failures}
            {m.demo && ` · 玩家席有效决策 ${controllers.player.stats.successes}`}
          </div>
        )}
      </header>
      <nav className="race-tabs" aria-label="查看场景">
        <button aria-pressed={mobileView === 'player'} onClick={() => setMobileView('player')}>
          玩家 · {m.player.score}
        </button>
        <button aria-pressed={mobileView === 'ai'} onClick={() => setMobileView('ai')}>
          AI · {m.ai.score}
        </button>
      </nav>
      <section className="race-arena">
        {(['player', 'ai'] as const).map((side) => {
          const g = m[side],
            isPlayer = side === 'player';
          return (
            <section
              key={side}
              className={`race-side ${mobileView !== side ? 'is-mobile-hidden' : ''}`}
            >
              <div className="race-score">
                <div>
                  <b>
                    {isPlayer
                      ? m.demo
                        ? '玩家席 · 自动演示'
                        : '玩家 · 手动驾驶'
                      : modeRef.current === 'pyramid'
                        ? '对手 · Pyramid NPU 协同'
                        : '对手 · 本地规则 AI'}
                  </b>
                  <small>
                    {ready
                      ? '等待开始'
                      : g.state === 'gameover'
                        ? '已阵亡，成绩冻结'
                        : m.paused
                          ? '已暂停'
                          : '战斗中'}{' '}
                    · 生存 {seconds(isPlayer ? m.playerTicks : m.aiTicks)} 秒
                  </small>
                </div>
                <strong data-testid={`${side}-score`}>{g.score.toLocaleString()}</strong>
              </div>
              <div className="race-screen">
                <canvas
                  aria-label={isPlayer ? '玩家战场' : 'AI 战场'}
                  ref={isPlayer ? playerCanvas : aiCanvas}
                  onPointerDown={
                    isPlayer
                      ? (e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          point(e);
                        }
                      : undefined
                  }
                  onPointerMove={
                    isPlayer
                      ? (e) => {
                          if (e.currentTarget.hasPointerCapture(e.pointerId)) point(e);
                        }
                      : undefined
                  }
                  onPointerUp={
                    isPlayer
                      ? () => {
                          pointerGoal.current = null;
                          inputRef.current.left =
                            inputRef.current.right =
                            inputRef.current.up =
                            inputRef.current.down =
                              false;
                        }
                      : undefined
                  }
                  onPointerCancel={
                    isPlayer
                      ? () => {
                          pointerGoal.current = null;
                          inputRef.current = createInputState();
                        }
                      : undefined
                  }
                />
              </div>
              <div className="race-side-footer">
                {isPlayer
                  ? `击杀 ${g.enemiesKilled} · 连击 ${g.maxCombo} · 受伤 ${g.raceDamageTaken ?? 0}`
                  : modeRef.current === 'pyramid'
                    ? decisionRef.current.label
                    : `${decisionRef.current.label} · 本地决策 ${decisionRef.current.ms.toFixed(1)} ms`}
                <span>
                  补给 {g.powerUpsCollected ?? 0} / 漏过 {g.powerUpsMissed ?? 0} · 炸弹{' '}
                  {g.raceBombs ?? 0}
                </span>
              </div>
            </section>
          );
        })}
        {modeRef.current === 'pyramid' && (
          <aside className="race-decision-sidebar" aria-label="Pyramid 决策监控">
            <DecisionPanel
              controller={controllers.ai}
              active={!ready && !m.paused && !m.finished && m.ai.state === 'playing'}
              status={
                ready
                  ? '等待开始'
                  : m.finished
                    ? '比赛结束'
                    : m.ai.state === 'gameover'
                      ? '已阵亡'
                      : '已暂停'
              }
            />
            {m.demo && (
              <DecisionPanel
                title="玩家席 AI 决策"
                controller={controllers.player}
                active={!ready && !m.paused && !m.finished && m.player.state === 'playing'}
                status={
                  ready
                    ? '等待开始'
                    : m.finished
                      ? '比赛结束'
                      : m.player.state === 'gameover'
                        ? '已阵亡'
                        : '已暂停'
                }
              />
            )}
          </aside>
        )}
        {ready && (
          <div className="race-cover">
            <div className="race-card">
              <span className="race-eyebrow">180 秒 · 同一份关卡</span>
              <h2>你能超过 AI 吗？</h2>
              <p>击落敌机、躲避弹幕、争取更高分。双方独立战场，同步开始；一方阵亡，另一方继续。</p>
              <p>得分优先，同分比较生存时间。自动驾驶演示会单独标注。</p>
              <button
                className="race-primary"
                disabled={!canStart}
                onClick={() => start(Number(seedText))}
              >
                开始比赛
              </button>
              <small>
                {mode === 'pyramid'
                  ? 'NPU 根据当前状态选择战术，本地算法负责移动与避弹。连接异常时规则接管，本局标为混合练习。'
                  : '当前对手是本地规则算法。切换“Pyramid NPU 协同”可使用设备推理。'}
              </small>
            </div>
          </div>
        )}
        {!ready && m.paused && !m.finished && (
          <div className="race-cover">
            <div className="race-card">
              <h2>双方已暂停</h2>
              <p>计时与两个战场都已停止。</p>
              <button className="race-primary" onClick={pause}>
                继续比赛
              </button>
            </div>
          </div>
        )}
        {m.finished && (
          <div className="race-cover">
            <div className="race-card race-result">
              <span className="race-eyebrow">
                {m.demo ? '自动驾驶演示结果' : raceSourceLabel(source()) + ' 对局结果'}
              </span>
              <h2>
                {result === 'tie'
                  ? '双方平局'
                  : result === 'player'
                    ? m.demo
                      ? '玩家席领先'
                      : '你赢了！'
                    : 'AI 获胜'}
              </h2>
              <table>
                <thead>
                  <tr>
                    <th>本局表现</th>
                    <th>玩家{m.demo ? '席' : ''}</th>
                    <th>AI</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>得分</td>
                    <td>{m.player.score}</td>
                    <td>{m.ai.score}</td>
                  </tr>
                  <tr>
                    <td>生存秒数</td>
                    <td>{seconds(m.playerTicks)}</td>
                    <td>{seconds(m.aiTicks)}</td>
                  </tr>
                  <tr>
                    <td>击杀 / 最大连击</td>
                    <td>
                      {m.player.enemiesKilled} / {m.player.maxCombo}
                    </td>
                    <td>
                      {m.ai.enemiesKilled} / {m.ai.maxCombo}
                    </td>
                  </tr>
                  <tr>
                    <td>受伤次数</td>
                    <td>{m.player.raceDamageTaken}</td>
                    <td>{m.ai.raceDamageTaken}</td>
                  </tr>
                  <tr>
                    <td>补给拾取 / 漏过</td>
                    <td>
                      {m.player.powerUpsCollected ?? 0} / {m.player.powerUpsMissed ?? 0}
                    </td>
                    <td>
                      {m.ai.powerUpsCollected ?? 0} / {m.ai.powerUpsMissed ?? 0}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p>
                种子 {m.seed} · 敌机 {m.enemySpeed}× · {raceSourceLabel(source())}
                {modeRef.current === 'pyramid' && ` · ${controllers.ai.stats.model}`}
              </p>
              <div className="race-result-buttons">
                <button className="race-primary" onClick={() => start(m.seed)}>
                  同种子重赛
                </button>
                <button onClick={() => start(newSeed())}>新关卡</button>
              </div>
              {!!history.length && (
                <small>
                  最近对局：
                  {history.slice(0, 3).map((h, i) => (
                    <span key={i}>
                      {h.demo ? '演示' : '竞技'} / {raceSourceLabel(h.source)} · {h.playerScore} :{' '}
                      {h.aiScore} · 种子 {h.seed} · 敌机 {h.enemySpeed ?? 1}×
                      <br />
                    </span>
                  ))}
                </small>
              )}
            </div>
          </div>
        )}
      </section>
      <footer className="race-footer">
        <span>方向键 / WASD 移动 · 自动射击 · C 技能 · X 炸弹 · Esc 暂停</span>
        <div>
          <button
            disabled={ready || m.paused || m.finished || m.demo}
            onClick={() => {
              inputRef.current.skill = true;
            }}
          >
            技能
          </button>
          <button
            disabled={ready || m.paused || m.finished || m.demo || (m.player.raceBombs ?? 0) <= 0}
            onClick={() => {
              inputRef.current.bomb = true;
            }}
          >
            炸弹 {m.player.raceBombs}
          </button>
        </div>
      </footer>
    </main>
  );
}
