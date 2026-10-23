import { PHYS, WIND_ACCEL, WATER, WORLD_W } from './config.js';
import { wormCollides } from './worm.js';
import { glowSprite, flameSprite } from './sprites.js';

// Оружие. ammo: Infinity — без ограничений.
export const WEAPONS = [
  { id: 'bazooka', name: 'Базука', icon: 'bazooka', ammo: Infinity, charge: true, speed: 14, hint: 'Ракета летит по ветру' },
  { id: 'homing', name: 'Самонаводящаяся ракета', icon: 'homing', ammo: 1, charge: true, speed: 12, needsTarget: true, hint: 'Кликни цель, потом стреляй' },
  { id: 'grenade', name: 'Граната', icon: 'grenade', ammo: Infinity, charge: true, fuse: true, speed: 11, hint: 'Таймер 1–5 с, отскакивает' },
  { id: 'cluster', name: 'Кассетная граната', icon: 'cluster', ammo: 3, charge: true, fuse: true, speed: 11, hint: 'Разлетается на осколки' },
  { id: 'banana', name: 'Банановая бомба', icon: 'banana', ammo: 1, charge: true, fuse: true, speed: 11, hint: 'Пять прыгучих бананов-бомб' },
  { id: 'holy', name: 'Святая граната', icon: 'holy', ammo: 1, charge: true, speed: 10, hint: 'Аллилуйя! Огромный взрыв' },
  { id: 'molotov', name: 'Коктейль Молотова', icon: 'molotov', ammo: 2, charge: true, speed: 12, hint: 'Разливает огонь' },
  { id: 'shotgun', name: 'Дробовик', icon: 'shotgun', ammo: Infinity, shots: 2, hint: 'Два выстрела за ход' },
  { id: 'bat', name: 'Бейсбольная бита', icon: 'bat', ammo: 2, hint: 'Выбивает соседа с карты' },
  { id: 'punch', name: 'Огненный кулак', icon: 'punch', ammo: 2, hint: 'Апперкот: подбрасывает соседа' },
  { id: 'dynamite', name: 'Динамит', icon: 'dynamite', ammo: 2, hint: 'Положи и беги!' },
  { id: 'mine', name: 'Мина', icon: 'mine', ammo: 2, hint: 'Срабатывает рядом с червяком' },
  { id: 'sheep', name: 'Овца', icon: 'sheep', ammo: 1, hint: 'Бежит вперёд. «Огонь» ещё раз — взрыв' },
  { id: 'airstrike', name: 'Авиаудар', icon: 'airstrike', ammo: 1, target: true, hint: 'Кликни по карте' },
  { id: 'donkey', name: 'Бетонный осёл', icon: 'donkey', ammo: 0, target: true, hint: 'Падает с неба и пробивает всё' },
  { id: 'armageddon', name: 'Армагеддон', icon: 'armageddon', ammo: 0, hint: 'Метеоритный дождь по всей карте' },
  { id: 'quake', name: 'Землетрясение', icon: 'quake', ammo: 0, hint: 'Трясёт всех червяков на карте' },
  { id: 'rope', name: 'Ниндзя-верёвка', icon: 'rope', ammo: Infinity, rope: true, hint: 'Огонь — крюк, ←→ раскачка, ↑↓ длина, прыжок — отцепиться' },
  { id: 'drill', name: 'Лазерный бур', icon: 'drill', ammo: Infinity, drill: true, hint: 'Огонь — бурить, ↑↓ направление, огонь или прыжок — стоп' },
  { id: 'teleport', name: 'Телепорт', icon: 'teleport', ammo: 2, target: true, hint: 'Кликни, куда переместиться' },
  { id: 'skip', name: 'Пропустить ход', icon: 'skip', ammo: Infinity, hint: 'Ничего не делать' },
];

// Что может выпасть из ящика с оружием (редкое — только отсюда).
export const CRATE_WEAPONS = ['cluster', 'dynamite', 'airstrike', 'teleport', 'bat', 'mine', 'sheep', 'holy', 'banana',
  'molotov', 'homing', 'punch', 'donkey', 'armageddon', 'quake', 'donkey', 'sheep'];

export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

