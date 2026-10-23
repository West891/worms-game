// Сервис-воркер: игра открывается и работает без интернета.
//
// Код (HTML, JS, CSS) берётся из сети, а без сети — из кэша, поэтому обновления
// приходят сразу. Картинки, звуки и голоса кладутся в кэш при установке, музыка —
// когда впервые зазвучит. Списки и версии ниже пишет tools/build_pwa.py.

// PRECACHE-START
const VERSION = 'bc0db2a0e929';
const MEDIA_VERSION = 'fcc1f83d459c';
const PRECACHE = [
  "./",
  "manifest.webmanifest",
  "css/style.css",
  "js/ai.js",
  "js/assets.js",
  "js/audio.js",
  "js/config.js",
  "js/effects.js",
  "js/game.js",
  "js/input.js",
  "js/main.js",
  "js/maps.js",
  "js/net/config.js",
  "js/net/online.js",
  "js/net/session.js",
  "js/net/sync.js",
  "js/net/transport.js",
  "js/objects.js",
  "js/quality.js",
  "js/rng.js",
  "js/scenery.js",
  "js/sprites.js",
  "js/terrain.js",
  "js/ui.js",
  "js/weapons.js",
  "js/worm.js",
  "assets/ambience/cemetery.mp3",
  "assets/ambience/desert.mp3",
  "assets/ambience/halloween.mp3",
  "assets/ambience/meadow.mp3",
  "assets/ambience/snow.mp3",
  "assets/ambience/spaceport.mp3",
  "assets/fonts/rubik-cyrillic-800-normal.woff2",
  "assets/fonts/rubik-latin-800-normal.woff2",
  "assets/icons/airstrike.svg",
  "assets/icons/armageddon.svg",
  "assets/icons/banana.svg",
  "assets/icons/barrel.svg",
  "assets/icons/bat.svg",
  "assets/icons/bazooka.svg",
  "assets/icons/cluster.svg",
  "assets/icons/crate.svg",
  "assets/icons/donkey.svg",
  "assets/icons/dynamite.svg",
  "assets/icons/grenade.svg",
  "assets/icons/health.svg",
  "assets/icons/holy.svg",
  "assets/icons/homing.svg",
  "assets/icons/mine.svg",
  "assets/icons/molotov.svg",
  "assets/icons/punch.svg",
  "assets/icons/quake.svg",
  "assets/icons/sheep.svg",
  "assets/icons/shotgun.svg",
  "assets/icons/skip.svg",
  "assets/icons/teleport.svg",
  "assets/icons/tombstone.svg",
  "assets/icons/wind.svg",
  "assets/icons/worms.svg",
  "assets/img/burst.png",
  "assets/img/hit.png",
  "assets/img/particle.png",
  "assets/img/sky.jpg",
  "assets/img/smoke.png",
  "assets/img/splash-tall.jpg",
  "assets/img/splash-wide.jpg",
  "assets/pwa/apple-touch-icon.png",
  "assets/pwa/icon-192.png",
  "assets/pwa/icon-512.png",
  "assets/pwa/maskable-512.png",
  "assets/sfx/baa.mp3",
  "assets/sfx/backflip.mp3",
  "assets/sfx/bats.mp3",
  "assets/sfx/break.mp3",
  "assets/sfx/click.mp3",
  "assets/sfx/explosion.mp3",
  "assets/sfx/fire.mp3",
  "assets/sfx/hallelujah.mp3",
  "assets/sfx/heehaw.mp3",
  "assets/sfx/hurt.mp3",
  "assets/sfx/impact.mp3",
  "assets/sfx/jump.mp3",
  "assets/sfx/land.mp3",
  "assets/sfx/liftoff.mp3",
  "assets/sfx/meteor.mp3",
  "assets/sfx/pickup.mp3",
  "assets/sfx/quake.mp3",
  "assets/sfx/select.mp3",
  "assets/sfx/shotgun.mp3",
  "assets/sfx/teleport.mp3",
  "assets/sfx/throw.mp3",
  "assets/sfx/tick.mp3",
  "assets/sfx/walk.mp3",
  "assets/voice/a/airstrike_1.mp3",
  "assets/voice/a/airstrike_2.mp3",
  "assets/voice/a/armageddon_1.mp3",
  "assets/voice/a/armageddon_2.mp3",
  "assets/voice/a/backflip_1.mp3",
  "assets/voice/a/backflip_2.mp3",
  "assets/voice/a/banana_1.mp3",
  "assets/voice/a/banana_2.mp3",
  "assets/voice/a/bat_1.mp3",
  "assets/voice/a/bat_2.mp3",
  "assets/voice/a/bigHurt_1.mp3",
  "assets/voice/a/bigHurt_2.mp3",
  "assets/voice/a/bigHurt_3.mp3",
  "assets/voice/a/burn_1.mp3",
  "assets/voice/a/burn_2.mp3",
  "assets/voice/a/crate_1.mp3",
  "assets/voice/a/crate_2.mp3",
  "assets/voice/a/death_1.mp3",
  "assets/voice/a/death_2.mp3",
  "assets/voice/a/death_3.mp3",
  "assets/voice/a/donkey_1.mp3",
  "assets/voice/a/donkey_2.mp3",
  "assets/voice/a/drown_1.mp3",
  "assets/voice/a/drown_2.mp3",
  "assets/voice/a/dynamite_1.mp3",
  "assets/voice/a/dynamite_2.mp3",
  "assets/voice/a/fire_1.mp3",
  "assets/voice/a/fire_2.mp3",
  "assets/voice/a/fire_3.mp3",
  "assets/voice/a/fly_1.mp3",
  "assets/voice/a/fly_2.mp3",
  "assets/voice/a/fly_3.mp3",
  "assets/voice/a/holy_1.mp3",
  "assets/voice/a/holy_2.mp3",
  "assets/voice/a/hurt_1.mp3",
  "assets/voice/a/hurt_2.mp3",
  "assets/voice/a/hurt_3.mp3",
  "assets/voice/a/hurt_4.mp3",
  "assets/voice/a/mine_1.mp3",
  "assets/voice/a/mine_2.mp3",
  "assets/voice/a/molotov_1.mp3",
  "assets/voice/a/molotov_2.mp3",
  "assets/voice/a/oops_1.mp3",
  "assets/voice/a/oops_2.mp3",
  "assets/voice/a/punch_1.mp3",
  "assets/voice/a/punch_2.mp3",
  "assets/voice/a/quake_1.mp3",
  "assets/voice/a/quake_2.mp3",
  "assets/voice/a/sheep_1.mp3",
  "assets/voice/a/sheep_2.mp3",
  "assets/voice/a/skip_1.mp3",
  "assets/voice/a/skip_2.mp3",
  "assets/voice/a/taunt_1.mp3",
  "assets/voice/a/taunt_2.mp3",
  "assets/voice/a/taunt_3.mp3",
  "assets/voice/a/throw_1.mp3",
  "assets/voice/a/throw_2.mp3",
  "assets/voice/a/throw_3.mp3",
  "assets/voice/a/timeup_1.mp3",
  "assets/voice/a/timeup_2.mp3",
  "assets/voice/a/turn_1.mp3",
  "assets/voice/a/turn_2.mp3",
  "assets/voice/a/turn_3.mp3",
  "assets/voice/a/victory_1.mp3",
  "assets/voice/a/victory_2.mp3",
  "assets/voice/b/airstrike_1.mp3",
  "assets/voice/b/airstrike_2.mp3",
  "assets/voice/b/armageddon_1.mp3",
  "assets/voice/b/armageddon_2.mp3",
  "assets/voice/b/backflip_1.mp3",
  "assets/voice/b/backflip_2.mp3",
  "assets/voice/b/banana_1.mp3",
  "assets/voice/b/banana_2.mp3",
  "assets/voice/b/bat_1.mp3",
  "assets/voice/b/bat_2.mp3",
  "assets/voice/b/bigHurt_1.mp3",
  "assets/voice/b/bigHurt_2.mp3",
  "assets/voice/b/bigHurt_3.mp3",
  "assets/voice/b/burn_1.mp3",
  "assets/voice/b/burn_2.mp3",
  "assets/voice/b/crate_1.mp3",
  "assets/voice/b/crate_2.mp3",
  "assets/voice/b/death_1.mp3",
  "assets/voice/b/death_2.mp3",
  "assets/voice/b/death_3.mp3",
  "assets/voice/b/donkey_1.mp3",
  "assets/voice/b/donkey_2.mp3",
  "assets/voice/b/drown_1.mp3",
  "assets/voice/b/drown_2.mp3",
  "assets/voice/b/dynamite_1.mp3",
  "assets/voice/b/dynamite_2.mp3",
  "assets/voice/b/fire_1.mp3",
  "assets/voice/b/fire_2.mp3",
  "assets/voice/b/fire_3.mp3",
  "assets/voice/b/fly_1.mp3",
  "assets/voice/b/fly_2.mp3",
  "assets/voice/b/fly_3.mp3",
  "assets/voice/b/holy_1.mp3",
  "assets/voice/b/holy_2.mp3",
  "assets/voice/b/hurt_1.mp3",
  "assets/voice/b/hurt_2.mp3",
  "assets/voice/b/hurt_3.mp3",
  "assets/voice/b/hurt_4.mp3",
  "assets/voice/b/mine_1.mp3",
  "assets/voice/b/mine_2.mp3",
  "assets/voice/b/molotov_1.mp3",
  "assets/voice/b/molotov_2.mp3",
  "assets/voice/b/oops_1.mp3",
  "assets/voice/b/oops_2.mp3",
  "assets/voice/b/punch_1.mp3",
  "assets/voice/b/punch_2.mp3",
  "assets/voice/b/quake_1.mp3",
  "assets/voice/b/quake_2.mp3",
  "assets/voice/b/sheep_1.mp3",
  "assets/voice/b/sheep_2.mp3",
  "assets/voice/b/skip_1.mp3",
  "assets/voice/b/skip_2.mp3",
  "assets/voice/b/taunt_1.mp3",
  "assets/voice/b/taunt_2.mp3",
  "assets/voice/b/taunt_3.mp3",
  "assets/voice/b/throw_1.mp3",
  "assets/voice/b/throw_2.mp3",
  "assets/voice/b/throw_3.mp3",
  "assets/voice/b/timeup_1.mp3",
  "assets/voice/b/timeup_2.mp3",
  "assets/voice/b/turn_1.mp3",
  "assets/voice/b/turn_2.mp3",
  "assets/voice/b/turn_3.mp3",
  "assets/voice/b/victory_1.mp3",
  "assets/voice/b/victory_2.mp3",
  "assets/voice/manifest.json",
  "assets/voice/n/armageddon_1.mp3",
  "assets/voice/n/bigHit_1.mp3",
  "assets/voice/n/bigHit_2.mp3",
  "assets/voice/n/doubleDamage_1.mp3",
  "assets/voice/n/doubleKill_1.mp3",
  "assets/voice/n/firstBlood_1.mp3",
  "assets/voice/n/quake_1.mp3",
  "assets/voice/n/suddenDeath_1.mp3",
  "assets/voice/n/tripleKill_1.mp3"
];
// PRECACHE-END

