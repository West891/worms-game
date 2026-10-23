// Онлайн: поиск соперника, комнаты по коду, подстановка бота, если живых нет.
import { connectTransport, isRealNetwork } from './transport.js';
import { PROTOCOL } from './config.js';
import { HostSession, GuestSession } from './session.js';
import { rand, pick } from '../rng.js';
import { MAP_KEYS } from '../maps.js';

const $ = (sel) => document.querySelector(sel);
const CODE_ABC = 'abcdefghjkmnpqrstuvwxyz23456789';
const BOT_NICKS = [
  'Червяк_Гром', 'BazookaKing', 'Пельмешка', 'xX_Worm_Xx', 'Snaiper2011', 'Danya_Pro', 'Kolbasa777',
  'ТихийУжас', 'MegaWorm', 'Лёха', 'Shrimp', 'NoobMaster', 'Ваня_из_5Б', 'Grenadier', 'Котлетка',
  'Wormzilla', 'Дядя_Боря', 'Pashtet', 'Sosiska_99', 'Kamikadze', 'Мармеладка', 'ProRocket',
];

export const randomNick = () => 'Игрок' + Math.floor(1000 + Math.random() * 9000);
const botNick = () => pick(BOT_NICKS) + (Math.random() < 0.4 ? Math.floor(Math.random() * 100) : '');
const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const safeNick = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 18) || 'Игрок';

export class Online {
  // hooks: startHost(channel, opts, session), startGuest(channel, setup), startBot(opts), peerLost(role), rate()
  constructor(hooks) {
    this.hooks = hooks;
    // Закрыли вкладку — сразу выходим из комнаты, чтобы соперник не ждал.
    window.addEventListener('pagehide', () => this.cancel());
    this.transport = null;
    this.pending = null;
    this.mode = null;
    this.channel = null;
    this.session = null;
  }

  async ensure() {
    if (!this.pending) this.pending = connectTransport().catch(() => null);
    this.transport = await this.pending;
    return this.transport;
  }

  get kind() { return this.transport ? this.transport.kind : null; }
  get real() { return isRealNetwork(this.transport); }

  // --- Экран ожидания ------------------------------------------------------

  showWait({ title, text = '', code = null, canStart = false, startLabel = 'Начать игру' }) {
    for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
    $('#net-wait').classList.remove('hidden');
    $('#net-title').textContent = title;
    $('#net-text').textContent = text;
    $('#net-code-box').classList.toggle('hidden', !code);
    if (code) $('#net-code').textContent = code.toUpperCase();
    $('#net-start').classList.toggle('hidden', !canStart);
    $('#net-start').textContent = startLabel;
  }

  setWaitText(text) { $('#net-text').textContent = text; }

  // --- Автопоиск -----------------------------------------------------------

  async findMatch(nick) {
    this.cancel();
    this.nick = safeNick(nick);
    this.mode = 'search';
    this.searchStart = performance.now();
    this.showWait({ title: 'Ищем соперника…', text: 'Подключаемся…' });
    const t = await this.ensure();
    if (this.mode !== 'search') return;
    // Если живых нет, через несколько секунд «находится» бот.
    this.botAt = performance.now() + (isRealNetwork(t) ? rand(12, 20) : rand(4, 9)) * 1000;
    this.partner = null;
    if (t) t.lobby.setPresence({ mm: { v: PROTOCOL, nick: this.nick, since: Date.now(), st: 'search' } });
  }

  searchTick(now) {
    const sec = Math.floor((now - this.searchStart) / 1000);
    this.setWaitText(`Прошло ${sec} с`);
    const t = this.transport;
    if (t && !this.committing) {
      const myId = t.lobby.id;
      const peers = t.lobby.peers();
      // Нас уже выбрали в пару: через интернет второй игрок мог заметить нас
      // раньше, чем мы его, и уже ждёт в комнате.
      const invite = peers.find((p) => !p.isMe && p.presence && p.presence.mm && p.presence.mm.v === PROTOCOL &&
        p.presence.mm.st === 'match' && p.presence.mm.with === myId);
      if (invite) {
        this.commitMatch(invite);
        return;
      }
      const list = peers
        .filter((p) => p.presence && p.presence.mm && p.presence.mm.v === PROTOCOL && p.presence.mm.st === 'search')
        .sort((a, b) => (a.presence.mm.since - b.presence.mm.since) || (a.id < b.id ? -1 : 1));
      const i = list.findIndex((p) => p.id === myId);
      const partner = i < 0 ? null : list[i % 2 === 0 ? i + 1 : i - 1] || null;
      if (partner && this.partner && partner.id === this.partner.id) {
        if (now - this.partnerSince > 1200) this.commitMatch(partner);
      } else {
        this.partner = partner;
        this.partnerSince = now;
      }
    }
    if (!this.committing && now >= this.botAt) this.startBot();
  }

