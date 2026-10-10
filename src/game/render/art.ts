import { SPRITES, type SpriteId } from './art-atlas';
import { animationFrame, fitSprite } from './art-math';
import type { Bullet, Enemy, GameData } from '../types';

const images = new Map<string, HTMLImageElement>();
const cache = new Map<SpriteId, HTMLCanvasElement>();

function sprite(id: SpriteId): HTMLCanvasElement | undefined {
  const ready = cache.get(id);
  if (ready) return ready;
  if (typeof Image === 'undefined' || typeof document === 'undefined') return;
  const region = SPRITES[id];
  let img = images.get(region.file);
  if (!img) {
    img = new Image();
    images.set(region.file, img);
    img.onload = () => {
      // Cache all cells before releasing the large decoded source atlas.
      for (const key of Object.keys(SPRITES) as SpriteId[]) {
        if (SPRITES[key].file === region.file) sprite(key);
      }
      images.delete(region.file);
    };
    img.src = new URL(`./art-v2/${region.file}`, document.baseURI).href;
  }
  if (!img.complete || !img.naturalWidth) return;
  const [x, y, w, h] = region.rect;
  const max = id.startsWith('bg_') ? 700 : id.startsWith('boss_') ? 128 : 64;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const context = canvas.getContext('2d');
  if (!context) return;
  context.imageSmoothingEnabled = false;
  context.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
  cache.set(id, canvas);
  return canvas;
}

// Load once, outside the simulation. No frame-by-frame decoding or atlas cropping.
if (typeof window !== 'undefined') {
  for (const id of Object.keys(SPRITES) as SpriteId[]) sprite(id);
}

export function drawArt(
  ctx: CanvasRenderingContext2D,
  id: SpriteId,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
): boolean {
  const source = sprite(id);
  if (!source) return false;
  const [w, h] = fitSprite(source.width, source.height, width, height);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(x, y);
  ctx.rotate(rotation);
  if (id.startsWith('player_') || id.startsWith('enemy_') || id.startsWith('boss_')) {
    ctx.shadowColor = '#c9af78';
    ctx.shadowBlur = 2;
  }
  ctx.drawImage(source, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

export function drawArtBackground(ctx: CanvasRenderingContext2D, g: GameData): boolean {
  const source = sprite(`bg_${g.chapterId}`);
  if (!source) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // Bounded pan: supplied backgrounds have not been authored as seamless tiles.
  const offset = Math.sin(g.frameCount * 0.0015) * 24;
  ctx.drawImage(source, -20, -35 + offset, 440, 770);
  ctx.fillStyle = 'rgba(7,10,9,0.48)';
  ctx.fillRect(0, 0, 400, 700);
  ctx.restore();
  return true;
}

export function enemyArt(e: Enemy): SpriteId {
  return e.type === 'boss' ? `boss_${e.bossPattern ?? 'fan'}` : `enemy_${e.type}`;
}

export function bulletArt(b: Bullet): SpriteId {
  if (b.isPlayer) return `bullet_${b.weapon ?? (b.homingStrength ? 'homing' : 'standard')}`;
  return b.width >= 10 ? 'bullet_heavy' : b.height > b.width * 2 ? 'bullet_needle' : 'bullet_enemy';
}

export function drawArtExplosion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  size: number,
): boolean {
  const prefix = size >= 100 ? 'explosion_large' : 'explosion';
  return drawArt(ctx, `${prefix}_${animationFrame(progress, 6)}` as SpriteId, x, y, size, size);
}

export function drawArtExhaust(ctx: CanvasRenderingContext2D, frame: number, y: number): void {
  drawArt(ctx, `exhaust_${animationFrame(frame / 18, 4, true)}` as SpriteId, 0, y, 11, 20);
}
