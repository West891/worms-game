// Язык интерфейса: русский или английский.
//
// Ключи словаря — сами русские строки, поэтому в коде пишется t('Базука'), а
// без перевода показывается русский текст. Подстановки — {имя}: t('{name} выбывает!', { name }).
// Язык читается до загрузки остальных модулей; смена языка перезагружает страницу.

const LANG_KEY = 'worms-lang';

function detect() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch (e) { /* хранилище недоступно */ }
  const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'ru'];
  // Русский и соседние языки, где русский обычно понимают, — по-русски, остальные — по-английски.
  return langs.some((l) => /^(ru|uk|be|kk|ky|uz|tg|hy|az|ka|tt|ba|sah|os)\b/i.test(l)) ? 'ru' : 'en';
}

export const LANG = detect();

export function setLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* не сохранится */ }
}

const EN = {
  // Меню и экраны
  'Червяки Online': 'Wormies Online',
  'Пошаговая артиллерийская игра в духе Worms: разрушаемый ландшафт, ветер, базуки и гранаты.':
    'A turn-based artillery game: destructible terrain, wind, bazookas and grenades.',
  'Червяки': 'Wormies',
  'Установить игру на устройство': 'Install the game on this device',
  '📲 Установить': '📲 Install',
  'Звук (M)': 'Sound (M)',
  'Выключить звук': 'Mute',
  'Включить звук': 'Unmute',
  'В Safari нажмите': 'In Safari tap',
  '«Поделиться»': '“Share”',
  ', затем': ', then',
  '«На экран „Домой“»': '“Add to Home Screen”',
  '. Игра появится среди приложений и будет работать без интернета.': '. The game will appear with your apps and work offline.',
  'Ветер': 'Wind',
  'Во весь экран': 'Full screen',
  'Пауза (Esc)': 'Pause (Esc)',
  'Оружие': 'Weapons',
  'ОГОНЬ': 'FIRE',
  'Загрузка…': 'Loading…',
  'Онлайн': 'Online',
  'На одном устройстве': 'Same device',
  'Ваш ник': 'Your nickname',
  'Найти соперника': 'Find an opponent',
  'Играть с другом': 'Play with a friend',
  'Друг против друга': 'Friend vs friend',
  'Вдвоём против компьютера': 'Two of us vs computer',
  'Создать комнату': 'Create room',
  'Код комнаты': 'Room code',
  'Войти': 'Join',
  'Проверяем сеть…': 'Checking the network…',
  'Команды': 'Teams',
  'В бой!': 'Battle!',
  'Настройки': 'Settings',
  'Червей в команде': 'Worms per team',
  'Компьютер': 'Computer',
  'Игрок': 'Player',
  'Новичок': 'Rookie',
  'Боец': 'Fighter',
  'Снайпер': 'Sniper',
  'Карта': 'Map',
  'Случайная': 'Random',
  'Луг': 'Meadow',
  'Пустыня': 'Desert',
  'Снег': 'Snow',
  'Ночь Хэллоуина': 'Halloween Night',
  'Ночное кладбище': 'Night Cemetery',
  'Космодром': 'Spaceport',
  'Космодром (низкая гравитация)': 'Spaceport (low gravity)',
  'Время хода': 'Turn time',
  '30 с': '30 s',
  '45 с': '45 s',
  '60 с': '60 s',
  '90 с': '90 s',
  'Голоса червяков': 'Worm voices',
  'вкл': 'on',
  'выкл': 'off',
  'Бочки с горючим': 'Oil barrels',
  'нет': 'none',
  'Внезапная смерть': 'Sudden death',
  '20 ходов': '20 turns',
  '30 ходов': '30 turns',
  '45 ходов': '45 turns',
  'Музыка': 'Music',
  'Живой фон': 'Animated background',
  'авто': 'auto',
  'Графика': 'Graphics',
  'высокая': 'high',
  'экономная': 'battery saver',
  'Мины на карте': 'Mines on the map',
  'Язык': 'Language',
  'Управление': 'Controls',
  '— ползти,': '— crawl,',
  '— прицел': '— aim',
  'Пробел': 'Space',
  '— держать для силы броска, отпустить — выстрел': '— hold to charge, release to fire',
  '— прыжок,': '— jump,',
  '— сальто назад': '— backflip',
  '— смена оружия (или клик по панели)': '— switch weapon (or click the panel)',
  '— таймер гранаты': '— grenade fuse',
  'Авиаудар, орёл и телепорт — клик по карте': 'Airstrike, eagle and teleport — click the map',
  'Перетаскивание — двигать камеру, колесо — масштаб': 'Drag — move the camera, wheel — zoom',
  '— пауза,': '— pause,',
  '— звук': '— sound',
  'Скопировать': 'Copy',
  'Скопировано': 'Copied',
  'Начать игру': 'Start game',
  'Отмена': 'Cancel',
  'Насыпаем землю…': 'Piling up the dirt…',
  'Пауза': 'Paused',
  'Сетевая игра не останавливается: соперник продолжает ход.': 'Online games don’t stop: your opponent keeps playing.',
  'Продолжить': 'Resume',
  'В меню': 'Main menu',
  'Ещё раз': 'Play again',
  'Найти нового соперника': 'Find a new opponent',
  'Поверните телефон — так удобнее играть': 'Turn your phone sideways — it’s easier to play',
  'Ошибка загрузки: {msg}. Запустите игру через локальный сервер (см. README).':
    'Loading error: {msg}. Run the game from a local web server (see README).',
  'Друг отключился — его червяками управляет компьютер': 'Your friend left — the computer controls their worms',
  'Соперник отключился — за него доигрывает компьютер': 'Your opponent left — the computer plays for them',
  'Нет связи с сервером — похоже, нет интернета. Играть с компьютером можно на вкладке «На одном устройстве».':
    'Can’t reach the server — looks like you’re offline. You can play the computer on the “Same device” tab.',
  'Играть могут все, кому открыт доступ к этой игре в claude.ai.': 'Anyone with access to this game on claude.ai can play.',
  'Игра через интернет.': 'Playing over the internet.',
  'Сервер для игры через интернет не настроен: соперники ищутся только в других вкладках этого браузера.':
    'No internet game server is set up: opponents are only found in other tabs of this browser.',
  'Сетевая игра здесь недоступна.': 'Online play isn’t available here.',

  // Команды
  'Красные': 'Red',
  'Синие': 'Blue',
  'Зелёные': 'Green',
  'Жёлтые': 'Yellow',
  'Друзья': 'Friends',

  // Игра
  'Внезапная смерть!': 'Sudden death!',
  'Вода поднимается': 'The water is rising',
  'Двойной урон!': 'Double damage!',
  'Тройное убийство!': 'Triple kill!',
  'Двойное убийство!': 'Double kill!',
  'Вот это удар!': 'What a hit!',
  '{n} урона за ход': '{n} damage this turn',
  'Землетрясение!': 'Earthquake!',
  'Армагеддон!': 'Armageddon!',
  'С неба падают метеориты': 'Meteors are falling from the sky',
  '{name} пропускает ход': '{name} skips the turn',
  'Сюда телепортироваться нельзя': 'You can’t teleport there',
  'Первая кровь!': 'First blood!',
  'Буль-буль!': 'Glug glug!',
  'Время вышло!': 'Time’s up!',
  '{name} выбывает!': '{name} is out!',
  'Аллилуйя!': 'Hallelujah!',
  'Двойной урон в следующий ход!': 'Double damage next turn!',
  'Сначала кликните по цели': 'Click a target first',
  'Кликните по карте, чтобы выбрать цель': 'Click the map to pick a target',
  'ИИ': 'AI',
  'вы': 'you',
  ' · цель выбрана': ' · target set',
  ' · выберите цель': ' · pick a target',
  ' · ещё выстрел': ' · one more shot',
  'с': 's',
  'Победа: {team}!': 'Victory: {team}!',
  'Ничья — никто не выжил!': 'Draw — nobody survived!',
  'Выжили: {list}': 'Survivors: {list}',
  'Соперник отключился': 'Opponent disconnected',
  'Партия прервана.': 'The match was interrupted.',

  // Оружие
  'Базука': 'Bazooka',
  'Ракета летит по ветру': 'The rocket drifts with the wind',
  'Самонаводящаяся ракета': 'Homing missile',
  'Кликни цель, потом стреляй': 'Click a target, then fire',
  'Граната': 'Grenade',
  'Таймер 1–5 с, отскакивает': '1–5 s fuse, bounces',
  'Кассетная граната': 'Cluster grenade',
  'Разлетается на осколки': 'Splits into bomblets',
  'Банановая бомба': 'Banana bomb',
  'Пять прыгучих бананов-бомб': 'Five bouncy banana bombs',
  'Святая граната': 'Holy hand grenade',
  'Аллилуйя! Огромный взрыв': 'Hallelujah! A huge blast',
  'Коктейль Молотова': 'Molotov cocktail',
  'Разливает огонь': 'Spills fire',
  'Дробовик': 'Shotgun',
  'Два выстрела за ход': 'Two shots per turn',
  'Бейсбольная бита': 'Baseball bat',
  'Выбивает соседа с карты': 'Knocks a neighbour off the map',
  'Огненный кулак': 'Fire punch',
  'Апперкот: подбрасывает соседа': 'Uppercut: launches a neighbour',
  'Динамит': 'Dynamite',
  'Положи и беги!': 'Drop it and run!',
  'Мина': 'Mine',
  'Срабатывает рядом с червяком': 'Goes off when a worm comes near',
  'Овца': 'Sheep',
  'Бежит вперёд. «Огонь» ещё раз — взрыв': 'Runs ahead. Press “Fire” again to explode',
  'Авиаудар': 'Airstrike',
  'Кликни по карте': 'Click the map',
  'Бетонный осёл': 'Concrete donkey',
  'Падает с неба и пробивает всё': 'Falls from the sky and smashes through everything',
  'Самонаводящийся орёл': 'Homing eagle',
  'Кликни цель — орёл облетит препятствия и спикирует': 'Click a target — the eagle flies around obstacles and dives',
  'Метеоритный дождь по всей карте': 'Meteor shower over the whole map',
  'Трясёт всех червяков на карте': 'Shakes every worm on the map',
  'Ниндзя-верёвка': 'Ninja rope',
  'Огонь — крюк, ←→ раскачка, ↑↓ длина, прыжок — отцепиться': 'Fire — hook, ←→ swing, ↑↓ length, jump — let go',
  'Лазерный бур': 'Laser drill',
  'Огонь — бурить, ↑↓ направление, огонь или прыжок — стоп': 'Fire — drill, ↑↓ steer, fire or jump — stop',
  'Телепорт': 'Teleport',
  'Кликни, куда переместиться': 'Click where to go',
  'Пропустить ход': 'Skip turn',
  'Ничего не делать': 'Do nothing',

  // Онлайн
  'Ищем соперника…': 'Looking for an opponent…',
  'Подключаемся…': 'Connecting…',
  'Прошло {sec} с': '{sec} s passed',
  'Соперник найден: {nick}. Подключаемся…': 'Opponent found: {nick}. Connecting…',
  'Соперник найден: {nick}': 'Opponent found: {nick}',
  'Комната для друга': 'Room for a friend',
  'Создаём комнату…': 'Creating a room…',
  'Сетевая игра здесь недоступна': 'Online play isn’t available here',
  'Не удалось создать комнату. Попробуйте ещё раз.': 'Couldn’t create a room. Please try again.',
  'Отправьте другу код. Он открывает игру → «Онлайн» → вводит код.': 'Send your friend the code. They open the game → “Online” → enter the code.',
  'Друг подключился: {nick}. Можно начинать!': '{nick} joined. You can start!',
  'Код комнаты — 6 букв и цифр': 'The room code is 6 letters and digits',
  'Подключаемся к другу…': 'Connecting to your friend…',
  'Комната {code}': 'Room {code}',
  'Не удалось подключиться. Проверьте код.': 'Couldn’t connect. Check the code.',
  'У друга другая версия игры — обновите страницу': 'Your friend has a different game version — reload the page',
  'Вы в комнате у {nick}. Ждём, когда начнётся игра.': 'You’re in {nick}’s room. Waiting for the game to start.',
  'Комната не найдена. Проверьте код или попросите друга создать новую.': 'Room not found. Check the code or ask your friend to create a new one.',
  'Хост прислал непонятные данные': 'The host sent data we can’t read',
  'Не получилось': 'Something went wrong',
};

