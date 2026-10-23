// Синхронизация сетевой игры. Хост ведёт физику и публикует компактный снимок;
// гость рисует по снимкам, плавно подтягивая объекты, и воспроизводит журнал
// событий (звуки, эффекты, сообщения). Воронки в ландшафте идут отдельным
// журналом с подтверждением, чтобы ни одна не потерялась.
import { PHYS, WATER, WORLD_W } from '../config.js';
import { WEAPONS, Projectile } from '../weapons.js';
import { Item } from '../objects.js';
import { audio } from '../audio.js';
import { updateScenery } from '../scenery.js';
import { haptic } from '../quality.js';

const KINDS = ['rocket', 'grenade', 'cluster', 'bomblet', 'missile', 'dynamite', 'homing', 'banana', 'bananette',
  'holy', 'molotov', 'flame', 'sheep', 'donkey', 'meteor'];
const ITEM_TYPES = ['crate', 'mine', 'grave', 'barrel'];
const LOOP_OF = { rocket: 'rocket', dynamite: 'fuse' };
const r1 = (v) => Math.round(v * 10) / 10;

// Обёртка, которая пишет каждый вызов в журнал игры и выполняет его.
export function recorder(target, tag, game) {
  return new Proxy(target, {
    get(t, prop) {
      const v = t[prop];
      if (typeof v !== 'function') return v;
      return (...args) => {
        game.record(tag, prop, args);
        return v.apply(t, args);
      };
    },
  });
}

export function buildSetup(game) {
  return {
    seed: game.seed,
    theme: game.themeKey,
    turnTime: game.opts.turnTime,
    teams: game.teams.map((t) => ({ name: t.name, color: t.color, ai: !!t.ai, owner: t.owner || null, hat: t.hat })),
    worms: game.worms.map((w) => [w.team.index, w.name, w.owner, w.voicePitch]),
  };
}

function ropeSnapshot(game) {
  const rv = game.ropeView();
  return rv ? [rv.kind === 'rope' ? 1 : 2, r1(rv.x), r1(rv.y)] : 0;
}

export function buildSnapshot(game) {
  const winner = game.over ? (game.winner ? game.winner.index : -1) : undefined;
  return {
    t: game.time,
    st: game.state,
    tn: game.turnNumber,
    a: game.active ? game.worms.indexOf(game.active) : -1,
    tl: r1(game.turnTimeLeft || 0),
    rl: r1(game.retreatLeft || 0),
    wi: game.wind,
    wp: game.weaponId,
    fu: game.fuseSec,
    pw: Math.round(game.power * 100) / 100,
    ch: game.charging ? 1 : 0,
    sg: game.shotgunShots,
    w: game.worms.map((w) => [
      r1(w.x), r1(w.y), w.dir, Math.round(w.aim * 100), Math.round(w.hp),
      (w.dead ? 1 : 0) | (w.grounded ? 2 : 0) | (w.flying ? 4 : 0) | (w.hurtTimer > 0 ? 8 : 0),
    ]),
    // Огоньки шлём короче: только где горят.
    p: game.projectiles.map((p) => (p.cfg.flame
      ? [p.id, KINDS.indexOf(p.kind), r1(p.x), r1(p.y)]
      : [p.id, KINDS.indexOf(p.kind), r1(p.x), r1(p.y), r1(p.vx), r1(p.vy), p.resting ? 1 : 0])),
    wl: Math.round(WATER.y),
    ht: game.homingTarget ? [r1(game.homingTarget.x), r1(game.homingTarget.y)] : 0,
    qk: game.quake > 0 ? 1 : 0,
    rp: ropeSnapshot(game),
    dr: game.drill ? [r1(game.drill.hx), r1(game.drill.hy)] : 0,
    it: game.items.map((it) => [
      ITEM_TYPES.indexOf(it.type), r1(it.x), r1(it.y),
      (it.parachute ? 1 : 0) | (it.fuse > 0 ? 2 : 0) | (it.armDelay > 0 ? 4 : 0) | (it.content === 'health' ? 8 : 0),
    ]),
    am: game.teams.map((t) => WEAPONS.map((w) => (t.ammo[w.id] === Infinity ? -1 : t.ammo[w.id]))),
    win: winner,
  };
}

