import { rand, pick } from './rng.js';
import { QUALITY } from './quality.js';

const BOOM_WORDS = ['БУМ!', 'БАХ!', 'БАБАХ!', 'ПАФ!', 'БДЫЩ!'];

export class Effects {
  constructor(assets) {
    this.sp = assets.sprite;
    this.parts = [];
    this.texts = [];
  }

  add(p) {
    // Лимит частиц: на слабых устройствах лишние просто не появляются.
    if (this.parts.length >= QUALITY.maxParticles) return;
    p.life = p.max = p.life || 30;
    p.vx = p.vx || 0;
    p.vy = p.vy || 0;
    p.g = p.g || 0;
    p.drag = p.drag ?? 1;
    p.rot = p.rot || 0;
    p.vr = p.vr || 0;
    p.a0 = p.a0 ?? 1;
    p.a1 = p.a1 ?? 0;
    p.s1 = p.s1 ?? p.s0;
    this.parts.push(p);
  }

  update() {
    for (const p of this.parts) {
      p.life--;
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.life--;
      t.y += t.vy;
      t.vy *= 0.96;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  draw(ctx) {
    for (const p of this.parts) {
      const k = 1 - p.life / p.max;
      const a = p.a0 + (p.a1 - p.a0) * k;
      if (a <= 0) continue;
      const s = p.s0 + (p.s1 - p.s0) * k;
      ctx.globalAlpha = Math.min(1, a);
      ctx.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
      if (p.img) {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.rot) ctx.rotate(p.rot);
        ctx.drawImage(p.img, -s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (p.rect) {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  drawTexts(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const a = Math.min(1, t.life / 25);
      const pop = t.age0 - t.life < 8 ? 0.6 + (t.age0 - t.life) / 20 : 1;
      ctx.globalAlpha = a;
      ctx.font = `800 ${Math.round(t.size * pop)}px Rubik, sans-serif`;
      ctx.lineWidth = Math.max(3, t.size / 5);
      ctx.strokeStyle = '#1b1220';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  text(x, y, text, color = '#fff', size = 14, life = 70) {
    this.texts.push({ x, y, text, color, size, life, age0: life, vy: -1.1 });
  }

  explosion(x, y, r, debrisColors) {
    const sp = this.sp;
    this.add({ img: sp.flash, x, y, s0: r * 2.4, s1: r * 3.4, life: 10, add: true, a0: 1, a1: 0 });
    this.add({ img: sp.ring, x, y, s0: r * 0.6, s1: r * 2.9, life: 22, a0: 1, a1: 0 });
    this.add({ img: sp.star, x, y, s0: r * 1.2, s1: r * 2.6, life: 14, add: true, rot: rand(0, 6), vr: 0.05 });
    const q = QUALITY.fx;
    const fire = Math.round(r * 0.6 * q);
    for (let i = 0; i < fire; i++) {
      const a = rand(0, Math.PI * 2), v = rand(0.5, 3.5) * (r / 40);
      this.add({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, drag: 0.93,
        s0: rand(2, 5) * (r / 35), s1: 0.5, life: rand(18, 38) | 0,
        color: pick(['#ff7a1f', '#ffb52e', '#ffe259', '#ff4d1f']), add: true,
      });
    }
    const smoke = Math.round((r / 5) * q) + 2;
    for (let i = 0; i < smoke; i++) {
      const a = rand(0, Math.PI * 2), d = rand(0, r * 0.6);
      this.add({
        img: Math.random() < 0.5 ? sp.smokeGray : sp.smokeDark,
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        vx: Math.cos(a) * 0.4, vy: -rand(0.2, 0.7), drag: 0.99,
        s0: r * rand(0.4, 0.7), s1: r * rand(1.1, 1.6), life: rand(50, 95) | 0,
        a0: 0.75, a1: 0, rot: rand(0, 6), vr: rand(-0.02, 0.02),
      });
    }
    const debris = Math.round(r * 0.5 * q);
    for (let i = 0; i < debris; i++) {
      const a = rand(Math.PI * 1.05, Math.PI * 1.95), v = rand(1.5, 6) * Math.sqrt(r / 40);
      this.add({
        rect: true, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.2,
        s0: rand(2, 4), life: rand(40, 70) | 0, color: pick(debrisColors),
        a0: 1, a1: 0.6, vr: rand(-0.3, 0.3),
      });
    }
    if (r >= 40) this.text(x, y - r * 0.6, pick(BOOM_WORDS), '#ffe259', 16 + r * 0.25, 55);
  }

  trail(x, y) {
    this.add({
      img: this.sp.smokeWhite, x: x + rand(-1, 1), y: y + rand(-1, 1), vy: -0.15,
      s0: 5, s1: 16, life: 40, a0: 0.55, a1: 0, rot: rand(0, 6),
    });
  }

  fuseSpark(x, y) {
    this.add({
      x, y, vx: rand(-1, 1), vy: rand(-1.8, -0.5), g: 0.08, s0: 1.4, s1: 0.2, life: 14,
      color: pick(['#ffe259', '#ff9a2e']), add: true,
    });
  }

  splash(x, y, size = 1) {
    const n = Math.round(14 * size);
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + rand(-4, 4), y, vx: rand(-1.6, 1.6) * size, vy: -rand(2, 5) * size, g: 0.18,
        s0: rand(1.5, 3), s1: 1, life: rand(30, 50) | 0, color: '#d6efff', a0: 0.9, a1: 0.2,
      });
    }
    this.add({ img: this.sp.ring, x, y, s0: 8, s1: 50 * size, life: 25, a0: 0.5, a1: 0 });
  }

  teleport(x, y) {
    for (let i = 0; i < 24; i++) {
      const a = rand(0, Math.PI * 2), v = rand(0.5, 2.5);
      this.add({
        img: this.sp.sparkCyan, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.94,
        s0: rand(6, 12), s1: 0, life: rand(25, 45) | 0, add: true, rot: rand(0, 6),
      });
    }
  }

  dust(x, y) {
    for (let i = 0; i < 6; i++) {
      this.add({
        img: this.sp.smokeGray, x: x + rand(-6, 6), y, vx: rand(-0.6, 0.6), vy: -rand(0.1, 0.4),
        s0: 4, s1: 12, life: 30, a0: 0.4, a1: 0,
      });
    }
  }
}
