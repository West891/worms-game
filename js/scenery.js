// Окружение карты: небо, дальний план, погода, огоньки, туман, фоновые события.
// Всё здесь — только для красоты: у хоста и гостя может отличаться.
import { WORLD_W, WATER_Y } from './config.js';
import { makeRng, noise1D, rand, pick } from './rng.js';
import { glowSprite } from './sprites.js';
import { QUALITY } from './quality.js';

const HILL_W = 2048;

// Силуэты на горизонте поверх холмов.
function drawSkyline(ctx, kind, rng, h, color) {
  ctx.fillStyle = color;
  if (kind === 'spooky') {
    // Замок с башенками и голые деревья.
    const cx = 300 + rng() * 1400, base = 300;
    ctx.fillRect(cx - 70, base - 90, 140, 90);
    for (const [dx, tw, th] of [[-80, 26, 150], [70, 30, 170], [0, 34, 200]]) {
      ctx.fillRect(cx + dx - tw / 2, base - th, tw, th);
      ctx.beginPath();
      ctx.moveTo(cx + dx - tw / 2 - 6, base - th);
      ctx.lineTo(cx + dx, base - th - 40);
      ctx.lineTo(cx + dx + tw / 2 + 6, base - th);
      ctx.fill();
    }
    for (let i = 0; i < 8; i++) {
      const x = rng() * HILL_W;
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, base + 20);
      ctx.lineTo(x + 4, base - 60);
      ctx.lineTo(x - 18, base - 90);
      ctx.moveTo(x + 3, base - 40);
      ctx.lineTo(x + 24, base - 70);
      ctx.stroke();
    }
  } else if (kind === 'church') {
    const cx = 400 + rng() * 1200, base = 300;
    ctx.fillRect(cx - 60, base - 70, 120, 70);
    ctx.fillRect(cx + 30, base - 150, 34, 150);
    ctx.beginPath();
    ctx.moveTo(cx + 24, base - 150);
    ctx.lineTo(cx + 47, base - 210);
    ctx.lineTo(cx + 70, base - 150);
    ctx.fill();
    ctx.fillRect(cx + 45, base - 232, 4, 22);
    ctx.fillRect(cx + 39, base - 225, 16, 4);
    ctx.beginPath();
    ctx.moveTo(cx - 66, base - 70);
    ctx.lineTo(cx, base - 110);
    ctx.lineTo(cx + 66, base - 70);
    ctx.fill();
    for (let i = 0; i < 26; i++) {
      const x = rng() * HILL_W, ch = 14 + rng() * 14;
      ctx.fillRect(x - 2, base - ch, 4, ch + 20);
      ctx.fillRect(x - 6, base - ch + 5, 12, 3);
    }
  } else if (kind === 'launch') {
    for (let i = 0; i < 4; i++) {
      const x = 200 + i * 450 + rng() * 200, base = 300, th = 160 + rng() * 80;
      ctx.fillRect(x - 6, base - th, 12, th);
      ctx.fillRect(x - 30, base - th * 0.7, 24, 6);
      // Ракета на старте.
      ctx.beginPath();
      ctx.moveTo(x + 20, base);
      ctx.lineTo(x + 20, base - th * 0.85);
      ctx.lineTo(x + 30, base - th * 0.85 - 30);
      ctx.lineTo(x + 40, base - th * 0.85);
      ctx.lineTo(x + 40, base);
      ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      const x = rng() * HILL_W, r = 30 + rng() * 30;
      ctx.beginPath();
      ctx.arc(x, 300, r, Math.PI, 0);
      ctx.fill();
    }
  }
}

