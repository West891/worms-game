// Транспорт сетевой игры. Все адаптеры дают одинаковый «канал»:
//   channel.id            — мой идентификатор в канале
//   channel.setPresence(p) — слить поля p в моё состояние (видят все в канале)
//   channel.peers()        — [{ id, isMe, presence }] всех в канале, включая меня
//   channel.leave()
// Игра общается только через состояние участников: каждый публикует свой
// «снимок» целиком, поэтому потерянное сообщение ничего не ломает.
import { NET_CONFIG } from './config.js';

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => (b % 36).toString(36)).join('');

// --- claude.ai: capability `room` -----------------------------------------

class RoomChannel {
  constructor(room) {
    this.room = room;
    this.state = {};
  }

  get id() {
    const me = this.room.peers().find((p) => p.isMe && p.sameTab);
    return me ? me.peer : null;
  }

  setPresence(patch) {
    Object.assign(this.state, patch);
    this.room.presence(patch).catch((e) => console.warn('presence:', e && e.code));
  }

  peers() {
    return this.room.peers().map((p) => ({ id: p.peer, isMe: p.isMe && p.sameTab, presence: p.presence || {} }));
  }

  leave() {
    if (this.room.leave) return this.room.leave().catch(() => {});
    return this.room.presence(Object.fromEntries(Object.keys(this.state).map((k) => [k, null]))).catch(() => {});
  }
}

class RoomTransport {
  constructor(room) {
    this.kind = 'claude';
    this.rate = 15;
    this.room = room;
    this.lobby = new RoomChannel(room);
  }

  async join(name) {
    return new RoomChannel(await this.room.join(name));
  }

  connected() { return this.room.connected(); }
}

// --- Вкладки одного браузера (BroadcastChannel) — для проверки и игры на одном ПК

class LocalChannel {
  constructor(bus, name, id) {
    this.bus = bus;
    this.name = name;
    this.id = id;
    this.state = {};
    this.others = new Map();
    this.timer = setInterval(() => this.broadcast(), 1000);
    this.onMessage = (e) => {
      const m = e.data;
      if (!m || m.room !== name || m.id === id) return;
      if (m.leave) this.others.delete(m.id);
      else this.others.set(m.id, { presence: m.state, seen: Date.now() });
    };
    bus.addEventListener('message', this.onMessage);
    this.broadcast();
  }

  broadcast() {
    this.bus.postMessage({ room: this.name, id: this.id, state: this.state });
  }

  setPresence(patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete this.state[k]; else this.state[k] = v;
    }
    this.broadcast();
  }

  peers() {
    const now = Date.now();
    const list = [{ id: this.id, isMe: true, presence: this.state }];
    for (const [pid, p] of this.others) {
      if (now - p.seen > 3500) { this.others.delete(pid); continue; }
      list.push({ id: pid, isMe: false, presence: p.presence });
    }
    return list;
  }

  leave() {
    clearInterval(this.timer);
    this.bus.postMessage({ room: this.name, id: this.id, leave: true });
    this.bus.removeEventListener('message', this.onMessage);
  }
}

class LocalTransport {
  constructor() {
    this.kind = 'local';
    this.rate = 15;
    this.id = randomId();
    this.bus = new BroadcastChannel('worms-net');
    this.lobby = new LocalChannel(this.bus, 'lobby', this.id);
  }

  async join(name) { return new LocalChannel(this.bus, name, this.id); }
  connected() { return true; }
}

// --- Supabase Realtime: публичная игра через интернет -------------------------

function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = ok;
    s.onerror = () => fail(new Error('Не удалось загрузить ' + src));
    document.head.appendChild(s);
  });
}

