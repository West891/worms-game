import {
  TICK, WORLD_W, WORLD_H, WATER_Y, WATER, PHYS, GRAVITY, WORM_R, MAX_CLIMB, AIM_SPEED, CHARGE_TICKS, RETREAT_TIME, SETTLE_DELAY, WORM_NAMES,
} from './config.js';
import { Terrain } from './terrain.js';
import { Worm, wormCollides, contactNormal } from './worm.js';
import {
  WEAPONS, WEAPON_BY_ID, CRATE_WEAPONS, Projectile, projectileTick, drawProjectile, drawHeldWeapon,
  airstrikeMissiles, muzzlePoint,
} from './weapons.js';
import { Item } from './objects.js';
import { Effects } from './effects.js';
import { audio } from './audio.js';
import { planTurn, nearestEnemy, DIFFICULTY } from './ai.js';
import { makeRng, rand, pick, shuffle, noise1D } from './rng.js';
import { recorder, buildSetup, guestTick } from './net/sync.js';
import { buildScenery, drawSky, updateScenery, drawWeather, drawLights, drawFog } from './scenery.js';
import { MAPS, MAP_KEYS } from './maps.js';
import { haptic } from './quality.js';

// Сколько тиков камера смотрит на место взрыва (2,75 с).
const IMPACT_HOLD = 165;

// Ниндзя-верёвка.
const HOOK_SPEED = 16;
const ROPE_MIN = 14;
const ROPE_MAX = 300;
const ROPE_REEL = 1.6;
const ROPE_SWING = 0.075;
const ROPE_MAX_SPEED = 9;

// Лазерный бур.
const DRILL_TICKS = 300;
const DRILL_SPEED = 0.75;
const DRILL_R = 11;

// Шапки команд (рисуются в worm.js).
export const HATS = ['cap', 'crown', 'tophat', 'cowboy', 'viking', 'party', 'wizard', 'helmet'];

export class Game {
  constructor(opts, assets, ui) {
    const setup = opts.setup || null;
    if (setup) opts = { ...opts, turnTime: setup.turnTime, teams: setup.teams };
    this.opts = opts;
    this.assets = assets;
    this.ui = ui;
    // Роль в сетевой игре: local — обычная игра, host — ведёт физику, guest — повторяет за хостом.
    this.role = opts.role || 'local';
    this.seed = setup ? setup.seed : (opts.seed ?? Math.floor(Math.random() * 1e9));
    this.themeKey = setup ? setup.theme : (opts.theme === 'random' || !MAPS[opts.theme] ? pick(MAP_KEYS) : opts.theme);
    this.terrain = new Terrain(this.seed, this.themeKey);
    PHYS.g = MAPS[this.themeKey].gravity || GRAVITY;
    WATER.y = WATER_Y;
    this.waterTarget = WATER_Y;
    this.spawnQueue = [];
    this.quake = 0;
    this.damageMult = 1;
    this.kills = 0;
    this.turnKills = 0;
    this.turnDamage = 0;
    this.homingTarget = null;
    this.impact = null; // место последнего взрыва, куда смотрит камера
    this.hook = null; // летящий крюк ниндзя-верёвки
    this.drill = null; // работающий лазерный бур
    this.drillSync = null; // голова бура, которую прислал хост (у гостя)
    this.drillLoop = null;
    this.ropeSync = null; // верёвка, которую прислал хост (у гостя)
    this.effects = new Effects(assets);
    this.sfx = audio;
    this.fx = this.effects;
    this.projSeq = 0;
    this.remote = { held: {}, queue: [], fire: false };
    if (this.role === 'host') {
      this.log = [];
      this.logSeq = 0;
      this.carves = [];
      this.sfx = recorder(audio, 'a', this);
      this.fx = recorder(this.effects, 'f', this);
    }
    this.projectiles = [];
    this.items = [];
    this.tracers = [];
    this.pending = [];
    this.time = 0;
    this.turnNumber = 0;
    this.wind = 0;
    this.paused = false;
    this.over = false;
    this.camera = { x: WORLD_W / 2, y: WATER_Y - 500, zoom: 1, targetZoom: 1, shake: 0, manual: 0 };
    this.charging = false;
    this.power = 0;
    this.fuseSec = 3;
    this.shotgunShots = 0;
    this.weaponId = 'bazooka';
    this.ai = null;
    this.pendingWeapon = null;
    this.active = null;
    this.state = 'start';
    this.stateTimer = 0;

    const names = shuffle(WORM_NAMES);
    const hats = shuffle(HATS);
    this.teams = opts.teams.map((t, i) => ({
      hat: hats[i % hats.length],
      ...t,
      index: i,
      worms: [],
      ammo: Object.fromEntries(WEAPONS.map((w) => [w.id, w.ammo])),
      lastWorm: -1,
      lastWeapon: 'bazooka',
    }));
    this.worms = [];
    if (setup) {
      for (const [ti, name, owner, pitch] of setup.worms) {
        const team = this.teams[ti];
        const worm = new Worm(team, name, -1000, -1000);
        worm.owner = owner;
        worm.voicePitch = pitch;
        team.worms.push(worm);
        this.worms.push(worm);
      }
    } else {
      for (let k = 0; k < opts.wormsPerTeam; k++) {
        for (const team of this.teams) {
          const pos = this.findSpawn();
          const worm = new Worm(team, names[this.worms.length % names.length], pos.x, pos.y);
          worm.voicePitch = Math.round(rand(0.94, 1.08) * 100) / 100;
          // Владелец червяка: компьютер, игрок на этом устройстве или участник сетевой игры.
          worm.owner = team.ai ? 'ai' : team.owner === 'mixed' ? (k % 2 ? 'guest' : 'host') : (team.owner || 'local');
          team.worms.push(worm);
          this.worms.push(worm);
        }
      }
      for (let i = 0; i < (opts.mines ?? 5); i++) {
        const pos = this.findSpawn(40);
        if (pos) this.items.push(new Item('mine', pos.x, pos.y + 2));
      }
      for (let i = 0; i < (opts.barrels ?? 4); i++) {
        const pos = this.findSpawn(50);
        if (pos) this.items.push(new Item('barrel', pos.x, pos.y - 2));
      }
    }
    if (this.role === 'host') this.setup = buildSetup(this);

    const fit = Math.min(window.innerWidth / 1100, window.innerHeight / 620);
    this.camera.zoom = this.camera.targetZoom = Math.max(1, Math.min(1.5, fit));
    this.scenery = buildScenery(this);
    this.teamTurn = Math.floor(Math.random() * this.teams.length) - 1;
    this.state = this.role === 'guest' ? 'sync' : 'settle';
    this.settleTimer = 0;
    this.settleTotal = 0;
  }

  // --- Подготовка --------------------------------------------------------

  findSpawn(minDist = 70) {
    const t = this.terrain;
    for (let tries = 0; tries < 400; tries++) {
      const x = rand(90, WORLD_W - 90);
      const sy = t.surfaceY(x);
      if (sy === null || sy > WATER.y - 40 || sy < 60) continue;
      const y = sy - WORM_R - 1;
      if (wormCollides(t, x, y) || wormCollides(t, x, y - 10)) continue;
      const near = this.worms.some((w) => Math.hypot(w.x - x, w.y - y) < minDist) ||
        this.items.some((it) => Math.hypot(it.x - x, it.y - y) < minDist);
      if (near && tries < 300) continue;
      return { x, y };
    }
    return { x: rand(200, WORLD_W - 200), y: 100 };
  }

  // --- Ходы -------------------------------------------------------------

  get activeTeam() { return this.active ? this.active.team : null; }
  get isAiTurn() { return !!(this.active && this.active.owner === 'ai'); }
  // Ход того, кто сидит за этим устройством.
  get isMyTurn() {
    const a = this.active;
    return !!a && !a.dead && (a.owner === 'local' || a.owner === this.role);
  }
  get weapon() { return WEAPON_BY_ID[this.weaponId]; }
  get controllable() { return this.state === 'aim' || this.state === 'retreat'; }

  aliveTeams() { return this.teams.filter((t) => t.worms.some((w) => !w.dead)); }

  nextTurn() {
    const alive = this.aliveTeams();
    if (alive.length <= 1) {
      this.finish(alive[0] || null);
      return;
    }
    this.reactToTurn();
    this.turnKills = 0;
    this.turnDamage = 0;
    this.homingTarget = null;
    this.impact = null;
    this.hook = null;
    this.drill = null;
    for (const w of this.worms) w.rope = null;
    this.turnFired = false;
    this.turnEnemyHit = false;
    this.turnFriendlyHit = false;
    this.focusWorm = null;
    let idx = this.teamTurn;
    do { idx = (idx + 1) % this.teams.length; } while (!this.teams[idx].worms.some((w) => !w.dead));
    this.teamTurn = idx;
    const team = this.teams[idx];
    let wi = team.lastWorm;
    do { wi = (wi + 1) % team.worms.length; } while (team.worms[wi].dead);
    team.lastWorm = wi;
    this.active = team.worms[wi];
    this.turnNumber++;

    this.wind = Math.round(rand(-1, 1) * Math.random() * 20) / 20;
    if (this.turnNumber > 1 && Math.random() < 0.35) this.dropCrate();
    const sd = this.opts.suddenDeath || 0;
    if (sd && this.turnNumber >= sd) {
      if (!this.suddenDeath) {
        this.suddenDeath = true;
        this.banner('Внезапная смерть!', 'Вода поднимается', '#5ec8ff');
        this.sfx.say('n', 'suddenDeath', { priority: 3 });
      }
      this.waterTarget = Math.max(260, this.waterTarget - 24);
    }
    this.damageMult = team.double ? 2 : 1;
    if (team.double) {
      team.double = false;
      this.banner('Двойной урон!', team.name, team.color);
      this.sfx.say('n', 'doubleDamage', { priority: 3 });
    }

    this.weaponId = team.ammo[team.lastWeapon] > 0 ? team.lastWeapon : 'bazooka';
    this.fuseSec = 3;
    this.power = 0;
    this.charging = false;
    this.shotgunShots = 0;
    this.turnTimeLeft = this.opts.turnTime;
    this.state = 'turnStart';
    this.stateTimer = 1.1;
    this.camera.manual = 0;
    this.lastTick = 0;
    this.remote = { held: {}, queue: [], fire: false };
    this.ai = this.active.owner === 'ai' ? this.newAiState() : null;
    this.ui.announce(`${this.active.name}`, team.name, team.color);
    this.ui.onTurn(this);
    this.sfx.turnChime();
  }

