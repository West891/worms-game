// Игровые площадки через GamePush (Яндекс Игры, VK Play, CrazyGames и др.).
//
// SDK есть только в сборке tools/build_gamepush.py: её index.html загружает SDK и
// кладёт его в window.__gp до запуска игры. В обычной версии всё здесь ничего не делает.
//
// Где реклама (правила площадок: не посреди игрового процесса, звук — выключен):
//   прелоадер — при запуске, пока открыто меню;
//   липкий баннер — только в меню, убирается, когда начинается партия;
//   полноэкранная — между партиями: после конца партии и при выходе из неё в меню;
//   за вознаграждение — только по кнопке игрока: «реванш с бонусом» на экране конца
//   партии и «ящик за рекламу» в свой ход в партии на одном устройстве.
// В сетевой партии рекламы нет: она остановила бы игру у соперника.

export const gp = window.__gp || null;

const call = (fn) => { if (!gp) return; try { fn(gp); } catch (e) { console.warn('GamePush:', e); } };
const ads = () => (gp && gp.ads) || null;

// Игра загрузилась и готова к игре — площадка убирает свой экран загрузки.
export const gameReady = () => call((g) => g.gameStart());

// Начало и конец игрового процесса (между ними площадка не показывает рекламу).
let playing = false;
export const gameplayStart = () => {
  if (playing) return;
  playing = true;
  hideSticky();
  call((g) => g.gameplayStart());
};
export const gameplayStop = () => { if (playing) { playing = false; call((g) => g.gameplayStop()); } };

// Реклама при запуске игры.
export async function showPreloaderAd() {
  const a = ads();
  if (!a || !a.isPreloaderAvailable) return false;
  try { return !!(await a.showPreloader()); } catch (e) { return false; }
}

// Полноэкранная реклама между партиями. Если с прошлой ещё не прошло время из
// настроек площадки, SDK её просто не покажет.
export async function showAdBreak() {
  const a = ads();
  if (!a || !a.isFullscreenAvailable) return false;
  try { return !!(await a.showFullscreen()); } catch (e) { return false; }
}

// Реклама за вознаграждение. true — ролик досмотрен и награду нужно выдать.
export const rewardedAvailable = () => { const a = ads(); return !!(a && a.isRewardedAvailable); };
export async function showRewarded() {
  const a = ads();
  if (!a || !a.isRewardedAvailable) return false;
  try { return !!(await a.showRewardedVideo()); } catch (e) { return false; }
}

// Липкий баннер в меню.
let sticky = false;
export function showSticky() {
  const a = ads();
  if (!a || sticky || !a.isStickyAvailable) return;
  sticky = true;
  a.showSticky().catch(() => { sticky = false; });
}
export function hideSticky() {
  const a = ads();
  if (!a || !sticky) return;
  sticky = false;
  try { a.closeSticky(); } catch (e) { /* уже закрыт */ }
}

// Звук на время рекламы и когда площадка ставит игру на паузу (свернули вкладку и т. п.).
// Липкий баннер игру не прерывает, поэтому его события здесь не нужны.
export function onPlatformPause(pause, resume) {
  if (!gp) return;
  for (const kind of ['fullscreen', 'rewarded', 'preloader']) {
    gp.ads.on(`${kind}:start`, pause);
    gp.ads.on(`${kind}:close`, resume);
  }
  gp.on('pause', pause);
  gp.on('resume', resume);
}

// Язык и имя игрока на площадке, если она их знает.
export const platformLang = () => (gp && gp.language) || null;
export const platformNick = () => {
  const name = gp && gp.player && gp.player.name;
  return name && String(name).trim() ? String(name).trim().slice(0, 18) : null;
};
