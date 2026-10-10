import { describe, expect, it, vi } from 'vitest';
import { createMatch } from './match';
import { PyramidController } from './pyramid';

const prediction = {
  tactic: 'evade',
  model: 'laya-multilingual',
  provider: 'AxEngineExecutionProvider',
  npuMs: 29,
};
function deferred() {
  let resolve!: (r: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  return {
    fetcher,
    reply: (body: unknown = prediction) => resolve(new Response(JSON.stringify(body))),
  };
}
async function flush() {
  for (let n = 0; n < 8; n++) await Promise.resolve();
}
describe('Pyramid tactical controller', () => {
  it('calls the native fetch function without binding it to the controller', async () => {
    const original = globalThis.fetch;
    const calls: unknown[] = [];
    globalThis.fetch = function (this: unknown) {
      calls.push(this);
      return Promise.resolve(new Response(JSON.stringify(prediction)));
    } as typeof fetch;
    try {
      const c = new PyramidController();
      c.update(createMatch(7).ai, 0, 0);
      await flush();
      expect(c.stats.successes).toBe(1);
      expect(calls[0]).not.toBe(c);
    } finally {
      globalThis.fetch = original;
    }
  });
  it('allows one pending decision and accepts a measured on-chip NPU response', async () => {
    const d = deferred(),
      c = new PyramidController(d.fetcher),
      g = createMatch(1).ai;
    c.update(g, 0, 0);
    c.update(g, 1, 10);
    expect(d.fetcher).toHaveBeenCalledTimes(1);
    d.reply();
    await flush();
    expect(c.stats.successes).toBe(1);
    expect(c.stats.npuMs).toBe(29);
    expect(c.update(g, 2, 70).source).toBe('pyramid-npu');
  });
  it('ignores a response after a new round or pause invalidates it', async () => {
    const d = deferred(),
      c = new PyramidController(d.fetcher),
      g = createMatch(2).ai;
    c.update(g, 0, 0);
    c.invalidate();
    d.reply();
    await flush();
    expect(c.stats.successes).toBe(0);
    c.reset();
    expect(c.stats.fallbackUsed).toBe(false);
  });
  it('drops a response more than 30 simulation ticks old', async () => {
    const d = deferred(),
      c = new PyramidController(d.fetcher),
      g = createMatch(3).ai;
    c.update(g, 0, 0);
    c.update(g, 35, 100);
    d.reply();
    await flush();
    expect(c.stats.successes).toBe(0);
    expect(c.stats.fallbackUsed).toBe(true);
  });
  it('marks network failure and uses local rules without stopping the game', async () => {
    const c = new PyramidController(vi.fn().mockRejectedValue(new Error('offline'))),
      g = createMatch(4).ai;
    c.update(g, 0, 0);
    await flush();
    expect(c.stats.failures).toBe(1);
    expect(c.update(g, 1, 100).source).toBe('local-rules');
    expect(c.stats.fallbackUsed).toBe(true);
  });
  it('rejects unmeasured, unknown or CPU-labelled answers', async () => {
    const d = deferred(),
      c = new PyramidController(d.fetcher),
      g = createMatch(5).ai;
    c.update(g, 0, 0);
    d.reply({ ...prediction, provider: 'CPUExecutionProvider' });
    await flush();
    expect(c.stats.successes).toBe(0);
    expect(c.stats.failures).toBe(1);
  });
  it('ages out a decision and starts rule takeover when requests stall', async () => {
    const d = deferred(),
      c = new PyramidController(d.fetcher),
      g = createMatch(6).ai;
    c.update(g, 0, 0);
    d.reply();
    await flush();
    c.update(g, 10, 200);
    const decision = c.update(g, 60, 1000);
    expect(decision.source).toBe('local-rules');
    expect(c.stats.fallbackUsed).toBe(true);
    c.invalidate();
  });
});
