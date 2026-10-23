import { TICK, TEAM_DEFS } from './config.js';
import { loadAssets } from './assets.js';
import { audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Game } from './game.js';
import { Online, randomNick } from './net/online.js';
import { QUALITY, DEVICE, setQualityMode, trackFrame, isTouchDevice } from './quality.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
let ui = null;
let assets = null;
let game = null;
let lastSettings = null;
// local — на одном устройстве, bot — «онлайн» против подставного бота,
// match — найденный соперник, friend — комната с другом.
let playMode = 'local';
let online = null;

const SETTINGS_KEY = 'worms-settings-v1';

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, QUALITY.dprCap);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  return dpr;
}
const touch = isTouchDevice();
setQualityMode('auto');
let dpr = resize();
window.addEventListener('resize', () => { dpr = resize(); });
window.addEventListener('orientationchange', () => setTimeout(() => { dpr = resize(); }, 200));

// --- Меню -------------------------------------------------------------

function buildTeamRows() {
  const box = $('#menu-teams');
  box.innerHTML = '';
  TEAM_DEFS.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'team-row';
    row.innerHTML = `
      <label class="team-toggle">
        <input type="checkbox" data-team="${i}" ${i < 2 ? 'checked' : ''} ${i < 2 ? 'disabled' : ''}>
        <span class="swatch" style="background:${t.color}"></span>
        <span class="team-name">${t.name}</span>
      </label>
      <select data-control="${i}">
        <option value="human">Игрок</option>
        <option value="ai" ${i > 0 ? 'selected' : ''}>Компьютер</option>
      </select>`;
    box.appendChild(row);
  });
}

function readSettings() {
  const teams = [];
  TEAM_DEFS.forEach((t, i) => {
    const on = $(`[data-team="${i}"]`).checked;
    if (on) teams.push({ ...t, ai: $(`[data-control="${i}"]`).value === 'ai' });
  });
  return {
    teams,
    wormsPerTeam: +$('#opt-worms').value,
    difficulty: $('#opt-difficulty').value,
    theme: $('#opt-theme').value,
    turnTime: +$('#opt-time').value,
    mines: +$('#opt-mines').value,
    voices: $('#opt-voices').value === 'on',
    music: $('#opt-music').value === 'on',
    barrels: +$('#opt-barrels').value,
    suddenDeath: +$('#opt-sudden').value,
    nick: $('#opt-nick').value.trim() || randomNick(),
    quality: $('#opt-quality').value,
    liveBg: $('#opt-livebg').value,
  };
}

function saveSettings(s) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      teams: s.teams.map((t) => ({ name: t.name, ai: t.ai })),
      wormsPerTeam: s.wormsPerTeam, difficulty: s.difficulty, theme: s.theme, turnTime: s.turnTime, mines: s.mines,
      voices: s.voices, nick: s.nick, music: s.music, barrels: s.barrels, suddenDeath: s.suddenDeath, quality: s.quality,
      liveBg: s.liveBg,
    }));
  } catch (e) { /* хранилище недоступно — не страшно */ }
}

function restoreSettings() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)); } catch (e) { s = null; }
  if (!s) return;
  TEAM_DEFS.forEach((t, i) => {
    const saved = s.teams && s.teams.find((x) => x.name === t.name);
    if (i >= 2) $(`[data-team="${i}"]`).checked = !!saved;
    if (saved) $(`[data-control="${i}"]`).value = saved.ai ? 'ai' : 'human';
  });
  for (const [id, key] of [['#opt-worms', 'wormsPerTeam'], ['#opt-difficulty', 'difficulty'], ['#opt-theme', 'theme'], ['#opt-time', 'turnTime'], ['#opt-mines', 'mines'], ['#opt-barrels', 'barrels'], ['#opt-sudden', 'suddenDeath']]) {
    if (s[key] !== undefined) $(id).value = String(s[key]);
  }
  if (s.voices !== undefined) $('#opt-voices').value = s.voices ? 'on' : 'off';
  if (s.nick) $('#opt-nick').value = s.nick;
  if (s.music !== undefined) $('#opt-music').value = s.music ? 'on' : 'off';
  if (s.quality) $('#opt-quality').value = s.quality;
  if (s.liveBg) $('#opt-livebg').value = s.liveBg;
}

function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) el.classList.add('hidden');
  if (id) $(id).classList.remove('hidden');
}

