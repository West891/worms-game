// Сетевые сессии одной партии. Обмен идёт только через состояние участника
// канала (presence): хост держит в нём настройку партии и свежий снимок,
// гость — свой ввод и подтверждения. Всё отправляется целиком, поэтому
// пропущенное обновление ничего не ломает.
import { buildSnapshot, applySnapshot, replayEvent } from './sync.js';

const MAX_PRESENCE = 3800; // запас до 4 КиБ, которые даёт комната claude.ai
const PEER_TIMEOUT = 5000;

export class HostSession {
  constructor(channel, game, rate, onPeerLost) {
    this.ch = channel;
    this.game = game;
    this.every = Math.max(1, Math.round(60 / rate));
    this.onPeerLost = onPeerLost;
    this.frame = 0;
    this.lastInputSeq = 0;
    this.ackEv = 0;
    this.ackCarve = 0;
    this.guestSeen = performance.now();
    this.lost = false;
    game.net = this;
    channel.setPresence({ setup: game.setup });
  }

  tick() {
    const now = performance.now();
    const guest = this.ch.peers().find((p) => !p.isMe && p.presence && p.presence.in);
    if (guest) {
      this.guestSeen = now;
      this.readInput(guest.presence.in);
    } else if (!this.lost && now - this.guestSeen > PEER_TIMEOUT) {
      this.lost = true;
      this.onPeerLost();
    }
    if (++this.frame % this.every) return;
    this.ch.setPresence({ s: this.pack() });
  }

  readInput(inp) {
    if (!inp || typeof inp !== 'object') return;
    const h = typeof inp.h === 'string' ? inp.h : '';
    this.game.remote.held = { l: h.includes('l'), r: h.includes('r'), u: h.includes('u'), d: h.includes('d') };
    if (Array.isArray(inp.ev)) {
      for (const ev of inp.ev) {
        if (!Array.isArray(ev) || !(ev[0] > this.lastInputSeq)) continue;
        this.lastInputSeq = ev[0];
        this.game.remote.queue.push(ev.slice(1));
      }
    }
    if (inp.ack > this.ackEv) this.ackEv = inp.ack;
    if (inp.cc > this.ackCarve) this.ackCarve = Math.min(inp.cc, this.game.carves.length);
  }

  pack() {
    const g = this.game;
    const s = buildSnapshot(g);
    s.ia = this.lastInputSeq;
    let carveCap = 25;
    let evCap = 30;
    for (;;) {
      s.cc0 = this.ackCarve;
      s.cv = g.carves.slice(this.ackCarve, this.ackCarve + carveCap);
      s.ev = g.log.filter((e) => e[0] > this.ackEv).slice(0, evCap);
      const size = JSON.stringify(s).length + JSON.stringify(g.setup).length;
      if (size <= MAX_PRESENCE || (evCap === 0 && carveCap <= 2)) break;
      if (evCap > 0) evCap = Math.floor(evCap / 2);
      else carveCap = Math.max(2, Math.floor(carveCap / 2));
    }
    return s;
  }

  leave() { return this.ch.leave(); }
}

export class GuestSession {
  constructor(channel, game, rate, onPeerLost) {
    this.ch = channel;
    this.game = game;
    this.every = Math.max(1, Math.round(60 / rate));
    this.onPeerLost = onPeerLost;
    this.frame = 0;
    this.seq = 0;
    this.out = [];
    this.held = '';
    this.ackHost = 0;
    this.cc = 0;
    this.lastT = -1;
    this.lastS = null;
    this.hostSeen = performance.now();
    this.lost = false;
    this.dirty = true;
    game.net = this;
  }

  send(ev) {
    this.out.push([++this.seq, ...ev]);
    if (this.out.length > 40) this.out.splice(0, this.out.length - 40);
    this.dirty = true;
  }

  tick() {
    const now = performance.now();
    const host = this.ch.peers().find((p) => !p.isMe && p.presence && p.presence.s);
    if (host) {
      this.hostSeen = now;
      if (host.presence.s !== this.lastS) {
        this.lastS = host.presence.s;
        this.receive(host.presence.s);
      }
    } else if (!this.lost && now - this.hostSeen > PEER_TIMEOUT) {
      this.lost = true;
      this.onPeerLost();
    }
    if (++this.frame % this.every) return;
    const inp = { h: this.held, ev: this.out.slice(-20), ack: this.ackHost, cc: this.cc };
    const key = JSON.stringify(inp);
    if (key !== this.lastSent || this.frame % (this.every * 15) === 0) {
      this.lastSent = key;
      this.ch.setPresence({ in: inp });
    }
  }

  receive(s) {
    if (!s || typeof s !== 'object' || !(s.t > this.lastT)) return;
    this.lastT = s.t;
    const g = this.game;
    if (Array.isArray(s.cv) && s.cc0 <= this.cc) {
      s.cv.forEach((c, i) => {
        if (s.cc0 + i !== this.cc || !Array.isArray(c)) return;
        g.terrain.carve(+c[0], +c[1], Math.min(120, +c[2] || 0));
        this.cc++;
      });
    }
    if (Array.isArray(s.ev)) {
      for (const e of s.ev) {
        if (!Array.isArray(e) || !(e[0] > this.ackHost)) continue;
        this.ackHost = e[0];
        try { replayEvent(g, e); } catch (err) { console.warn('Событие не воспроизведено', e, err); }
      }
    }
    if (s.ia) this.out = this.out.filter((e) => e[0] > s.ia);
    applySnapshot(g, s);
  }

  leave() { return this.ch.leave(); }
}
