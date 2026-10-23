// Качество графики. На телефонах и планшетах стартуем со «среднего» и
// подстраиваемся по частоте кадров: если кадры не успевают, снижаем
// разрешение холста и количество частиц.

export const LEVELS = {
  high: { name: 'high', dprCap: 2, fx: 1, maxParticles: 900, fog: true, weather: 1, glow: true },
  medium: { name: 'medium', dprCap: 1.5, fx: 0.75, maxParticles: 500, fog: true, weather: 0.6, glow: true },
  low: { name: 'low', dprCap: 1, fx: 0.45, maxParticles: 220, fog: false, weather: 0.3, glow: false },
};
const ORDER = ['low', 'medium', 'high'];

export const isTouchDevice = () =>
  (window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches) ||
  (navigator.maxTouchPoints > 0 && !(window.matchMedia && window.matchMedia('(pointer: fine)').matches));

// Возможности устройства, которые выставляет main.js.
export const DEVICE = { haptics: false };

// Короткая вибрация (Android; iOS не поддерживает).
export function haptic(ms) {
  if (DEVICE.haptics) navigator.vibrate(ms);
}

// Текущие настройки; модули читают поля напрямую.
export const QUALITY = { ...LEVELS.high };

let mode = 'auto';
let ceiling = 'high';
let ema = 16;
let slowFor = 0;
let fastFor = 0;

function apply(level) {
  Object.assign(QUALITY, LEVELS[level]);
}

// mode: 'auto' | 'high' | 'low'
export function setQualityMode(m) {
  mode = m;
  ceiling = isTouchDevice() ? 'medium' : 'high';
  if (m === 'auto') apply(ceiling);
  else apply(m);
  ema = 16;
  slowFor = fastFor = 0;
}

// Вызывается каждый кадр с длительностью кадра в мс. Возвращает true, если уровень сменился.
export function trackFrame(ms) {
  if (mode !== 'auto' || ms > 250) return false;
  ema += (ms - ema) * 0.05;
  const i = ORDER.indexOf(QUALITY.name);
  if (ema > 24) { slowFor += ms; fastFor = 0; } else if (ema < 14) { fastFor += ms; slowFor = 0; } else { slowFor = fastFor = 0; }
  if (slowFor > 2500 && i > 0) {
    apply(ORDER[i - 1]);
    slowFor = 0;
    ema = 16;
    return true;
  }
  if (fastFor > 12000 && i < ORDER.indexOf(ceiling)) {
    apply(ORDER[i + 1]);
    fastFor = 0;
    return true;
  }
  return false;
}