export function buildScenery(game) {
  const map = game.terrain.theme;
  const rng = makeRng(game.seed + 5);
  const hills = map.hills.map((color, layer) => {
    const c = document.createElement('canvas');
    c.width = HILL_W;
    c.height = 420;
    const ctx = c.getContext('2d');
    const n1 = noise1D(rng, HILL_W, 340 - layer * 120);
    const n2 = noise1D(rng, HILL_W, 90);
    const at = (x) => (n1(x) * 0.8 + n2(x) * 0.2);
    if (map.skyline && layer === 0) {
      ctx.save();
      ctx.translate(0, 60 + layer * 70 - 120);
      drawSkyline(ctx, map.skyline, rng, 420, color);
      ctx.restore();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 420);
    for (let x = 0; x <= HILL_W; x += 8) {
      const blend = x > HILL_W - 200 ? (x - (HILL_W - 200)) / 200 : 0;
      const h = at(x) * (1 - blend) + at(x - (HILL_W - 200)) * blend;
      ctx.lineTo(x, 60 + layer * 70 + h * 220);
    }
    ctx.lineTo(HILL_W, 420);
    ctx.closePath();
    ctx.fill();
    return c;
  });
  const stars = Array.from({ length: map.stars || 0 }, () => ({
    x: rng(), y: rng() * 0.75, r: 0.4 + rng() * 1.3, tw: rng() * Math.PI * 2, sp: 0.02 + rng() * 0.05,
  }));
  const cloudCount = map.clouds === 'none' ? 0 : map.clouds === 'night' ? 8 : 14;
  const clouds = Array.from({ length: cloudCount }, () => ({
    x: rand(-300, WORLD_W + 300), y: rand(-80, 380), s: rand(90, 220), a: rand(0.35, 0.7),
  }));
  const fog = map.fog ? Array.from({ length: 18 }, () => ({
    x: rand(-200, WORLD_W + 200), y: rand(WATER_Y - 520, WATER_Y - 40), s: rand(180, 380), a: rand(0.12, 0.26), v: rand(0.1, 0.35),
  })) : [];
  return { hills, stars, clouds, fog, weather: [], bats: [], launches: [], shooting: [] };
}

