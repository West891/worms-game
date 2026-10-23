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
export function drawHeldWeapon(ctx, worm, weaponId) {
  const v = worm.aimVector();
  const cx = worm.x + worm.dir * 2;
  const cy = worm.y - 2;
  const ang = Math.atan2(v.y, v.x);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.strokeStyle = '#1b1b1b';
  ctx.lineWidth = 1;
  switch (weaponId) {
    case 'bazooka':
      ctx.fillStyle = '#5d7a2e';
      ctx.fillRect(-6, -2.6, 20, 5.2);
      ctx.strokeRect(-6, -2.6, 20, 5.2);
      ctx.fillStyle = '#333';
      ctx.fillRect(12, -3.2, 3, 6.4);
      break;
    case 'shotgun':
      ctx.fillStyle = '#6b4a2b';
      ctx.fillRect(-5, -1.8, 7, 4);
      ctx.fillStyle = '#333';
      ctx.fillRect(2, -1.4, 13, 2.4);
      break;
    case 'grenade':
    case 'cluster':
      ctx.fillStyle = weaponId === 'grenade' ? '#3f6b2a' : '#7a3fa0';
      ctx.beginPath();
      ctx.arc(7, 0, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'bat':
      ctx.fillStyle = '#b07a3e';
      ctx.beginPath();
      ctx.moveTo(0, -1.2);
      ctx.lineTo(16, -2.6);
      ctx.lineTo(16, 2.6);
      ctx.lineTo(0, 1.2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'dynamite':
      ctx.fillStyle = '#d23a2a';
      ctx.fillRect(3, -3, 6, 10);
      break;
    case 'mine':
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(7, 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'homing':
      ctx.fillStyle = '#d8d8e2';
      ctx.fillRect(-6, -2.6, 20, 5.2);
      ctx.strokeRect(-6, -2.6, 20, 5.2);
      ctx.fillStyle = '#d33';
      ctx.fillRect(12, -3.2, 3, 6.4);
      break;
    case 'banana':
      ctx.fillStyle = '#ffd93b';
      ctx.beginPath();
      ctx.arc(7, 3, 5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.fill();
      break;
    case 'holy':
      ctx.fillStyle = '#f2c230';
      ctx.beginPath();
      ctx.arc(7, 0, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(6.4, -6, 1.2, 3);
      break;
    case 'molotov':
      ctx.fillStyle = 'rgba(120,200,120,0.9)';
      ctx.fillRect(4, -3, 5, 7);
      ctx.fillStyle = '#ffb030';
      ctx.fillRect(5.5, -6, 2, 3);
      break;
    case 'punch':
      ctx.fillStyle = '#ff7a2a';
      ctx.beginPath();
      ctx.arc(8, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
  ctx.restore();
}
