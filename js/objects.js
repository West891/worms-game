import { PHYS, WATER } from './config.js';

// Предметы на карте: ящики, мины, надгробия.
export class Item {
  constructor(type, x, y, extra = {}) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.resting = false;
    this.dead = false;
    this.parachute = type === 'crate' && extra.parachute;
    this.content = extra.content || null; // для ящика: 'health' | id оружия
    this.armDelay = extra.armDelay || 0; // для мины: тики до взведения
    this.fuse = 0; // для мины: тики до взрыва после срабатывания
    this.bob = Math.random() * 10;
    this.stuck = 0; // тики подряд, когда предмет упирается в землю и не сдвигается
  }

  get radius() { return this.type === 'mine' ? 4 : 8; }

  update(terrain, wind) {
    if (this.armDelay > 0) this.armDelay--;
    const r = this.radius;
    if (this.resting) {
      // Опора — те же точки, что и при столкновении: застрявший в узкой
      // ямке ящик может касаться только стенок, а не земли прямо под собой.
      if (terrain.isSolid(this.x, this.y + r + 1) || terrain.isSolid(this.x - r * 0.7, this.y + r * 0.7 + 1) ||
        terrain.isSolid(this.x + r * 0.7, this.y + r * 0.7 + 1)) return null;
      this.resting = false;
    }
    this.vy += PHYS.g;
    if (this.parachute) {
      this.vy = Math.min(this.vy, 1.3);
      this.vx = wind * 0.5;
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(this.vx, this.vy)));
    const x0 = this.x, y0 = this.y;
    let hit = false;
    for (let i = 0; i < steps; i++) {
      const nx = this.x + this.vx / steps;
      const ny = this.y + this.vy / steps;
      if (terrain.isSolid(nx, ny + r) || terrain.isSolid(nx - r * 0.7, ny + r * 0.7) || terrain.isSolid(nx + r * 0.7, ny + r * 0.7)) {
        const n = terrain.normalAt(nx, ny + r, 5);
        const vn = this.vx * n.x + this.vy * n.y;
        if (vn < 0) {
          this.vx -= 1.2 * vn * n.x;
          this.vy -= 1.2 * vn * n.y;
          this.vx *= 0.7;
          this.vy *= 0.7;
        }
        this.parachute = false;
        if (Math.hypot(this.vx, this.vy) < 0.8 && n.y < -0.4) {
          this.vx = this.vy = 0;
          this.resting = true;
        }
        if (terrain.isSolid(this.x, this.y + r)) this.y -= 1;
        hit = true;
        break;
      }
      this.x = nx;
      this.y = ny;
    }
    // На крутом склоне или в щели скорость не гасится до нуля, а предмет
    // всё равно стоит на месте. Без этого ход ждал бы его до упора.
    if (hit && !this.resting && Math.hypot(this.x - x0, this.y - y0) < 0.25) {
      if (++this.stuck >= 20) {
        this.vx = this.vy = 0;
        this.resting = true;
      }
    } else if (!hit || Math.hypot(this.x - x0, this.y - y0) > 1) {
      this.stuck = 0;
    }
    if (this.y > WATER.y + 4) return 'water';
    return null;
  }

  draw(ctx, sp, time) {
    const { x, y } = this;
    if (this.type === 'crate') {
      if (this.parachute) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 8); ctx.lineTo(x - 15, y - 30);
        ctx.moveTo(x + 8, y - 8); ctx.lineTo(x + 15, y - 30);
        ctx.stroke();
        ctx.fillStyle = this.content === 'health' ? '#f4f4f4' : '#ffb347';
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.arc(x, y - 30, 17, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      const health = this.content === 'health';
      ctx.fillStyle = health ? '#f2f2f2' : '#c58a4a';
      ctx.strokeStyle = health ? '#777' : '#5a3a18';
      ctx.lineWidth = 1.2;
      ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.strokeRect(x - 8, y - 8, 16, 16);
      if (health) {
        ctx.fillStyle = '#e33';
        ctx.fillRect(x - 2, y - 6, 4, 12);
        ctx.fillRect(x - 6, y - 2, 12, 4);
      } else {
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 8, y + 8);
        ctx.moveTo(x + 8, y - 8); ctx.lineTo(x - 8, y + 8);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = '800 9px Rubik, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x, y + 0.5);
      }
    } else if (this.type === 'mine') {
      ctx.fillStyle = '#2b2b2b';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y + 1, 6, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const blinkOn = this.fuse > 0 ? Math.floor(time / 4) % 2 === 0 : Math.floor((time + this.bob * 10) / 40) % 2 === 0;
      ctx.fillStyle = this.armDelay > 0 ? '#555' : blinkOn ? '#ff3030' : '#661010';
      ctx.beginPath();
      ctx.arc(x, y - 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'barrel') {
      ctx.fillStyle = '#c8442e';
      ctx.strokeStyle = '#5a1a10';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, y - 7, 7, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 7, y - 7, 14, 15);
      ctx.strokeRect(x - 7, y - 7, 14, 15);
      ctx.fillStyle = '#ffcf3f';
      ctx.fillRect(x - 7, y - 2, 14, 4);
      ctx.fillStyle = '#1b1b1b';
      ctx.font = '800 6px Rubik, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☢', x, y + 0.2);
    } else if (this.type === 'grave') {
      ctx.drawImage(sp.tombShadow, x - 10.5, y - 11.5, 21, 21);
      ctx.drawImage(sp.tomb, x - 9, y - 10, 18, 18);
    }
  }
}
