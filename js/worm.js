import { PHYS, WORM_R, WALK_SPEED, MAX_CLIMB, WATER, WORM_HP } from './config.js';

// Точки, которыми червяк «щупает» землю.
const BODY_POINTS = [[0, 0]];
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  BODY_POINTS.push([Math.cos(a) * WORM_R, Math.sin(a) * WORM_R]);
}
const CONTACT_RING = [];
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2;
  CONTACT_RING.push([Math.cos(a), Math.sin(a)]);
}

// Шапки команд: у каждой команды своя.
function drawHat(ctx, kind, hx, hy, dir, color) {
  ctx.save();
  ctx.translate(hx - dir * 0.5, hy - 4.5);
  ctx.scale(dir, 1);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = '#1b1220';
  switch (kind) {
    case 'cap':
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 4.6, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(1, -0.6, 6, 1.6);
      break;
    case 'crown':
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(-4.5, 0); ctx.lineTo(-4.5, -5); ctx.lineTo(-2.2, -2.5); ctx.lineTo(0, -6);
      ctx.lineTo(2.2, -2.5); ctx.lineTo(4.5, -5); ctx.lineTo(4.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e33';
      ctx.fillRect(-0.8, -2.5, 1.6, 1.6);
      break;
    case 'tophat':
      ctx.fillStyle = '#1e1e26';
      ctx.fillRect(-6, -1, 12, 1.8);
      ctx.fillRect(-3.6, -8, 7.2, 7.5);
      ctx.fillStyle = color;
      ctx.fillRect(-3.6, -2.6, 7.2, 1.6);
      break;
    case 'cowboy':
      ctx.fillStyle = '#9a6a3a';
      ctx.beginPath();
      ctx.ellipse(0, -0.5, 7.5, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-3.8, -0.5); ctx.lineTo(-3, -6); ctx.lineTo(0, -4.5); ctx.lineTo(3, -6); ctx.lineTo(3.8, -0.5);
      ctx.fill();
      ctx.stroke();
      break;
    case 'viking':
      ctx.fillStyle = '#9aa0ac';
      ctx.beginPath();
      ctx.arc(0, 0, 4.8, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f2ead8';
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 4, -1.5);
        ctx.quadraticCurveTo(s * 8, -3, s * 7, -8);
        ctx.quadraticCurveTo(s * 6, -4, s * 3.5, -3.5);
        ctx.fill();
      }
      break;
    case 'party':
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(-3.8, 0); ctx.lineTo(0, -10); ctx.lineTo(3.8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, -10, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'wizard':
      ctx.fillStyle = '#3a2a8a';
      ctx.beginPath();
      ctx.moveTo(-5.5, 0); ctx.lineTo(-1, -11); ctx.lineTo(-4, -12); ctx.lineTo(5.5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-1, -5, 1.6, 1.6);
      ctx.fillRect(1.5, -2.5, 1.2, 1.2);
      break;
    case 'helmet':
      ctx.fillStyle = '#5a6a3a';
      ctx.beginPath();
      ctx.arc(0, 0.5, 5.4, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillRect(-6, -0.2, 12, 1.4);
      break;
  }
  ctx.restore();
}

export function wormCollides(terrain, x, y) {
  for (const [dx, dy] of BODY_POINTS) if (terrain.isSolid(x + dx, y + dy)) return true;
  return false;
}

export function contactNormal(terrain, x, y) {
  let nx = 0, ny = 0;
  for (const [dx, dy] of CONTACT_RING) {
    if (terrain.isSolid(x + dx * (WORM_R + 2), y + dy * (WORM_R + 2))) { nx -= dx; ny -= dy; }
  }
  const len = Math.hypot(nx, ny);
  return len < 1e-6 ? { x: 0, y: -1 } : { x: nx / len, y: ny / len };
}

const RESTITUTION = 0.3;
const FALL_SAFE_SPEED = 6.5;

export class Worm {
  constructor(team, name, x, y) {
    this.team = team;
    this.name = name;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.hp = WORM_HP;
    this.shownHp = WORM_HP;
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.aim = 0.35;
    this.grounded = false;
    this.dead = false;
    this.walkAcc = 0;
    this.walkPhase = 0;
    this.stuckTicks = 0;
    this.blinkTimer = Math.random() * 200;
    this.flying = false; // летит после взрыва/удара
  }

  get alive() { return !this.dead; }

  aimVector() {
    return { x: Math.cos(this.aim) * this.dir, y: -Math.sin(this.aim) };
  }

  // Шаг ходьбы. Возвращает true, если червяк сдвинулся.
  walk(terrain, dir) {
    this.dir = dir;
    if (!this.grounded) return false;
    this.walkAcc += WALK_SPEED;
    let moved = false;
    while (this.walkAcc >= 1) {
      this.walkAcc -= 1;
      if (!this.stepX(terrain, dir)) { this.walkAcc = 0; break; }
      moved = true;
      if (!this.grounded) break;
    }
    if (moved) this.walkPhase += 0.35;
    return moved;
  }

  stepX(terrain, dir) {
    const nx = this.x + dir;
    for (let up = 0; up <= MAX_CLIMB; up++) {
      if (wormCollides(terrain, nx, this.y - up)) continue;
      this.x = nx;
      this.y -= up;
      for (let d = 0; d <= MAX_CLIMB; d++) {
        if (wormCollides(terrain, this.x, this.y + 1)) return true;
        this.y += 1;
      }
      this.grounded = false;
      this.vx = dir * 0.7;
      this.vy = 0;
      return true;
    }
    return false;
  }

  jump(back) {
    if (!this.grounded) return false;
    this.grounded = false;
    if (back) { this.vx = -this.dir * 1.0; this.vy = -6.2; }
    else { this.vx = this.dir * 2.3; this.vy = -4.2; }
    this.y -= 1;
    return true;
  }

  knock(vx, vy) {
    this.rope = null;
    this.vx += vx;
    this.vy += vy;
    this.grounded = false;
    this.flying = true;
  }

  // Физика одного тика. Возвращает событие: { landed, fallDamage } или null.
  update(terrain) {
    this.blinkTimer -= 1;
    if (this.blinkTimer < -8) this.blinkTimer = 120 + Math.random() * 240;
    if (this.dead) return null;

    if (this.grounded) {
      if (!wormCollides(terrain, this.x, this.y + 1)) {
        this.grounded = false;
        this.vx = 0;
        this.vy = 0;
      } else {
        return null;
      }
    }

    this.vy = Math.min(this.vy + PHYS.g, 14);
    const speed = Math.hypot(this.vx, this.vy);
    const steps = Math.max(1, Math.ceil(speed));
    let result = null;
    const ox = this.x, oy = this.y;
    for (let i = 0; i < steps; i++) {
      const nx = this.x + this.vx / steps;
      const ny = this.y + this.vy / steps;
      if (!wormCollides(terrain, nx, ny)) { this.x = nx; this.y = ny; continue; }
      const n = contactNormal(terrain, nx, ny);
      const vn = this.vx * n.x + this.vy * n.y;
      let impact = 0;
      if (vn < 0) {
        impact = -vn;
        this.vx -= (1 + RESTITUTION) * vn * n.x;
        this.vy -= (1 + RESTITUTION) * vn * n.y;
        this.vx *= 0.75;
        this.vy *= 0.75;
      }
      if (wormCollides(terrain, this.x, this.y)) { this.x += n.x; this.y += n.y; }
      if (n.y < -0.45 && Math.hypot(this.vx, this.vy) < 2.2) {
        this.grounded = true;
        this.flying = false;
        this.vx = 0;
        this.vy = 0;
      }
      const fallDamage = impact > FALL_SAFE_SPEED ? Math.round((impact - FALL_SAFE_SPEED) * 5) : 0;
      result = { landed: this.grounded, impact, fallDamage };
      break;
    }
    if (!this.grounded) {
      if (Math.abs(this.x - ox) < 0.05 && Math.abs(this.y - oy) < 0.05) this.stuckTicks++;
      else this.stuckTicks = 0;
      if (this.stuckTicks > 20) {
        this.grounded = true;
        this.flying = false;
        this.vx = this.vy = 0;
        this.stuckTicks = 0;
      }
    }
    return result;
  }

  get inWater() { return this.y > WATER.y + 4; }
  get atRest() { return this.dead || this.grounded; }

  draw(ctx, opts) {
    if (this.dead) return;
    const { x, y, dir } = this;
    const wiggle = this.grounded ? Math.sin(this.walkPhase) : 0;
    const segs = [
      [x - dir * 4.5, y + 2.5, 4.4],
      [x - dir * 1.5 + wiggle * 0.4, y + 1 - Math.abs(wiggle) * 0.6, 5.4],
      [x + dir * 1, y - 3.2, 5],
      [x + dir * 2, y - 8.2 + wiggle * 0.3, 5.6],
    ];
    if (opts.flying) {
      segs[0][1] -= 2;
      segs[3][1] += 1;
    }
    ctx.fillStyle = '#7d3a4e';
    for (const [sx, sy, r] of segs) {
      ctx.beginPath();
      ctx.arc(sx, sy, r + 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f7a3b7';
    for (const [sx, sy, r] of segs) {
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Блик на спине.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(segs[1][0] - dir * 1.5, segs[1][1] - 2, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // Повязка цвета команды.
    const [hx, hy] = [segs[3][0], segs[3][1]];
    ctx.strokeStyle = this.team.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(hx, hy, 5.2, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx - dir * 4.5, hy - 2.5);
    ctx.lineTo(hx - dir * 8, hy - 1 + Math.sin(this.walkPhase * 0.7 + performance.now() / 300) * 1.2);
    ctx.stroke();
    if (this.team.hat) drawHat(ctx, this.team.hat, hx, hy, dir, this.team.color);
    // Глаза.
    const look = opts.look || { x: dir, y: 0 };
    const eyes = [[hx + dir * 0.4, hy - 1.6], [hx + dir * 3.6, hy - 1.4]];
    const blink = this.blinkTimer < 0;
    for (const [ex, ey] of eyes) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#7d3a4e';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 1.9, blink ? 0.4 : 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (!blink) {
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(ex + look.x * 0.8, ey + look.y * 1.1 + 0.3, 1.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Рот.
    ctx.strokeStyle = '#7d3a4e';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    if (opts.hurt) ctx.arc(hx + dir * 2.6, hy + 3.2, 1.1, 0, Math.PI * 2);
    else ctx.arc(hx + dir * 2.4, hy + 1.6, 1.6, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
}
