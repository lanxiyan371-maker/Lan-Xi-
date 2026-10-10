import { createInputState, type InputState } from '../../app/input';

export const AI_KEYS = [
  ['up', '↑', '向上'],
  ['left', '←', '向左'],
  ['down', '↓', '向下'],
  ['right', '→', '向右'],
  ['shoot', '射击', '自动射击'],
  ['skill', 'C', '技能'],
  ['bomb', 'X/B', '炸弹'],
] as const;
export interface DecisionTelemetry {
  tactic: string;
  action: string;
  input: InputState;
  history: { tick: number; tactic: string; action: string; keys: string }[];
}
export function emptyTelemetry(): DecisionTelemetry {
  return { tactic: '等待 NPU', action: '等待开始', input: createInputState(), history: [] };
}
export function pressedKeys(input: InputState): string {
  return (
    AI_KEYS.filter(([key]) => input[key])
      .map(([, label]) => label)
      .join(' + ') || '无'
  );
}
