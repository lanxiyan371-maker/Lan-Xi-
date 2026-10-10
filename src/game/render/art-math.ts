export function animationFrame(progress: number, count: number, loop = false): number {
  const t = loop ? ((progress % 1) + 1) % 1 : Math.max(0, Math.min(1, progress));
  return Math.min(count - 1, Math.floor(t * count));
}

export function fitSprite(sw: number, sh: number, width: number, height: number): [number, number] {
  const scale = Math.min(width / sw, height / sh);
  return [sw * scale, sh * scale];
}