  newAiState() {
    const d = DIFFICULTY[this.opts.difficulty] || DIFFICULTY.normal;
    return { phase: 'wait', timer: d.think + Math.random() * (d.jitter || 0), walked: 0, stall: 0 };
  }

  // Соперник отключился: его червяками дальше управляет компьютер.
  convertToAi(owner) {
    for (const w of this.worms) if (w.owner === owner) w.owner = 'ai';
    if (this.active && this.active.owner === 'ai' && !this.ai) this.ai = this.newAiState();
  }

  toast(msg) {
    this.ui.toast(msg);
    this.record('g', 'toast', [msg]);
  }

  // Журнал событий для гостя: звук, эффекты, сообщения.
  record(tag, method, args) {
    if (this.role !== 'host') return;
    const round = (v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v);
    this.log.push([++this.logSeq, tag, method, args.map((a) => (a && typeof a === 'object' && !Array.isArray(a)
      ? Object.fromEntries(Object.entries(a).map(([k, v]) => [k, round(v)])) : round(a)))]);
    if (this.log.length > 400) this.log.splice(0, this.log.length - 400);
  }

  addTracer(x0, y0, x1, y1) {
    this.tracers.push({ x0, y0, x1, y1, life: 12 });
    this.record('g', 'tracer', [x0, y0, x1, y1]);
  }

  // Крупная надпись по центру — у всех игроков.
  banner(title, sub = '', color = '#ffcf3f') {
    this.ui.announce(title, sub, color);
    this.record('g', 'banner', [title, sub, color]);
  }

  reactToTurn() {
    const prev = this.active;
    if (this.turnKills >= 2) {
      const triple = this.turnKills >= 3;
      this.banner(triple ? 'Тройное убийство!' : 'Двойное убийство!', prev ? prev.name : '', '#ff5d5d');
      this.sfx.say('n', triple ? 'tripleKill' : 'doubleKill', { priority: 3 });
      return;
    }
    if (this.turnDamage >= 90) {
      this.banner('Вот это удар!', `${this.turnDamage} урона за ход`, '#ffcf3f');
      this.sfx.say('n', 'bigHit', { priority: 3 });
      return;
    }
    if (!prev || !this.turnFired) return;
    if (this.turnFriendlyHit && !this.turnEnemyHit) {
      if (!prev.dead) this.say(prev, 'oops', 0.9, 2);
      return;
    }
    if (!this.turnEnemyHit) {
      const mockers = this.worms.filter((w) => !w.dead && w.team !== prev.team);
      if (mockers.length) this.say(pick(mockers), 'taunt', 0.75, 2);
    }
  }

  // --- Звук -------------------------------------------------------------

  panAt(x) {
    const cam = this.camera;
    const half = (this.viewW || 1280) / 2 / cam.zoom;
    return Math.max(-1, Math.min(1, (x - cam.x) / (half * 1.3)));
  }

  // Реплика червяка. Банк голоса и высота зависят от команды и самого червяка.
  say(w, category, prob = 1, priority = 1) {
    if (!w || Math.random() > prob) return false;
    const bank = w.team.index % 2 === 0 ? 'a' : 'b';
    const teamPitch = [1, 1, 1.17, 1.14][w.team.index] || 1;
    return this.sfx.say(bank, category, { pan: this.panAt(w.x), rate: teamPitch * (w.voicePitch || 1), priority });
  }

  ambientSound(name) {
    audio.play(name, { vol: 0.25, pan: Math.random() * 1.4 - 0.7, wet: 0.9 });
  }

  stopLoops() {
    for (const p of this.projectiles) if (p.loop) { p.loop.stop(); p.loop = null; }
    if (this.drillLoop) { this.drillLoop.stop(); this.drillLoop = null; }
  }

  dropCrate() {
    const x = rand(150, WORLD_W - 150);
    const roll = Math.random();
    const content = roll < 0.4 ? 'health' : roll < 0.48 ? 'double' : pick(CRATE_WEAPONS);
    // Сбрасываем невысоко над землёй: с самого верха карты ящик на парашюте
    // летел бы секунд десять, и ход ждал бы его приземления.
    const ground = this.terrain.surfaceY(x) ?? WATER.y;
    this.items.push(new Item('crate', x, Math.max(-40, ground - 420), { parachute: true, content }));
  }

  finish(team) {
    this.stopLoops();
    this.sfx.fanfare();
    if (team) this.say(pick(team.worms.filter((w) => !w.dead)), 'victory', 1, 3);
    this.state = 'over';
    this.over = true;
    this.winner = team;
    this.active = null;
    this.ui.showGameOver(team);
  }

  enterRetreat() {
    this.state = 'retreat';
    this.retreatLeft = RETREAT_TIME;
    this.charging = false;
    this.power = 0;
  }

  enterSettle() {
    this.dropRope();
    this.state = 'settle';
    this.settleTimer = 0;
    this.settleTotal = 0;
    this.charging = false;
    this.power = 0;
    if (this.ai) this.ai.phase = 'done';
  }

  // --- Оружие -----------------------------------------------------------

  selectWeapon(id) {
    const team = this.activeTeam;
    if (!team || !WEAPON_BY_ID[id] || team.ammo[id] <= 0) return false;
    if (this.state !== 'aim' || this.charging || this.shotgunShots > 0) return false;
    if (this.weaponId !== id) this.sfx.play('select', { vol: 0.5 });
    this.weaponId = id;
    team.lastWeapon = id;
    this.ui.onWeapon(this);
    return true;
  }

  cycleWeapon(step) {
    const team = this.activeTeam;
    if (!team) return;
    const list = WEAPONS.filter((w) => team.ammo[w.id] > 0);
    let i = list.findIndex((w) => w.id === this.weaponId);
    i = (i + step + list.length) % list.length;
    this.selectWeapon(list[i].id);
  }

  useAmmo(id) {
    const team = this.activeTeam;
    if (team.ammo[id] !== Infinity) team.ammo[id]--;
    this.ui.onWeapon(this);
  }

  fire() {
    const w = this.active;
    const id = this.weaponId;
    const def = this.weapon;
    const v = w.aimVector();
    const m = muzzlePoint(w, v);
    const power = Math.max(0.05, this.power);
    this.charging = false;
    this.power = 0;
    this.camera.manual = 0;
    switch (id) {
      case 'bazooka':
        this.addProjectile(new Projectile('rocket', m.x, m.y, v.x * def.speed * power, v.y * def.speed * power, w), 'rocket');
        this.sfx.launch(this.panAt(w.x));
        this.say(w, 'fire', 0.45);
        break;
      case 'homing': {
        const p = new Projectile('homing', m.x, m.y, v.x * def.speed * power, v.y * def.speed * power, w);
        p.target = this.homingTarget;
        this.addProjectile(p, 'rocket');
        this.sfx.launch(this.panAt(w.x));
        this.sfx.beep(1600, 0.08, 0.1, 'sine', this.panAt(w.x));
        this.say(w, 'fire', 0.45);
        break;
      }
      case 'holy':
        this.addProjectile(new Projectile('holy', m.x, m.y, v.x * def.speed * power, v.y * def.speed * power, w, 3 * 60));
        this.sfx.play('throw', { vol: 0.5, pan: this.panAt(w.x) });
        this.say(w, 'holy', 0.9, 2);
        break;
      case 'molotov':
        this.addProjectile(new Projectile('molotov', m.x, m.y, v.x * def.speed * power, v.y * def.speed * power, w));
        this.sfx.play('throw', { vol: 0.5, pan: this.panAt(w.x) });
        this.say(w, 'molotov', 0.7);
        break;
      case 'banana':
        this.addProjectile(new Projectile('banana', m.x, m.y, v.x * def.speed * power, v.y * def.speed * power, w, this.fuseSec * 60));
        this.sfx.play('throw', { vol: 0.5, pan: this.panAt(w.x) });
        this.say(w, 'banana', 0.8);
        break;
      case 'sheep': {
        const sh = new Projectile('sheep', w.x + w.dir * 8, w.y - 2, w.dir * 1.25, -1, w, 9 * 60);
        sh.dir = w.dir;
        this.addProjectile(sh);
        this.sfx.play('baa', { vol: 0.9, pan: this.panAt(w.x) });
        this.say(w, 'sheep', 0.8);
        this.turnFired = true;
        this.useAmmo(id);
        this.enterRetreat();
        // Пока овца бежит, её можно взорвать повторным «огнём».
        this.retreatLeft = 9;
        return;
      }
      case 'punch':
        this.firePunch(w);
        break;
      case 'quake':
        this.quake = 160;
        this.sfx.play('quake', { vol: 1 });
        this.sfx.boom(1.6, 0);
        this.banner('Землетрясение!', '', '#ff9a3c');
        this.sfx.say('n', 'quake', { priority: 3 });
        break;
      case 'armageddon':
        for (let i = 0; i < 20; i++) {
          this.spawnQueue.push({ delay: 20 + i * 11 + Math.floor(Math.random() * 8), kind: 'meteor', x: rand(80, WORLD_W - 80) });
        }
        this.banner('Армагеддон!', 'С неба падают метеориты', '#ff5d2a');
        this.sfx.say('n', 'armageddon', { priority: 3 });
        this.say(w, 'armageddon', 0.6);
        break;
      case 'grenade':
      case 'cluster':
        this.addProjectile(new Projectile(id, m.x, m.y, v.x * def.speed * power, v.y * def.speed * power, w, this.fuseSec * 60));
        this.sfx.play('throw', { vol: 0.5, pan: this.panAt(w.x) });
        this.sfx.whoosh(0.3, this.panAt(w.x), 0.25 + power * 0.25);
        this.say(w, 'throw', 0.5);
        break;
      case 'dynamite':
        this.addProjectile(new Projectile('dynamite', w.x + w.dir * 7, w.y - 4, w.dir * 0.8, -1.2, w, 5 * 60), 'fuse');
        this.sfx.play('throw', { vol: 0.5, rate: 0.8, pan: this.panAt(w.x) });
        this.say(w, 'dynamite', 0.85, 2);
        break;
      case 'mine': {
        const mine = new Item('mine', w.x + w.dir * 9, w.y - 4, { armDelay: 150 });
        mine.vx = w.dir * 0.8;
        mine.vy = -1;
        this.items.push(mine);
        this.sfx.play('throw', { vol: 0.5, rate: 0.8, pan: this.panAt(w.x) });
        this.sfx.beep(1200, 0.05, 0.08, 'square', this.panAt(w.x));
        this.say(w, 'throw', 0.4);
        break;
      }
      case 'shotgun':
        this.shootRay(w, v, m);
        this.shotgunShots++;
        this.useAmmo(id);
        if (this.shotgunShots < def.shots) {
          if (this.ai) { this.ai.phase = 'wait'; this.ai.timer = 0.7; }
          return;
        }
        this.enterRetreat();
        return;
      case 'bat':
        this.swingBat(w, v);
        break;
      case 'skip':
        this.toast(`${w.name} пропускает ход`);
        this.say(w, 'skip', 0.9);
        this.enterSettle();
        return;
      default:
        return;
    }
    this.turnFired = id !== 'mine';
    this.useAmmo(id);
    this.enterRetreat();
  }

