import type { GameData } from '../game/types';
import type { InputState } from './input';
import { isCoopMode } from '../game/coop';
import { PyramidController } from '../game/race/pyramid';

export class SoloPilot {
  enabled = false;
  label = '手动驾驶';
  private lastFrame = -1;
  private lastState: GameData['state'] = 'menu';
  constructor(readonly controller = new PyramidController()) {}
  drive(g: GameData, manual: InputState, now: number): InputState {
    if (g.frameCount < this.lastFrame || (g.state === 'playing' && this.lastState === 'menu'))
      this.controller.reset();
    if (g.state !== 'playing' && this.lastState === 'playing') this.controller.invalidate();
    this.lastFrame = g.frameCount;
    this.lastState = g.state;
    if (!this.enabled || isCoopMode(g) || g.state !== 'playing') {
      if (g.state === 'menu') g.aiDemo = false;
      this.label = this.enabled && !isCoopMode(g) ? 'AI 已开启 · 等待开局' : '手动驾驶';
      return manual;
    }
    g.aiDemo = true;
    const decision = this.controller.update(g, g.frameCount, now);
    this.label = decision.label;
    return { ...decision.input, pause: manual.pause };
  }
  dispose() {
    this.controller.invalidate();
  }
}
