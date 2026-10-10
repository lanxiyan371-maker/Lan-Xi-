import type { GameData } from '../types';
import { drawArtExplosion } from './art';
import { CANVAS_W, CANVAS_H, GRAZE_RADIUS } from '../core/constants';
import { getWaveAnnounce } from '../modes';
import { getChapter } from '../chapters';

export function drawParticles(ctx: CanvasRenderingContext2D, g: GameData) {
  ctx.save();
  // lighter compositing makes particle glow visible on the dark background
  ctx.globalCompositeOperation = 'lighter';
  for (const pt of g.particles) {
    if (pt.type === 'score') continue;
    const a = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    if (pt.type === 'ring' && ['#ff6644', '#ff994488', '#ff884488', '#ff4444'].includes(pt.color)) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, a * 2);
      const rendered = drawArtExplosion(ctx, pt.x, pt.y, 1 - a, (pt.startSize ?? 35) * 2);
      ctx.restore();
      if (rendered) continue;
    }
    if (pt.type === 'ring') {
      const progress = 1 - a;
      const r = (pt.startSize ?? 30) * progress;
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = Math.max(0.5, 3 * a);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (pt.type === 'spark') {
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate(Math.atan2(pt.vy, pt.vx));
      ctx.fillRect(-pt.size, -pt.size / 3, pt.size * 2, pt.size * 0.6);
      ctx.restore();
    } else if (pt.type === 'ember') {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, Math.max(0.3, pt.size * a * 0.7), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, Math.max(0.5, pt.size * a), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Restore default compositing for readable score text
  for (const pt of g.particles) {
    if (pt.type !== 'score') continue;
    const a = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.font = `bold ${pt.size}px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(pt.text ?? '', pt.x, pt.y);
  }
  ctx.globalAlpha = 1;
}

export function drawFlashOverlay(ctx: CanvasRenderingContext2D, g: GameData) {
  if (g.flashAlpha > 0) {
    ctx.globalAlpha = g.flashAlpha;
    ctx.fillStyle = g.flashColor;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.globalAlpha = 1;
  }
}

export function drawDangerVignette(ctx: CanvasRenderingContext2D, g: GameData) {
  if (g.dangerAlpha > 0.01) {
    const vg = ctx.createRadialGradient(
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_H * 0.3,
      CANVAS_W / 2,
      CANVAS_H / 2,
      CANVAS_H * 0.7,
    );
    vg.addColorStop(0, 'transparent');
    vg.addColorStop(1, '#ff000044');
    ctx.globalAlpha = g.dangerAlpha;
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.globalAlpha = 1;
  }
}

export function drawGrazeIndicator(ctx: CanvasRenderingContext2D, g: GameData) {
  if (g.player.grazeTimer > 0) {
    ctx.globalAlpha = (g.player.grazeTimer / 0.3) * 0.4;
    ctx.strokeStyle = '#aaeeff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(g.player.x, g.player.y, GRAZE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

export function drawComboBanner(ctx: CanvasRenderingContext2D, g: GameData) {
  if (g.state !== 'playing' || g.combo < 3) return;
  ctx.globalAlpha = Math.min(1, g.comboTimer);
  ctx.fillStyle = '#fd0';
  ctx.font =
    'bold 28px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.textAlign = 'center';
  const bx = Math.sin(Date.now() * 0.01) * 3;
  ctx.fillText(`${g.combo} 连击！`, CANVAS_W / 2, 120 + bx);
  ctx.globalAlpha = 1;
}

export function drawWaveAnnounce(ctx: CanvasRenderingContext2D, g: GameData) {
  if (g.waveAnnounceTimer > 0 && g.wave > 0) {
    const t = g.waveAnnounceTimer;
    let a = 1;
    if (t > 70) a = (90 - t) / 20;
    else if (t < 20) a = t / 20;
    a = Math.max(0, Math.min(1, a));
    const announce = getWaveAnnounce(g);
    const chapter = getChapter(g.chapterId);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(CANVAS_W / 2, CANVAS_H / 2 - 30);
    ctx.scale(1 + (1 - a) * 0.3, 1 + (1 - a) * 0.3);
    ctx.font =
      'bold 32px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.textAlign = 'center';
    if (announce.boss) {
      ctx.fillStyle = '#f44';
      ctx.shadowColor = '#f00';
      ctx.shadowBlur = 20;
    } else ctx.fillStyle = '#fff';
    ctx.fillText(announce.main, 0, 0);
    if (announce.sub) {
      ctx.font =
        '14px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
      ctx.fillStyle = chapter.hudColor;
      ctx.fillText(announce.sub, 0, 24);
    }
    ctx.restore();
  }
}

export function drawPausedOverlay(ctx: CanvasRenderingContext2D, g: GameData) {
  if (g.state !== 'paused') return;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#fff';
  ctx.font =
    'bold 40px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('已暂停', CANVAS_W / 2, CANVAS_H / 2 - 20);
  ctx.font = '18px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillStyle = '#aac';
  ctx.fillText('按 Esc 或点击屏幕继续', CANVAS_W / 2, CANVAS_H / 2 + 20);
}

export function drawSlowMotionOverlay(ctx: CanvasRenderingContext2D, g: GameData) {
  if (g.slowMotion < 1) {
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#88aaff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.globalAlpha = 1;
  }
}
