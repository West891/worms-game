// Карты: палитра земли, небо, декорации, погода, гравитация, звук.
// Декорации рисуются прямо в ландшафт, поэтому их тоже можно взорвать.

import { t } from './i18n.js';

export const MAPS = {
  meadow: {
    name: t('Луг'),
    top: [126, 204, 74], second: [84, 160, 52],
    dirt: [150, 101, 60], dirtDark: [109, 70, 42], rock: [128, 118, 108],
    rim: 'rgba(52, 30, 16, 0.9)',
    water: ['#4b8fe0', '#1d4f93'],
    hills: ['rgba(170,150,240,0.55)', 'rgba(130,110,215,0.6)'],
    debris: ['#8a5a34', '#6d4428', '#7cc04a'],
    decor: ['tree', 'tree', 'flowers', 'fence'],
    weather: 'petals', ambience: 'meadow', music: 'day',
  },
  desert: {
    name: t('Пустыня'),
    top: [247, 218, 146], second: [230, 188, 112],
    dirt: [214, 160, 94], dirtDark: [182, 128, 72], rock: [160, 108, 70], strata: true,
    rim: 'rgba(92, 52, 24, 0.9)',
    water: ['#38b3d6', '#176c93'],
    hills: ['rgba(240,170,210,0.5)', 'rgba(205,140,195,0.6)'],
    debris: ['#d9a35c', '#b57d45', '#f2d593'],
    decor: ['cactus', 'cactus', 'skull', 'rock'],
    weather: 'dust', ambience: 'desert', music: 'day',
  },
  snow: {
    name: t('Снег'),
    top: [250, 252, 255], second: [205, 224, 242],
    dirt: [120, 134, 164], dirtDark: [88, 100, 130], rock: [66, 76, 102],
    rim: 'rgba(36, 42, 66, 0.9)',
    water: ['#5c97d8', '#264f8a'],
    hills: ['rgba(200,205,250,0.55)', 'rgba(160,165,235,0.6)'],
    debris: ['#7886a4', '#58627e', '#eef4ff'],
    decor: ['pine', 'pine', 'snowman'],
    weather: 'snow', ambience: 'snow', music: 'day',
  },
  halloween: {
    name: t('Ночь Хэллоуина'), night: true,
    sky: ['#12061f', '#3a1240', '#7a2e3a'],
    moon: { color: '#ffb547', glow: 'rgba(255,150,40,0.35)', r: 64, x: 0.78, y: 0.2 },
    stars: 120,
    top: [104, 62, 128], second: [72, 42, 92],
    dirt: [62, 40, 52], dirtDark: [40, 26, 36], rock: [86, 74, 96],
    rim: 'rgba(20, 8, 24, 0.92)',
    water: ['#8a3fd0', '#26093f'], waterGlow: true,
    hills: ['rgba(40,14,52,0.85)', 'rgba(24,8,32,0.92)'], skyline: 'spooky',
    clouds: 'night',
    debris: ['#4a2c3c', '#2e1c26', '#7a4fa0', '#ff8a2a'],
    decor: ['pumpkin', 'pumpkin', 'deadtree', 'pumpkin', 'fence'],
    weather: 'bats', ambience: 'halloween', music: 'halloween',
  },
  cemetery: {
    name: t('Ночное кладбище'), night: true,
    sky: ['#03070f', '#0f1d2e', '#24384a'],
    moon: { color: '#e9f0f7', glow: 'rgba(200,220,255,0.25)', r: 46, x: 0.25, y: 0.16 },
    stars: 90,
    top: [86, 104, 74], second: [60, 72, 52],
    dirt: [70, 62, 58], dirtDark: [46, 40, 38], rock: [112, 112, 122],
    rim: 'rgba(10, 12, 16, 0.92)',
    water: ['#3d6658', '#0b1d18'],
    hills: ['rgba(20,32,44,0.85)', 'rgba(10,18,26,0.92)'], skyline: 'church',
    clouds: 'night', fog: true,
    debris: ['#4e4642', '#2e2826', '#8a8a96'],
    decor: ['tomb', 'cross', 'tomb', 'deadtree', 'tomb', 'crypt', 'cross'],
    amp: 0.38, caves: 0.72,
    weather: 'wisps', ambience: 'cemetery', music: 'cemetery',
  },
  spaceport: {
    name: t('Космодром'), night: true, gravity: 0.13,
    sky: ['#010008', '#0a0a26', '#1f1748'],
    planet: { color: '#d07a5a', ring: 'rgba(240,200,170,0.55)', r: 80, x: 0.2, y: 0.22 },
    stars: 220,
    top: [176, 180, 194], second: [132, 136, 154],
    dirt: [90, 92, 112], dirtDark: [62, 64, 84], rock: [150, 160, 182], plates: true,
    rim: 'rgba(10, 10, 20, 0.92)',
    water: ['#36e0c8', '#062a3a'], waterGlow: true,
    hills: ['rgba(30,26,60,0.85)', 'rgba(16,14,36,0.92)'], skyline: 'launch',
    clouds: 'none',
    debris: ['#8a8ea4', '#5a5c70', '#d0d4e0', '#ffcf3f'],
    decor: ['tower', 'tank', 'dish', 'antenna', 'pad', 'tank'],
    plateaus: true, caves: 0.74,
    weather: 'sparks', ambience: 'spaceport', music: 'spaceport',
  },
};

