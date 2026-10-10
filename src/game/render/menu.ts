import type { GameData } from '../types';
import { drawArt } from './art';
import { CANVAS_W, CANVAS_H } from '../core/constants';
import { loadHighScores } from '../storage/highscores';
import { AIRCRAFT } from '../aircraft';
import { getWeapon } from '../weapons';
import {
  MODE_INFO,
  DIFFICULTY_INFO,
  getDailyModifierLabel,
  getDailySeed,
  pickDailyModifier,
  isPracticeMode,
  practiceStartWaveLabel,
} from '../modes';
import { isAircraftUnlocked, isWeaponUnlocked, canAffordUnlock, loadCoins } from '../progress';
import { isCoopMode, describeCoopLobby } from '../coop';
import { getMenuLayout } from './menu-layout';

export function drawMenu(ctx: CanvasRenderingContext2D, g: GameData): void {
  const showPracticeStart = isPracticeMode(g);
  const showCoopLobby = isCoopMode(g);
  const layout = getMenuLayout(showPracticeStart, showCoopLobby);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.textAlign = 'center';
  drawArt(ctx, `player_${g.selectedAircraft}`, CANVAS_W / 2, 65, 68, 68);

  ctx.save();
  ctx.shadowColor = '#0af';
  ctx.shadowBlur = 40;
  ctx.fillStyle = '#fff';
  ctx.font =
    'bold 42px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText('苍穹战机', CANVAS_W / 2, layout.titleY);
  ctx.restore();

  ctx.fillStyle = '#6bf';
  ctx.font = '14px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText('V2 · 像素末世行动', CANVAS_W / 2, layout.subtitleY);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#fd4';
  ctx.font =
    'bold 14px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText(`¢ ${loadCoins().toLocaleString()}`, CANVAS_W - 12, 28);
  ctx.textAlign = 'center';

  const mode = MODE_INFO[g.gameMode];
  ctx.fillStyle = '#fd4';
  ctx.font =
    'bold 13px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText('选择模式', CANVAS_W / 2, layout.mode.labelY);
  ctx.fillStyle = '#8df';
  ctx.font =
    'bold 20px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText(`▲  ${mode.name.toUpperCase()}  ▼`, CANVAS_W / 2, layout.mode.valueY);
  ctx.fillStyle = '#889';
  ctx.font = '11px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText(mode.tagline, CANVAS_W / 2, layout.mode.taglineY);
  if (g.gameMode === 'daily') {
    ctx.fillStyle = '#da8';
    ctx.fillText(
      `今日规则：${getDailyModifierLabel(pickDailyModifier(getDailySeed()))}`,
      CANVAS_W / 2,
      layout.mode.dailyY,
    );
  }

  const craft = AIRCRAFT[g.selectedAircraft];
  const weapon = getWeapon(g.selectedWeapon);
  const craftUnlocked = isAircraftUnlocked(g.selectedAircraft);
  const weaponUnlocked = isWeaponUnlocked(g.selectedWeapon);
  ctx.fillStyle = '#fd4';
  ctx.font =
    'bold 13px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText('选择战机', CANVAS_W / 2, layout.aircraft.labelY);
  ctx.fillStyle = craftUnlocked ? craft.hullTop : '#888';
  ctx.font =
    'bold 20px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText(
    `◀  ${craft.name.toUpperCase()}${craftUnlocked ? '' : ' 🔒'}  ▶`,
    CANVAS_W / 2,
    layout.aircraft.valueY,
  );
  ctx.fillStyle = '#aac';
  ctx.font = '11px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText(craft.tagline, CANVAS_W / 2, layout.aircraft.valueY + 16);
  if (!craftUnlocked) {
    ctx.fillStyle = canAffordUnlock(craft.coinCost) ? '#8f8' : '#f88';
    ctx.font =
      '10px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText(`${craft.coinCost} 金币 · 按 U 解锁`, CANVAS_W / 2, layout.aircraft.detailY);
  } else {
    ctx.fillStyle = '#889';
    ctx.font =
      '10px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText(
      `速度 ${craft.speed}  ·  生命 ${craft.startHp}/${craft.maxHp}  ·  ${craft.skillName}`,
      CANVAS_W / 2,
      layout.aircraft.detailY,
    );
  }

  ctx.fillStyle = '#fd4';
  ctx.font =
    'bold 13px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText('选择武器', CANVAS_W / 2, layout.weapon.labelY);
  ctx.fillStyle = weaponUnlocked ? weapon.hudColor : '#888';
  ctx.font =
    'bold 18px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText(
    `◀  ${weapon.name.toUpperCase()}${weaponUnlocked ? '' : ' 🔒'}  ▶`,
    CANVAS_W / 2,
    layout.weapon.valueY,
  );
  if (!weaponUnlocked) {
    ctx.fillStyle = canAffordUnlock(weapon.coinCost) ? '#8f8' : '#f88';
    ctx.font =
      '10px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText(`${weapon.coinCost} 金币 · 按 U 解锁`, CANVAS_W / 2, layout.weapon.detailY);
  } else {
    ctx.fillStyle = '#889';
    ctx.font =
      '10px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText(weapon.tagline, CANVAS_W / 2, layout.weapon.detailY);
  }

  const diff = DIFFICULTY_INFO[g.difficulty];
  ctx.fillStyle = '#fd4';
  ctx.font =
    'bold 13px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText('选择难度', CANVAS_W / 2, layout.difficulty.labelY);
  ctx.fillStyle = diff.color;
  ctx.font =
    'bold 18px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText(`◀  ${diff.name.toUpperCase()}  ▶`, CANVAS_W / 2, layout.difficulty.valueY);
  ctx.fillStyle = '#889';
  ctx.font = '10px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
  ctx.fillText(diff.tagline, CANVAS_W / 2, layout.difficulty.taglineY);

  if (showPracticeStart) {
    const sw = layout.startWave;
    ctx.fillStyle = '#fd4';
    ctx.font =
      'bold 13px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText('起始波次', CANVAS_W / 2, sw.labelY);
    ctx.fillStyle = '#8df';
    ctx.font =
      'bold 18px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText(`◀  第 ${g.practiceStartWave} 波  ▶`, CANVAS_W / 2, sw.valueY);
    ctx.fillStyle = '#889';
    ctx.font =
      '10px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText(practiceStartWaveLabel(g.practiceStartWave), CANVAS_W / 2, sw.taglineY);
  }

  if (showCoopLobby) {
    const cl = layout.coopLobby;
    const lobbyCopy = describeCoopLobby(g);
    ctx.fillStyle = '#fd4';
    ctx.font =
      'bold 13px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText('合作大厅', CANVAS_W / 2, cl.labelY);
    ctx.fillStyle = g.coopLobbyStatus === 'error' ? '#f88' : '#8df';
    ctx.font =
      'bold 15px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText(lobbyCopy.value, CANVAS_W / 2, cl.valueY);
    ctx.fillStyle = '#889';
    ctx.font =
      '10px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText(lobbyCopy.detail, CANVAS_W / 2, cl.detailY);
  }

  const ready = isAircraftUnlocked(g.selectedAircraft) && isWeaponUnlocked(g.selectedWeapon);
  let startReady = ready;
  let startText = ready ? '点击屏幕或按空格开始' : '请先解锁所选战机和武器';
  if (showCoopLobby) {
    if (g.coopRole === 'host') {
      startReady = g.coopLobbyCanStart;
      startText = g.coopLobbyCanStart ? '按空格开始' : '等待队友加入…';
    } else if (g.coopRole === 'guest') {
      startReady = false;
      startText = '等待房主开始…';
    } else {
      startReady = false;
      startText = 'H 创建房间 · J 加入房间';
    }
  }
  ctx.globalAlpha = startReady ? 0.5 + Math.sin(Date.now() * 0.004) * 0.5 : 0.7;
  ctx.fillStyle = startReady ? '#fff' : '#f88';
  ctx.font = `${startReady ? '20' : '16'}px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif`;
  ctx.fillText(startText, CANVAS_W / 2, layout.start.textY);
  ctx.globalAlpha = 1;

  const lines: [string, string][] = [
    ['↑ / ↓', '选择模式'],
    ['← / →', '选择战机'],
    ['[ / ]', '选择武器'],
    [', / .', '选择难度'],
    ['U', '解锁当前选择'],
    ['SPACE / Z', '射击 / 开始'],
    ['X / B', '清屏炸弹'],
    ['F', '切换自动射击'],
    ['I', '练习模式：切换无敌'],
    ['- / =', '练习起始波次'],
  ];
  const controlsTop = layout.controls.topY;
  const controlsStep = layout.controls.step;
  lines.forEach(([k, v], i) => {
    const y = controlsTop + i * controlsStep;
    ctx.fillStyle = '#aac';
    ctx.font =
      '11px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(k, CANVAS_W / 2 - 8, y);
    ctx.fillStyle = '#88a';
    ctx.textAlign = 'left';
    ctx.fillText(v, CANVAS_W / 2 + 8, y);
  });

  const sc = loadHighScores();
  if (sc.length) {
    const scoresTop = controlsTop + lines.length * controlsStep + 18;
    ctx.strokeStyle = '#ffffff22';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, scoresTop - 10);
    ctx.lineTo(CANVAS_W - 40, scoresTop - 10);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fd4';
    ctx.font =
      'bold 13px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",Arial,sans-serif';
    ctx.fillText('最高纪录', CANVAS_W / 2, scoresTop);
    ctx.font = '10px "Microsoft YaHei","Noto Sans CJK SC","PingFang SC","Segoe UI",monospace';
    sc.slice(0, 3).forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#fd4' : '#aac';
      ctx.fillText(
        `${i + 1}. ${String(s.score).padStart(8)}  第${s.wave}波  ${s.date}`,
        CANVAS_W / 2,
        scoresTop + 16 + i * 15,
      );
    });
  }
}