  async commitMatch(partner) {
    this.committing = true;
    const t = this.transport;
    const myId = t.lobby.id;
    const host = myId < partner.id;
    const name = ('d-' + clean(host ? myId : partner.id).slice(0, 20) + '-' + clean(host ? partner.id : myId).slice(0, 20)).slice(0, 48);
    const theirNick = safeNick(partner.presence.mm.nick);
    t.lobby.setPresence({ mm: { v: PROTOCOL, nick: this.nick, since: partner.presence.mm.since, st: 'match', with: partner.id } });
    this.setWaitText(`Соперник найден: ${theirNick}. Подключаемся…`);
    try {
      this.channel = await t.join(name);
    } catch (e) {
      this.backToSearch();
      return;
    }
    if (this.mode !== 'search') return;
    this.mode = host ? 'match-host' : 'match-guest';
    this.matchDeadline = performance.now() + 12000;
    this.theirNick = theirNick;
    this.channel.setPresence(host ? { host: { v: PROTOCOL, nick: this.nick } } : { hello: { v: PROTOCOL, nick: this.nick } });
  }

  backToSearch() {
    if (this.channel) this.channel.leave();
    this.channel = null;
    this.committing = false;
    this.partner = null;
    this.mode = 'search';
    if (this.transport) {
      this.transport.lobby.setPresence({ mm: { v: PROTOCOL, nick: this.nick, since: Date.now(), st: 'search' } });
    }
  }

  matchTick(now) {
    const peers = this.channel.peers();
    if (this.mode === 'match-host') {
      const guest = peers.find((p) => !p.isMe && p.presence && p.presence.hello);
      if (guest) {
        this.leaveLobby();
        this.startHost(duelTeams(this.nick, safeNick(guest.presence.hello.nick)), DUEL_SETTINGS, 'match');
        return;
      }
    } else {
      const host = peers.find((p) => !p.isMe && p.presence && p.presence.setup);
      if (host) {
        this.leaveLobby();
        this.startGuest(host.presence.setup, 'match');
        return;
      }
    }
    if (now > this.matchDeadline) this.backToSearch();
  }

  startBot() {
    this.leaveLobby();
    const opponent = botNick();
    this.mode = null;
    this.setWaitText(`Соперник найден: ${opponent}`);
    setTimeout(() => this.hooks.startBot({
      teams: [
        { name: this.nick, color: '#ff5d5d', owner: 'local', online: true },
        { name: opponent, color: '#53a8ff', ai: true, disguise: true, online: true },
      ],
      ...DUEL_SETTINGS,
      difficulty: 'human',
    }), 900);
  }

  // --- Игра с другом --------------------------------------------------------

  async createRoom(nick, friendMode) {
    this.cancel();
    this.nick = safeNick(nick);
    this.friendMode = friendMode;
    this.mode = 'room-host';
    this.showWait({ title: 'Комната для друга', text: 'Создаём комнату…' });
    const t = await this.ensure();
    if (this.mode !== 'room-host') return;
    if (!t) { this.showError('Сетевая игра здесь недоступна'); return; }
    const code = Array.from({ length: 6 }, () => CODE_ABC[Math.floor(Math.random() * CODE_ABC.length)]).join('');
    try {
      this.channel = await t.join('f-' + code);
    } catch (e) {
      this.showError('Не удалось создать комнату. Попробуйте ещё раз.');
      return;
    }
    this.code = code;
    this.channel.setPresence({ host: { v: PROTOCOL, nick: this.nick, mode: friendMode } });
    this.showWait({
      title: friendMode === 'coop' ? 'Вдвоём против компьютера' : 'Друг против друга',
      text: 'Отправьте другу код. Он открывает игру → «Онлайн» → вводит код.',
      code,
      canStart: false,
    });
  }

  roomHostTick() {
    const guest = this.channel.peers().find((p) => !p.isMe && p.presence && p.presence.hello);
    const ready = !!guest;
    $('#net-start').classList.toggle('hidden', !ready);
    this.guestNick = guest ? safeNick(guest.presence.hello.nick) : null;
    const text = ready
      ? `Друг подключился: ${this.guestNick}. Можно начинать!`
      : 'Отправьте другу код. Он открывает игру → «Онлайн» → вводит код.';
    if ($('#net-text').textContent !== text) this.setWaitText(text);
  }

  startFromRoom(settings) {
    if (this.mode !== 'room-host' || !this.guestNick) return;
    const teams = this.friendMode === 'coop'
      ? [
        { name: 'Друзья', color: '#5fe36c', owner: 'mixed', online: true },
        { name: 'Компьютер', color: '#ff5d5d', ai: true },
      ]
      : duelTeams(this.nick, this.guestNick);
    this.startHost(teams, settings, 'friend');
  }