function startGame(settings, mode = 'local', afterCreate = null) {
  document.body.classList.add('playing');
  updateLiveBackground();
  audio.unlock();
  const prefs = readSettings();
  audio.voicesOn = prefs.voices;
  audio.musicOn = prefs.music;
  audio.stopMenuMusic();
  audio.paused = false;
  audio.resume();
  setQualityMode(prefs.quality);
  dpr = resize();
  requestWakeLock();
  if (touch && window.innerHeight > window.innerWidth && window.innerWidth < 600 && !portraitHintShown) {
    portraitHintShown = true;
    setTimeout(() => ui.toast('Поверните телефон — так удобнее играть'), 2500);
  }
  if (game) game.stopLoops();
  if (mode === 'local') lastSettings = settings;
  playMode = mode;
  $('#btn-again').textContent = mode === 'local' ? 'Ещё раз' : 'Найти нового соперника';
  $('#btn-again').classList.toggle('hidden', mode === 'friend');
  showScreen('#generating');
  // Даём браузеру отрисовать надпись перед генерацией ландшафта.
  setTimeout(() => {
    game = new Game(settings, assets, ui);
    if (afterCreate) afterCreate(game);
    const map = game.terrain.theme;
    audio.startAmbience(map.ambience, map.music);
    ui.attach(game);
    showScreen(null);
  }, 30);
}

function toMenu() {
  document.body.classList.remove('playing');
  // Вышли из паузы в меню — звук снова включён.
  audio.paused = false;
  audio.resume();
  updateLiveBackground();
  releaseWakeLock();
  if (game) game.stopLoops();
  audio.stopAmbience();
  game = null;
  if (online) online.cancel();
  playMode = 'local';
  ui.hideHud();
  showScreen('#menu');
}

// В сетевой игре пауза только показывает меню: соперник продолжает играть.
function setPaused(p) {
  if (!game || game.over) return;
  if (playMode === 'local') {
    game.paused = p;
    audio.paused = p;
    if (p) audio.suspend(); else audio.resume();
  }
  $('#pause-note').classList.toggle('hidden', playMode === 'local');
  if (p) showScreen('#pause'); else showScreen(null);
}

function findMatch() {
  const s = readSettings();
  saveSettings(s);
  audio.unlock();
  online.findMatch(s.nick);
}

const onlineHooks = {
  startHost(opts, makeSession, kind) {
    startGame(opts, kind, makeSession);
  },
  startGuest(opts, makeSession, kind) {
    startGame(opts, kind, makeSession);
  },
  startBot(opts) {
    startGame(opts, 'bot');
  },
  peerLost(role) {
    if (!game || game.over) return;
    if (role === 'host') {
      const coop = game.teams.some((t) => t.owner === 'mixed');
      game.convertToAi('guest');
      ui.toast(coop ? 'Друг отключился — его червяками управляет компьютер' : 'Соперник отключился — за него доигрывает компьютер');
    } else {
      game.over = true;
      game.stopLoops();
      ui.showDisconnected();
    }
  },
};

const MUTE_KEY = 'worms-muted';

// Звук выключается и в меню (кнопка в углу), и в игре; выбор запоминается.
function setMuted(m) {
  audio.setMuted(m);
  for (const b of [$('#btn-mute'), $('#btn-menu-mute')]) {
    b.textContent = m ? '🔇' : '🔊';
    b.setAttribute('aria-label', m ? 'Включить звук' : 'Выключить звук');
  }
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { /* без сохранения */ }
}

function toggleMute() { setMuted(!audio.muted); }

// --- Цикл -------------------------------------------------------------

let acc = 0;
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  // Слабое устройство — снижаем качество, мощное — возвращаем.
  if (game && !document.hidden && trackFrame(now - last)) dpr = resize();
  last = now;
  if (online) online.tick();
  if (game) {
    if (input.wasPressed('pause')) setPaused($('#pause').classList.contains('hidden'));
    if (input.wasPressed('mute')) toggleMute();
    input.pressed.delete('pause');
    input.pressed.delete('mute');
    acc += dt;
    let ticks = 0;
    while (acc >= TICK && ticks < 5) {
      game.update(input);
      input.clearEdges();
      acc -= TICK;
      ticks++;
    }
    if (ticks === 5) acc = 0;
    if (game.paused) input.clearEdges();
    game.updateCamera(input, window.innerWidth, window.innerHeight);
    game.render(ctx, window.innerWidth, window.innerHeight, dpr, input);
    ui.frame(game);
  } else {
    input.clearEdges();
    drawMenuBackground();
    // Тема меню: включается, как только браузер разрешил звук.
    if (assets && audio.ctx && audio.ctx.state === 'running' && !document.hidden && !document.body.classList.contains('playing')) {
      audio.startMenuMusic();
    }
  }
  input.clearFrame();
  requestAnimationFrame(frame);
}

// В меню холст прозрачный: под ним видна заставка (#splash в CSS).
function drawMenuBackground() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// --- Запуск -----------------------------------------------------------

