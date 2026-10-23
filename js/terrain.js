import { WORLD_W, WORLD_H, WATER_Y } from './config.js';
import { makeRng, noise1D, valueNoise2, hash2 } from './rng.js';
import { MAPS, DECOR } from './maps.js';

// Палитры и параметры карт живут в maps.js; THEMES оставлен для совместимости.
export const THEMES = MAPS;

const smooth = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};

// Точки окружности для оценки нормали к поверхности.
const NORMAL_RING = [];
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  NORMAL_RING.push([Math.cos(a), Math.sin(a)]);
}

export class Terrain {
  constructor(seed, themeKey) {
    this.w = WORLD_W;
    this.h = WORLD_H;
    this.seed = seed;
    this.theme = MAPS[themeKey] || MAPS.meadow;
    this.lights = [];
    this.mask = new Uint8Array(this.w * this.h);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.generate();
    this.paint();
    this.paintDecor();
  }

  generate() {
    const { w: W, h: H, mask } = this;
    const rng = makeRng(this.seed);
    const n1 = noise1D(rng, W, 520);
    const n2 = noise1D(rng, W, 190);
    const n3 = noise1D(rng, W, 60);

    const gaps = [];
    const gapCount = Math.floor(rng() * 3);
    for (let g = 0; g < gapCount; g++) {
      gaps.push({ x: W * (0.22 + rng() * 0.56), w: 50 + rng() * 110 });
    }

    const surface = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      let hgt = 0.5 * n1(x) + 0.33 * n2(x) + 0.17 * n3(x);
      // Космодром: ровные площадки-плато с короткими склонами.
      if (this.theme.plateaus) {
        const step = 0.16;
        const q = Math.floor(hgt / step);
        const f = hgt / step - q;
        hgt = (q + smooth((f - 0.75) * 4)) * step;
      }
      const amp = this.theme.amp || 0.5;
      const y = H * (0.74 - amp) + hgt * H * amp;
      let e = Math.min(smooth(x / 240), smooth((W - x) / 240));
      for (const gap of gaps) {
        const d = Math.abs(x - gap.x) / gap.w;
        if (d < 1) e *= smooth(d * 1.4 - 0.2);
      }
      surface[x] = y * e + (WATER_Y + 90) * (1 - e);
    }
    this.surface = surface;

