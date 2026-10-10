import { useState } from 'react';
import type { PyramidController } from '../game/race/pyramid';
import { AI_KEYS } from '../game/race/telemetry';
import './decision-panel.css';

export function DecisionPanel({
  controller,
  active,
  status,
  title = 'AI 决策框',
}: {
  controller: PyramidController;
  active: boolean;
  status: string;
  title?: string;
}) {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  const t = controller.telemetry;
  return (
    <details
      className="ai-decision-panel"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        {title}
        <span>{active ? '实时' : status}</span>
      </summary>
      <div className="ai-decision-body">
        <dl>
          <dt>NPU 战术</dt>
          <dd>{active ? t.tactic : status}</dd>
          <dt>实际动作</dt>
          <dd>{active ? t.action : '已停止输出按键'}</dd>
        </dl>
        <div className="ai-keyboard" aria-label="AI 输出虚拟按键">
          {AI_KEYS.map(([key, label, name]) => (
            <span
              key={key}
              className={active && t.input[key] ? 'is-held' : ''}
              data-key={key}
              data-pressed={active && t.input[key]}
              title={name}
            >
              <kbd>{label}</kbd>
              <small>{name}</small>
            </span>
          ))}
        </div>
        <small>虚拟控制输入；射击受间隔限制，技能受冷却限制。</small>
        <p className="ai-decision-latency">
          NPU {controller.stats.npuMs.toFixed(1)} ms · 往返 {controller.stats.endToEndMs.toFixed(1)}{' '}
          ms
        </p>
        <b className="ai-recent-title">最近动作变化（游戏时间）</b>
        <ol>
          {t.history.map((h, i) => (
            <li key={`${h.tick}-${i}`}>
              <time>{(h.tick / 60).toFixed(1)}s</time>
              <span>
                {h.tactic} → {h.action}
                <small>{h.keys}</small>
              </span>
            </li>
          ))}
        </ol>
        {!t.history.length && <small>开局后显示决策记录</small>}
      </div>
    </details>
  );
}