  addProjectile(p, loop) {
    p.id = ++this.projSeq;
    if (loop) p.loop = audio.loop(loop, this.panAt(p.x));
    this.projectiles.push(p);
  }

  fireAt(pt) {
    const w = this.active;
    const id = this.weaponId;
    if (id === 'airstrike') {
      for (const m of airstrikeMissiles(pt.x, w.dir)) {
        this.addProjectile(new Projectile('missile', m.x, m.y, m.vx, m.vy, null));
      }
      this.sfx.jet(w.dir);
      this.say(w, 'airstrike', 0.9, 2);
      this.turnFired = true;
      this.useAmmo(id);
      this.enterRetreat();
      this.camera.manual = 0;
    } else if (id === 'donkey') {
      const p = new Projectile('donkey', pt.x, -120, 0, 3, null);
      p.pierceLeft = p.cfg.pierce;
      this.addProjectile(p);
      this.sfx.play('heehaw', { vol: 1, pan: this.panAt(pt.x) });
      this.say(w, 'donkey', 0.8, 2);
      this.turnFired = true;
      this.useAmmo(id);
      this.enterRetreat();
      this.camera.manual = 0;
    } else if (id === 'teleport') {
      if (pt.x < 10 || pt.x > WORLD_W - 10 || pt.y < -100 || pt.y > WATER.y - 20 || wormCollides(this.terrain, pt.x, pt.y)) {
        this.sfx.beep(220, 0.15, 0.15);
        this.toast('Сюда телепортироваться нельзя');
        return;
      }
      this.fx.teleport(w.x, w.y - 4);
      w.x = pt.x;
      w.y = pt.y;
      w.vx = w.vy = 0;
      w.grounded = false;
      this.fx.teleport(w.x, w.y - 4);
      this.sfx.teleportSweep(this.panAt(w.x));
      this.useAmmo(id);
      this.enterSettle();
    }
  }

  shootRay(w, v, m) {
    this.sfx.shotgunBlast(this.panAt(w.x));
    this.turnFired = true;
    let x = m.x, y = m.y;
    for (let d = 0; d < 700; d += 2) {
      x += v.x * 2;
      y += v.y * 2;
      const hit = this.worms.find((o) => !o.dead && o !== w && Math.hypot(o.x - x, o.y - 3 - y) < 9);
      if (hit) {
        this.addTracer(m.x, m.y, x, y);
        this.damageWorm(hit, 25 * this.damageMult);
        hit.knock(v.x * 3, v.y * 3 - 1.5);
        this.explode(x, y, 8, 0);
        return;
      }
      if (this.terrain.isSolid(x, y)) {
        this.addTracer(m.x, m.y, x, y);
        this.explode(x, y, 14, 20);
        return;
      }
      if (y > WATER.y) break;
    }
    this.addTracer(m.x, m.y, x, y);
  }

  firePunch(w) {
    w.grounded = false;
    w.vy = -6.5;
    w.vx = w.dir * 0.6;
    let any = false;
    for (const o of this.worms) {
      if (o.dead || o === w) continue;
      if (Math.abs(o.x - (w.x + w.dir * 8)) < 14 && Math.abs(o.y - w.y) < 16) {
        this.damageWorm(o, 30 * this.damageMult);
        o.knock(w.dir * 2.5, -9);
        any = true;
      }
    }
    this.fx.explosion(w.x + w.dir * 6, w.y - 4, 10, this.terrain.theme.debris);
    this.sfx.whoosh(0.35, this.panAt(w.x), 0.4, true);
    if (any) {
      this.sfx.whack(this.panAt(w.x));
      this.camera.shake = 8;
    }
    this.say(w, 'punch', 0.9, 2);
    this.turnFired = true;
  }

  swingBat(w, v) {
    let any = false;
    const hx = w.x + w.dir * 9, hy = w.y - 2;
    for (const o of this.worms) {
      if (o.dead || o === w) continue;
      if (Math.hypot(o.x - hx, o.y - hy) < 16) {
        this.damageWorm(o, 30 * this.damageMult);
        o.knock(v.x * 10, v.y * 10 - 1);
        any = true;
      }
    }
    for (const it of this.items) {
      if (Math.hypot(it.x - hx, it.y - hy) < 16) {
        it.vx += v.x * 8;
        it.vy += v.y * 8 - 1;
        it.resting = false;
        any = true;
      }
    }
    this.turnFired = true;
    this.sfx.whoosh(0.25, this.panAt(w.x), 0.3, true);
    if (any) {
      this.sfx.whack(this.panAt(w.x));
      this.say(w, 'bat', 0.9, 2);
      this.camera.shake = 6;
    }
  }

  // --- Урон и взрывы ----------------------------------------------------

  damageWorm(w, amount, silent = false) {
    if (w.dead || amount <= 0) return;
    w.hp = Math.max(0, w.hp - amount);
    w.hurtTimer = 50;
    this.turnDamage += amount;
    this.fx.text(w.x, w.y - 32, `-${amount}`, w.team.color, 15, 80);
    this.sfx.play('hurt', { vol: 0.35, rate: rand(0.9, 1.15), pan: this.panAt(w.x) });
    const team = this.activeTeam;
    if (team && w.team === team) { if (w !== this.active) this.turnFriendlyHit = true; } else this.turnEnemyHit = true;
    if (!silent && w.hp > 0 && (!w.lastVoice || this.time - w.lastVoice > 40)) {
      w.lastVoice = this.time;
      this.say(w, amount >= 35 ? 'bigHurt' : 'hurt', 0.8, amount >= 35 ? 2 : 1);
    }
    if (w === this.active && this.controllable) this.enterSettle();
    this.ui.onDamage(this);
  }

  // --- Ниндзя-верёвка ---------------------------------------------------

  shootHook(w) {
    const v = w.aimVector();
    this.hook = { x: w.x + v.x * 6, y: w.y - 2 + v.y * 6, vx: v.x * HOOK_SPEED, vy: v.y * HOOK_SPEED, worm: w };
    this.sfx.play('throw', { vol: 0.45, pan: this.panAt(w.x) });
    this.camera.manual = 0;
  }

  updateHook() {
    const h = this.hook;
    if (!h) return;
    const w = h.worm;
    if (w.dead || this.state !== 'aim' || w !== this.active) { this.hook = null; return; }
    for (let i = 0; i < 4; i++) {
      h.x += h.vx / 4;
      h.y += h.vy / 4;
      if (this.terrain.isSolid(h.x, h.y)) {
        w.rope = { x: h.x, y: h.y, len: Math.max(ROPE_MIN, Math.hypot(w.x - h.x, w.y - h.y)) };
        if (w.grounded) { w.vx = 0; w.vy = 0; }
        w.grounded = false;
        this.hook = null;
        this.sfx.play('click', { vol: 0.9, pan: this.panAt(h.x) });
        return;
      }
      if (Math.hypot(h.x - w.x, h.y - w.y) > ROPE_MAX || h.y > WATER.y || h.y < -400 || h.x < -100 || h.x > WORLD_W + 100) {
        this.hook = null;
        return;
      }
    }
  }

