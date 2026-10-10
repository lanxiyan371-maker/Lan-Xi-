import type { Match } from './match';
import { winner } from './match';

export const RACE_HISTORY_KEY = 'sky_blaster_race_history_v1';
export type RaceSource = 'local-rules' | 'pyramid-npu' | 'mixed';
export const raceSourceLabel = (source: RaceSource) =>
  source === 'pyramid-npu' ? 'NPU 协同' : source === 'mixed' ? '混合练习' : '本地规则 AI';
export interface RaceResult {
  date: string;
  seed: number;
  source: RaceSource;
  model?: string;
  npuDecisions?: number;
  failures?: number;
  enemySpeed?: number;
  playerPickups?: number;
  aiPickups?: number;
  demo: boolean;
  playerScore: number;
  aiScore: number;
  playerSeconds: number;
  aiSeconds: number;
  winner: 'player' | 'ai' | 'tie';
}
export function loadRaceHistory(): RaceResult[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(RACE_HISTORY_KEY) ?? '[]');
    return Array.isArray(data)
      ? data
          .filter(
            (x) =>
              x &&
              typeof x.seed === 'number' &&
              typeof x.playerScore === 'number' &&
              typeof x.aiScore === 'number' &&
              ['local-rules', 'pyramid-npu', 'mixed'].includes(x.source),
          )
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
export function recordRace(
  m: Match,
  metadata: { source: RaceSource; model?: string; npuDecisions?: number; failures?: number } = {
    source: 'local-rules',
  },
): RaceResult[] {
  const result: RaceResult = {
    date: new Date().toLocaleString('zh-CN'),
    seed: m.seed,
    enemySpeed: m.enemySpeed,
    playerPickups: m.player.powerUpsCollected ?? 0,
    aiPickups: m.ai.powerUpsCollected ?? 0,
    ...metadata,
    demo: m.demo,
    playerScore: m.player.score,
    aiScore: m.ai.score,
    playerSeconds: m.playerTicks / 60,
    aiSeconds: m.aiTicks / 60,
    winner: winner(m.player.score, m.playerTicks, m.ai.score, m.aiTicks),
  };
  const records = [result, ...loadRaceHistory()].slice(0, 20);
  try {
    localStorage.setItem(RACE_HISTORY_KEY, JSON.stringify(records));
  } catch {
    /* session result remains visible */
  }
  return records;
}
