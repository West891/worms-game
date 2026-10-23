// Заранее нарисованные спрайты свечения и огня: градиент в каждом кадре
// дорог на телефонах, а готовая картинка рисуется почти бесплатно.
const glowCache = new Map();

// Круглое свечение заданного цвета ('255,170,40'), прозрачное к краям.
export function glowSprite(rgb) {
  let c = glowCache.get(rgb);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(0.4, `rgba(${rgb},0.45)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowCache.set(rgb, c);
  return c;
}

let flame = null;
// Язычок пламени: основание внизу по центру, высота 32.
export function flameSprite() {
  if (flame) return flame;
  flame = document.createElement('canvas');
  flame.width = 24;
  flame.height = 32;
  const ctx = flame.getContext('2d');
  const g = ctx.createRadialGradient(12, 24, 0, 12, 22, 16);
  g.addColorStop(0, 'rgba(255,235,140,1)');
  g.addColorStop(0.45, 'rgba(255,130,30,0.75)');
  g.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(2, 30);
  ctx.quadraticCurveTo(3, 10, 12, 1);
  ctx.quadraticCurveTo(21, 10, 22, 30);
  ctx.closePath();
  ctx.fill();
  return flame;
}