  // Тик червяка на верёвке: маятник с жёсткой связью и отскоками от земли.
  ropeTick(w) {
    const r = w.rope;
    const t = this.terrain;
    if (!t.isSolid(r.x, r.y)) { this.releaseRope(w); return null; }
    w.vy += PHYS.g;
    w.vx *= 0.996;
    w.vy *= 0.996;
    const sp = Math.hypot(w.vx, w.vy);
    if (sp > ROPE_MAX_SPEED) { w.vx *= ROPE_MAX_SPEED / sp; w.vy *= ROPE_MAX_SPEED / sp; }
    const steps = Math.max(1, Math.ceil(Math.hypot(w.vx, w.vy)) + 1);
    for (let i = 0; i < steps; i++) {
      let nx = w.x + w.vx / steps;
      let ny = w.y + w.vy / steps;
      const dx = nx - r.x, dy = ny - r.y, d = Math.hypot(dx, dy);
      if (d > r.len) {
        const ux = dx / d, uy = dy / d;
        nx = r.x + ux * r.len;
        ny = r.y + uy * r.len;
        const vr = w.vx * ux + w.vy * uy;
        if (vr > 0) { w.vx -= vr * ux; w.vy -= vr * uy; }
      }
      if (wormCollides(t, nx, ny)) {
        // Мелкие кочки перешагиваем, как при ходьбе: иначе по неровной земле
        // верёвка не подтягивает.
        let up = 1;
        while (up <= MAX_CLIMB && wormCollides(t, nx, ny - up)) up++;
        if (up <= MAX_CLIMB) { w.x = nx; w.y = ny - up; continue; }
        const n = contactNormal(t, nx, ny);
        const vn = w.vx * n.x + w.vy * n.y;
        if (vn < 0) {
          w.vx = (w.vx - 1.3 * vn * n.x) * 0.85;
          w.vy = (w.vy - 1.3 * vn * n.y) * 0.85;
        }
        if (wormCollides(t, w.x, w.y)) { w.x += n.x; w.y += n.y; }
        break;
      }
      w.x = nx;
      w.y = ny;
    }
    // Упёрлись в землю — подтягиваться дальше некуда.
    r.len = Math.max(r.len, Math.hypot(w.x - r.x, w.y - r.y) - 0.5);
    if (Math.abs(w.vx) > 0.3) w.dir = w.vx > 0 ? 1 : -1;
    return null;
  }

  releaseRope(w) {
    if (!w.rope) return;
    w.rope = null;
    w.grounded = false;
    this.sfx.play('jump', { vol: 0.3, pan: this.panAt(w.x) });
  }

  dropRope() {
    this.stopDrill();
    this.hook = null;
    if (this.active && this.active.rope) this.releaseRope(this.active);
  }

  // --- Лазерный бур -----------------------------------------------------

  startDrill(w) {
    this.drill = { worm: w, n: 0, stuck: 0, hit: new Set(), hx: w.x, hy: w.y };
    w.grounded = false;
    w.vx = w.vy = 0;
    this.camera.manual = 0;
    this.sfx.beep(1800, 0.08, 0.1, 'sawtooth', this.panAt(w.x));
  }

  stopDrill() {
    const d = this.drill;
    if (!d) return;
    this.drill = null;
    d.worm.grounded = false;
    d.worm.vx = d.worm.vy = 0;
  }

  // Тик бура: прожигаем землю перед червяком и тащим его по тоннелю.
  updateDrill() {
    const d = this.drill;
    if (!d) return;
    const w = d.worm;
    if (w.dead || w !== this.active || this.state !== 'aim' || d.n >= DRILL_TICKS) { this.stopDrill(); return; }
    const v = w.aimVector();
    d.hx = w.x + v.x * 9;
    d.hy = w.y - 2 + v.y * 9;
    // Проход чуть шире тела червяка (круг радиуса WORM_R вокруг x, y).
    if (d.n % 3 === 0) this.carveOnly(w.x + v.x * 4, w.y + v.y * 4, DRILL_R);
    d.n++;
    const nx = w.x + v.x * DRILL_SPEED, ny = w.y + v.y * DRILL_SPEED;
    if (!wormCollides(this.terrain, nx, ny)) { w.x = nx; w.y = ny; d.stuck = 0; }
    else if (++d.stuck > 40) { this.stopDrill(); return; }
    w.vx = w.vy = 0;
    for (const o of this.worms) {
      if (o === w || o.dead || d.hit.has(o) || Math.hypot(o.x - d.hx, o.y - d.hy) > DRILL_R + WORM_R) continue;
      d.hit.add(o);
      this.damageWorm(o, Math.round(15 * this.damageMult));
      o.knock(v.x * 3, v.y * 3 - 2);
      this.turnEnemyHit = this.turnEnemyHit || o.team !== w.team;
    }
  }

  drillView() {
    if (this.role === 'guest') return this.drillSync;
    return this.drill ? { x: this.drill.hx, y: this.drill.hy } : null;
  }

  // Луч бура: от сопла до ближайшей земли, но не дальше 30 px.
  laserBeam(w) {
    const a = w.aimVector();
    const sx = w.x + a.x * 14, sy = w.y - 2 + a.y * 14;
    let len = 4;
    while (len < 30 && !this.terrain.isSolid(sx + a.x * len, sy + a.y * len)) len += 2;
    return { sx, sy, ex: sx + a.x * len, ey: sy + a.y * len, a };
  }

  // Звук и искры бура: у хоста и у гостя одинаково, в сеть не уходят.
  drillFx() {
    const v = this.drillView();
    if (v && this.active && !this.active.dead) {
      if (!this.drillLoop) this.drillLoop = audio.loop('drill', this.panAt(v.x));
      else this.drillLoop.setPan(this.panAt(v.x));
      const b = this.laserBeam(this.active);
      if (this.time % 2 === 0) this.effects.sparks(b.ex, b.ey);
    } else if (this.drillLoop) {
      this.drillLoop.stop();
      this.drillLoop = null;
    }
  }