// Снаряды: радиус и урон взрыва, поведение при столкновении.
export const PROJ = {
  rocket: { wind: true, impact: true, hitWorms: true, explosion: [44, 50], trail: true },
  grenade: { bounce: 0.45, explosion: [44, 50] },
  cluster: { bounce: 0.45, explosion: [28, 30], children: 5 },
  bomblet: { impact: true, explosion: [20, 20] },
  missile: { impact: true, hitWorms: true, explosion: [30, 30], trail: true },
  dynamite: { bounce: 0.15, explosion: [70, 75], spark: true },
  homing: { wind: true, impact: true, hitWorms: true, explosion: [44, 50], trail: true, homing: true },
  banana: { bounce: 0.6, explosion: [40, 40], children: 5, childKind: 'bananette' },
  bananette: { bounce: 0.55, impact: true, explosion: [34, 35] },
  holy: { bounce: 0.3, explosion: [100, 100], holy: true },
  molotov: { impact: true, hitWorms: true, explosion: [16, 10], flames: 14 },
  flame: { bounce: 0.05, flame: true },
  sheep: { walker: true, explosion: [60, 70] },
  donkey: { impact: true, hitWorms: true, explosion: [52, 50], pierce: 6 },
  meteor: { impact: true, hitWorms: true, explosion: [38, 35], trail: true, fiery: true },
};

export class Projectile {
  constructor(kind, x, y, vx, vy, owner, fuse = 0) {
    this.kind = kind;
    this.cfg = PROJ[kind];
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.owner = owner;
    this.fuse = fuse; // в тиках; 0 — без таймера
    this.age = 0;
    this.rot = Math.atan2(vy, vx);
    this.spin = 0;
    this.resting = false;
    this.dead = false;
  }

  get busy() { return !this.dead; }
}

// Один тик полёта. Возвращает 'explode' | 'water' | 'bounce' | null.
export function projectileTick(p, terrain, wind, worms) {
  const cfg = p.cfg;
  if (cfg.walker) return walkerTick(p, terrain, worms);
  p.age++;
  if (p.fuse > 0) {
    p.fuse--;
    if (p.fuse === 0) return 'explode';
  }
  if (p.resting) {
    if (terrain.isSolid(p.x, p.y + 3)) return null;
    p.resting = false;
  }
  p.vy += PHYS.g;
  if (cfg.homing && p.target && p.age > 22) {
    // Наводится на цель: гасит гравитацию и плавно доворачивает.
    const dx = p.target.x - p.x, dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    p.vy -= PHYS.g;
    p.vx += (dx / d * 9 - p.vx) * 0.09;
    p.vy += (dy / d * 9 - p.vy) * 0.09;
  } else if (cfg.wind) p.vx += wind * WIND_ACCEL;
  const speed = Math.hypot(p.vx, p.vy);
  const steps = Math.max(1, Math.ceil(speed / 1.5));
  let event = null;
  for (let i = 0; i < steps; i++) {
    const nx = p.x + p.vx / steps;
    const ny = p.y + p.vy / steps;
    if (cfg.hitWorms && worms) {
      for (const w of worms) {
        if (w.dead || (w === p.owner && p.age < 14)) continue;
        const dx = w.x - nx, dy = w.y - 3 - ny;
        if (dx * dx + dy * dy < 90) { p.x = nx; p.y = ny; return 'explode'; }
      }
    }
    if (terrain.isSolid(nx, ny)) {
      if (cfg.impact) { p.x = nx; p.y = ny; return 'explode'; }
      const n = terrain.normalAt(nx, ny, 5);
      const vn = p.vx * n.x + p.vy * n.y;
      if (vn < 0) {
        p.vx -= (1 + cfg.bounce) * vn * n.x;
        p.vy -= (1 + cfg.bounce) * vn * n.y;
        p.vx *= 0.88;
        p.vy *= 0.88;
        if (-vn > 1.5) event = 'bounce';
      }
      if (terrain.isSolid(p.x, p.y)) { p.x += n.x; p.y += n.y; }
      if (Math.hypot(p.vx, p.vy) < 0.7 && n.y < -0.5) {
        p.vx = 0;
        p.vy = 0;
        p.resting = true;
      }
      break;
    }
    p.x = nx;
    p.y = ny;
  }
  p.spin += p.vx * 0.12;
  if (p.y > WATER.y + 6) return 'water';
  if (p.x < -600 || p.x > WORLD_W + 600) return 'water';
  return event;
}

