import type { GameData } from '../types';
import { CANVAS_W, CANVAS_H } from '../core/constants';
import { loadHighScores } from '../storage/highscores';
import { formatAccuracy } from '../run-stats';

/** Advance baseline after a line (canvas fillText y is the baseline, not the top). */
function lineStep(y: number, fontSize: number, gap = 14): number {
  return y + fontSize + gap;
}

export function drawGameOver(ctx: CanvasRenderingContext2D, g: GameData) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';

  if (g.modeVictory) {
    ctx.save();
    ctx.shadowColor = '#4f8';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#4f8';
    ctx.font =
      'bold 40px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText('任务完成', CANVAS_W / 2, 195);
    ctx.restore();
    ctx.fillStyle = '#aac';
    ctx.font =
      '14px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText('已通关全部四个章节', CANVAS_W / 2, 230);
  } else {
    ctx.save();
    ctx.shadowColor = '#f44';
    ctx.shadowBlur = 25;
    ctx.fillStyle = '#f44';
    ctx.font =
      'bold 44px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText('战斗结束', CANVAS_W / 2, 195);
    ctx.restore();
  }

  ctx.fillStyle = '#fff';
  ctx.font = '24px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText(`得分：${g.score.toLocaleString()}`, CANVAS_W / 2, g.modeVictory ? 270 : 255);

  ctx.fillStyle = '#aac';
  ctx.font = '14px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  const progressLabel = g.gameMode === 'story' ? `第 ${g.wave} 关` : `第 ${g.wave} 波`;
  const progressY = g.modeVictory ? 300 : 285;
  ctx.fillText(
    `${progressLabel}  ·  连击 ${g.maxCombo}x  ·  擦弹 ${g.player.grazeCount}`,
    CANVAS_W / 2,
    progressY,
  );

  ctx.fillStyle = '#889';
  ctx.font = '13px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  let y = lineStep(progressY, 13, 12);
  ctx.fillText(
    `命中率 ${formatAccuracy(g.shotsHit, g.shotsFired)}  ·  伤害 ${Math.round(g.damageDealt).toLocaleString()}  ·  击落 ${g.enemiesKilled}`,
    CANVAS_W / 2,
    y,
  );
  y = lineStep(y, 13, 15);
  const sc = loadHighScores();
  const isNewHighScore =
    g.gameMode !== 'practice' && sc.length > 0 && sc[0].score === g.score && !g.modeVictory;

  if (g.runCoinsEarned > 0) {
    ctx.fillStyle = '#fd4';
    ctx.font =
      'bold 15px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText(`+${g.runCoinsEarned.toLocaleString()} 金币`, CANVAS_W / 2, y);
    y = lineStep(y, 15);
  }

  if (isNewHighScore) {
    ctx.fillStyle = '#fd4';
    ctx.font =
      'bold 18px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText('★ 创下新纪录！ ★', CANVAS_W / 2, y);
    y = lineStep(y, 18);
  }

  const highScoresTop = Math.max(y + 18, 372);
  ctx.fillStyle = '#fd4';
  ctx.font =
    'bold 15px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText('最高纪录', CANVAS_W / 2, highScoresTop);
  ctx.font = '12px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",monospace';
  sc.slice(0, 5).forEach((s, i) => {
    ctx.fillStyle = s.score === g.score ? '#fd4' : '#aac';
    ctx.fillText(
      `${i + 1}. ${String(s.score).padStart(8)}  第${s.wave}波  ${s.date}`,
      CANVAS_W / 2,
      highScoresTop + 22 + i * 20,
    );
  });

  ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.004) * 0.5;
  ctx.fillStyle = '#fff';
  ctx.font = '20px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  const continueHint =
    g.gameMode === 'coop_endless'
      ? g.coopRole === 'host'
        ? '按空格或点击屏幕再战'
        : '按空格或点击返回大厅'
      : '点击屏幕或按空格重新开始';
  ctx.fillText(continueHint, CANVAS_W / 2, 540);
  ctx.globalAlpha = 1;
}