  async joinRoom(nick, rawCode) {
    this.cancel();
    const code = clean(rawCode);
    if (code.length !== 6) { this.showError('Код комнаты — 6 букв и цифр'); return; }
    this.nick = safeNick(nick);
    this.mode = 'room-guest';
    this.showWait({ title: 'Подключаемся к другу…', text: `Комната ${code.toUpperCase()}` });
    const t = await this.ensure();
    if (this.mode !== 'room-guest') return;
    if (!t) { this.showError('Сетевая игра здесь недоступна'); return; }
    try {
      this.channel = await t.join('f-' + code);
    } catch (e) {
      this.showError('Не удалось подключиться. Проверьте код.');
      return;
    }
    this.channel.setPresence({ hello: { v: PROTOCOL, nick: this.nick } });
    this.joinDeadline = performance.now() + 10000;
  }

  roomGuestTick(now) {
    const host = this.channel.peers().find((p) => !p.isMe && p.presence && p.presence.host);
    if (host && host.presence.setup) {
      this.startGuest(host.presence.setup, 'friend');
      return;
    }
    if (host) {
      this.joinDeadline = Infinity;
      if (host.presence.host.v !== PROTOCOL) { this.showError('У друга другая версия игры — обновите страницу'); return; }
      this.setWaitText(`Вы в комнате у ${safeNick(host.presence.host.nick)}. Ждём, когда начнётся игра.`);
    } else if (now > this.joinDeadline) {
      this.showError('Комната не найдена. Проверьте код или попросите друга создать новую.');
    }
  }

  // --- Запуск партии --------------------------------------------------------

  startHost(teams, settings, kind) {
    this.mode = 'playing';
    this.playKind = kind;
    const opts = { ...settings, teams, role: 'host' };
    this.hooks.startHost(opts, (game) => {
      this.session = new HostSession(this.channel, game, this.transport.rate, () => this.hooks.peerLost('host'));
    }, kind);
  }

  startGuest(rawSetup, kind) {
    const setup = sanitizeSetup(rawSetup);
    if (!setup) { this.showError('Хост прислал непонятные данные'); return; }
    this.mode = 'playing';
    this.playKind = kind;
    this.hooks.startGuest({ setup, role: 'guest' }, (game) => {
      this.session = new GuestSession(this.channel, game, this.transport.rate, () => this.hooks.peerLost('guest'));
    }, kind);
  }

  // --- Общее -----------------------------------------------------------------

  tick() {
    const now = performance.now();
    switch (this.mode) {
      case 'search': this.searchTick(now); break;
      case 'match-host':
      case 'match-guest': this.matchTick(now); break;
      case 'room-host': if (this.channel) this.roomHostTick(); break;
      case 'room-guest': if (this.channel) this.roomGuestTick(now); break;
      case 'playing': if (this.session) this.session.tick(); break;
    }
  }

  showError(text) {
    this.cancel();
    this.showWait({ title: 'Не получилось', text });
  }

  leaveLobby() {
    if (this.transport) this.transport.lobby.setPresence({ mm: null });
  }

  cancel() {
    this.leaveLobby();
    if (this.session) this.session.leave();
    else if (this.channel) this.channel.leave();
    this.session = null;
    this.channel = null;
    this.mode = null;
    this.committing = false;
  }
}

// Настройка партии пришла от другого игрока: проверяем и чистим всё.
function sanitizeSetup(s) {
  if (!s || typeof s !== 'object' || !Array.isArray(s.teams) || !Array.isArray(s.worms)) return null;
  if (s.teams.length < 2 || s.teams.length > 4 || s.worms.length < 2 || s.worms.length > 24) return null;
  const color = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#cccccc');
  const owners = ['host', 'guest', 'ai', 'local'];
  const hats = ['cap', 'crown', 'tophat', 'cowboy', 'viking', 'party', 'wizard', 'helmet'];
  const teams = s.teams.map((t) => ({
    name: safeNick(t && t.name), color: color(t && t.color), ai: !!(t && t.ai), online: true,
    owner: t && ['host', 'guest', 'mixed'].includes(t.owner) ? t.owner : null,
    hat: t && hats.includes(t.hat) ? t.hat : null,
  }));
  const worms = [];
  for (const w of s.worms) {
    if (!Array.isArray(w) || !(w[0] >= 0 && w[0] < teams.length)) return null;
    worms.push([w[0] | 0, safeNick(w[1]), owners.includes(w[2]) ? w[2] : 'ai', Math.min(1.2, Math.max(0.8, +w[3] || 1))]);
  }
  const themes = MAP_KEYS;
  return {
    seed: Number.isFinite(+s.seed) ? +s.seed >>> 0 : 1,
    theme: themes.includes(s.theme) ? s.theme : 'meadow',
    turnTime: Math.min(120, Math.max(15, +s.turnTime || 45)),
    teams,
    worms,
  };
}

const DUEL_SETTINGS = { wormsPerTeam: 3, theme: 'random', turnTime: 45, mines: 5, barrels: 4, suddenDeath: 30, difficulty: 'normal' };

function duelTeams(hostNick, guestNick) {
  return [
    { name: hostNick, color: '#ff5d5d', owner: 'host', online: true },
    { name: guestNick, color: '#53a8ff', owner: 'guest', online: true },
  ];
}