// Овца: бежит по земле, перепрыгивает препятствия, взрывается по таймеру,
// по команде или врезавшись в червяка.
function walkerTick(p, terrain, worms) {
  p.age++;
  if (p.fuse > 0) {
    p.fuse--;
    if (p.fuse === 0) return 'explode';
  }
  if (worms && p.age > 40) {
    for (const w of worms) {
      if (!w.dead && w !== p.owner && Math.abs(w.x - p.x) < 9 && Math.abs(w.y - p.y) < 10) return 'explode';
    }
  }
  const dir = p.dir || 1;
  const grounded = wormCollides(terrain, p.x, p.y + 1);
  if (grounded && p.vy >= 0) {
    p.vy = 0;
    const nx = p.x + dir * 1.25;
    let moved = false;
    for (let up = 0; up <= 6; up++) {
      if (!wormCollides(terrain, nx, p.y - up)) { p.x = nx; p.y -= up; moved = true; break; }
    }
    if (moved) {
      p.blocked = 0;
      for (let d = 0; d < 6 && !wormCollides(terrain, p.x, p.y + 1); d++) p.y++;
      if (p.age % 70 === 0) p.vy = -3;
    } else {
      p.vy = -4.6;
      p.blocked = (p.blocked || 0) + 1;
      if (p.blocked > 3) { p.dir = -dir; p.blocked = 0; }
    }
    p.vx = dir * 1.25;
  }
  if (p.vy !== 0 || !grounded) {
    p.vy = Math.min(p.vy + PHYS.g, 10);
    const steps = Math.max(1, Math.ceil(Math.abs(p.vy) + 1.25));
    for (let i = 0; i < steps; i++) {
      const nx = p.x + (p.dir || 1) * 1.25 / steps, ny = p.y + p.vy / steps;
      if (wormCollides(terrain, nx, ny)) {
        if (!wormCollides(terrain, p.x, ny)) { p.y = ny; continue; }
        if (p.vy > 0) p.vy = 0; else p.vy = 0.1;
        break;
      }
      p.x = nx;
      p.y = ny;
    }
  }
  p.spin = p.age;
  if (p.y > WATER.y + 4) return 'water';
  if (p.x < -400 || p.x > WORLD_W + 400) return 'water';
  return null;
}

// Стартовые позиции ракет авиаудара: летят по диагонали и падают около tx.
export function airstrikeMissiles(tx, dir) {
  const list = [];
  for (let i = 0; i < 5; i++) {
    list.push({ x: tx + (i - 2) * 26 - dir * 200, y: -60 - i * 6, vx: dir * 3, vy: 4 });
  }
  return list;
}

// Точка вылета снаряда из оружия червяка.
export function muzzlePoint(worm, v) {
  return { x: worm.x + v.x * 12, y: worm.y - 2 + v.y * 12 };
}

// Траектория для ИИ: где произойдёт взрыв (или null — улетит в воду).
export function simulateShot(terrain, wind, kind, x, y, vx, vy, owner, worms, fuse = 0, maxTicks = 600) {
  const p = new Projectile(kind, x, y, vx, vy, owner, fuse);
  for (let t = 0; t < maxTicks; t++) {
    const ev = projectileTick(p, terrain, wind, worms);
    if (ev === 'explode') return { x: p.x, y: p.y, t };
    if (ev === 'water') return null;
  }
  return null;
}

