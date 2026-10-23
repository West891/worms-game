import { WATER } from './config.js';
import { WEAPON_BY_ID, PROJ, simulateShot, airstrikeMissiles, muzzlePoint } from './weapons.js';

// Разброс прицела по уровням сложности.
export const DIFFICULTY = {
  easy: { name: 'Новичок', angle: 0.11, power: 0.09, think: 1.4 },
  normal: { name: 'Боец', angle: 0.045, power: 0.035, think: 1.0 },
  hard: { name: 'Снайпер', angle: 0.012, power: 0.01, think: 0.7 },
  // Бот, который в онлайне играет вместо живого соперника: думает дольше и мажет чаще.
  human: { name: 'Игрок', angle: 0.07, power: 0.05, think: 2, jitter: 3.5 },
};

function blastDamage(w, x, y, r, dmg) {
  const d = Math.hypot(w.x - x, w.y - y);
  const reach = r + 10;
  if (d >= reach) return 0;
  return dmg * Math.min(1, (1 - d / reach) * 1.25);
}

function scoreBlast(worms, me, x, y, r, dmg) {
  let s = 0;
  for (const w of worms) {
    if (w.dead) continue;
    const e = blastDamage(w, x, y, r, dmg);
    if (!e) continue;
    const kill = e >= w.hp;
    if (w.team === me.team) s -= e * 1.7 + (kill ? 50 : 0);
    else s += Math.min(e, w.hp) + (kill ? 30 : 0) + (w.y > WATER.y - 90 ? e * 0.3 : 0);
  }
  return s;
}

