import { useRef, useCallback, useEffect, useState } from 'react';
import RaceApp from './app/race/RaceApp';
import { createGameData, togglePause, resetGame, canStartGame } from './game/engine';
import { createInputState } from './app/input';
import { CANVAS_W, CANVAS_H } from './game/core/constants';
import { useGameLoop } from './app/use-game-loop';
import { useKeyboardInput } from './app/use-keyboard-input';
import { usePointerInput } from './app/use-pointer-input';
import { CoopSession } from './net/coop-session';
import { leaveCoopEndless } from './app/coop-actions';
import type { GameData } from './game/types';
import { SoloPilot } from './app/solo-pilot';
import { DecisionPanel } from './app/DecisionPanel';
import { isCoopMode } from './game/coop';
import { ENEMY_SPEEDS } from './game/race/match';

export default function App() {
  const [race, setRace] = useState(window.location.hash === '#race');
  useEffect(() => {
    const changed = () => setRace(window.location.hash === '#race');
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  return race ? <RaceApp /> : <SoloApp />;
}

function SoloApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameData>(createGameData());
  const inputRef = useRef(createInputState());
  const rafRef = useRef<number>(0);
  const sessionRef = useRef(new CoopSession());
  const [pilot] = useState(() => new SoloPilot());
  const [connected, setConnected] = useState(false);
  const [, refresh] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => refresh((v) => v + 1), 200);
    const cancel = new AbortController();
    fetch('/api/pyramid/info', { signal: cancel.signal })
      .then(async (response) => {
        const info = await response.json();
        setConnected(response.ok && info.connected === true);
      })
      .catch(() => setConnected(false));
    const blur = () => {
      if (pilot.enabled && gameRef.current.state === 'playing') togglePause(gameRef.current);
      pilot.dispose();
    };
    window.addEventListener('blur', blur);
    return () => {
      clearInterval(timer);
      cancel.abort();
      pilot.dispose();
      window.removeEventListener('blur', blur);
    };
  }, []);
  const stats = pilot.controller.stats;
  const game = gameRef.current;

  const getCanvasScale = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / CANVAS_W, rect.height / CANVAS_H);
    return {
      scale,
      offsetX: (rect.width - CANVAS_W * scale) / 2,
      offsetY: (rect.height - CANVAS_H * scale) / 2,
      rect,
    };
  }, []);

  useGameLoop(canvasRef, gameRef, inputRef, rafRef, sessionRef, (g, input, now) =>
    pilot.drive(g, input, now),
  );
  useKeyboardInput(gameRef, inputRef, sessionRef);
  usePointerInput(canvasRef, gameRef, inputRef, sessionRef, getCanvasScale);

  return (
    <div
      className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ maxWidth: '100vw', maxHeight: '100vh' }}
      />
      <button
        type="button"
        onKeyDown={(event) => event.stopPropagation()}
        onKeyUp={(event) => event.stopPropagation()}
        onClick={() => {
          leaveCoopEndless(gameRef.current, sessionRef.current);
          inputRef.current = createInputState();
          gameRef.current.state = 'menu';
          pilot.dispose();
        }}
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          padding: '7px 12px',
          background: '#29321fe8',
          border: '1px solid #b59f62',
          color: '#f3deb0',
          fontSize: 12,
          borderRadius: 3,
          cursor: 'pointer',
        }}
      >
        返回首页
      </button>
      <a
        href="#race"
        style={{
          position: 'absolute',
          top: 48,
          right: 12,
          padding: '7px 12px',
          background: '#29321fe8',
          border: '1px solid #b59f62',
          color: '#f3deb0',
          fontSize: 12,
          borderRadius: 3,
        }}
      >
        玩家 vs AI · 同关竞技
      </a>
      <details
        style={{
          position: 'absolute',
          bottom: 10,
          left: 12,
          width: 280,
          maxWidth: 'calc(100vw - 24px)',
          padding: '8px 12px',
          background: '#192319ee',
          border: '1px solid #b59f62',
          borderRadius: 3,
          color: '#f3deb0',
          fontSize: 12,
          touchAction: 'auto',
        }}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
      >
        <summary style={{ cursor: 'pointer' }}>
          个人关卡 AI 控制 · {pilot.enabled ? '已开启' : '手动'}
        </summary>
        <label style={{ display: 'block', marginTop: 8 }}>
          <input
            type="checkbox"
            aria-label="个人关卡 Pyramid 自动驾驶"
            checked={pilot.enabled}
            disabled={!connected || isCoopMode(game)}
            onChange={(e) => {
              pilot.enabled = e.target.checked;
              pilot.controller.reset();
              inputRef.current = createInputState();
              refresh((v) => v + 1);
            }}
          />{' '}
          Pyramid 自动驾驶
        </label>
        <label style={{ display: 'block', marginTop: 8 }}>
          敌机速度{' '}
          <select
            aria-label="个人关卡敌机速度"
            value={game.enemySpeedScale ?? 1}
            disabled={game.state !== 'menu' || isCoopMode(game)}
            onChange={(e) => {
              game.enemySpeedScale = Number(e.target.value);
              refresh((v) => v + 1);
            }}
            style={{ background: '#0f1510', color: '#f3deb0', padding: 3 }}
          >
            {ENEMY_SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}×
              </option>
            ))}
          </select>
        </label>
        {game.state === 'menu' && (
          <button
            type="button"
            disabled={!connected || isCoopMode(game) || !canStartGame(game)}
            onClick={() => {
              pilot.enabled = true;
              pilot.controller.reset();
              inputRef.current = createInputState();
              resetGame(game);
              game.aiDemo = true;
              refresh((v) => v + 1);
            }}
            style={{ marginTop: 8, padding: '4px 8px', border: '1px solid #b59f62' }}
          >
            开始个人 AI 关卡
          </button>
        )}
        {(game.state === 'playing' || game.state === 'paused') && (
          <button
            type="button"
            onClick={() => {
              togglePause(game);
              pilot.dispose();
              refresh((v) => v + 1);
            }}
            style={{ marginTop: 8, padding: '4px 8px', border: '1px solid #b59f62' }}
          >
            {game.state === 'paused' ? '继续个人关卡' : '暂停个人关卡'}
          </button>
        )}
        <small
          style={{ display: 'block', marginTop: 7, lineHeight: 1.7 }}
          data-testid="solo-pilot-status"
        >
          {connected ? pilot.label : '请通过“一键启动Pyramid竞技”连接设备'}
          <br />
          NPU {stats.npuMs.toFixed(1)} ms · 端到端 {stats.endToEndMs.toFixed(1)} ms
          <br />
          有效决策 {stats.successes} · 失败 {stats.failures} · 拾取补给{' '}
          {game.powerUpsCollected ?? 0}
          <br />
          {game.aiDemo || pilot.enabled
            ? 'AI 演示不写入普通金币、成就和高分。'
            : '开启 AI 后按空格或点击首页开始。'}
        </small>
      </details>
      {pilot.enabled && !isCoopMode(game) && (
        <aside
          className="solo-decision-sidebar"
          aria-label="个人关卡 AI 决策监控"
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
        >
          <DecisionPanel
            controller={pilot.controller}
            active={game.state === 'playing'}
            status={
              game.state === 'menu' ? '等待开始' : game.state === 'gameover' ? '战斗结束' : '已暂停'
            }
          />
        </aside>
      )}
    </div>
  );
}