export function applySnapshot(game, s) {
  const first = game.state === 'sync';
  const prevTurn = game.turnNumber;
  const prevWeaponKey = game.weaponKey;
  game.state = s.st;
  game.turnNumber = s.tn;
  game.active = s.a >= 0 ? game.worms[s.a] : null;
  game.turnTimeLeft = s.tl;
  game.retreatLeft = s.rl;
  game.wind = s.wi;
  game.weaponId = s.wp;
  game.fuseSec = s.fu;
  game.power = s.pw;
  game.charging = !!s.ch;
  game.shotgunShots = s.sg;
  if (Number.isFinite(s.wl)) game.waterTarget = s.wl;
  game.homingTarget = Array.isArray(s.ht) ? { x: +s.ht[0], y: +s.ht[1] } : null;
  game.quake = s.qk ? 1 : 0;
  game.drillSync = Array.isArray(s.dr) && Number.isFinite(+s.dr[0]) && Number.isFinite(+s.dr[1])
    ? { x: +s.dr[0], y: +s.dr[1] } : null;
  game.ropeSync = Array.isArray(s.rp) && Number.isFinite(+s.rp[1]) && Number.isFinite(+s.rp[2])
    ? { kind: s.rp[0] === 1 ? 'rope' : 'hook', x: +s.rp[1], y: +s.rp[2] } : null;

  let hpChanged = false;
  s.w.forEach((d, i) => {
    const w = game.worms[i];
    if (!w) return;
    const [x, y, dir, aim, hp, flags] = d;
    if (first || w.tx === undefined) { w.x = x; w.y = y; }
    w.tx = x;
    w.ty = y;
    w.dir = dir;
    w.aim = aim / 100;
    if (w.hp !== hp) hpChanged = true;
    w.hp = hp;
    if (first) w.shownHp = hp;
    w.dead = !!(flags & 1);
    w.grounded = !!(flags & 2);
    w.flying = !!(flags & 4);
    w.hurtTimer = flags & 8 ? 10 : 0;
  });

  const byId = new Map(game.projectiles.map((p) => [p.id, p]));
  const keep = [];
  for (const [id, k, x, y, vx = 0, vy = 0, resting = 1] of s.p) {
    let p = byId.get(id);
    if (!p) {
      const kind = KINDS[k];
      if (!kind) continue;
      p = new Projectile(kind, x, y, vx, vy, null);
      p.id = id;
      if (LOOP_OF[kind]) p.loop = audio.loop(LOOP_OF[kind], game.panAt(x));
    }
    byId.delete(id);
    p.sx = x; p.sy = y; p.vx = vx; p.vy = vy; p.resting = !!resting; p.st = game.time;
    keep.push(p);
  }
  for (const p of byId.values()) if (p.loop) p.loop.stop();
  game.projectiles = keep;

  game.items = s.it.map(([type, x, y, flags], i) => {
    const kind = ITEM_TYPES[type];
    let it = game.items[i];
    if (!it || it.type !== kind) {
      it = new Item(kind, x, y, { parachute: !!(flags & 1), content: flags & 8 ? 'health' : 'weapon' });
    }
    it.tx = x;
    it.ty = y;
    it.parachute = !!(flags & 1);
    it.fuse = flags & 2 ? 1 : 0;
    it.armDelay = flags & 4 ? 1 : 0;
    it.content = flags & 8 ? 'health' : 'weapon';
    return it;
  });

  s.am.forEach((list, ti) => {
    const team = game.teams[ti];
    if (team) WEAPONS.forEach((w, i) => { team.ammo[w.id] = list[i] < 0 ? Infinity : list[i]; });
  });

  if (game.turnNumber !== prevTurn && game.active) {
    const t = game.active.team;
    game.camera.manual = 0;
    game.ui.announce(game.active.name, t.name, t.color);
    game.ui.onTurn(game);
  }
  game.weaponKey = `${s.wp}|${s.fu}|${s.sg}|${s.a}|${s.am.join(';')}`;
  if (game.weaponKey !== prevWeaponKey) game.ui.onWeapon(game);
  if (hpChanged) game.ui.onDamage(game);
  if (s.win !== undefined && !game.over) {
    game.over = true;
    game.stopLoops();
    game.ui.showGameOver(s.win >= 0 ? game.teams[s.win] : null);
  }
}

// Событие из журнала хоста: звук, эффект или сообщение. Приходит от другого
// игрока, поэтому вызываем только известные методы с разумными аргументами.
const AUDIO_EVENTS = new Set(['play', 'boom', 'whoosh', 'launch', 'shotgunBlast', 'tonk', 'boing', 'whack', 'splash',
  'chime', 'fanfare', 'slideWhistle', 'teleportSweep', 'jet', 'woodblock', 'turnChime', 'beep', 'say', 'choir', 'clip']);
const FX_EVENTS = new Set(['explosion', 'text', 'splash', 'teleport', 'dust']);

function sane(args) {
  return args.every((a) => {
    if (typeof a === 'number') return Number.isFinite(a) && Math.abs(a) < 1e5;
    if (typeof a === 'string') return a.length <= 80;
    if (Array.isArray(a)) return a.length <= 8 && a.every((x) => typeof x === 'number' || (typeof x === 'string' && x.length < 16));
    return a === null || a === undefined || typeof a === 'boolean' || typeof a === 'object';
  });
}