async function boot() {
  buildTeamRows();
  restoreSettings();
  requestAnimationFrame(frame);
  const bar = $('#loading-bar');
  try {
    const audioReady = audio.init();
    assets = await loadAssets((p) => { bar.style.width = `${Math.round(p * 80)}%`; });
    await document.fonts.load('800 16px Rubik').catch(() => {});
    await audioReady;
    bar.style.width = '100%';
  } catch (e) {
    $('#loading-text').textContent = 'Ошибка загрузки: ' + e.message + '. Запустите игру через локальный сервер (см. README).';
    return;
  }
  ui = new UI();
  ui.onFuseClick = (n) => {
    if (!game || !game.isMyTurn) return;
    game.pendingFuse = n;
  };
  ui.onWeaponClick = (id) => {
    if (!game || !game.isMyTurn) return;
    audio.unlock();
    game.pendingWeapon = id;
  };

  if (touch) document.body.classList.add('touch');
  input.haptics = DEVICE.haptics = touch && !!navigator.vibrate;
  // Тап по полю закрывает сетку оружия.
  canvas.addEventListener('pointerdown', () => $('#bottom').classList.remove('open'));

  // Полный экран (где разрешён) и поворот в альбомную ориентацию.
  if (touch && document.fullscreenEnabled && !installedApp()) {
    $('#btn-fullscreen').classList.remove('hidden');
    $('#btn-fullscreen').addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else {
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        }
      } catch (e) { /* не разрешили — играем как есть */ }
    });
  }

  // Звук на телефонах включается только после касания; ловим любое.
  for (const ev of ['pointerup', 'touchend', 'click', 'keydown']) {
    document.addEventListener(ev, () => audio.unlock(), { passive: true });
  }
  // Свернули вкладку — глушим звук и не тратим батарею.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.suspend();
    else if (!audio.paused) audio.resume();
    if (!document.hidden && game) requestWakeLock();
  });
  for (const btn of document.querySelectorAll('[data-act]')) input.bindButton(btn, btn.dataset.act);

  $('#btn-start').addEventListener('click', () => {
    const s = readSettings();
    saveSettings(s);
    startGame(s);
  });
  $('#btn-resume').addEventListener('click', () => setPaused(false));
  $('#btn-quit').addEventListener('click', toMenu);
  $('#btn-again').addEventListener('click', () => {
    if (playMode === 'local') startGame(lastSettings);
    else { game = null; ui.hideHud(); document.body.classList.remove('playing'); updateLiveBackground(); findMatch(); }
  });
  $('#btn-menu').addEventListener('click', toMenu);
  $('#btn-pause').addEventListener('click', () => setPaused(true));
  $('#btn-mute').addEventListener('click', toggleMute);
  $('#btn-menu-mute').addEventListener('click', toggleMute);
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* по умолчанию со звуком */ }
  setMuted(muted);
  // M работает и в меню, если фокус не в поле ввода.
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyM' || game || e.repeat || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    toggleMute();
  });
  $('#opt-livebg').addEventListener('change', () => { saveSettings(readSettings()); updateLiveBackground(); });
  audio.musicOn = readSettings().music;
  $('#opt-music').addEventListener('change', () => {
    const s = readSettings();
    saveSettings(s);
    audio.musicOn = s.music;
    if (!s.music) audio.stopMenuMusic();
  });
  updateLiveBackground();

  // Частые реплики подгружаем заранее, пока игрок в меню.
  setTimeout(() => audio.preloadVoices(['turn', 'hurt', 'fire', 'fly']), 3000);

  // Вкладки меню.
  const setTab = (name) => {
    for (const b of document.querySelectorAll('[data-tab]')) b.classList.toggle('active', b.dataset.tab === name);
    $('#pane-online').classList.toggle('hidden', name !== 'online');
    $('#pane-local').classList.toggle('hidden', name !== 'local');
  };
  for (const b of document.querySelectorAll('[data-tab]')) b.addEventListener('click', () => setTab(b.dataset.tab));

  // Онлайн.
  online = new Online(onlineHooks);
  if (!$('#opt-nick').value) $('#opt-nick').value = randomNick();
  $('#btn-find').addEventListener('click', findMatch);
  $('#btn-create').addEventListener('click', () => {
    const s = readSettings();
    saveSettings(s);
    audio.unlock();
    online.createRoom(s.nick, $('#opt-friend-mode').value);
  });
  $('#btn-join').addEventListener('click', () => {
    const s = readSettings();
    saveSettings(s);
    audio.unlock();
    online.joinRoom(s.nick, $('#opt-code').value);
  });
  $('#opt-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-join').click(); });
  $('#net-start').addEventListener('click', () => online.startFromRoom(readSettings()));
  $('#net-cancel').addEventListener('click', () => { online.cancel(); showScreen('#menu'); });
  $('#net-copy').addEventListener('click', () => {
    const code = $('#net-code').textContent;
    const done = () => { $('#net-copy').textContent = 'Скопировано'; setTimeout(() => { $('#net-copy').textContent = 'Скопировать'; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, () => {});
  });
  const showNetKind = (t) => {
    const kind = t ? t.kind : null;
    $('#net-kind').textContent = t && t.fallback
      ? 'Нет связи с сервером — похоже, нет интернета. Играть с компьютером можно на вкладке «На одном устройстве».'
      : {
        claude: 'Играть могут все, кому открыт доступ к этой игре в claude.ai.',
        supabase: 'Игра через интернет.',
        local: 'Сервер для игры через интернет не настроен: соперники ищутся только в других вкладках этого браузера.',
      }[kind] || 'Сетевая игра здесь недоступна.';
  };
  online.ensure().then(showNetKind);
  window.addEventListener('online', () => {
    $('#net-kind').textContent = 'Проверяем сеть…';
    online.ensure().then(showNetKind);
  });
  const hash = (location.hash || '').slice(1);
  if (/^[a-z0-9]{6}$/i.test(hash)) {
    $('#opt-code').value = hash.toUpperCase();
    setTab('online');
  } else {
    setTab('online');
  }

  showScreen('#menu');
}

// Живой фон меню: зацикленное видео поверх статичной заставки.
// «Авто» — только на компьютере, без экономии трафика и без «уменьшить движение».
// Во время партии видео выгружается, чтобы не занимать память.
// WebM (VP9) легче, MP4 (H.264) — для Safari.
const LIVE_BG_SRC = document.createElement('video').canPlayType('video/webm; codecs="vp9"')
  ? 'assets/video/splash-loop.webm'
  : 'assets/video/splash-loop.mp4';
let liveBgBlob = null;
function liveBackgroundWanted() {
  const pref = $('#opt-livebg').value;
  if (pref === 'off') return false;
  if (pref === 'on') return true;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  return !touch && !reduced && !saveData;
}

function updateLiveBackground() {
  const video = $('#splash-video');
  const on = liveBackgroundWanted() && !document.body.classList.contains('playing');
  $('#splash').classList.toggle('live', on);
  if (!on) {
    video.classList.remove('ready');
    if (video.getAttribute('src')) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    return;
  }
  if (video.getAttribute('src')) { video.play().catch(() => {}); return; }
  video.onplaying = () => video.classList.add('ready');
  // Если хостинг не отдаёт видео напрямую, пробуем через fetch и blob:, иначе остаётся картинка.
  video.onerror = async () => {
    video.onerror = () => { video.removeAttribute('src'); $('#splash').classList.remove('live'); };
    try {
      if (!liveBgBlob) liveBgBlob = URL.createObjectURL(await (await fetch(LIVE_BG_SRC)).blob());
      video.src = liveBgBlob;
      video.play().catch(() => {});
    } catch (e) { video.onerror(); }
  };
  video.src = liveBgBlob || LIVE_BG_SRC;
  video.play().catch(() => {});
}

// Экран не гаснет, пока идёт партия (если браузер разрешает).
let wakeLock = null;
let portraitHintShown = false;
async function requestWakeLock() {
  try {
    if (navigator.wakeLock && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (e) { /* нет разрешения */ }
}
function releaseWakeLock() {
  if (wakeLock) wakeLock.release().catch(() => {});
  wakeLock = null;
}

// Хук для отладки из консоли браузера.
window.__worms = { get game() { return game; }, get online() { return online; }, input, audio };

// --- Установка как приложение (PWA) ----------------------------------

const installedApp = () => navigator.standalone === true ||
  !!(window.matchMedia && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);

function setupInstall() {
  // В рамке (страница claude.ai) сервис-воркер и установка недоступны.
  let framed = true;
  try { framed = window.top !== window; } catch (e) { /* чужая рамка */ }
  if (framed || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  if (installedApp()) return;

  const btn = $('#btn-install');
  const hint = $('#install-hint');
  let prompt = null;
  let hintTimer = 0;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    prompt = e;
    btn.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => { prompt = null; btn.classList.add('hidden'); });
  // Safari на iPhone и iPad не умеет предлагать установку сам: показываем подсказку.
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) btn.classList.remove('hidden');
  btn.addEventListener('click', async () => {
    if (prompt) {
      const p = prompt;
      prompt = null;
      p.prompt();
      const { outcome } = await p.userChoice.catch(() => ({}));
      if (outcome === 'accepted') btn.classList.add('hidden');
    } else if (ios) {
      hint.classList.toggle('hidden');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hint.classList.add('hidden'), 9000);
    }
  });
}

setupInstall();
boot();