export function drawProjectile(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  switch (p.kind) {
    case 'rocket':
    case 'homing':
    case 'missile': {
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillStyle = p.kind === 'rocket' ? '#5d7a2e' : p.kind === 'homing' ? '#e8e8f0' : '#556';
      ctx.strokeStyle = '#1b1b1b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.quadraticCurveTo(4, -3.2, -6, -3);
      ctx.lineTo(-6, 3);
      ctx.quadraticCurveTo(4, 3.2, 8, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c33';
      ctx.fillRect(-8, -4.5, 3, 9);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(-8, -2);
      ctx.lineTo(-13 - Math.random() * 4, 0);
      ctx.lineTo(-8, 2);
      ctx.fill();
      break;
    }
    case 'grenade':
    case 'cluster': {
      ctx.rotate(p.spin);
      ctx.fillStyle = p.kind === 'grenade' ? '#3f6b2a' : '#7a3fa0';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.2, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#999';
      ctx.fillRect(-1.6, -7, 3.2, 2.5);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.stroke();
      break;
    }
    case 'banana':
    case 'bananette': {
      const k = p.kind === 'banana' ? 1 : 0.75;
      ctx.rotate(p.spin);
      ctx.scale(k, k);
      ctx.fillStyle = '#ffd93b';
      ctx.strokeStyle = '#7a5a10';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 4, 8, Math.PI * 1.1, Math.PI * 1.9);
      ctx.arc(0, 8, 9, Math.PI * 1.8, Math.PI * 1.2, true);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#5a3a10';
      ctx.fillRect(-7.5, -1.5, 2, 2);
      break;
    }
    case 'holy': {
      ctx.rotate(p.spin * 0.5);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(glowSprite('255,240,150'), -14, -14, 28, 28);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#f2c230';
      ctx.strokeStyle = '#7a5a00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 1, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-0.9, -9, 1.8, 6);
      ctx.fillRect(-3, -7.5, 6, 1.6);
      break;
    }
    case 'molotov': {
      ctx.rotate(p.spin);
      ctx.fillStyle = 'rgba(120,200,120,0.85)';
      ctx.strokeStyle = '#1e4a1e';
      ctx.lineWidth = 1;
      ctx.fillRect(-3.5, -3, 7, 10);
      ctx.strokeRect(-3.5, -3, 7, 10);
      ctx.fillRect(-1.5, -8, 3, 5);
      ctx.fillStyle = '#ffb030';
      ctx.beginPath();
      ctx.arc(0, -10, 2.5 + Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'flame': {
      const f = 0.7 + Math.random() * 0.5;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(flameSprite(), -6 * f, -14 * f + 2, 12 * f, 16 * f);
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'sheep': {
      const d = p.vx < 0 ? -1 : 1;
      ctx.scale(d, 1);
      const hop = Math.abs(Math.sin(p.age * 0.3)) * 1.5;
      ctx.fillStyle = '#222';
      for (const lx of [-4, -1, 2, 5]) ctx.fillRect(lx, 2 - hop, 1.6, 5 + (lx % 2 ? Math.sin(p.age * 0.6) : -Math.sin(p.age * 0.6)) * 1.2);
      ctx.fillStyle = '#f7f5ee';
      ctx.strokeStyle = '#bdb9ad';
      ctx.lineWidth = 0.8;
      for (const [cx, cy, r] of [[-4, -1, 4], [0, -3, 4.5], [4, -1, 4], [0, 1, 4], [-2, -4, 3.5], [3, -4, 3.5]]) {
        ctx.beginPath();
        ctx.arc(cx, cy - hop, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.ellipse(8, -3 - hop, 3.2, 2.6, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(8.5, -4.5 - hop, 1.4, 1.4);
      break;
    }
    case 'donkey': {
      ctx.rotate(Math.sin(p.age * 0.05) * 0.1);
      ctx.fillStyle = '#9a9aa2';
      ctx.strokeStyle = '#55555e';
      ctx.lineWidth = 1.2;
      ctx.fillRect(-14, -8, 26, 14);
      ctx.strokeRect(-14, -8, 26, 14);
      for (const lx of [-12, -5, 3, 9]) { ctx.fillRect(lx, 6, 4, 10); ctx.strokeRect(lx, 6, 4, 10); }
      ctx.fillRect(10, -20, 9, 16);
      ctx.strokeRect(10, -20, 9, 16);
      ctx.fillRect(12, -30, 3, 10);
      ctx.fillRect(16, -29, 3, 9);
      ctx.fillStyle = '#55555e';
      ctx.fillRect(15, -15, 2, 2);
      ctx.fillRect(-18, -6, 4, 2);
      break;
    }
    case 'meteor': {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSprite('255,140,40'), -18, -18, 36, 36);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#5a3a2a';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bomblet': {
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'dynamite': {
      ctx.rotate(p.spin * 0.3);
      ctx.fillStyle = '#d23a2a';
      ctx.strokeStyle = '#5a120c';
      ctx.lineWidth = 1;
      ctx.fillRect(-3.5, -7, 7, 13);
      ctx.strokeRect(-3.5, -7, 7, 13);
      ctx.fillStyle = '#f2e3c4';
      ctx.fillRect(-3.5, -2, 7, 3);
      ctx.strokeStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.quadraticCurveTo(3, -10, 2, -12);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// Оружие в руках червяка.
// --- Оружие в руках червяка ---------------------------------------------
// Рисуется в системе координат прицела: ось x — направление выстрела, y — вниз
// от ствола. Для червяка, смотрящего влево, система отражается, чтобы оружие
// не переворачивалось вверх ногами.

const INK = '#1d1522';
const SKIN = '#f7a3b7';
const SKIN_EDGE = '#7d3a4e';

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Цилиндр вдоль оси x: светлая середина, тёмные края.
function tube(ctx, y0, y1, dark, mid, light) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, dark);
  g.addColorStop(0.35, light);
  g.addColorStop(0.6, mid);
  g.addColorStop(1, dark);
  return g;
}

function ball(ctx, x, y, r, light, mid, dark) {
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
  g.addColorStop(0, light);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, dark);
  return g;
}

function outline(ctx, w = 0.8) {
  ctx.lineWidth = w;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

// Кончик «руки» червяка, держащей оружие.
function hand(ctx, x, y, r = 2.1) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = SKIN_EDGE;
  ctx.stroke();
}

function flame(ctx, x, y, size, t) {
  const f = 1 + Math.sin(t * 0.03) * 0.15 + Math.sin(t * 0.071) * 0.1;
  const g = ctx.createRadialGradient(x, y + size * 0.3, 0, x, y, size * 1.2 * f);
  g.addColorStop(0, 'rgba(255,250,200,1)');
  g.addColorStop(0.35, 'rgba(255,190,60,0.95)');
  g.addColorStop(0.75, 'rgba(255,90,20,0.7)');
  g.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.6, y + size * 0.3);
  ctx.quadraticCurveTo(x - size * 0.5, y - size * 0.6 * f, x + Math.sin(t * 0.05) * size * 0.3, y - size * 1.4 * f);
  ctx.quadraticCurveTo(x + size * 0.5, y - size * 0.6 * f, x + size * 0.6, y + size * 0.3);
  ctx.closePath();
  ctx.fill();
}

function spark(ctx, x, y, t) {
  const n = 5;
  ctx.strokeStyle = '#ffe680';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + t * 0.02;
    const len = 1.5 + ((t * 7 + i * 13) % 10) / 6;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  }
  ctx.stroke();
  ctx.fillStyle = '#fff6c0';
  ctx.beginPath();
  ctx.arc(x, y, 0.9, 0, Math.PI * 2);
  ctx.fill();
}

function drawLauncher(ctx, body, bodyMid, bodyLight, band, tip) {
  // Труба.
  rrect(ctx, -9, -3, 25, 6, 1.5);
  ctx.fillStyle = tube(ctx, -3, 3, body, bodyMid, bodyLight);
  ctx.fill();
  outline(ctx);
  // Раструб сзади.
  ctx.beginPath();
  ctx.moveTo(-9, -3); ctx.lineTo(-12.5, -4.2); ctx.lineTo(-12.5, 4.2); ctx.lineTo(-9, 3); ctx.closePath();
  ctx.fillStyle = tube(ctx, -4.2, 4.2, '#222', '#3a3a3a', '#5a5a5a');
  ctx.fill();
  outline(ctx);
  // Цветная полоса и дуло.
  ctx.fillStyle = band;
  ctx.fillRect(4, -3, 2.2, 6);
  rrect(ctx, 14.5, -3.8, 3.2, 7.6, 1);
  ctx.fillStyle = tube(ctx, -3.8, 3.8, '#1e1e1e', '#3b3b3b', '#6a6a6a');
  ctx.fill();
  outline(ctx);
  if (tip) tip();
  // Прицел и рукоять.
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(-1, -5, 5, 2);
  ctx.fillRect(1, -6.2, 1.2, 1.4);
  ctx.beginPath();
  ctx.moveTo(-2, 3); ctx.lineTo(1, 3); ctx.lineTo(0, 7); ctx.lineTo(-2.6, 7); ctx.closePath();
  ctx.fillStyle = '#3a2a1e';
  ctx.fill();
  outline(ctx, 0.6);
  // Блик.
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(-8, -2.1, 22, 0.9);
  hand(ctx, -0.8, 6);
  hand(ctx, 8, 3.4);
}

export function drawHeldWeapon(ctx, worm, weaponId) {
  const v = worm.aimVector();
  const t = performance.now() / 16.7;
  ctx.save();
  ctx.translate(worm.x + worm.dir * 2, worm.y - 2);
  ctx.rotate(Math.atan2(v.y, v.x));
  if (v.x < 0) ctx.scale(1, -1);
  ctx.lineJoin = 'round';
  switch (weaponId) {
    case 'bazooka':
      drawLauncher(ctx, '#3c5220', '#5d7a2e', '#8fae55', '#e8c43a');
      break;
    case 'homing':
      drawLauncher(ctx, '#8d8f9c', '#c9ccd8', '#f4f5fa', '#d8332f', () => {
        // Оптика головки самонаведения.
        const g = ctx.createRadialGradient(17.6, 0, 0, 17.6, 0, 3);
        g.addColorStop(0, 'rgba(160,240,255,1)');
        g.addColorStop(1, 'rgba(40,140,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(17.6, 0, 3 + Math.sin(t * 0.15) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    case 'shotgun': {
      // Приклад.
      ctx.beginPath();
      ctx.moveTo(-9, -1.2); ctx.lineTo(-1, -2); ctx.lineTo(1, 1.6); ctx.lineTo(-3, 2.2); ctx.lineTo(-9.5, 4.2);
      ctx.closePath();
      const wood = ctx.createLinearGradient(0, -2, 0, 4);
      wood.addColorStop(0, '#b5773d'); wood.addColorStop(1, '#6b3f1c');
      ctx.fillStyle = wood;
      ctx.fill();
      outline(ctx);
      // Ствольная коробка и два ствола.
      rrect(ctx, -1.5, -2.4, 6, 4, 0.8);
      ctx.fillStyle = tube(ctx, -2.4, 1.6, '#202024', '#3c3d44', '#6d707c');
      ctx.fill();
      outline(ctx);
      for (const y of [-2.3, -0.6]) {
        rrect(ctx, 4, y, 15, 1.7, 0.6);
        ctx.fillStyle = tube(ctx, y, y + 1.7, '#1c1c20', '#45474f', '#9a9eab');
        ctx.fill();
        outline(ctx, 0.5);
      }
      // Цевьё.
      rrect(ctx, 7, 0.9, 6, 2.2, 0.8);
      ctx.fillStyle = wood;
      ctx.fill();
      outline(ctx, 0.6);
      hand(ctx, 0.5, 3);
      hand(ctx, 10, 3.4);
      break;
    }
    case 'grenade': {
      ctx.beginPath();
      ctx.ellipse(7, 0, 4.2, 4.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = ball(ctx, 7, 0, 4.8, '#9fd36a', '#4c7d2c', '#24401a');
      ctx.fill();
      outline(ctx);
      // Насечки «ананаса».
      ctx.strokeStyle = 'rgba(20,40,10,0.55)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(3.2, -1.6); ctx.lineTo(10.8, -1.6);
      ctx.moveTo(3, 1.6); ctx.lineTo(11, 1.6);
      ctx.moveTo(5.5, -4.5); ctx.lineTo(5.5, 4.5);
      ctx.moveTo(8.5, -4.5); ctx.lineTo(8.5, 4.5);
      ctx.stroke();
      // Запал, скоба и кольцо.
      ctx.fillStyle = '#9aa0aa';
      ctx.fillRect(5.6, -6.6, 2.8, 2.2);
      ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.strokeRect(5.6, -6.6, 2.8, 2.2);
      ctx.strokeStyle = '#c9ccd4'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(8.4, -6); ctx.quadraticCurveTo(12, -5, 11.4, -1.5); ctx.stroke();
      ctx.beginPath(); ctx.arc(4.2, -7.2, 1.4, 0, Math.PI * 2); ctx.stroke();
      hand(ctx, 4, 3.2);
      break;
    }
    case 'cluster': {
      ctx.beginPath();
      ctx.arc(7, 0, 4.8, 0, Math.PI * 2);
      ctx.fillStyle = ball(ctx, 7, 0, 4.8, '#d9a8ff', '#8a45c0', '#40175e');
      ctx.fill();
      outline(ctx);
      // Бомбочки внутри.
      ctx.fillStyle = '#ffd34d';
      for (const [dx, dy] of [[-2, -1.6], [1.4, -2.2], [2.4, 1], [-1.2, 2], [0, 0]]) {
        ctx.beginPath(); ctx.arc(7 + dx, dy, 0.9, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#9aa0aa';
      ctx.fillRect(5.8, -6.6, 2.4, 2);
      hand(ctx, 4, 3.4);
      break;
    }
    case 'banana': {
      ctx.beginPath();
      ctx.moveTo(1.5, -3.5);
      ctx.quadraticCurveTo(8, 6, 15, -3.5);
      ctx.quadraticCurveTo(8, 2, 1.5, -3.5);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -3, 0, 4);
      g.addColorStop(0, '#fff3a0'); g.addColorStop(0.5, '#ffd83a'); g.addColorStop(1, '#d9a000');
      ctx.fillStyle = g;
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#5a3a14';
      ctx.beginPath(); ctx.arc(1.6, -3.4, 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(14.9, -3.4, 0.9, 0, Math.PI * 2); ctx.fill();
      hand(ctx, 6, 3);
      break;
    }
    case 'holy': {
      // Ореол.
      const halo = ctx.createRadialGradient(7, 0, 2, 7, 0, 9);
      halo.addColorStop(0, `rgba(255,240,170,${0.45 + Math.sin(t * 0.08) * 0.15})`);
      halo.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(7, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.arc(7, 0.5, 4.6, 0, Math.PI * 2);
      ctx.fillStyle = ball(ctx, 7, 0.5, 4.6, '#fff6c2', '#f0b928', '#8a5a00');
      ctx.fill();
      outline(ctx);
      // Крест.
      ctx.fillStyle = '#fff2a8';
      ctx.fillRect(6.3, -8, 1.4, 4.6);
      ctx.fillRect(4.9, -6.8, 4.2, 1.3);
      ctx.strokeStyle = '#8a5a00'; ctx.lineWidth = 0.4;
      ctx.strokeRect(6.3, -8, 1.4, 4.6);
      hand(ctx, 4, 3.6);
      break;
    }
    case 'molotov': {
      // Бутылка горлышком вперёд.
      ctx.beginPath();
      ctx.moveTo(1, -3.4); ctx.lineTo(8, -3.4); ctx.quadraticCurveTo(10, -3.4, 11, -1.5);
      ctx.lineTo(15, -1.3); ctx.lineTo(15, 1.3); ctx.lineTo(11, 1.5);
      ctx.quadraticCurveTo(10, 3.4, 8, 3.4); ctx.lineTo(1, 3.4); ctx.closePath();
      ctx.fillStyle = tube(ctx, -3.4, 3.4, 'rgba(40,110,50,0.95)', 'rgba(80,170,90,0.9)', 'rgba(190,240,190,0.9)');
      ctx.fill();
      outline(ctx);
      // Жидкость и этикетка.
      ctx.fillStyle = 'rgba(255,170,40,0.55)';
      ctx.fillRect(1.5, 0.2, 7, 3);
      ctx.fillStyle = '#f1e6c8';
      ctx.fillRect(3, -2.4, 4, 4.2);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(3, -0.8, 4, 1);
      // Тряпка с огнём.
      ctx.fillStyle = '#d8d0b8';
      ctx.beginPath(); ctx.moveTo(15, -1.6); ctx.lineTo(18, -2.6); ctx.lineTo(17.4, 0.4); ctx.lineTo(19, 2); ctx.lineTo(15, 1.6); ctx.closePath();
      ctx.fill(); outline(ctx, 0.5);
      flame(ctx, 18.6, -1.5, 2.6, t);
      hand(ctx, 3.5, 4);
      break;
    }
    case 'dynamite': {
      for (const [y, dy] of [[-3.6, 0], [-1.2, 0.5], [1.2, 0]]) {
        rrect(ctx, 3 + dy, y, 10, 2.6, 1.2);
        ctx.fillStyle = tube(ctx, y, y + 2.6, '#8a1610', '#d23a2a', '#ff8a6a');
        ctx.fill();
        outline(ctx, 0.5);
      }
      // Изолента.
      ctx.fillStyle = '#2b2b33';
      ctx.fillRect(5.5, -3.8, 1.5, 7.8);
      ctx.fillRect(10, -3.8, 1.5, 7.8);
      // Фитиль с искрой.
      ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(13.2, -2.3); ctx.quadraticCurveTo(16, -4, 15.5, -6.5); ctx.stroke();
      spark(ctx, 15.5, -6.6, t);
      hand(ctx, 4.5, 4.2);
      break;
    }
    case 'mine': {
      ctx.beginPath();
      ctx.ellipse(8, 1, 5.6, 3.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = ball(ctx, 8, 1, 5.6, '#7a7a80', '#3b3b40', '#151518');
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#55555c';
      ctx.fillRect(6.6, -3.2, 2.8, 1.6);
      const on = Math.floor(t / 20) % 2 === 0;
      ctx.fillStyle = on ? '#ff3b30' : '#6a1410';
      ctx.beginPath(); ctx.arc(8, -3.4, 1.1, 0, Math.PI * 2); ctx.fill();
      if (on) {
        ctx.fillStyle = 'rgba(255,60,40,0.35)';
        ctx.beginPath(); ctx.arc(8, -3.4, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      hand(ctx, 4, 4);
      break;
    }
    case 'bat': {
      ctx.beginPath();
      ctx.moveTo(-3, -0.9); ctx.lineTo(6, -1.3); ctx.quadraticCurveTo(14, -3.2, 19, -2.6);
      ctx.quadraticCurveTo(20.6, 0, 19, 2.6); ctx.quadraticCurveTo(14, 3.2, 6, 1.3); ctx.lineTo(-3, 0.9);
      ctx.closePath();
      ctx.fillStyle = tube(ctx, -3, 3, '#8a5422', '#c58a48', '#f0c88a');
      ctx.fill();
      outline(ctx);
      // Обмотка рукояти и набалдашник.
      ctx.fillStyle = '#2b2b33';
      ctx.fillRect(-2, -1.1, 4.5, 2.2);
      ctx.beginPath(); ctx.ellipse(-3.3, 0, 0.9, 1.7, 0, 0, Math.PI * 2); ctx.fill();
      hand(ctx, -0.5, 2.2);
      hand(ctx, 2.5, 2.2);
      break;
    }
    case 'punch': {
      flame(ctx, 6, -2, 5.5, t);
      flame(ctx, 11, -1, 4, t + 40);
      // Кулак: кисть с пальцами.
      rrect(ctx, 5, -3.4, 7, 6.8, 2.4);
      ctx.fillStyle = ball(ctx, 8.5, 0, 5, '#ffd0dc', SKIN, '#d9788e');
      ctx.fill();
      ctx.lineWidth = 0.8; ctx.strokeStyle = SKIN_EDGE; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(10, -1.6); ctx.lineTo(12, -1.6);
      ctx.moveTo(10, 0.2); ctx.lineTo(12, 0.2);
      ctx.moveTo(10, 1.9); ctx.lineTo(12, 1.9);
      ctx.lineWidth = 0.5; ctx.stroke();
      break;
    }
    case 'sheep': {
      // Кудрявая овечка в руках.
      ctx.fillStyle = '#f4f1ea';
      for (const [dx, dy, r] of [[5, 0, 2.6], [7.5, -1.4, 2.6], [10, -0.4, 2.5], [7.6, 1.6, 2.5], [5.6, -2.2, 2], [9.8, 1.8, 2]]) {
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 0.5; ctx.strokeStyle = '#a9a39a'; ctx.stroke();
      }
      ctx.fillStyle = '#2a2a2e';
      ctx.beginPath(); ctx.ellipse(13, -0.8, 2.4, 1.8, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(13.6, -1.4, 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(13.8, -1.4, 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a2a2e';
      ctx.fillRect(6, 3, 0.9, 2); ctx.fillRect(9.5, 3, 0.9, 2);
      hand(ctx, 4, 3.6);
      break;
    }
    case 'drill': {
      // Лазерный бур: корпус с рёбрами охлаждения, светящаяся катушка и эмиттер.
      rrect(ctx, -6, -3.2, 15, 6.4, 2);
      ctx.fillStyle = tube(ctx, -3.2, 3.2, '#3a3f4c', '#7c8496', '#c8cfdc');
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = '#2a2e38';
      for (const x of [-4, -2, 0]) ctx.fillRect(x, -3.2, 0.9, 6.4);
      const glow = 0.6 + Math.sin(t * 0.25) * 0.4;
      ctx.fillStyle = `rgba(80,230,255,${0.55 + glow * 0.45})`;
      rrect(ctx, 2.5, -2.2, 4.5, 4.4, 1.2);
      ctx.fill();
      ctx.strokeStyle = '#1b5a6a'; ctx.lineWidth = 0.5; ctx.stroke();
      // Сопло.
      ctx.beginPath();
      ctx.moveTo(9, -2.6); ctx.lineTo(14.5, -1.4); ctx.lineTo(14.5, 1.4); ctx.lineTo(9, 2.6); ctx.closePath();
      ctx.fillStyle = tube(ctx, -2.6, 2.6, '#25262c', '#4a4c56', '#8a8e9c');
      ctx.fill();
      outline(ctx);
      ctx.fillStyle = `rgba(255,70,50,${0.6 + glow * 0.4})`;
      ctx.beginPath(); ctx.arc(14.6, 0, 1.3, 0, Math.PI * 2); ctx.fill();
      // Рукоять.
      ctx.beginPath();
      ctx.moveTo(-3, 3); ctx.lineTo(0, 3); ctx.lineTo(-0.6, 7); ctx.lineTo(-3.4, 7); ctx.closePath();
      ctx.fillStyle = '#2b2e36';
      ctx.fill();
      outline(ctx, 0.6);
      hand(ctx, -1.8, 6.2);
      hand(ctx, 6, 3.6);
      break;
    }
    case 'rope': {
      // Пистолет-кошка: короткий ствол с торчащим крюком и мотком верёвки.
      rrect(ctx, -2, -2.4, 12, 4.8, 1.4);
      ctx.fillStyle = tube(ctx, -2.4, 2.4, '#3a2a1e', '#6b4a2b', '#a77a48');
      ctx.fill();
      outline(ctx);
      ctx.beginPath();
      ctx.arc(1.5, 3.6, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = '#d9b77a';
      ctx.fill();
      ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.beginPath(); ctx.arc(1.5, 3.6, 1.2, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#2a2a30'; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(15, 0);
      ctx.moveTo(15, 0); ctx.quadraticCurveTo(17.5, -3.5, 14.5, -4.5);
      ctx.moveTo(15, 0); ctx.quadraticCurveTo(17.5, 3.5, 14.5, 4.5);
      ctx.stroke();
      ctx.strokeStyle = '#c3c7d2'; ctx.lineWidth = 0.8; ctx.stroke();
      hand(ctx, 3.5, 2.8);
      break;
    }
    case 'armageddon':
    case 'quake': {
      // Пульт с большой кнопкой.
      rrect(ctx, 3, -3, 7, 8, 1.4);
      ctx.fillStyle = tube(ctx, -3, 5, '#2a2a30', '#4a4a55', '#70707c');
      ctx.fill();
      outline(ctx);
      ctx.strokeStyle = '#9aa0aa'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(8.5, -3); ctx.lineTo(10.5, -8); ctx.stroke();
      ctx.fillStyle = '#ffdf5a';
      ctx.beginPath(); ctx.arc(10.5, -8.2, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = weaponId === 'quake' ? '#e0a030' : '#ff3b30';
      ctx.beginPath(); ctx.arc(6.5, 0, 2, 0, Math.PI * 2); ctx.fill();
      outline(ctx, 0.5);
      hand(ctx, 4, 4.4);
      break;
    }
  }
  ctx.restore();
}
