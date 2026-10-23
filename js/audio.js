// Звук через Web Audio. Семплы Kenney дополняются синтезом: каждый эффект
// собирается из нескольких слоёв, проходит через панораму, общий компрессор
// и немного реверберации. Голоса червяков — отдельная шина.
const SOUNDS = [
  'explosion', 'fire', 'shotgun', 'select', 'jump', 'backflip', 'land', 'hurt', 'throw',
  'walk', 'pickup', 'break', 'impact', 'click', 'tick', 'teleport',
  'baa', 'heehaw', 'hallelujah', 'meteor', 'bats', 'quake', 'liftoff',
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const VOICE_CACHE = 60;

class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = {};
    this.voices = null; // { banks: { a: { hurt: [AudioBuffer…] } } }
    this.muted = false;
    this.voicesOn = true;
    this.ambience = null;
    this.lastPlay = {};
    this.currentVoice = null;
  }

  async init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    this.master.connect(comp).connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.voiceBus = ctx.createGain();
    this.voiceBus.gain.value = 1.1;
    this.voiceBus.connect(this.master);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(1.6, 2.8);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.22;
    this.reverbSend.connect(this.reverb).connect(this.master);

    this.noiseBuf = this.makeNoise(2);
    await Promise.all(SOUNDS.map((name) => this.load(name, `assets/sfx/${name}.mp3`)));
    this.loadVoices();
  }

  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  makeImpulse(seconds, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  async fetchBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    const data = await res.arrayBuffer();
    return new Promise((ok, fail) => this.ctx.decodeAudioData(data, ok, fail));
  }

  async load(name, url) {
    try {
      this.buffers[name] = await this.fetchBuffer(url);
    } catch (e) {
      console.warn('Звук не загружен:', url, e);
    }
  }

  // Голоса необязательны: если манифеста нет, игра просто молчит.
  // Файлы реплик грузятся и распаковываются по мере надобности — так меньше
  // памяти на телефонах; распакованных держим не больше VOICE_CACHE.
  async loadVoices() {
    try {
      const res = await fetch('assets/voice/manifest.json');
      if (!res.ok) return;
      const manifest = await res.json();
      this.voices = { banks: manifest.banks || {} };
    } catch (e) {
      /* без голосов */
    }
  }

  voiceBuffer(file) {
    const cache = (this.voiceCache = this.voiceCache || new Map());
    if (cache.has(file)) {
      const hit = cache.get(file);
      cache.delete(file);
      cache.set(file, hit);
      return hit;
    }
    const p = this.fetchBuffer(`assets/voice/${file}`).catch(() => null);
    cache.set(file, p);
    while (cache.size > VOICE_CACHE) cache.delete(cache.keys().next().value);
    return p;
  }

  // Заранее подгрузить частые реплики, пока игрок смотрит на меню.
  preloadVoices(categories) {
    if (!this.voices) return;
    for (const bank of Object.values(this.voices.banks)) {
      for (const cat of categories) for (const f of bank[cat] || []) this.voiceBuffer(f);
    }
  }

  get hasVoices() { return !!this.voices; }

  unlock() {
    if (this.ctx && this.ctx.state !== 'running' && !this.paused) this.ctx.resume();
    if (this.paused) return;
    for (const l of [...(this.ambience || []), this.menuTrack]) if (l && l.el && l.el.paused) l.el.play().catch(() => {});
  }

  get ready() { return this.ctx && !this.muted; }
  get now() { return this.ctx.currentTime; }

  // Выход эффекта: панорама → шина эффектов (+ посыл на реверберацию).
  out(pan = 0, vol = 1, wet = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = vol;
    let node = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p);
      node = p;
    }
    node.connect(this.sfxBus);
    if (wet > 0) {
      const s = ctx.createGain();
      s.gain.value = wet;
      node.connect(s).connect(this.reverbSend);
    }
    return g;
  }

  play(name, { vol = 1, rate = 1, pan = 0, minGap = 0.03, wet = 0.5, delay = 0 } = {}) {
    if (!this.ready || !this.buffers[name]) return null;
    const now = this.now;
    if (this.lastPlay[name] && now - this.lastPlay[name] < minGap) return null;
    this.lastPlay[name] = now;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers[name];
    src.playbackRate.value = rate;
    src.connect(this.out(pan, vol, wet));
    src.start(now + delay);
    return src;
  }

  // --- Строительные блоки синтеза -------------------------------------

  noiseSrc(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    return src;
  }

  env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone(type, f0, f1, t, dur, vol, dest, attack = 0.005) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, attack, vol, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }

  filteredNoise(t, dur, vol, dest, { type = 'lowpass', f0 = 1000, f1 = f0, q = 0.7, attack = 0.004 } = {}) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = this.ctx.createGain();
    this.env(g, t, attack, vol, dur);
    this.noiseSrc(t, attack + dur).connect(f).connect(g).connect(dest);
  }

  // --- Эффекты --------------------------------------------------------

  // Взрыв: удар низкого тона, грохот шума и треск, масштабируются размером.
  boom(size = 1, pan = 0) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.out(pan, 1, 0.9);
    const s = clamp(size, 0.3, 2);
    this.tone('sine', 150 * (1.3 - s * 0.25), 32, t, 0.35 + s * 0.35, 0.9 * Math.min(1, s), out);
    this.tone('triangle', 80, 28, t, 0.25 + s * 0.2, 0.5, out);
    this.filteredNoise(t, 0.5 + s * 0.9, 0.7 * Math.min(1, s + 0.2), out, { f0: 2400, f1: 120, q: 0.4 });
    this.filteredNoise(t, 0.12, 0.5, out, { type: 'highpass', f0: 2500, q: 0.5 });
    for (let i = 0; i < 4 + s * 6; i++) {
      this.filteredNoise(t + 0.08 + Math.random() * 0.5 * s, 0.05, 0.12 + Math.random() * 0.15, out,
        { type: 'bandpass', f0: 800 + Math.random() * 2500, q: 3 });
    }
    this.play('explosion', { vol: 0.35 + s * 0.25, rate: 1.15 - s * 0.25, pan, minGap: 0.02 });
  }

  // Свист рассекаемого воздуха.
  whoosh(dur = 0.4, pan = 0, vol = 0.4, up = false) {
    if (!this.ready) return;
    const t = this.now;
    const [a, b] = up ? [500, 3000] : [3000, 400];
    this.filteredNoise(t, dur, vol, this.out(pan, 1, 0.3), { type: 'bandpass', f0: a, f1: b, q: 1.2, attack: dur * 0.3 });
  }

  launch(pan = 0) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.out(pan, 1, 0.5);
    this.tone('sine', 90, 45, t, 0.25, 0.7, out);
    this.filteredNoise(t, 0.45, 0.5, out, { type: 'bandpass', f0: 600, f1: 2600, q: 0.8 });
    this.play('fire', { vol: 0.35, rate: 1.3, pan });
  }

  shotgunBlast(pan = 0) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.out(pan, 1, 0.8);
    this.tone('sine', 120, 40, t, 0.22, 0.9, out);
    this.filteredNoise(t, 0.25, 0.9, out, { f0: 6000, f1: 400, q: 0.3 });
    this.filteredNoise(t, 0.04, 0.6, out, { type: 'highpass', f0: 3000 });
    // Перезарядка: два щелчка помпы.
    for (const dt of [0.42, 0.55]) {
      this.filteredNoise(t + dt, 0.03, 0.35, out, { type: 'bandpass', f0: 2200, q: 4 });
      this.tone('square', 900, 700, t + dt, 0.02, 0.06, out);
    }
  }

  tonk(pan = 0, vol = 0.35) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.out(pan, 1, 0.3);
    const f = 420 + Math.random() * 120;
    this.tone('sine', f, f * 0.92, t, 0.12, vol, out);
    this.tone('triangle', f * 2.7, f * 2.5, t, 0.05, vol * 0.4, out);
    this.filteredNoise(t, 0.02, vol * 0.5, out, { type: 'highpass', f0: 2000 });
  }

  boing(pan = 0, back = false) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.out(pan, 1, 0.2);
    const o = this.tone('triangle', back ? 260 : 200, back ? 900 : 620, t, 0.22, 0.18, out);
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 28;
    lg.gain.value = 25;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + 0.3);
  }

  whack(pan = 0) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.out(pan, 1, 0.6);
    this.tone('sine', 220, 60, t, 0.18, 0.9, out);
    this.filteredNoise(t, 0.08, 0.8, out, { type: 'bandpass', f0: 1400, q: 1.5 });
    this.play('impact', { vol: 0.8, pan });
  }

  splash(size = 1, pan = 0) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.out(pan, 1, 0.6);
    this.filteredNoise(t, 0.35 + size * 0.5, 0.6 * size, out, { f0: 3500, f1: 300, q: 0.6, attack: 0.01 });
    this.tone('sine', 160, 60, t, 0.15, 0.4 * size, out);
    // Пузырьки.
    for (let i = 0; i < 6 + size * 6; i++) {
      const bt = t + 0.15 + Math.random() * (0.6 + size * 0.4);
      const f = 500 + Math.random() * 900;
      this.tone('sine', f, f * 1.8, bt, 0.05 + Math.random() * 0.05, 0.05 + Math.random() * 0.08, out);
    }
  }

  chime(notes = [660, 880, 1320], pan = 0, step = 0.08, vol = 0.18, type = 'triangle') {
    if (!this.ready) return;
    const t = this.now;
    const out = this.out(pan, 1, 0.7);
    notes.forEach((f, i) => {
      this.tone(type, f, f, t + i * step, 0.35, vol, out);
      this.tone('sine', f * 2, f * 2, t + i * step, 0.2, vol * 0.3, out);
    });
  }

  fanfare() {
    this.chime([523, 659, 784, 1047, 784, 1047], 0, 0.13, 0.22, 'square');
    if (!this.ready) return;
    const t = this.now + 0.8;
    const out = this.out(0, 1, 0.8);
    for (const f of [523, 659, 784, 1047]) this.tone('sawtooth', f, f, t, 1.2, 0.05, out, 0.03);
  }

  // Нисходящий «свисток» — классика комедийного падения.
  slideWhistle(pan = 0, up = false) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.out(pan, 1, 0.5);
    const o = this.tone('sine', up ? 500 : 1800, up ? 1800 : 300, t, 0.9, 0.16, out, 0.05);
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = 18;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + 1);
  }

  teleportSweep(pan = 0) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.out(pan, 1, 0.9);
    for (let i = 0; i < 3; i++) this.tone('sine', 300 * (i + 1), 2400 * (i + 1), t + i * 0.04, 0.5, 0.08, out);
    this.play('teleport', { vol: 0.5, pan });
  }

  // Пролёт самолёта: шум с доплеровским спадом и проходом по панораме.
  jet(dir = 1) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t = this.now;
    const dur = 2.4;
    const g = ctx.createGain();
    this.env(g, t, dur * 0.45, 0.55, dur * 0.55);
    let node = g;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(-dir, t);
      p.pan.linearRampToValueAtTime(dir, t + dur);
      g.connect(p);
      node = p;
    }
    node.connect(this.sfxBus);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(500, t + dur);
    this.noiseSrc(t, dur).connect(f).connect(g);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(120, t + dur);
    const og = ctx.createGain();
    og.gain.value = 0.08;
    o.connect(og).connect(g);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  woodblock(high = false) {
    if (!this.ready) return;
    const t = this.now;
    const out = this.out(0, 1, 0.2);
    const f = high ? 1500 : 1100;
    this.tone('sine', f, f * 0.9, t, 0.06, 0.25, out, 0.002);
    this.filteredNoise(t, 0.02, 0.15, out, { type: 'bandpass', f0: f * 2, q: 5 });
  }

  turnChime(pan = 0) { this.chime([587, 880], pan, 0.11, 0.14); }

  beep(freq = 880, duration = 0.08, vol = 0.15, type = 'square', pan = 0) {
    if (!this.ready) return;
    this.tone(type, freq, freq, this.now, duration, vol, this.out(pan, 1, 0.2), 0.002);
  }

  // Бесконечный звук, пока жив объект (шипение фитиля, рёв ракеты).
  loop(kind, pan = 0) {
    if (!this.ready) return null;
    const ctx = this.ctx;
    const t = this.now;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(kind === 'fuse' ? 0.12 : kind === 'drill' ? 0.16 : 0.22, t + 0.08);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = clamp(pan, -1, 1); g.connect(p).connect(this.sfxBus); } else g.connect(this.sfxBus);
    const f = ctx.createBiquadFilter();
    const nodes = [];
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.start(t);
    nodes.push(src);
    if (kind === 'drill') {
      // Гудение лазера: пила с биением и шипение прожигаемой земли.
      f.type = 'bandpass';
      f.frequency.value = 2400;
      f.Q.value = 1.4;
      for (const [freq, vol] of [[180, 0.08], [184, 0.08], [360, 0.03]]) {
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        og.gain.value = vol;
        o.connect(og).connect(g);
        o.start(t);
        nodes.push(o);
      }
    } else if (kind === 'fuse') {
      f.type = 'highpass';
      f.frequency.value = 4000;
      // Потрескивание фитиля.
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.type = 'square';
      lfo.frequency.value = 13;
      lg.gain.value = 0.05;
      lfo.connect(lg).connect(g.gain);
      lfo.start(t);
      nodes.push(lfo);
    } else {
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 0.9;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 95;
      const og = ctx.createGain();
      og.gain.value = 0.15;
      o.connect(og).connect(g);
      o.start(t);
      nodes.push(o);
    }
    src.connect(f).connect(g);
    return {
      setPan(v) { if (p) p.pan.value = clamp(v, -1, 1); },
      setPitch(v) { f.frequency.value = (kind === 'fuse' ? 4000 : kind === 'drill' ? 2400 : 900) * v; },
      stop: () => {
        const now = ctx.currentTime;
        g.gain.cancelScheduledValues(now);
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
        for (const n of nodes) n.stop(now + 0.1);
      },
    };
  }

  // --- Голоса ---------------------------------------------------------

  // Произносит случайную реплику категории. Важные реплики перебивают текущую.
  say(bank, category, { pan = 0, rate = 1, priority = 1 } = {}) {
    if (!this.ready || !this.voicesOn || !this.voices) return false;
    const list = this.voices.banks[bank] && this.voices.banks[bank][category];
    if (!list || !list.length) return false;
    const cur = this.currentVoice;
    if (cur && cur.end > this.now) {
      if (priority <= cur.priority) return false;
      cur.cancelled = true;
      if (cur.src) { try { cur.src.stop(); } catch (e) { /* уже остановлен */ } }
    }
    const file = list[Math.floor(Math.random() * list.length)];
    // Пока файл грузится, место занято: реплика с тем же приоритетом не перебьёт.
    const voice = { priority, end: this.now + 1.5, src: null };
    this.currentVoice = voice;
    Promise.resolve(this.voiceBuffer(file)).then((buf) => {
      if (!buf || voice.cancelled || this.currentVoice !== voice || this.now > voice.end) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = this.ctx.createGain();
      let node = g;
      if (this.ctx.createStereoPanner) {
        const p = this.ctx.createStereoPanner();
        p.pan.value = clamp(pan * 0.7, -1, 1);
        g.connect(p);
        node = p;
      }
      node.connect(this.voiceBus);
      const send = this.ctx.createGain();
      send.gain.value = 0.25;
      node.connect(send).connect(this.reverbSend);
      src.connect(g);
      src.start();
      voice.src = src;
      voice.end = this.now + buf.duration / rate;
    });
    return true;
  }

  // Фон карты: петля атмосферы (короткая, держим в памяти) и музыка.
  // Музыку играем потоком через <audio>: распакованный трек занял бы десятки мегабайт.
  async startAmbience(mapKey, musicKey) {
    if (!this.ctx) return;
    this.stopAmbience();
    const token = (this.ambienceToken = {});
    this.ambience = [];
    const fadeIn = (g, vol) => {
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 2);
    };
    const key = 'amb-' + mapKey;
    for (const k of Object.keys(this.buffers)) if (k.startsWith('amb-') && k !== key) delete this.buffers[k];
    if (!this.buffers[key]) await this.load(key, `assets/ambience/${mapKey}.mp3`);
    if (this.ambienceToken !== token) return;
    if (this.buffers[key]) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers[key];
      src.loop = true;
      const g = this.ctx.createGain();
      fadeIn(g, 0.32);
      src.connect(g).connect(this.master);
      src.start();
      this.ambience.push({ src, g });
    }
    if (this.musicOn !== false && musicKey) {
      const track = this.streamTrack(`assets/music/${musicKey}.mp3`, 0.16, () => this.ambienceToken === token);
      if (track) this.ambience.push(track);
    }
  }

  // Музыкальный трек потоком через <audio> с плавным появлением.
  // alive() — ещё нужен ли трек (для запасной загрузки через blob:).
  streamTrack(url, vol, alive = () => true) {
    try {
      const el = new Audio();
      el.loop = true;
      el.preload = 'auto';
      this.trackSource(url).then((src) => {
        if (!alive()) { if (src.startsWith('blob:')) URL.revokeObjectURL(src); return; }
        el.src = src;
        if (!this.paused && !document.hidden) el.play().catch(() => {});
      });
      // Если хостинг не отдаёт файл тегу <audio>, пробуем через fetch и blob:.
      el.onerror = async () => {
        el.onerror = null;
        try {
          el.src = URL.createObjectURL(await (await fetch(url)).blob());
          if (alive()) el.play().catch(() => {});
        } catch (e) { /* без музыки */ }
      };
      const node = this.ctx.createMediaElementSource(el);
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 2);
      node.connect(g).connect(this.master);
      return { el, g };
    } catch (e) {
      return null;
    }
  }

  // Откуда играть трек. Установленная игра (PWA) хранит музыку в кэше: тогда
  // берём её оттуда, иначе играем из сети и параллельно докачиваем файл целиком
  // через сервис-воркер, чтобы в следующий раз он был и без интернета.
  async trackSource(url) {
    try {
      const hit = window.caches && await caches.match(url, { ignoreSearch: true });
      if (hit) return URL.createObjectURL(await hit.blob());
    } catch (e) { /* кэш недоступен — играем из сети */ }
    if (navigator.serviceWorker && navigator.serviceWorker.controller) fetch(url).catch(() => {});
    return url;
  }

  fadeOutTrack(l, time = 0.6) {
    const t = this.ctx.currentTime;
    l.g.gain.cancelScheduledValues(t);
    l.g.gain.setValueAtTime(Math.max(0.0001, l.g.gain.value), t);
    l.g.gain.exponentialRampToValueAtTime(0.0001, t + time);
    if (l.src) l.src.stop(t + time + 0.1);
    if (l.el) {
      const el = l.el;
      el.onerror = null;
      setTimeout(() => {
        el.pause();
        if (el.src.startsWith('blob:')) URL.revokeObjectURL(el.src);
        el.removeAttribute('src');
        el.load();
      }, time * 1000 + 100);
    }
  }

  // Тема главного меню. Браузер даст включить звук только после касания или клика,
  // поэтому startMenuMusic вызывается и при загрузке, и при каждой разблокировке.
  startMenuMusic() {
    if (!this.ctx || this.menuTrack || this.musicOn === false || this.ctx.state !== 'running') return;
    this.menuTrack = this.streamTrack('assets/music/menu.mp3', 0.22, () => !!this.menuTrack);
  }

  stopMenuMusic() {
    if (!this.menuTrack) return;
    this.fadeOutTrack(this.menuTrack, 1);
    this.menuTrack = null;
  }

  stopAmbience() {
    this.ambienceToken = null;
    if (!this.ambience) return;
    for (const l of this.ambience) this.fadeOutTrack(l);
    this.ambience = null;
  }


  // На паузе и в фоне останавливаем и музыку тоже.
  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    for (const l of [...(this.ambience || []), this.menuTrack]) if (l && l.el) l.el.pause();
  }

  resume() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume();
    for (const l of [...(this.ambience || []), this.menuTrack]) if (l && l.el) l.el.play().catch(() => {});
  }

  // Короткий звуковой клип из банка голосов, не прерывающий реплики червяков.
  clip(bank, category, { pan = 0, vol = 1, rate = 1 } = {}) {
    if (!this.ready || !this.voices) return;
    const list = this.voices.banks[bank] && this.voices.banks[bank][category];
    if (!list || !list.length) return;
    Promise.resolve(this.voiceBuffer(list[Math.floor(Math.random() * list.length)])).then((buf) => {
      if (!buf) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      src.connect(this.out(pan, vol, 0.4));
      src.start();
    });
  }

  // Хор: аккорд из «голосов» с фильтром гласной «а», на случай если семпла нет.
  choir(pan = 0) {
    if (!this.ready) return;
    if (this.buffers.hallelujah) { this.play('hallelujah', { vol: 0.9, pan }); return; }
    const t = this.now;
    const out = this.out(pan, 1, 1);
    for (const f of [261.6, 329.6, 392, 523.3]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 800;
      flt.Q.value = 3;
      const g = this.ctx.createGain();
      this.env(g, t, 0.3, 0.06, 1.6);
      o.connect(flt).connect(g).connect(out);
      o.start(t);
      o.stop(t + 2.1);
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
    return m;
  }

  toggleMute() { return this.setMuted(!this.muted); }
}

export const audio = new AudioManager();