    const caveSeed = this.seed + 101;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const s = surface[x];
        if (y < s) continue;
        let solid = 1;
        if (y > s + 28 && y < WATER_Y + 40) {
          const c = valueNoise2(x / 95, y / 48, caveSeed) * 0.65 + valueNoise2(x / 34, y / 26, caveSeed + 1) * 0.35;
          if (c > (this.theme.caves || 0.69)) solid = 0;
        }
        mask[y * W + x] = solid;
      }
    }

    // Парящие острова.
    const islands = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < islands; i++) {
      const cx = 260 + rng() * (W - 520);
      const cy = surface[Math.floor(cx)] - 150 - rng() * 140;
      if (cy < 170) continue;
      const rx = 50 + rng() * 80;
      const ry = 12 + rng() * 10;
      for (let y = Math.floor(cy - ry); y < cy + ry * 2.4; y++) {
        for (let x = Math.floor(cx - rx); x < cx + rx; x++) {
          if (x < 0 || x >= W || y < 0 || y >= H) continue;
          const dx = (x - cx) / rx;
          const bottom = y > cy ? ry * (1.4 + valueNoise2(x / 12, 0, caveSeed + 9)) : ry;
          const dy = (y - cy) / bottom;
          if (dx * dx + dy * dy <= 1) mask[y * W + x] = 1;
        }
      }
    }
  }

  paint() {
    const { w: W, h: H, mask, theme, seed } = this;
    const img = this.ctx.createImageData(W, H);
    const data = img.data;
    const depth = new Uint16Array(W);
    const desert = !!theme.strata;
    const plates = !!theme.plates;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mask[i]) { depth[x] = 0; continue; }
        const d = ++depth[x];
        let r, g, b;
        if (d <= 3) {
          [r, g, b] = theme.top;
        } else if (d <= 9) {
          const t = (d - 3) / 6;
          r = theme.second[0] * (1 - t * 0.3) + theme.dirt[0] * t * 0.3;
          g = theme.second[1] * (1 - t * 0.3) + theme.dirt[1] * t * 0.3;
          b = theme.second[2] * (1 - t * 0.3) + theme.dirt[2] * t * 0.3;
        } else {
          let t = valueNoise2(x / 16, y / 16, seed + 7);
          if (desert) t = 0.5 + 0.5 * Math.sin(y * 0.09 + t * 4);
          r = theme.dirt[0] + (theme.dirtDark[0] - theme.dirt[0]) * t;
          g = theme.dirt[1] + (theme.dirtDark[1] - theme.dirt[1]) * t;
          b = theme.dirt[2] + (theme.dirtDark[2] - theme.dirt[2]) * t;
          const s = valueNoise2(x / 6, y / 6, seed + 11);
          if (s > 0.78) {
            const k = Math.min(1, (s - 0.78) * 7);
            const shade = 0.75 + 0.5 * valueNoise2(x / 2.5, y / 2.5, seed + 13);
            r = r * (1 - k) + theme.rock[0] * shade * k;
            g = g * (1 - k) + theme.rock[1] * shade * k;
            b = b * (1 - k) + theme.rock[2] * shade * k;
          }
        }
        let f = 0.9 + hash2(x, y, seed) * 0.18;
        // Металлические плиты с заклёпками.
        if (plates && d > 9) {
          const px = (x + (Math.floor(y / 32) % 2) * 24) % 48, py = y % 32;
          if (px < 2 || py < 2) f *= 0.62;
          else if ((px === 5 || px === 42) && (py === 5 || py === 26)) f *= 1.5;
        }
        if ((x > 0 && !mask[i - 1]) || (x < W - 1 && !mask[i + 1]) || (y < H - 1 && !mask[i + W])) f *= 0.68;
        const o = i * 4;
        data[o] = Math.min(255, r * f);
        data[o + 1] = Math.min(255, g * f);
        data[o + 2] = Math.min(255, b * f);
        data[o + 3] = 255;
      }
    }
    this.ctx.putImageData(img, 0, 0);
  }

  // Декорации карты рисуются в ландшафт и попадают в маску — их можно взорвать.
  // Рисуем всё на отдельном холсте и читаем пиксели один раз.
  paintDecor() {
    const kinds = this.theme.decor;
    if (!kinds || !kinds.length) return;
    const rng = makeRng(this.seed + 77);
    const layer = document.createElement('canvas');
    layer.width = this.w;
    layer.height = this.h;
    const ctx = layer.getContext('2d');
    const count = 9 + Math.floor(rng() * 5);
    const used = [];
    let top = this.h, bottom = 0;
    for (let n = 0, tries = 0; n < count && tries < 200; tries++) {
      const x = Math.floor(120 + rng() * (this.w - 240));
      const y = this.surfaceY(x);
      if (y === null || y > WATER_Y - 70 || y < 80) continue;
      const l = this.surfaceY(x - 12), r = this.surfaceY(x + 12);
      if (l === null || r === null || Math.abs(l - r) > 10) continue;
      if (used.some((u) => Math.abs(u - x) < 70)) continue;
      used.push(x);
      n++;
      const kind = kinds[Math.floor(rng() * kinds.length)];
      ctx.save();
      const lights = DECOR[kind](ctx, x, y + 3, rng, this.theme);
      ctx.restore();
      if (lights) this.lights.push(...lights);
      top = Math.min(top, y - 140);
      bottom = Math.max(bottom, y + 10);
    }
    if (!used.length) return;
    top = Math.max(0, top);
    bottom = Math.min(this.h, bottom);
    const data = ctx.getImageData(0, top, this.w, bottom - top).data;
    for (let yy = 0; yy < bottom - top; yy++) {
      const row = (top + yy) * this.w;
      for (let xx = 0; xx < this.w; xx++) {
        if (data[(yy * this.w + xx) * 4 + 3] > 110) this.mask[row + xx] = 1;
      }
    }
    this.ctx.drawImage(layer, 0, 0);
  }

  isSolid(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x >= this.w || y < 0 || y >= this.h) return false;
    return this.mask[y * this.w + x] === 1;
  }

  // Нормаль, направленная из земли наружу.
  normalAt(x, y, r = 5) {
    let nx = 0, ny = 0;
    for (const [dx, dy] of NORMAL_RING) {
      if (this.isSolid(x + dx * r, y + dy * r)) { nx -= dx; ny -= dy; }
    }
    const len = Math.hypot(nx, ny);
    if (len < 1e-6) return { x: 0, y: -1 };
    return { x: nx / len, y: ny / len };
  }

  carve(cx, cy, r) {
    const { w: W, h: H, mask } = this;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        if (dx * dx + dy * dy <= r2) mask[y * W + x] = 0;
      }
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = this.theme.rim;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Верхняя точка земли в столбце x (или null, если столбец пуст до воды).
  surfaceY(x) {
    for (let y = 0; y < WATER_Y; y++) if (this.isSolid(x, y)) return y;
    return null;
  }

  // Свободен ли отрезок между двумя точками.
  lineClear(x0, y0, x1, y1, step = 2) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(len / step);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.isSolid(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }
}
