// Общие константы игры. Скорости — в пикселях за тик, тик = 1/60 секунды.
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
  { name: 'Красные', color: '#ff5d5d' },
  { name: 'Синие', color: '#53a8ff' },
  { name: 'Зелёные', color: '#5fe36c' },
  { name: 'Жёлтые', color: '#ffd84a' },
];

export const WORM_NAMES = [
  'Боб', 'Сосиска', 'Генерал', 'Пухляш', 'Шнурок', 'Кузя', 'Бублик', 'Профессор',
  'Ржавый', 'Колбаска', 'Мистер Пинк', 'Спагетти', 'Шрапнель', 'Динамо', 'Кексик',
  'Бобёр', 'Матрос', 'Фитиль', 'Носок', 'Пельмень', 'Лапша', 'Барон', 'Ёжик', 'Шуруп',
];