// Генератор плана хода: перебирает выстрелы и периодически отдаёт управление,
// чтобы не подвешивать кадр. Итоговое значение — лучший найденный план.
export function* planTurn(game, me) {
  const { terrain, wind, worms } = game;
  const team = me.team;
  const enemies = worms.filter((w) => !w.dead && w.team !== team);
  const has = (id) => team.ammo[id] > 0;
  let best = { score: 0, weapon: null };
  const consider = (plan) => { if (plan.score > best.score) best = plan; };
  // Запасной план, если ничем не попасть: выстрел, который ляжет ближе всего
  // к противнику и не заденет своих. Лучше, чем пропускать ход.
  let nearMiss = null;

  // Дробовик: прямая видимость до цели.
  if (has('shotgun')) {
    for (const e of enemies) {
      const dx = e.x - me.x, dy = (e.y - 3) - (me.y - 2);
      const dist = Math.hypot(dx, dy);
      if (dist > 420 || dist < 1) continue;
      const dir = dx >= 0 ? 1 : -1;
      const aim = Math.atan2(-dy, Math.abs(dx));
      const m = muzzlePoint(me, { x: Math.cos(aim) * dir, y: -Math.sin(aim) });
      if (!terrain.lineClear(m.x, m.y, e.x, e.y - 3)) continue;
      const friendlyInWay = worms.some((w) => !w.dead && w !== me && w.team === team &&
        Math.hypot(w.x - me.x, w.y - me.y) < dist && Math.abs((w.x - me.x) * dy - (w.y - me.y) * dx) / dist < 10);
      if (friendlyInWay) continue;
      const dmg = Math.min(50, e.hp);
      consider({ weapon: 'shotgun', dir, aim, score: dmg * 0.9 + (e.hp <= 50 ? 25 : 0) });
    }
  }

  // Бита: противник вплотную.
  if (has('bat')) {
    for (const e of enemies) {
      if (Math.abs(e.x - me.x) < 18 && Math.abs(e.y - me.y) < 14) {
        consider({ weapon: 'bat', dir: e.x >= me.x ? 1 : -1, aim: 0.7, score: Math.min(30, e.hp) + 25 });
      }
    }
  }

  // Авиаудар по каждому противнику.
  if (has('airstrike')) {
    const [r, dmg] = PROJ.missile.explosion;
    for (const e of enemies) {
      for (const dir of [-1, 1]) {
        let s = 0;
        for (const m of airstrikeMissiles(e.x, dir)) {
          const res = simulateShot(terrain, 0, 'missile', m.x, m.y, m.vx, m.vy, null, worms, 0, 400);
          if (res) s += scoreBlast(worms, me, res.x, res.y, r, dmg);
        }
        consider({ weapon: 'airstrike', dir, target: { x: e.x, y: e.y }, score: s - 15 });
      }
      yield;
    }
  }

  // Бетонный осёл: падает на цель и пробивает всё под ней.
  if (has('donkey')) {
    const [r, dmg] = PROJ.donkey.explosion;
    for (const e of enemies) {
      const res = simulateShot(terrain, 0, 'donkey', e.x, -120, 0, 3, null, worms, 0, 500);
      if (res) consider({ weapon: 'donkey', dir: me.dir, target: { x: e.x, y: e.y }, score: scoreBlast(worms, me, res.x, res.y, r, dmg) * 1.5 - 12 });
    }
    yield;
  }

  // Баллистика: грубый перебор, затем уточнение вокруг лучших вариантов.
  // [оружие, снаряд, таймер (с), множитель очков, штраф за редкий боезапас, взрыв для оценки]
  const BALLISTIC = [
    ['bazooka', 'rocket', 0, 1, 0],
    ['grenade', 'grenade', 3, 1, 2],
    ['cluster', 'cluster', 3, 1.25, 8],
    ['banana', 'banana', 3, 1.5, 12],
    ['holy', 'holy', 3, 1, 15],
    ['molotov', 'molotov', 0, 1, 5, [30, 30]],
  ];
  for (const [wid, kind, fuseSec, mult, penalty, blast] of BALLISTIC) {
    if (!has(wid)) continue;
    const def = WEAPON_BY_ID[wid];
    const [r, dmg] = blast || PROJ[kind].explosion;
    const fuse = fuseSec * 60;
    const evalShot = (dir, aim, power) => {
      const v = { x: Math.cos(aim) * dir, y: -Math.sin(aim) };
      const m = muzzlePoint(me, v);
      if (terrain.isSolid(m.x, m.y)) return -100;
      const sp = def.speed * power;
      const res = simulateShot(terrain, wind, kind, m.x, m.y, v.x * sp, v.y * sp, me, worms, fuse);
      if (!res) return -5;
      const s = scoreBlast(worms, me, res.x, res.y, r, dmg) * mult;
      if (!penalty && s >= 0) {
        let d = Infinity;
        for (const e of enemies) d = Math.min(d, Math.hypot(e.x - res.x, e.y - res.y));
        if (!nearMiss || d < nearMiss.d) nearMiss = { d, weapon: wid, dir, aim, power, fuse: fuseSec || 3, score: 0.5 };
      }
      return s - penalty;
    };
    const top = [];
    let n = 0;
    for (const dir of [-1, 1]) {
      for (let aim = -1.2; aim <= 1.5; aim += 0.07) {
        for (let power = 0.3; power <= 1.001; power += 0.07) {
          const s = evalShot(dir, aim, power);
          if (s > 0) {
            top.push({ dir, aim, power, s });
            top.sort((a, b) => b.s - a.s);
            if (top.length > 5) top.pop();
          }
          if (++n % 30 === 0) yield;
        }
      }
    }
    for (const c of top) {
      for (let da = -0.06; da <= 0.0601; da += 0.015) {
        for (let dp = -0.06; dp <= 0.0601; dp += 0.015) {
          const power = Math.min(1, Math.max(0.1, c.power + dp));
          const aim = c.aim + da;
          const s = evalShot(c.dir, aim, power);
          if (s > best.score) best = { weapon: wid, dir: c.dir, aim, power, fuse: fuseSec || 3, score: s };
          if (++n % 30 === 0) yield;
        }
      }
    }
  }
  if (!best.weapon && nearMiss) best = nearMiss;
  return best;
}

export function nearestEnemy(game, me) {
  let best = null, bd = Infinity;
  for (const w of game.worms) {
    if (w.dead || w.team === me.team) continue;
    const d = Math.abs(w.x - me.x) + Math.abs(w.y - me.y) * 0.5;
    if (d < bd) { bd = d; best = w; }
  }
  return best;
}