const CORE = `core-${VERSION}`;
const MEDIA = `media-${MEDIA_VERSION}`;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CORE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CORE && k !== MEDIA) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isCode = (url) => url.pathname.endsWith('/') || /\.(html|js|css|webmanifest)$/.test(url.pathname);
const isMusic = (url) => url.pathname.includes('/assets/music/');

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Видео заставки большое и нужно только при сети: не кэшируем.
  if (url.pathname.includes('/assets/video/')) return;
  if (req.headers.has('range')) e.respondWith(ranged(e, req, url));
  else if (req.mode === 'navigate' || isCode(url)) e.respondWith(networkFirst(req));
  else e.respondWith(cacheFirst(req, isMusic(url) ? MEDIA : CORE));
});

async function networkFirst(req) {
  const cache = await caches.open(CORE);
  try {
    const res = await withTimeout(fetch(req), 4000);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const index = await cache.match('./');
      if (index) return index;
    }
    throw err;
  }
}

async function cacheFirst(req, name) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(name)).put(req, res.clone());
  return res;
}

// <audio> просит файл кусками (Range). Из кэша отдаём нужный кусок сами, а при
// первом проигрывании докачиваем файл целиком в фоне, чтобы дальше он был офлайн.
async function ranged(e, req, url) {
  const hit = await caches.match(url.href, { ignoreSearch: true });
  if (hit) return slice(req, hit);
  if (isMusic(url)) {
    e.waitUntil(fetch(url.href).then(async (res) => {
      if (res.ok && res.status === 200) await (await caches.open(MEDIA)).put(url.href, res);
    }).catch(() => {}));
  }
  return fetch(req);
}

async function slice(req, res) {
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  let start = 0, end = size - 1;
  if (m && m[1]) { start = +m[1]; if (m[2]) end = Math.min(+m[2], size - 1); }
  else if (m && m[2]) start = Math.max(0, size - +m[2]);
  if (start > end || start >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}