class SupabaseChannel {
  constructor(client, name, id, rate) {
    this.id = id;
    this.state = {};
    this.others = new Map();
    this.members = new Set();
    this.minGap = 1000 / rate;
    this.lastSend = 0;
    this.pendingSend = null;
    this.ready = false;
    const ch = (this.ch = client.channel('worms-' + name, {
      config: { presence: { key: id }, broadcast: { self: false } },
    }));
    ch.on('presence', { event: 'sync' }, () => {
      this.members = new Set(Object.keys(ch.presenceState()));
    });
    ch.on('broadcast', { event: 'st' }, ({ payload }) => {
      if (!payload || payload.id === id) return;
      this.others.set(payload.id, { presence: payload.state || {}, seen: Date.now() });
    });
    this.joined = new Promise((resolve, reject) => {
      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.ready = true;
          await ch.track({ id });
          this.send(true);
          resolve(this);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error('Supabase: ' + status));
        }
      });
    });
    this.timer = setInterval(() => this.send(true), 1500);
  }

  send(force = false) {
    if (!this.ready) return;
    const now = performance.now();
    const wait = this.minGap - (now - this.lastSend);
    if (!force && wait > 0) {
      if (!this.pendingSend) this.pendingSend = setTimeout(() => { this.pendingSend = null; this.send(true); }, wait);
      return;
    }
    this.lastSend = now;
    this.ch.send({ type: 'broadcast', event: 'st', payload: { id: this.id, state: this.state } });
  }

  setPresence(patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete this.state[k]; else this.state[k] = v;
    }
    this.send();
  }

  peers() {
    const now = Date.now();
    const list = [{ id: this.id, isMe: true, presence: this.state }];
    for (const [pid, p] of this.others) {
      const member = this.members.size === 0 || this.members.has(pid);
      if (!member || now - p.seen > 5000) { this.others.delete(pid); continue; }
      list.push({ id: pid, isMe: false, presence: p.presence });
    }
    return list;
  }

  leave() {
    clearInterval(this.timer);
    clearTimeout(this.pendingSend);
    return this.ch.unsubscribe();
  }
}

class SupabaseTransport {
  static async create() {
    if (!window.supabase) await loadScript(NET_CONFIG.supabaseJs);
    const t = new SupabaseTransport();
    t.client = window.supabase.createClient(NET_CONFIG.supabaseUrl, NET_CONFIG.supabaseAnonKey, {
      realtime: { params: { eventsPerSecond: 20 } },
    });
    try {
      // Без интернета клиент переподключается бесконечно: ждём не дольше 8 с.
      t.lobby = await Promise.race([
        new SupabaseChannel(t.client, 'lobby', t.id, 2).joined,
        new Promise((_, fail) => setTimeout(() => fail(new Error('Supabase: timeout')), 8000)),
      ]);
    } catch (e) {
      t.client.removeAllChannels();
      t.client.realtime.disconnect();
      throw e;
    }
    return t;
  }

  constructor() {
    this.kind = 'supabase';
    this.rate = 10;
    this.id = randomId();
  }

  join(name) { return new SupabaseChannel(this.client, name, this.id, this.rate).joined; }
  connected() { return true; }
}

// Лучший доступный транспорт: комнаты claude.ai → Supabase → вкладки браузера.
export async function connectTransport() {
  if (window.claude && typeof window.claude.use === 'function') {
    try {
      const room = await window.claude.use('room');
      if (room) return new RoomTransport(room);
    } catch (e) { /* нет комнат — пробуем дальше */ }
  }
  const server = !!(NET_CONFIG.supabaseUrl && NET_CONFIG.supabaseAnonKey);
  if (server && navigator.onLine !== false) {
    try {
      return await SupabaseTransport.create();
    } catch (e) {
      console.warn('Supabase недоступен:', e);
    }
  }
  if (typeof BroadcastChannel === 'function') {
    const t = new LocalTransport();
    // Сервер настроен, но до него не достучались: скорее всего, нет интернета.
    t.fallback = server;
    return t;
  }
  return null;
}

// Может ли транспорт свести с живыми людьми не на этом компьютере.
export const isRealNetwork = (t) => !!t && t.kind !== 'local';