export const MAP_KEYS = Object.keys(MAPS);

// --- Декорации ------------------------------------------------------------
// Каждая функция рисует объект, стоящий основанием на точке (x, y).
// Огоньки (тыквы, антенны) возвращаются списком — их подсвечивает рендер.

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function branchyTree(ctx, x, y, rng, color, h) {
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const branch = (bx, by, ang, len, w, depth) => {
    const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo((bx + ex) / 2 + (rng() - 0.5) * 8, (by + ey) / 2, ex, ey);
    ctx.stroke();
    if (depth > 0) {
      branch(ex, ey, ang - 0.4 - rng() * 0.5, len * 0.7, w * 0.62, depth - 1);
      branch(ex, ey, ang + 0.3 + rng() * 0.5, len * 0.65, w * 0.62, depth - 1);
    }
  };
  branch(x, y + 4, -Math.PI / 2 + (rng() - 0.5) * 0.3, h * 0.45, 7, 4);
}

export const DECOR = {
  tree(ctx, x, y, rng) {
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(x - 3, y - 28, 6, 32);
    const greens = ['#4f9a33', '#5fb23c', '#3f8429'];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = greens[i % 3];
      ctx.beginPath();
      ctx.arc(x + (rng() - 0.5) * 22, y - 36 - rng() * 16, 10 + rng() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  flowers(ctx, x, y, rng) {
    for (let i = 0; i < 6; i++) {
      const fx = x + (rng() - 0.5) * 30;
      ctx.strokeStyle = '#3f8429';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(fx, y + 2);
      ctx.lineTo(fx, y - 7);
      ctx.stroke();
      ctx.fillStyle = ['#ff6fa8', '#ffd84a', '#ffffff', '#a98bff'][i % 4];
      ctx.beginPath();
      ctx.arc(fx, y - 8, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  fence(ctx, x, y, rng, map) {
    ctx.fillStyle = map.night ? '#2a1e2c' : '#8a6a44';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(x + i * 9 - 1.5, y - 16, 3, 20);
      ctx.beginPath();
      ctx.moveTo(x + i * 9 - 2.5, y - 16);
      ctx.lineTo(x + i * 9, y - 21);
      ctx.lineTo(x + i * 9 + 2.5, y - 16);
      ctx.fill();
    }
    ctx.fillRect(x - 21, y - 12, 42, 2.5);
    ctx.fillRect(x - 21, y - 5, 42, 2.5);
  },
  cactus(ctx, x, y) {
    ctx.fillStyle = '#4c8a3a';
    roundRect(ctx, x - 4, y - 34, 8, 38, 4);
    ctx.fill();
    roundRect(ctx, x - 13, y - 24, 6, 14, 3);
    ctx.fill();
    roundRect(ctx, x + 7, y - 28, 6, 12, 3);
    ctx.fill();
    ctx.fillRect(x - 10, y - 13, 7, 4);
    ctx.fillRect(x + 3, y - 18, 7, 4);
  },
  skull(ctx, x, y) {
    ctx.fillStyle = '#f2ead8';
    ctx.beginPath();
    ctx.arc(x, y - 7, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 4, y - 2, 8, 5);
    ctx.fillStyle = '#5a3a20';
    ctx.beginPath();
    ctx.arc(x - 2.6, y - 7, 1.8, 0, Math.PI * 2);
    ctx.arc(x + 2.6, y - 7, 1.8, 0, Math.PI * 2);
    ctx.fill();
  },
  rock(ctx, x, y, rng) {
    ctx.fillStyle = '#a07a52';
    ctx.beginPath();
    ctx.ellipse(x, y - 5, 12 + rng() * 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  pine(ctx, x, y) {
    ctx.fillStyle = '#5a3a26';
    ctx.fillRect(x - 3, y - 10, 6, 14);
    for (let i = 0; i < 3; i++) {
      const w = 20 - i * 5, ty = y - 10 - i * 12;
      ctx.fillStyle = '#2f6b4a';
      ctx.beginPath();
      ctx.moveTo(x - w, ty);
      ctx.lineTo(x, ty - 18);
      ctx.lineTo(x + w, ty);
      ctx.fill();
      ctx.fillStyle = '#f4f8ff';
      ctx.beginPath();
      ctx.moveTo(x - w * 0.45, ty - 10);
      ctx.lineTo(x, ty - 18);
      ctx.lineTo(x + w * 0.45, ty - 10);
      ctx.fill();
    }
  },
  snowman(ctx, x, y) {
    ctx.fillStyle = '#f8fbff';
    for (const [dy, r] of [[-8, 10], [-24, 7.5], [-36, 5.5]]) {
      ctx.beginPath();
      ctx.arc(x, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff8a2a';
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 36);
    ctx.lineTo(x + 10, y - 35);
    ctx.lineTo(x + 2, y - 34);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(x - 6, y - 46, 12, 3);
    ctx.fillRect(x - 4, y - 54, 8, 8);
  },
  pumpkin(ctx, x, y, rng) {
    const r = 10 + rng() * 5;
    const cy = y - r * 0.8;
    for (const [dx, c] of [[-r * 0.45, '#d9641a'], [r * 0.45, '#d9641a'], [0, '#f07a22']]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x + dx, cy, r * 0.62, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3f6b22';
    ctx.fillRect(x - 1.5, cy - r * 0.95, 3, 6);
    // Лицо вырезано насквозь — внутри светится свеча.
    ctx.fillStyle = '#2a0f05';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, cy - r * 0.15); ctx.lineTo(x - r * 0.2, cy - r * 0.45); ctx.lineTo(x - r * 0.05, cy - r * 0.1);
    ctx.moveTo(x + r * 0.45, cy - r * 0.15); ctx.lineTo(x + r * 0.2, cy - r * 0.45); ctx.lineTo(x + r * 0.05, cy - r * 0.1);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.5, cy + r * 0.2);
    ctx.lineTo(x - r * 0.25, cy + r * 0.45);
    ctx.lineTo(x, cy + r * 0.3);
    ctx.lineTo(x + r * 0.25, cy + r * 0.45);
    ctx.lineTo(x + r * 0.5, cy + r * 0.2);
    ctx.lineTo(x, cy + r * 0.32);
    ctx.fill();
    return [{ x, y: cy, r: r * 2.4, color: 'rgba(255,170,40,', flicker: true }];
  },
  deadtree(ctx, x, y, rng, map) {
    branchyTree(ctx, x, y, rng, map.night ? '#1c1018' : '#4a3426', 60 + rng() * 30);
  },
  tomb(ctx, x, y, rng) {
    const w = 14 + rng() * 6, h = 20 + rng() * 10;
    ctx.fillStyle = '#7d7f8c';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + 3);
    ctx.lineTo(x - w / 2, y - h + w / 2);
    ctx.arc(x, y - h + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, y + 3);
    ctx.fill();
    ctx.fillStyle = '#5a5c68';
    ctx.fillRect(x - 1, y - h + 4, 2, 9);
    ctx.fillRect(x - 3.5, y - h + 6.5, 7, 2);
    ctx.fillRect(x - w / 2 + 3, y - 6, w - 6, 1.5);
  },
  cross(ctx, x, y, rng) {
    const h = 26 + rng() * 10;
    ctx.fillStyle = '#6d6f7c';
    ctx.fillRect(x - 2.5, y - h, 5, h + 4);
    ctx.fillRect(x - 9, y - h + 7, 18, 5);
  },
  crypt(ctx, x, y) {
    ctx.fillStyle = '#5f616e';
    ctx.fillRect(x - 22, y - 34, 44, 38);
    ctx.beginPath();
    ctx.moveTo(x - 27, y - 34);
    ctx.lineTo(x, y - 52);
    ctx.lineTo(x + 27, y - 34);
    ctx.fill();
    ctx.fillStyle = '#23242c';
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 4);
    ctx.lineTo(x - 8, y - 16);
    ctx.arc(x, y - 16, 8, Math.PI, 0);
    ctx.lineTo(x + 8, y + 4);
    ctx.fill();
    return [{ x: x - 15, y: y - 22, r: 22, color: 'rgba(140,255,170,', flicker: true }];
  },
  tower(ctx, x, y) {
    ctx.strokeStyle = '#8f96ac';
    ctx.lineWidth = 2.5;
    const h = 120, w = 18;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + 4); ctx.lineTo(x - w / 2, y - h);
    ctx.moveTo(x + w / 2, y + 4); ctx.lineTo(x + w / 2, y - h);
    for (let yy = y; yy > y - h; yy -= 14) {
      ctx.moveTo(x - w / 2, yy); ctx.lineTo(x + w / 2, yy - 14);
      ctx.moveTo(x + w / 2, yy); ctx.lineTo(x - w / 2, yy - 14);
    }
    ctx.stroke();
    ctx.fillStyle = '#c33';
    ctx.fillRect(x - w / 2 - 2, y - h - 6, w + 4, 6);
    return [{ x, y: y - h - 9, r: 16, color: 'rgba(255,60,60,', blink: true }];
  },
  tank(ctx, x, y) {
    ctx.fillStyle = '#e4e7ef';
    roundRect(ctx, x - 12, y - 46, 24, 50, 11);
    ctx.fill();
    ctx.fillStyle = '#d23a3a';
    ctx.fillRect(x - 12, y - 30, 24, 6);
    ctx.fillRect(x - 12, y - 14, 24, 6);
  },
  dish(ctx, x, y) {
    ctx.fillStyle = '#9aa1b8';
    ctx.fillRect(x - 2, y - 22, 4, 26);
    ctx.fillStyle = '#d8dce8';
    ctx.beginPath();
    ctx.ellipse(x, y - 30, 18, 9, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9aa1b8';
    ctx.fillRect(x + 4, y - 44, 2, 12);
  },
  antenna(ctx, x, y) {
    ctx.strokeStyle = '#a3a9be';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 60);
    ctx.moveTo(x - 8, y + 4); ctx.lineTo(x, y - 30); ctx.lineTo(x + 8, y + 4);
    ctx.stroke();
    return [{ x, y: y - 62, r: 14, color: 'rgba(255,60,60,', blink: true }];
  },
  pad(ctx, x, y) {
    ctx.fillStyle = '#5a5e72';
    ctx.fillRect(x - 34, y - 4, 68, 8);
    ctx.fillStyle = '#ffcf3f';
    for (let i = -32; i < 32; i += 10) {
      ctx.beginPath();
      ctx.moveTo(x + i, y - 4); ctx.lineTo(x + i + 5, y - 4); ctx.lineTo(x + i + 1, y + 4); ctx.lineTo(x + i - 4, y + 4);
      ctx.fill();
    }
    return [{ x: x - 34, y: y - 6, r: 10, color: 'rgba(80,200,255,', blink: true }, { x: x + 34, y: y - 6, r: 10, color: 'rgba(80,200,255,', blink: true }];
  },
};