export function drawSky(game, ctx, vw, vh, sky) {
  const map = game.terrain.theme;
  const cam = game.camera;
  const sc = game.scenery;
  if (!map.night) {
    const s = Math.max(vw / sky.width, vh / sky.height) * 1.1;
    ctx.drawImage(sky, (vw - sky.width * s) / 2, (vh - sky.height * s) * 0.3, sky.width * s, sky.height * s);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, vh);
  g.addColorStop(0, map.sky[0]);
  g.addColorStop(0.6, map.sky[1]);
  g.addColorStop(1, map.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  const t = game.time;
  const px = -(cam.x / WORLD_W) * 60;
  for (const s of sc.stars) {
    const a = 0.45 + 0.55 * Math.sin(s.tw + t * s.sp);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = '#fff';
    ctx.fillRect(((s.x * (vw + 80) + px) % (vw + 80) + vw + 80) % (vw + 80) - 40, s.y * vh, s.r * 1.6, s.r * 1.6);
  }
  ctx.globalAlpha = 1;
  for (const s of sc.shooting) {
    ctx.strokeStyle = `rgba(255,255,255,${s.life / 40})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x * vw, s.y * vh);
    ctx.lineTo(s.x * vw - 60, s.y * vh - 20);
    ctx.stroke();
  }
  const body = map.moon || map.planet;
  if (body) {
    const bx = body.x * vw + px * 0.5, by = body.y * vh;
    const glow = ctx.createRadialGradient(bx, by, body.r * 0.6, bx, by, body.r * 3);
    glow.addColorStop(0, body.glow || 'rgba(255,255,255,0.15)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(bx - body.r * 3, by - body.r * 3, body.r * 6, body.r * 6);
    if (map.planet) {
      ctx.strokeStyle = body.ring;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(bx, by, body.r * 1.8, body.r * 0.45, -0.35, Math.PI * 0.95, Math.PI * 2.05);
      ctx.stroke();
    }
    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(bx, by, body.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.1, 0.16], [-0.05, 0.4, 0.12], [0.35, -0.35, 0.1]]) {
      ctx.beginPath();
      ctx.arc(bx + dx * body.r, by + dy * body.r, r * body.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (map.planet) {
      ctx.strokeStyle = body.ring;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(bx, by, body.r * 1.8, body.r * 0.45, -0.35, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
    }
  }
  // Ракеты, стартующие на горизонте космодрома.
  for (const l of sc.launches) {
    const x = l.x * vw + px, y = vh * 0.62 - l.h;
    ctx.fillStyle = 'rgba(255,190,90,0.9)';
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 14);
    ctx.lineTo(x, y + 26 + Math.random() * 10);
    ctx.lineTo(x + 3, y + 14);
    ctx.fill();
    ctx.fillStyle = '#c8cde0';
    ctx.fillRect(x - 3, y, 6, 14);
    for (let i = 1; i < 12; i++) {
      ctx.fillStyle = `rgba(200,200,220,${0.18 - i * 0.012})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(i + l.h * 0.01) * i, y + 20 + i * 12, 4 + i * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Погода и живые фоновые события. Вызывается каждый тик.
export function updateScenery(game) {
  const map = game.terrain.theme;
  const sc = game.scenery;
  const cam = game.camera;
  const vw = (game.viewW || 1280) / cam.zoom, vh = (game.viewH || 720) / cam.zoom;
  const x0 = cam.x - vw / 2 - 60, x1 = cam.x + vw / 2 + 60, y0 = cam.y - vh / 2 - 40;
  const wind = game.wind;
  const w = sc.weather;
  const spawn = ({ snow: 1.2, petals: 0.12, dust: 0.5, wisps: 0.05, sparks: 0.15, bats: 0 }[map.weather] || 0) * QUALITY.weather;
  if (w.length < 260 && Math.random() < spawn % 1 + (spawn >= 1 ? 1 : 0)) {
    for (let i = 0; i < Math.max(1, Math.floor(spawn)); i++) {
      const p = { x: rand(x0, x1), y: y0, life: 600, phase: rand(0, 6) };
      if (map.weather === 'dust') { p.x = wind >= 0 ? x0 : x1; p.y = rand(y0, y0 + vh); }
      if (map.weather === 'wisps' || map.weather === 'sparks') { p.y = rand(y0 + vh * 0.3, y0 + vh); p.life = 300; }
      w.push(p);
    }
  }
  for (const p of w) {
    p.life--;
    p.phase += 0.05;
    switch (map.weather) {
      case 'snow': p.x += wind * 1.2 + Math.sin(p.phase) * 0.3; p.y += 0.7; break;
      case 'petals': p.x += wind * 1.5 + Math.sin(p.phase) * 0.6; p.y += 0.45; break;
      case 'dust': p.x += (Math.sign(wind) || 1) * (2 + Math.abs(wind) * 4); p.y += Math.sin(p.phase) * 0.3; break;
      case 'wisps': p.x += Math.sin(p.phase * 0.5) * 0.4 + wind * 0.3; p.y += Math.cos(p.phase * 0.7) * 0.3 - 0.05; break;
      case 'sparks': p.y -= 0.25; p.x += Math.sin(p.phase) * 0.2; break;
    }
  }
  sc.weather = w.filter((p) => p.life > 0 && p.y < WATER_Y + 40 && p.x > x0 - 200 && p.x < x1 + 200);

  if (map.weather === 'bats' && Math.random() < 0.004 && sc.bats.length < 3) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const flock = [];
    for (let i = 0; i < 6 + Math.floor(Math.random() * 6); i++) {
      flock.push({ dx: rand(-60, 60), dy: rand(-30, 30), ph: rand(0, 6) });
    }
    sc.bats.push({ x: dir > 0 ? x0 - 100 : x1 + 100, y: rand(y0 + 40, y0 + vh * 0.4), dir, flock, life: 900 });
    game.ambientSound('bats');
  }
  for (const b of sc.bats) { b.x += b.dir * 2.2; b.y += Math.sin(game.time * 0.03) * 0.4; b.life--; }
  sc.bats = sc.bats.filter((b) => b.life > 0);

  if (map.planet || map.stars) {
    if (Math.random() < 0.003) sc.shooting.push({ x: rand(0.2, 1), y: rand(0.05, 0.4), life: 40 });
    for (const s of sc.shooting) { s.x -= 0.012; s.y += 0.004; s.life--; }
    sc.shooting = sc.shooting.filter((s) => s.life > 0);
  }
  if (map.skyline === 'launch') {
    if (Math.random() < 0.0012 && sc.launches.length === 0) {
      sc.launches.push({ x: rand(0.15, 0.85), h: 0, v: 0.2 });
      game.ambientSound('liftoff');
    }
    for (const l of sc.launches) { l.v += 0.01; l.h += l.v; }
    sc.launches = sc.launches.filter((l) => l.h < 900);
  }
  for (const f of sc.fog) {
    f.x += f.v + wind * 0.4;
    if (f.x > WORLD_W + 300) f.x = -300;
    if (f.x < -300) f.x = WORLD_W + 300;
  }
}

// Частицы погоды, летучие мыши и огоньки (в координатах мира).
export function drawWeather(game, ctx) {
  const map = game.terrain.theme;
  const sc = game.scenery;
  for (const p of sc.weather) {
    switch (map.weather) {
      case 'snow':
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(p.x, p.y, 2.2, 2.2);
        break;
      case 'petals':
        ctx.fillStyle = p.phase % 2 > 1 ? '#ffb3d1' : '#fff2a8';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 2.6, 1.4, p.phase, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'dust':
        ctx.fillStyle = 'rgba(240,210,150,0.35)';
        ctx.fillRect(p.x, p.y, 8, 1.2);
        break;
      case 'wisps': {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 60) * (0.5 + 0.5 * Math.sin(p.phase * 2)));
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glowSprite('150,255,190'), p.x - 7, p.y - 7, 14, 14);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        break;
      }
      case 'sparks':
        ctx.fillStyle = `rgba(120,220,255,${Math.min(1, p.life / 80) * 0.7})`;
        ctx.fillRect(p.x, p.y, 1.5, 1.5);
        break;
    }
  }
  ctx.fillStyle = '#0b0410';
  for (const b of sc.bats) {
    for (const m of b.flock) {
      const x = b.x + m.dx, y = b.y + m.dy;
      const flap = Math.sin(game.time * 0.5 + m.ph) * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - 5, y - 4 - flap, x - 9, y - flap);
      ctx.quadraticCurveTo(x - 5, y - 1, x, y + 1.5);
      ctx.quadraticCurveTo(x + 5, y - 1, x + 9, y - flap);
      ctx.quadraticCurveTo(x + 5, y - 4 - flap, x, y);
      ctx.fill();
    }
  }
}

// Свет от тыкв, склепов и антенн — пока цела земля под огоньком.
export function drawLights(game, ctx) {
  const t = game.time;
  ctx.globalCompositeOperation = 'lighter';
  for (const l of game.terrain.lights) {
    if (!game.terrain.isSolid(l.x, l.y + 4) && !game.terrain.isSolid(l.x, l.y)) continue;
    let a = 0.5;
    if (l.flicker) a = 0.42 + Math.sin(t * 0.3 + l.x) * 0.06 + Math.random() * 0.08;
    if (l.blink) a = Math.floor((t + l.x) / 40) % 2 ? 0.75 : 0.1;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.drawImage(glowSprite(l.color.slice(5, -1)), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

export function drawFog(game, ctx, sprite) {
  if (!QUALITY.fog) return;
  for (const f of game.scenery.fog) {
    ctx.globalAlpha = f.a;
    ctx.drawImage(sprite, f.x - f.s / 2, f.y - f.s * 0.2, f.s, f.s * 0.4);
  }
  ctx.globalAlpha = 1;
}

export { pick };
