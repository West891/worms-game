// Общие константы игры. Скорости — в пикселях за тик, тик = 1/60 секунды.
import { t, NAMES } from './i18n.js';

export const TICK = 1 / 60;
export const WORLD_W = 2560;
export const WORLD_H = 1280;
export const WATER_Y = 1160;

export const GRAVITY = 0.2;

// Меняются по ходу партии: гравитация зависит от карты, вода поднимается
// во «внезапной смерти». Задаются в начале каждой игры.
export const PHYS = { g: GRAVITY };
export const WATER = { y: WATER_Y };
export const WIND_ACCEL = 0.035;

export const WORM_R = 6;
export const WORM_HP = 100;
export const WALK_SPEED = 0.7;
export const MAX_CLIMB = 6;
export const AIM_SPEED = 0.028;
export const CHARGE_TICKS = 100;

export const RETREAT_TIME = 3;
export const SETTLE_DELAY = 0.6;

export const TEAM_DEFS = [
  { name: t('Красные'), color: '#ff5d5d' },
  { name: t('Синие'), color: '#53a8ff' },
  { name: t('Зелёные'), color: '#5fe36c' },
  { name: t('Жёлтые'), color: '#ffd84a' },
];

export const WORM_NAMES = NAMES;