  drawDrill(ctx) {
    const w = this.active;
    if (!this.drillView() || !w || w.dead) return;
    const { sx, sy, ex, ey } = this.laserBeam(w);
    const flick = 0.75 + Math.sin(this.time * 0.9) * 0.25;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(255,60,40,${0.35 * flick})`;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,170,120,0.9)';
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 12 * flick);
    g.addColorStop(0, 'rgba(255,255,220,0.95)');
    g.addColorStop(0.4, 'rgba(255,140,60,0.6)');
    g.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ex, ey, 12 * flick, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // Что рисовать: натянутая верёвка или летящий крюк (у гостя приходит с хоста).
  ropeView() {
    if (this.role === 'guest') return this.ropeSync || null;
    const w = this.active;
    if (w && w.rope) return { kind: 'rope', x: w.rope.x, y: w.rope.y };
    if (this.hook) return { kind: 'hook', x: this.hook.x, y: this.hook.y };
    return null;
  }

  drawRope(ctx) {
    const rv = this.ropeView();
    const w = this.active;
    if (!rv || !w || w.dead) return;
    const sx = w.x, sy = w.y - 2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(40,24,10,0.85)';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(rv.x, rv.y); ctx.stroke();
    ctx.strokeStyle = '#d9b77a';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([2.2, 1.6]);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(rv.x, rv.y); ctx.stroke();
    ctx.setLineDash([]);
    // Крюк: три лапы, развёрнутые по направлению верёвки.
    ctx.translate(rv.x, rv.y);
    ctx.rotate(Math.atan2(rv.y - sy, rv.x - sx));
    ctx.strokeStyle = '#2a2a30';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, 0); ctx.lineTo(1, 0);
    ctx.moveTo(1, 0); ctx.quadraticCurveTo(3, -4, 0, -5);
    ctx.moveTo(1, 0); ctx.quadraticCurveTo(3, 4, 0, 5);
    ctx.stroke();
    ctx.strokeStyle = '#b8bcc8';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  }

  // Камера задерживается на месте взрыва, чтобы было видно, куда попали.
  markImpact(x, y) {
    this.impact = { x, y, until: this.time + IMPACT_HOLD };
  }

  explode(x, y, r, dmg) {
    // В сетевой игре координаты воронки округляются так же, как уходят гостю.
    if (this.carves) {
      x = Math.round(x * 10) / 10;
      y = Math.round(y * 10) / 10;
      this.carves.push([x, y, r]);
    }
    this.terrain.carve(x, y, r);
    this.fx.explosion(x, y, r, this.terrain.theme.debris);
    if (r >= 14) this.sfx.boom(r / 45, this.panAt(x));
    if (r >= 30) haptic(Math.min(60, r));
    else this.sfx.play('break', { vol: 0.5, pan: this.panAt(x) });
    this.camera.shake = Math.max(this.camera.shake, r * 0.22);
    this.markImpact(x, y);
    const reach = r + 10;
    for (const w of this.worms) {
      if (w.dead) continue;
      const dx = w.x - x, dy = w.y - y;
      const d = Math.hypot(dx, dy);
      if (d >= reach) continue;
      const f = 1 - d / reach;
      const k = dmg > 0 ? (1.5 + dmg * 0.12) * f : 0;
      const flies = k > 5;
      this.damageWorm(w, Math.round(dmg * this.damageMult * Math.min(1, f * 1.25)), flies);
      if (k > 0) {
        const nx = d > 0.5 ? dx / d : 0, ny = d > 0.5 ? dy / d : -1;
        w.knock(nx * k, ny * k - 1.5 * f);
        if (flies && w.hp > 0) this.say(w, 'fly', 0.9, 2);
      }
    }
    for (const it of this.items) {
      if (it.dead) continue;
      const dx = it.x - x, dy = it.y - y;
      const d = Math.hypot(dx, dy);
      if (d >= reach + 6) continue;
      if (it.type === 'mine') {
        if (it.fuse === 0) it.fuse = 12;
      } else if (it.type === 'crate') {
        it.dead = true;
        this.pending.push({ x: it.x, y: it.y, r: 22, dmg: 15, delay: 6 });
      } else if (it.type === 'barrel') {
        it.dead = true;
        this.pending.push({ x: it.x, y: it.y, r: 34, dmg: 30, delay: 5, flames: 9 });
      }
      const f = 1 - d / (reach + 6);
      const k = (1 + dmg * 0.1) * f;
      it.vx += (d > 0.5 ? dx / d : 0) * k;
      it.vy += (d > 0.5 ? dy / d : -1) * k - f;
      it.resting = false;
      it.parachute = false;
    }
    for (const p of this.projectiles) {
      if (!p.resting) continue;
      const dx = p.x - x, dy = p.y - y;
      const d = Math.hypot(dx, dy);
      if (d < reach) {
        p.resting = false;
        p.vx += (dx / (d || 1)) * 3;
        p.vy += (dy / (d || 1)) * 3 - 2;
      }
    }
  }

  countKill() {
    this.turnKills++;
    this.kills++;
    if (this.kills === 1) {
      this.banner('Первая кровь!', '', '#ff4040');
      this.sfx.say('n', 'firstBlood', { priority: 3 });
    }
  }

  killWorm(w) {
    w.dead = true;
    this.countKill();
    this.explode(w.x, w.y, 22, 10);
    const grave = new Item('grave', w.x, w.y - 6);
    grave.vy = -2;
    this.items.push(grave);
    this.ui.onDamage(this);
  }

  drown(w) {
    w.dead = true;
    w.hp = 0;
    this.countKill();
    this.fx.splash(w.x, WATER.y, 1.2);
    this.fx.text(w.x, WATER.y - 30, 'Буль-буль!', '#bfe4ff', 14, 90);
    this.sfx.splash(1.3, this.panAt(w.x));
    this.say(w, 'drown', 1, 3);
    if (this.controllable && (w === this.active || this.aliveTeams().length <= 1)) this.enterSettle();
    this.ui.onDamage(this);
  }

  // --- Обновление -------------------------------------------------------

  update(input) {
    if (this.paused) return;
    if (input.wasPressed('zoomIn')) this.camera.targetZoom *= 1.2;
    if (input.wasPressed('zoomOut')) this.camera.targetZoom /= 1.2;
    if (this.role === 'guest') { guestTick(this, input); return; }
    this.time++;
    const act = (this.state === 'aim' || this.state === 'retreat') && this.active
      ? this.controllerAct(input)
      : null;

    // Победный танец: выжившие прыгают от радости.
    if (this.over && this.winner && this.time % 50 === 0) {
      for (const w of this.winner.worms) {
        if (!w.dead && w.grounded && Math.random() < 0.6) {
          w.dir = Math.random() < 0.5 ? -1 : 1;
          w.jump(Math.random() < 0.3);
        }
      }
    }

    switch (this.state) {
      case 'turnStart':
        this.stateTimer -= TICK;
        if (this.stateTimer <= 0) {
          this.state = 'aim';
          this.say(this.active, 'turn', 0.7);
        }
        break;
      case 'aim':
        this.turnTimeLeft -= TICK;
        if (this.turnTimeLeft <= 5 && Math.ceil(this.turnTimeLeft) !== this.lastTick) {
          this.lastTick = Math.ceil(this.turnTimeLeft);
          if (this.lastTick > 0) this.sfx.woodblock(this.lastTick <= 2);
        }
        if (this.turnTimeLeft <= 0) {
          this.turnTimeLeft = 0;
          this.toast('Время вышло!');
          this.say(this.active, 'timeup', 0.9, 2);
          this.enterSettle();
          break;
        }
        this.applyControls(act, true);
        break;
      case 'retreat':
        this.retreatLeft -= TICK;
        this.applyControls(act, false);
        if (this.retreatLeft <= 0) this.enterSettle();
        break;
      case 'settle':
        this.updateSettle();
        break;
    }

    this.updateWorld();
  }

  updateSettle() {
    const busy = this.projectiles.length > 0 || this.pending.length > 0 || this.spawnQueue.length > 0 ||
      this.quake > 0 || WATER.y > this.waterTarget + 0.5 ||
      (this.impact && this.time < this.impact.until) ||
      this.worms.some((w) => !w.dead && !w.grounded) ||
      // Ящики и бочки, которые никак не улягутся, держат ход не дольше 8 с.
      this.items.some((it) => !it.dead && (it.fuse > 0 || (!it.resting && this.settleTotal < 8)));
    this.settleTotal += TICK;
    if (busy && this.settleTotal < 25) { this.settleTimer = 0; return; }
    this.settleTimer += TICK;
    if (this.settleTimer < SETTLE_DELAY) return;
    const dying = this.worms.find((w) => !w.dead && w.hp <= 0);
    if (dying) {
      if (dying.dyingTimer === undefined) {
        dying.dyingTimer = 75;
        this.focusWorm = dying;
        this.camera.manual = 0;
        this.fx.text(dying.x, dying.y - 30, `${dying.name} выбывает!`, '#fff', 13, 90);
        this.say(dying, 'death', 1, 3);
        this.sfx.slideWhistle(this.panAt(dying.x));
        return;
      }
      if (--dying.dyingTimer > 0) return;
      this.killWorm(dying);
      this.settleTimer = 0;
      this.settleTotal = 0;
      return;
    }
    this.nextTurn();
  }

  updateWorld() {
    const t = this.terrain;
    this.updateHook();
    this.updateDrill();
    this.drillFx();
    for (const w of this.worms) {
      if (w.dead) continue;
      if (w.hurtTimer > 0) w.hurtTimer--;
      const res = w.rope ? this.ropeTick(w) : this.drill && this.drill.worm === w ? null : w.update(t);
      if (res) {
        if (res.impact > 2.5) {
          this.sfx.play('land', { vol: Math.min(1, res.impact / 6) });
          if (res.impact > 4) this.fx.dust(w.x, w.y + WORM_R);
        }
        if (res.fallDamage > 0) this.damageWorm(w, res.fallDamage);
      }
      if (w.inWater) { w.rope = null; this.drown(w); }
      else if (w.shownHp !== w.hp) w.shownHp += Math.sign(w.hp - w.shownHp);
    }

    for (const p of this.projectiles) {
      const ev = projectileTick(p, t, this.wind, this.worms);
      if (p.cfg.trail && this.time % 2 === 0) this.effects.trail(p.x, p.y);
      if (p.cfg.spark) this.effects.fuseSpark(p.x + 2, p.y - 11);
      if (p.loop) p.loop.setPan(this.panAt(p.x));
      if (ev === 'bounce') this.sfx.tonk(this.panAt(p.x));
      if (p.cfg.holy && p.fuse === 55) {
        this.sfx.choir(this.panAt(p.x));
        this.fx.text(p.x, p.y - 26, 'Аллилуйя!', '#fff1a8', 16, 70);
      }
      if (p.cfg.fiery && this.time % 2 === 0) this.fx.dust(p.x, p.y);
      if (ev === 'explode' && p.cfg.flame) {
        p.dead = true;
      } else if (ev === 'explode' && p.cfg.pierce && p.pierceLeft > 0) {
        // Осёл пробивает землю и летит дальше.
        const [r, dmg] = p.cfg.explosion;
        this.explode(p.x, p.y, r, dmg);
        p.pierceLeft--;
        p.vx = 0;
        p.vy = 3.5;
        p.y += 14;
        if (p.pierceLeft === 0) p.dead = true;
      } else if (ev === 'explode') {
        p.dead = true;
        const [r, dmg] = p.cfg.explosion;
        this.explode(p.x, p.y, r, dmg);
        if (p.cfg.holy) this.camera.shake = 22;
        if (p.cfg.children) {
          for (let i = 0; i < p.cfg.children; i++) {
            const kind = p.cfg.childKind || 'bomblet';
            const sp = kind === 'bananette' ? 1.5 : 1;
            this.addProjectile(new Projectile(kind, p.x, p.y - 4, rand(-3, 3) * sp, rand(-6, -3) * sp, null));
          }
        }
        if (p.cfg.flames) this.spawnFlames(p.x, p.y - 4, p.cfg.flames);
      } else if (ev === 'water') {
        p.dead = true;
        if (p.y > WATER.y) {
          this.fx.splash(p.x, WATER.y, 0.6);
          this.sfx.splash(0.5, this.panAt(p.x));
        }
      }
      if (p.fuse > 0 && p.fuse % 60 === 0 && p.kind !== 'dynamite') this.sfx.play('tick', { vol: 0.5, pan: this.panAt(p.x) });
      if (p.dead && p.loop) { p.loop.stop(); p.loop = null; }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    this.updateFire();

    for (const q of this.spawnQueue) q.delay--;
    for (const q of this.spawnQueue.filter((q) => q.delay <= 0)) {
      this.addProjectile(new Projectile(q.kind, q.x, -120, rand(-2, 2), 6, null));
      if (Math.random() < 0.4) this.sfx.play('meteor', { vol: 0.6, pan: this.panAt(q.x) });
    }
    this.spawnQueue = this.spawnQueue.filter((q) => q.delay > 0);

    if (this.quake > 0) {
      this.quake--;
      this.camera.shake = Math.max(this.camera.shake, 7);
      if (this.quake % 20 === 0) {
        for (const w of this.worms) if (!w.dead && w.grounded) w.knock(rand(-2.2, 2.2), rand(-3.6, -1.6));
        for (const it of this.items) { it.vx += rand(-1.5, 1.5); it.vy -= rand(1, 2.5); it.resting = false; }
        if (this.quake === 140) {
          const w = pick(this.worms.filter((x) => !x.dead));
          if (w) this.say(w, 'quake', 1, 2);
        }
      }
    }
    if (WATER.y > this.waterTarget) WATER.y = Math.max(this.waterTarget, WATER.y - 0.5);

    for (const it of this.items) {
      if (it.dead) continue;
      const ev = it.update(t, this.wind);
      if (ev === 'water') {
        it.dead = true;
        this.fx.splash(it.x, WATER.y, 0.5);
        this.sfx.splash(0.5, this.panAt(it.x));
        continue;
      }
      if (it.type === 'mine') this.updateMine(it);
      if (it.type === 'crate' && this.active && !this.active.dead && this.controllable) {
        const w = this.active;
        if (Math.hypot(w.x - it.x, w.y - it.y) < 15) this.collectCrate(w, it);
      }
    }
    this.items = this.items.filter((it) => !it.dead);

    for (const e of this.pending) e.delay--;
    const ready = this.pending.filter((e) => e.delay <= 0);
    this.pending = this.pending.filter((e) => e.delay > 0);
    for (const e of ready) {
      this.explode(e.x, e.y, e.r, e.dmg);
      if (e.flames) this.spawnFlames(e.x, e.y - 4, e.flames);
    }

    for (const tr of this.tracers) tr.life--;
    this.tracers = this.tracers.filter((tr) => tr.life > 0);

    for (const c of this.scenery.clouds) {
      c.x += 0.08 + this.wind * 0.9;
      if (c.x > WORLD_W + 400) c.x = -400;
      if (c.x < -400) c.x = WORLD_W + 400;
    }
    updateScenery(this);
    this.effects.update();
  }

  spawnFlames(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.addProjectile(new Projectile('flame', x + rand(-4, 4), y, rand(-2.6, 2.6), rand(-3.4, -0.6), null, Math.floor(rand(170, 330))));
    }
  }

  // Огонь жжёт червяков рядом и понемногу выжигает землю.
  updateFire() {
    let any = false;
    for (const p of this.projectiles) {
      if (!p.cfg.flame) continue;
      any = true;
      for (const w of this.worms) {
        if (w.dead) continue;
        if (Math.abs(w.x - p.x) < 9 && Math.abs(w.y - p.y) < 11) w.burn = (w.burn || 0) + 0.11;
      }
      if (p.resting && p.age % 30 === 0) this.carveOnly(p.x, p.y + 1, 4);
      for (const it of this.items) {
        if (it.type === 'barrel' && !it.dead && Math.hypot(it.x - p.x, it.y - p.y) < 12 && Math.random() < 0.01) {
          it.dead = true;
          this.pending.push({ x: it.x, y: it.y, r: 34, dmg: 30, delay: 1, flames: 9 });
        }
      }
    }
    if (!any && !this.worms.some((w) => w.burn)) return;
    if (this.time % 20 !== 0) return;
    for (const w of this.worms) {
      if (!w.burn || w.dead) continue;
      const dmg = Math.floor(w.burn);
      if (dmg > 0) {
        w.burn -= dmg;
        this.damageWorm(w, dmg, true);
        if (Math.random() < 0.25 && (!w.lastVoice || this.time - w.lastVoice > 90)) {
          w.lastVoice = this.time;
          this.say(w, 'burn', 1, 2);
        }
      }
      if (w.burn < 0.05) w.burn = 0;
    }
  }

  carveOnly(x, y, r) {
    if (this.carves) {
      x = Math.round(x * 10) / 10;
      y = Math.round(y * 10) / 10;
      this.carves.push([x, y, r]);
    }
    this.terrain.carve(x, y, r);
  }

  updateMine(it) {
    if (it.fuse > 0) {
      it.fuse--;
      if (it.fuse % 10 === 0) this.sfx.beep(1400, 0.05, 0.08, 'square', this.panAt(it.x));
      if (it.fuse === 0) {
        it.dead = true;
        this.explode(it.x, it.y, 40, 45);
      }
      return;
    }
    if (it.armDelay > 0 || !it.resting) return;
    for (const w of this.worms) {
      if (!w.dead && Math.hypot(w.x - it.x, w.y - it.y) < 28) {
        it.fuse = 75;
        this.fx.text(it.x, it.y - 18, '!', '#ff4040', 18, 50);
        this.say(w, 'mine', 0.8, 2);
        break;
      }
    }
  }

  collectCrate(w, it) {
    it.dead = true;
    this.sfx.chime([784, 988, 1319], this.panAt(w.x));
    this.say(w, 'crate', 0.9, 2);
    if (it.content === 'health') {
      w.hp += 25;
      this.fx.text(w.x, w.y - 32, '+25', '#7dff8a', 16, 80);
    } else if (it.content === 'double') {
      w.team.double = true;
      this.fx.text(w.x, w.y - 32, 'Двойной урон в следующий ход!', '#ff9a3c', 12, 100);
    } else {
      const team = w.team;
      if (team.ammo[it.content] !== Infinity) team.ammo[it.content]++;
      this.fx.text(w.x, w.y - 32, `+1 ${WEAPON_BY_ID[it.content].name}`, '#ffe259', 13, 90);
      this.ui.onWeapon(this);
    }
    this.ui.onDamage(this);
  }

  // --- Управление -------------------------------------------------------

  controllerAct(input) {
    const owner = this.active.owner;
    if (owner === 'ai') return this.ai ? this.aiAct() : null;
    if (owner === 'guest') return this.role === 'host' ? this.remoteAct() : null;
    return this.humanAct(input);
  }

  // Нажатия гостя, пришедшие по сети. Данные недоверенные — проверяем всё.
  remoteAct() {
    const r = this.remote;
    const a = { left: !!r.held.l, right: !!r.held.r, up: !!r.held.u, down: !!r.held.d };
    for (const ev of r.queue.splice(0)) {
      switch (ev[0]) {
        case 'fd': a.firePressed = true; r.fire = true; break;
        case 'fu': a.fireReleased = true; r.fire = false; break;
        case 'j': a.jump = true; break;
        case 'b': a.backflip = true; break;
        case 'n': a.next = true; break;
        case 'p': a.prev = true; break;
        case 'f': a.fuse = Math.max(1, Math.min(5, ev[1] | 0)); break;
        case 's': if (WEAPON_BY_ID[ev[1]]) a.select = ev[1]; break;
        case 'c':
          if (Number.isFinite(ev[1]) && Number.isFinite(ev[2])) a.click = { x: ev[1], y: ev[2] };
          break;
      }
    }
    a.fireHeld = r.fire;
    return a;
  }

  humanAct(input) {
    const a = {
      left: input.isHeld('left'), right: input.isHeld('right'),
      up: input.isHeld('up'), down: input.isHeld('down'),
      firePressed: input.wasPressed('fire'), fireHeld: input.isHeld('fire'), fireReleased: input.wasReleased('fire'),
      jump: input.wasPressed('jump'), backflip: input.wasPressed('backflip'),
      next: input.wasPressed('next'), prev: input.wasPressed('prev'),
      select: this.pendingWeapon,
    };
    this.pendingWeapon = null;
    for (let i = 1; i <= 5; i++) if (input.wasPressed('fuse' + i)) a.fuse = i;
    if (this.pendingFuse) { a.fuse = this.pendingFuse; this.pendingFuse = null; }
    if (input.clicks.length) a.click = this.screenToWorld(input.clicks[0].x, input.clicks[0].y);
    return a;
  }

  applyControls(a, canFire) {
    const w = this.active;
    if (!w || w.dead || !a) return;
    const t = this.terrain;
    if (canFire && !this.charging && this.shotgunShots === 0) {
      if (a.select) this.selectWeapon(a.select);
      if (a.next) this.cycleWeapon(1);
      if (a.prev) this.cycleWeapon(-1);
    }
    if (a.fuse && this.weapon.fuse) {
      this.fuseSec = a.fuse;
      this.sfx.play('click', { vol: 0.6 });
      this.ui.onWeapon(this);
    }
    // На верёвке стрелки раскачивают и меняют длину, огонь или прыжок — отцепиться.
    if (w.rope) {
      if (a.left !== a.right) {
        w.vx += (a.left ? -1 : 1) * ROPE_SWING;
        w.dir = a.left ? -1 : 1;
      }
      if (a.up) w.rope.len = Math.max(ROPE_MIN, w.rope.len - ROPE_REEL);
      if (a.down) w.rope.len = Math.min(ROPE_MAX, w.rope.len + ROPE_REEL);
      if (a.firePressed || a.jump || a.backflip) this.releaseRope(w);
      return;
    }
    if (this.hook) return;
    // Бур: стрелки ведут луч, огонь или прыжок — выключить.
    if (this.drill) {
      if (a.up) w.aim = Math.min(Math.PI / 2, w.aim + AIM_SPEED);
      if (a.down) w.aim = Math.max(-Math.PI / 2, w.aim - AIM_SPEED);
      if (a.left !== a.right) w.dir = a.left ? -1 : 1;
      if (a.firePressed || a.jump || a.backflip) this.stopDrill();
      return;
    }
    if (!this.charging) {
      if (a.left !== a.right) {
        const moved = w.walk(t, a.left ? -1 : 1);
        if (moved) {
          this.camera.manual = 0;
          if (this.time % 24 === 0) this.sfx.play('walk', { vol: 0.2, rate: rand(1.2, 1.4), pan: this.panAt(w.x) });
        }
      }
      if (a.jump && w.jump(false)) {
        this.sfx.play('jump', { vol: 0.35, pan: this.panAt(w.x) });
        this.sfx.boing(this.panAt(w.x));
        this.camera.manual = 0;
      }
      if (a.backflip && w.jump(true)) {
        this.sfx.play('backflip', { vol: 0.35, pan: this.panAt(w.x) });
        this.sfx.boing(this.panAt(w.x), true);
        this.say(w, 'backflip', 0.4);
        this.camera.manual = 0;
      }
    }
    if (!canFire) {
      if (a.firePressed) {
        const sheep = this.projectiles.find((p) => p.cfg.walker && p.owner === w && !p.dead);
        if (sheep) sheep.fuse = 1;
      }
      return;
    }
    if (a.up) w.aim = Math.min(Math.PI / 2, w.aim + AIM_SPEED);
    if (a.down) w.aim = Math.max(-Math.PI / 2, w.aim - AIM_SPEED);
    const def = this.weapon;
    if (def.drill) {
      if (a.firePressed && w.grounded) this.startDrill(w);
      return;
    }
    if (def.rope) {
      // Крюк можно выпустить и в прыжке или падении.
      if (a.firePressed) this.shootHook(w);
      return;
    }
    if (def.needsTarget && a.click) {
      this.homingTarget = { x: a.click.x, y: a.click.y };
      this.ui.onWeapon(this);
      this.sfx.beep(1200, 0.06, 0.1, 'sine');
      if (!a.firePressed) return;
    }
    if (def.needsTarget && a.firePressed && !this.homingTarget && !this.charging) {
      this.toast('Сначала кликните по цели');
      return;
    }
    if (def.target) {
      if (a.click && w.grounded) this.fireAt(a.click);
      else if (a.firePressed) this.toast('Кликните по карте, чтобы выбрать цель');
      return;
    }
    if (def.charge) {
      if (a.firePressed && w.grounded && !this.charging) {
        this.charging = true;
        this.power = 0;
      }
      if (this.charging) {
        this.power = Math.min(1, this.power + 1 / CHARGE_TICKS);
        if (a.fireReleased || !a.fireHeld || this.power >= 1) this.fire();
      }
    } else if (a.firePressed && w.grounded) {
      this.fire();
    }
  }

  // --- ИИ ---------------------------------------------------------------

  aiAct() {
    const ai = this.ai;
    const w = this.active;
    const a = {};
    if (this.state === 'retreat') {
      // Убегаем от собственного динамита/гранаты.
      const danger = this.projectiles.find((p) => p.fuse > 0 && Math.abs(p.x - w.x) < 90);
      if (danger) {
        if (danger.x > w.x) a.left = true; else a.right = true;
        if (this.time % 40 === 0) a.jump = true;
      }
      return a;
    }
    switch (ai.phase) {
      case 'wait':
        ai.timer -= TICK;
        if (ai.timer <= 0) {
          if (this.shotgunShots > 0) {
            ai.plan = this.aiShotgunFollowUp(w);
            ai.phase = 'select';
            ai.timer = 0.2;
          } else {
            ai.gen = planTurn(this, w);
            ai.phase = 'think';
          }
        }
        break;
      case 'think': {
        const start = performance.now();
        let r;
        do { r = ai.gen.next(); } while (!r.done && performance.now() - start < 6);
        if (!r.done) break;
        let plan = r.value;
        if (!plan.weapon || plan.score < 4) {
          if (ai.walked < 2 && this.turnTimeLeft > 15) {
            ai.walked++;
            ai.phase = 'walk';
            ai.walkTicks = 0;
            ai.lastX = w.x;
            ai.stuck = 0;
            const target = nearestEnemy(this, w);
            ai.walkDir = target && target.x < w.x ? -1 : 1;
            break;
          }
          if (!plan.weapon) plan = { weapon: 'skip', dir: w.dir, aim: w.aim };
        }
        const d = DIFFICULTY[this.opts.difficulty];
        const noise = () => (Math.random() + Math.random() - 1);
        if (plan.aim !== undefined && plan.weapon !== 'bat') plan.aim += noise() * d.angle;
        if (plan.power !== undefined) plan.power = Math.max(0.1, Math.min(1, plan.power + noise() * d.power));
        if (plan.target) plan.target = { x: plan.target.x + noise() * d.angle * 300, y: plan.target.y };
        ai.plan = plan;
        ai.phase = 'select';
        ai.timer = 0.5;
        break;
      }
      case 'walk': {
        ai.walkTicks++;
        if (ai.walkDir < 0) a.left = true; else a.right = true;
        if (Math.abs(w.x - ai.lastX) < 0.3 && w.grounded) ai.stuck++;
        else ai.stuck = 0;
        ai.lastX = w.x;
        if (ai.stuck > 8) { a.jump = true; ai.stuck = 0; }
        const target = nearestEnemy(this, w);
        const close = target && Math.abs(target.x - w.x) < 100;
        const cliff = !this.groundBelow(w.x + ai.walkDir * 22, w.y - 10);
        if (ai.walkTicks > 160 || close || cliff || this.turnTimeLeft < 12) {
          ai.phase = 'settleWalk';
        }
        break;
      }
      case 'settleWalk':
        if (w.grounded) { ai.phase = 'wait'; ai.timer = 0.3; }
        break;
      case 'select': {
        const plan = ai.plan;
        if (this.weaponId !== plan.weapon && this.shotgunShots === 0) {
          if (!this.selectWeapon(plan.weapon)) plan.weapon = this.weaponId;
        }
        if (plan.fuse) { this.fuseSec = plan.fuse; this.ui.onWeapon(this); }
        if (plan.dir) w.dir = plan.dir;
        ai.timer -= TICK;
        if (ai.timer <= 0) ai.phase = 'aim';
        break;
      }
      case 'aim': {
        const plan = ai.plan;
        if (!w.grounded) break;
        if (plan.weapon === 'skip') { a.firePressed = true; ai.phase = 'done'; break; }
        if (plan.target) { a.click = plan.target; ai.phase = 'done'; break; }
        const diff = plan.aim - w.aim;
        if (Math.abs(diff) > AIM_SPEED) {
          if (diff > 0) a.up = true; else a.down = true;
          break;
        }
        w.aim = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, plan.aim));
        a.firePressed = true;
        a.fireHeld = true;
        ai.phase = this.weapon.charge ? 'charge' : 'done';
        break;
      }
      case 'charge':
        // Зарядка почему-то не началась: жмём «огонь» заново, а не ждём конца хода.
        if (!this.charging) {
          if (++ai.stall > 10) { ai.stall = 0; ai.phase = 'aim'; }
          break;
        }
        ai.stall = 0;
        a.fireHeld = this.power < ai.plan.power;
        if (!a.fireHeld) a.fireReleased = true;
        break;
    }
    return a;
  }

  // Есть ли земля под точкой (до уровня воды).
  groundBelow(x, y) {
    for (let yy = Math.max(0, y); yy < WATER.y - 10; yy += 2) if (this.terrain.isSolid(x, yy)) return true;
    return false;
  }

  aiShotgunFollowUp(w) {
    const target = nearestEnemy(this, w);
    if (!target) return { weapon: 'shotgun', dir: w.dir, aim: w.aim };
    const dx = target.x - w.x, dy = (target.y - 3) - (w.y - 2);
    const d = DIFFICULTY[this.opts.difficulty];
    return {
      weapon: 'shotgun', dir: dx >= 0 ? 1 : -1,
      aim: Math.atan2(-dy, Math.abs(dx)) + (Math.random() - 0.5) * d.angle,
    };
  }

  // --- Камера -----------------------------------------------------------

  updateCamera(input, vw, vh) {
    const cam = this.camera;
    if (input.wheel) cam.targetZoom *= Math.pow(1.12, -input.wheel);
    if (input.zoomFactor !== 1) {
      cam.targetZoom *= input.zoomFactor;
      cam.manual = 4;
      this.pinching = true;
    }
    const minZoom = Math.max(0.35, Math.min(vw / (WORLD_W + 200), vh / (WORLD_H + 200)));
    cam.targetZoom = Math.max(minZoom, Math.min(2, cam.targetZoom));
    // Щипок двигает масштаб сразу, колесо и кнопки — плавно.
    if (this.pinching) { cam.zoom = cam.targetZoom; this.pinching = false; } else cam.zoom += (cam.targetZoom - cam.zoom) * 0.15;
    if (input.panDelta.x || input.panDelta.y) {
      cam.x -= input.panDelta.x / cam.zoom;
      cam.y -= input.panDelta.y / cam.zoom;
      cam.manual = 4;
    }
    if (cam.manual > 0) {
      cam.manual -= 1 / 60;
    } else {
      const focus = this.focusPoint();
      if (focus) {
        const k = focus.fast ? 0.14 : 0.08;
        cam.x += (focus.x - cam.x) * k;
        cam.y += (focus.y - cam.y) * k;
      }
    }
    const hw = vw / 2 / cam.zoom, hh = vh / 2 / cam.zoom;
    const minX = -150 + hw, maxX = WORLD_W + 150 - hw;
    cam.x = minX > maxX ? WORLD_W / 2 : Math.max(minX, Math.min(maxX, cam.x));
    const minY = -350 + hh, maxY = WATER_Y + 160 - hh;
    cam.y = minY > maxY ? (WATER_Y - 400) : Math.max(minY, Math.min(maxY, cam.y));
    cam.shake *= 0.88;
    if (cam.shake < 0.2) cam.shake = 0;
  }

  focusPoint() {
    if (this.focusWorm && !this.focusWorm.dead) return { x: this.focusWorm.x, y: this.focusWorm.y - 20 };
    const flying = this.projectiles.filter((p) => !p.resting && !p.cfg.flame);
    if (flying.length) {
      const p = flying[flying.length - 1];
      return { x: p.x, y: p.y, fast: true };
    }
    if (this.pending.length) return { x: this.pending[0].x, y: this.pending[0].y };
    const mover = this.worms.find((w) => !w.dead && w.flying);
    if (mover) return { x: mover.x, y: mover.y, fast: true };
    const imp = this.impact;
    if (imp && this.time < imp.until && this.state !== 'aim' && this.state !== 'turnStart') return { x: imp.x, y: imp.y };
    const fuse = this.projectiles.find((p) => p.fuse > 0) || this.items.find((it) => it.fuse > 0);
    if (fuse) return { x: fuse.x, y: fuse.y };
    if (this.state === 'turnStart' || this.state === 'aim' || this.state === 'retreat') {
      const crate = this.items.find((it) => it.parachute && this.state === 'turnStart');
      if (crate) return { x: crate.x, y: crate.y };
      if (this.active) return { x: this.active.x, y: this.active.y - 30, fast: !this.active.grounded };
    }
    return null;
  }

  screenToWorld(sx, sy) {
    const cam = this.camera;
    return {
      x: (sx - this.viewW / 2) / cam.zoom + cam.x,
      y: (sy - this.viewH / 2) / cam.zoom + cam.y,
    };
  }

  // --- Отрисовка --------------------------------------------------------

  render(ctx, vw, vh, dpr, input) {
    this.viewW = vw;
    this.viewH = vh;
    const cam = this.camera;
    const sp = this.assets.sprite;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawSky(this, ctx, vw, vh, this.assets.img.sky);

    // Холмы на заднем плане.
    const waterScreenY = (WATER.y - cam.y) * cam.zoom + vh / 2;
    this.scenery.hills.forEach((img, i) => {
      const p = 0.2 + i * 0.18;
      const s = 0.6 + cam.zoom * 0.4;
      const w = img.width * s, h = img.height * s;
      const y = vh / 2 + (waterScreenY - vh / 2) * (p + 0.35) - h + 30;
      let x0 = -((cam.x * p * cam.zoom) % w);
      if (x0 > 0) x0 -= w;
      for (let x = x0; x < vw; x += w - 1) ctx.drawImage(img, x, y, w, h);
      ctx.fillStyle = this.terrain.theme.hills[i];
      if (y + h < vh) ctx.fillRect(0, y + h - 1, vw, vh - y - h + 1);
    });

    // Мир.
    const shx = cam.shake ? rand(-cam.shake, cam.shake) : 0;
    const shy = cam.shake ? rand(-cam.shake, cam.shake) : 0;
    const z = cam.zoom * dpr;
    ctx.setTransform(z, 0, 0, z, (vw / 2 - cam.x * cam.zoom + shx) * dpr, (vh / 2 - cam.y * cam.zoom + shy) * dpr);
    const view = {
      x0: cam.x - vw / 2 / cam.zoom - 50, x1: cam.x + vw / 2 / cam.zoom + 50,
      y0: cam.y - vh / 2 / cam.zoom - 50, y1: cam.y + vh / 2 / cam.zoom + 50,
    };

    const night = !!this.terrain.theme.night;
    for (const c of this.scenery.clouds) {
      if (c.x + c.s < view.x0 || c.x - c.s > view.x1) continue;
      ctx.globalAlpha = night ? c.a * 0.55 : c.a;
      ctx.drawImage(night ? sp.cloudNight : sp.cloud, c.x - c.s / 2, c.y - c.s * 0.3, c.s, c.s * 0.6);
    }
    ctx.globalAlpha = 1;

    this.drawWater(ctx, view, 0);
    // Рисуем только видимую часть ландшафта.
    {
      const sx = Math.max(0, Math.floor(view.x0)), sy = Math.max(0, Math.floor(view.y0));
      const sw = Math.min(this.terrain.w, Math.ceil(view.x1)) - sx, sh = Math.min(this.terrain.h, Math.ceil(view.y1)) - sy;
      if (sw > 0 && sh > 0) ctx.drawImage(this.terrain.canvas, sx, sy, sw, sh, sx, sy, sw, sh);
    }
    if (this.terrain.lights.length) drawLights(this, ctx);
    if (this.scenery.fog.length) drawFog(this, ctx, sp.fog);

    for (const it of this.items) it.draw(ctx, sp, this.time);

    const active = this.active;
    const aiming = active && !active.dead && (this.state === 'aim') && active.grounded;
    this.drawRope(ctx);
    const drilling = !!this.drillView();
    for (const w of this.worms) {
      if (w.dead) continue;
      let look = null;
      if (w === active && aiming) look = w.aimVector();
      w.draw(ctx, { look, flying: w.flying, hurt: w.hurtTimer > 0 });
    }
    if ((aiming || drilling) && !this.weapon.target) drawHeldWeapon(ctx, active, this.weaponId);
    if (drilling) this.drawDrill(ctx);

    for (const p of this.projectiles) drawProjectile(ctx, p);

    for (const tr of this.tracers) {
      ctx.strokeStyle = `rgba(255,240,180,${tr.life / 12})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tr.x0, tr.y0);
      ctx.lineTo(tr.x1, tr.y1);
      ctx.stroke();
    }

    drawWeather(this, ctx);
    this.effects.draw(ctx);
    this.drawWater(ctx, view, 1);

    if (aiming) this.drawAim(ctx, active, input);
    if (this.homingTarget && this.weaponId === 'homing' && (this.state === 'aim' || this.state === 'retreat')) {
      const { x, y } = this.homingTarget;
      const r = 9 + Math.sin(this.time * 0.2) * 2;
      ctx.strokeStyle = '#ff3b3b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.moveTo(x - r - 6, y); ctx.lineTo(x - r + 3, y);
      ctx.moveTo(x + r - 3, y); ctx.lineTo(x + r + 6, y);
      ctx.moveTo(x, y - r - 6); ctx.lineTo(x, y - r + 3);
      ctx.moveTo(x, y + r - 3); ctx.lineTo(x, y + r + 6);
      ctx.stroke();
    }
    this.drawLabels(ctx);
    this.effects.drawTexts(ctx);

    if (active && !active.dead && (this.state === 'turnStart' || (this.state === 'aim' && this.opts.turnTime - this.turnTimeLeft < 2.5))) {
      const by = active.y - 52 + Math.sin(this.time / 6) * 4;
      ctx.fillStyle = active.team.color;
      ctx.strokeStyle = '#1b1220';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(active.x - 7, by - 8);
      ctx.lineTo(active.x + 7, by - 8);
      ctx.lineTo(active.x, by + 2);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }
  }

  drawWater(ctx, view, layer) {
    const theme = this.terrain.theme;
    const t = this.time;
    const base = WATER.y + (layer ? 8 : 0);
    const bottom = Math.max(view.y1, WORLD_H) + 400;
    const g = ctx.createLinearGradient(0, base, 0, base + 300);
    g.addColorStop(0, theme.water[0]);
    g.addColorStop(1, theme.water[1]);
    ctx.fillStyle = g;
    ctx.globalAlpha = layer ? 0.78 : 1;
    ctx.beginPath();
    const x0 = Math.floor(view.x0 / 16) * 16, x1 = view.x1 + 16;
    ctx.moveTo(x0, bottom);
    for (let x = x0; x <= x1; x += 16) {
      const y = base + Math.sin(x * 0.018 + t * 0.045 + layer * 2.1) * 4 + Math.sin(x * 0.05 - t * 0.03) * 2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x1, bottom);
    ctx.closePath();
    ctx.fill();
    if (layer) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 16) {
        const y = base + Math.sin(x * 0.018 + t * 0.045 + 2.1) * 4 + Math.sin(x * 0.05 - t * 0.03) * 2;
        if (x === x0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawAim(ctx, w, input) {
    const def = this.weapon;
    if (def.target) {
      if (this.isMyTurn && input.mouse.inside) {
        const p = this.screenToWorld(input.mouse.x, input.mouse.y);
        ctx.strokeStyle = def.id === 'teleport' ? '#7ff6ff' : '#ff4040';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
        ctx.moveTo(p.x - 16, p.y); ctx.lineTo(p.x - 5, p.y);
        ctx.moveTo(p.x + 5, p.y); ctx.lineTo(p.x + 16, p.y);
        ctx.moveTo(p.x, p.y - 16); ctx.lineTo(p.x, p.y - 5);
        ctx.moveTo(p.x, p.y + 5); ctx.lineTo(p.x, p.y + 16);
        ctx.stroke();
      }
      return;
    }
    if (['dynamite', 'mine', 'skip', 'quake', 'armageddon', 'sheep', 'punch'].includes(def.id)) return;
    const v = w.aimVector();
    const cx = w.x + v.x * 42, cy = w.y - 2 + v.y * 42;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    if (this.charging) {
      const n = Math.ceil(this.power * 16);
      for (let i = 0; i < n; i++) {
        const k = i / 16;
        const d = 12 + i * 4.2;
        ctx.fillStyle = `hsl(${55 - k * 55}, 100%, 55%)`;
        ctx.beginPath();
        ctx.arc(w.x + v.x * d, w.y - 2 + v.y * d, 1.8 + k * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawLabels(ctx) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const w of this.worms) {
      if (w.dead) continue;
      const y0 = w.y - 24;
      ctx.font = '800 9px Rubik, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#1b1220';
      ctx.fillStyle = w.team.color;
      const online = this.role !== 'local' || w.team.online;
      const label = online && (w.owner === this.role || w.owner === 'local') ? `★ ${w.name}` : w.name;
      ctx.strokeText(label, w.x, y0 - 10);
      ctx.fillText(label, w.x, y0 - 10);
      const hp = String(Math.max(0, Math.round(w.shownHp)));
      ctx.font = '800 10px Rubik, sans-serif';
      const tw = ctx.measureText(hp).width + 8;
      ctx.fillStyle = 'rgba(20,14,30,0.75)';
      ctx.fillRect(w.x - tw / 2, y0 - 5, tw, 11);
      ctx.fillStyle = w.team.color;
      ctx.fillText(hp, w.x, y0 + 0.5);
    }
  }
}