export function t(ru, params) {
  let s = LANG === 'en' && EN[ru] !== undefined ? EN[ru] : ru;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
  return s;
}

// Перевод готовой разметки: текстовые узлы и подписи (title, placeholder и т. п.).
export function translateDom(root = document.body) {
  document.documentElement.lang = LANG;
  if (LANG === 'ru') return;
  // Установленное приложение должно называться по-английски.
  const manifest = document.querySelector('link[rel="manifest"]');
  if (manifest) manifest.href = 'manifest-en.webmanifest';
  const appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appTitle) appTitle.content = t('Червяки');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const raw = n.nodeValue;
    const key = raw.trim();
    if (!key || EN[key] === undefined) continue;
    n.nodeValue = raw.replace(key, EN[key]);
  }
  for (const el of root.querySelectorAll('[title],[placeholder],[aria-label],[alt]')) {
    for (const attr of ['title', 'placeholder', 'aria-label', 'alt']) {
      const v = el.getAttribute(attr);
      if (v && EN[v] !== undefined) el.setAttribute(attr, EN[v]);
    }
  }
  document.title = t(document.title);
}

// Имена червяков и ники ботов — свои для каждого языка.
export const NAMES = LANG === 'en'
  ? ['Bob', 'Sausage', 'General', 'Chubby', 'Shoelace', 'Buddy', 'Bagel', 'Professor',
    'Rusty', 'Banger', 'Mister Pink', 'Spaghetti', 'Shrapnel', 'Dynamo', 'Cupcake',
    'Beaver', 'Sailor', 'Fuse', 'Sock', 'Dumpling', 'Noodle', 'Baron', 'Hedgehog', 'Screwy']
  : ['Боб', 'Сосиска', 'Генерал', 'Пухляш', 'Шнурок', 'Кузя', 'Бублик', 'Профессор',
    'Ржавый', 'Колбаска', 'Мистер Пинк', 'Спагетти', 'Шрапнель', 'Динамо', 'Кексик',
    'Бобёр', 'Матрос', 'Фитиль', 'Носок', 'Пельмень', 'Лапша', 'Барон', 'Ёжик', 'Шуруп'];

export const BOOMS = LANG === 'en'
  ? ['BOOM!', 'BANG!', 'KABOOM!', 'POW!', 'WHAM!']
  : ['БУМ!', 'БАХ!', 'БАБАХ!', 'ПАФ!', 'БДЫЩ!'];
