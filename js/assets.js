// Загрузка картинок и иконок, подготовка перекрашенных спрайтов.
const IMAGES = {
  sky: 'assets/img/sky.jpg',
  burst: 'assets/img/burst.png',
  hit: 'assets/img/hit.png',
  smoke: 'assets/img/smoke.png',
  particle: 'assets/img/particle.png',
};

export const ICON_NAMES = [
  'bazooka', 'grenade', 'cluster', 'shotgun', 'bat', 'dynamite', 'mine', 'airstrike',
  'teleport', 'skip', 'tombstone', 'crate', 'health', 'wind', 'worms',
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить ' + src));
    img.src = src;
  });
}

export function tint(img, color, w = img.width, h = img.height) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  return c;
}

export async function loadAssets(onProgress) {
  const assets = { img: {}, icon: {}, sprite: {} };
  const jobs = [];
  for (const [key, src] of Object.entries(IMAGES)) {
    jobs.push(loadImage(src).then((img) => { assets.img[key] = img; }));
  }
  for (const name of ICON_NAMES) {
    jobs.push(loadImage(`assets/icons/${name}.svg`).then((img) => { assets.icon[name] = img; }));
  }
  let done = 0;
  await Promise.all(jobs.map((j) => j.then(() => onProgress && onProgress(++done / jobs.length))));

  const { smoke, particle, burst } = assets.img;
  // Кадры атласа burst.png (512×256): кольцо и вспышка.
  const ring = document.createElement('canvas');
  ring.width = ring.height = 256;
  ring.getContext('2d').drawImage(burst, 0, 0, 256, 256, 0, 0, 256, 256);
  const star = document.createElement('canvas');
  star.width = star.height = 256;
  star.getContext('2d').drawImage(burst, 256, 0, 256, 256, 0, 0, 256, 256);
  assets.sprite = {
    ring,
    star: tint(star, '#fff3b0'),
    smokeGray: tint(smoke, '#8a8790', 128, 128),
    smokeDark: tint(smoke, '#4a4650', 128, 128),
    smokeWhite: tint(smoke, '#ffffff', 128, 128),
    cloud: tint(smoke, 'rgba(255,255,255,0.85)', 256, 256),
    cloudNight: tint(smoke, 'rgba(70,60,95,0.9)', 256, 256),
    fog: tint(smoke, 'rgba(190,210,220,0.8)', 256, 256),
    fireOrange: tint(particle, '#ff8a2a', 64, 64),
    fireYellow: tint(particle, '#ffe35a', 64, 64),
    sparkCyan: tint(particle, '#7ff6ff', 64, 64),
    water: tint(particle, '#bfe4ff', 64, 64),
    flash: tint(assets.img.hit, '#fff8d8', 128, 128),
    tomb: tint(assets.icon.tombstone, '#b9b3ad', 64, 64),
    tombShadow: tint(assets.icon.tombstone, '#2a2230', 64, 64),
    crateIcon: tint(assets.icon.crate, '#7a4a1e', 64, 64),
    healthIcon: tint(assets.icon.health, '#e33', 64, 64),
    mineIcon: tint(assets.icon.mine, '#2a2a2a', 64, 64),
  };
  return assets;
}