export function replayEvent(game, [, tag, method, args]) {
  if (!Array.isArray(args) || args.length > 8 || !sane(args)) return;
  if (tag === 'a') {
    if (!AUDIO_EVENTS.has(method)) return;
    if (method === 'splash') args[0] = Math.min(3, +args[0] || 1);
    if (method === 'boom') {
      args[0] = Math.min(2, +args[0] || 1);
      if (args[0] >= 0.66) haptic(Math.min(60, args[0] * 45));
    }
    audio[method](...args);
  } else if (tag === 'f') {
    if (!FX_EVENTS.has(method)) return;
    if (method === 'explosion') args[2] = Math.min(150, Math.max(1, +args[2] || 1));
    if (method === 'text') args[4] = Math.min(40, +args[4] || 14);
    if (method === 'splash') args[2] = Math.min(3, +args[2] || 1);
    game.effects[method](...args);
    if (method === 'explosion') {
      game.camera.shake = Math.max(game.camera.shake, args[2] * 0.22);
      game.markImpact(+args[0], +args[1]);
    }
  } else if (tag === 'g') {
    if (method === 'toast') game.ui.toast(String(args[0]).slice(0, 120));
    else if (method === 'tracer') game.tracers.push({ x0: +args[0], y0: +args[1], x1: +args[2], y1: +args[3], life: 12 });
    else if (method === 'banner') game.ui.announce(String(args[0]).slice(0, 40), String(args[1] || '').slice(0, 40), String(args[2] || '#ffcf3f'));
  }
}

// Один тик у гостя: ввод уходит хосту, объекты плавно догоняют снимок.
export function guestTick(game, input) {
  game.time++;
  game.drillFx();
  if (WATER.y > game.waterTarget) WATER.y = Math.max(game.waterTarget, WATER.y - 0.5);
  if (game.quake) game.camera.shake = Math.max(game.camera.shake, 7);
  const net = game.net;
  if (net) {
    if (game.isMyTurn && game.controllable) {
      net.held = (input.isHeld('left') ? 'l' : '') + (input.isHeld('right') ? 'r' : '') +
        (input.isHeld('up') ? 'u' : '') + (input.isHeld('down') ? 'd' : '');
      if (input.wasPressed('fire')) net.send(['fd']);
      if (input.wasReleased('fire')) net.send(['fu']);
      if (input.wasPressed('jump')) net.send(['j']);
      if (input.wasPressed('backflip')) net.send(['b']);
      if (input.wasPressed('next')) net.send(['n']);
      if (input.wasPressed('prev')) net.send(['p']);
      for (let i = 1; i <= 5; i++) if (input.wasPressed('fuse' + i)) net.send(['f', i]);
      if (game.pendingWeapon) net.send(['s', game.pendingWeapon]);
      if (game.pendingFuse) net.send(['f', game.pendingFuse]);
      if (input.clicks.length) {
        const pt = game.screenToWorld(input.clicks[0].x, input.clicks[0].y);
        net.send(['c', r1(pt.x), r1(pt.y)]);
      }
    } else {
      if (net.held && net.held !== '') net.held = '';
    }
    game.pendingWeapon = null;
    game.pendingFuse = null;
  }

  for (const w of game.worms) {
    if (w.tx === undefined) continue;
    const dx = w.tx - w.x;
    w.x += dx * 0.35;
    w.y += (w.ty - w.y) * 0.35;
    if (w.grounded && Math.abs(dx) > 0.05) w.walkPhase += 0.35;
    if (w.shownHp !== w.hp) w.shownHp += Math.sign(w.hp - w.shownHp);
    if (w.hurtTimer > 0) w.hurtTimer--;
    w.blinkTimer -= 1;
    if (w.blinkTimer < -8) w.blinkTimer = 120 + Math.random() * 240;
  }

  for (const p of game.projectiles) {
    const dt = game.time - p.st;
    const px = p.resting ? p.sx : p.sx + p.vx * dt;
    const py = p.resting ? p.sy : p.sy + p.vy * dt + 0.5 * PHYS.g * dt * dt;
    p.x += (px - p.x) * 0.5;
    p.y += (Math.min(py, WATER.y + 10) - p.y) * 0.5;
    p.spin += p.vx * 0.12;
    if (p.cfg.trail && game.time % 2 === 0) game.effects.trail(p.x, p.y);
    if (p.cfg.spark) game.effects.fuseSpark(p.x + 2, p.y - 11);
    if (p.loop) p.loop.setPan(game.panAt(p.x));
  }

  for (const it of game.items) {
    if (it.tx === undefined) continue;
    it.x += (it.tx - it.x) * 0.4;
    it.y += (it.ty - it.y) * 0.4;
  }

  for (const tr of game.tracers) tr.life--;
  game.tracers = game.tracers.filter((tr) => tr.life > 0);
  for (const c of game.scenery.clouds) {
    c.x += 0.08 + game.wind * 0.9;
    if (c.x > WORLD_W + 400) c.x = -400;
    if (c.x < -400) c.x = WORLD_W + 400;
  }
  updateScenery(game);
  game.effects.update();
}
