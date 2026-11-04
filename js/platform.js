// Игровые площадки через GamePush (Яндекс Игры, VK Play, CrazyGames и др.).
//
// SDK есть только в сборке tools/build_gamepush.py: её index.html загружает SDK и
// кладёт его в window.__gp до запуска игры. В обычной версии всё здесь ничего не делает.

export const gp = window.__gp || null;

const call = (fn) => { if (!gp) return; try { fn(gp); } catch (e) { console.warn('GamePush:', e); } };

// Игра загрузилась и готова к игре — площадка убирает свой экран загрузки.
export const gameReady = () => call((g) => g.gameStart());
// Начало и конец игрового процесса (между ними площадка не показывает рекламу).
let playing = false;
export const gameplayStart = () => { if (!playing) { playing = true; call((g) => g.gameplayStart()); } };
export const gameplayStop = () => { if (playing) { playing = false; call((g) => g.gameplayStop()); } };

// Полноэкранная реклама между партиями. Частоту показа ограничивает сама площадка.
export async function showAdBreak() {
  if (!gp || !gp.ads) return;
  try {
    if (gp.ads.isFullscreenAvailable === false) return;
    await gp.ads.showFullscreen();
  } catch (e) { /* реклама не показалась — играем дальше */ }
}

// Звук на время рекламы и когда площадка ставит игру на паузу (свернули вкладку и т. п.).
export function onPlatformPause(pause, resume) {
  if (!gp) return;
  gp.ads.on('fullscreen:start', pause);
  gp.ads.on('fullscreen:close', resume);
  gp.ads.on('rewarded:start', pause);
  gp.ads.on('rewarded:close', resume);
  gp.on('pause', pause);
  gp.on('resume', resume);
}

// Язык и имя игрока на площадке, если она их знает.
export const platformLang = () => (gp && gp.language) || null;
export const platformNick = () => {
  const name = gp && gp.player && gp.player.name;
  return name && String(name).trim() ? String(name).trim().slice(0, 18) : null;
};
