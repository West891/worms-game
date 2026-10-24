import { WEAPONS } from './weapons.js';
import { t as tr } from './i18n.js';

const $ = (sel) => document.querySelector(sel);
// Имена команд и червяков в сетевой игре приходят от других игроков.
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : '#ccc');

// DOM-интерфейс поверх холста: таймер, ветер, оружие, команды, экраны.
export class UI {
  constructor() {
    this.game = null;
    this.onWeaponClick = null;
    this.weaponButtons = {};
    this.toastTimer = 0;
    this.lastTimer = null;

    this.onFuseClick = null;
    $('#weapon-info').addEventListener('click', (e) => {
      const b = e.target.closest('[data-fuse]');
      if (b && this.onFuseClick) this.onFuseClick(+b.dataset.fuse);
    });
    // На сенсорных экранах оружие открывается сеткой по кнопке.
    $('#weapon-toggle').addEventListener('click', () => $('#bottom').classList.toggle('open'));
    const bar = $('#weapons');
    for (const w of WEAPONS) {
      const b = document.createElement('button');
      b.className = 'weapon';
      b.title = `${w.name} — ${w.hint}`;
      b.innerHTML = `<img src="assets/icons/${w.icon}.svg" alt=""><span class="ammo"></span>`;
      b.addEventListener('click', () => {
        if (this.onWeaponClick) this.onWeaponClick(w.id);
        $('#bottom').classList.remove('open');
      });
      bar.appendChild(b);
      this.weaponButtons[w.id] = b;
    }
  }

  attach(game) {
    this.game = game;
    $('#hud').classList.remove('hidden');
    this.buildTeams(game);
    this.onWeapon(game);
  }

  buildTeams(game) {
    const box = $('#teams');
    box.innerHTML = '';
    this.teamRows = game.teams.map((t) => {
      const row = document.createElement('div');
      row.className = 'team';
      const mine = game.role !== 'local' || t.online
        ? t.worms.some((w) => w.owner === 'local' || w.owner === game.role)
        : false;
      const tag = t.ai && !t.disguise ? ` <small>${tr('ИИ')}</small>` : mine ? ` <small>${tr('вы')}</small>` : '';
      row.innerHTML = `<span class="tname" style="color:${safeColor(t.color)}">${t.online && !(t.ai && !t.disguise) ? '<i class="dot"></i>' : ''}${esc(t.name)}${tag}</span>
        <span class="tbar"><span class="tfill" style="background:${safeColor(t.color)}"></span></span>`;
      box.appendChild(row);
      return { row, fill: row.querySelector('.tfill'), team: t };
    });
    this.maxTeamHp = Math.max(...game.teams.map((t) => t.worms.reduce((s, w) => s + w.hp, 0)));
    this.onDamage(game);
  }

  onDamage(game) {
    if (!this.teamRows) return;
    for (const r of this.teamRows) {
      const hp = r.team.worms.reduce((s, w) => s + (w.dead ? 0 : w.hp), 0);
      r.fill.style.width = `${Math.min(100, (hp / this.maxTeamHp) * 100)}%`;
      r.row.classList.toggle('out', hp <= 0);
    }
  }

  onTurn(game) {
    for (const r of this.teamRows) r.row.classList.toggle('current', r.team === game.activeTeam);
    $('#weapons').classList.toggle('locked', !game.isMyTurn);
    this.onWeapon(game);
    this.updateWind(game.wind);
  }

  onWeapon(game) {
    const team = game.activeTeam;
    for (const w of WEAPONS) {
      const b = this.weaponButtons[w.id];
      const ammo = team ? team.ammo[w.id] : w.ammo;
      b.classList.toggle('selected', game.weaponId === w.id);
      b.classList.toggle('empty', ammo <= 0);
      b.querySelector('.ammo').textContent = ammo === Infinity ? '' : ammo;
    }
    const def = game.weapon;
    let info = def.name;
    if (def.needsTarget) info += tr(game.homingTarget ? ' · цель выбрана' : ' · выберите цель');
    if (def.id === 'shotgun' && game.shotgunShots > 0) info += tr(' · ещё выстрел');
    // Таймер гранаты: кнопки 1–5 (на телефоне цифр на клавиатуре нет).
    const fuse = def.fuse
      ? `<span class="fuse">${[1, 2, 3, 4, 5].map((n) => `<button data-fuse="${n}" class="${n === game.fuseSec ? 'on' : ''}">${n}</button>`).join('')} ${tr('с')}</span>`
      : `<span class="hint">${def.hint}</span>`;
    $('#weapon-info').innerHTML = `<b>${info}</b>${fuse}`;
    $('#weapon-toggle-icon').src = `assets/icons/${def.icon}.svg`;
  }

  updateWind(wind) {
    const pct = Math.round(Math.abs(wind) * 100);
    $('#wind-left').style.width = wind < 0 ? `${pct}%` : '0';
    $('#wind-right').style.width = wind > 0 ? `${pct}%` : '0';
  }

  frame(game) {
    let t = '';
    if (game.state === 'aim') t = Math.ceil(game.turnTimeLeft);
    else if (game.state === 'retreat') t = Math.ceil(game.retreatLeft);
    if (t !== this.lastTimer) {
      this.lastTimer = t;
      const el = $('#timer-val');
      el.textContent = t;
      el.parentElement.classList.toggle('urgent', game.state === 'aim' && t <= 5);
      el.parentElement.classList.toggle('retreat', game.state === 'retreat');
    }
    if (this.toastTimer > 0) {
      this.toastTimer--;
      if (this.toastTimer === 0) $('#toast').classList.remove('show');
    }
  }

  // Надписи по центру идут по очереди, чтобы «Двойное убийство!» не перекрыл следующий ход.
  announce(title, sub, color) {
    this.bannerQueue = this.bannerQueue || [];
    this.bannerQueue.push([title, sub, color]);
    if (!this.bannerBusy) this.nextBanner();
  }

  nextBanner() {
    const item = this.bannerQueue.shift();
    if (!item) { this.bannerBusy = false; return; }
    this.bannerBusy = true;
    const [title, sub, color] = item;
    const el = $('#banner');
    el.innerHTML = `<b style="color:${safeColor(color)}">${esc(title)}</b><span>${esc(sub)}</span>`;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    setTimeout(() => this.nextBanner(), this.bannerQueue.length ? 1500 : 1900);
  }

  toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    this.toastTimer = 150;
  }

  showGameOver(team) {
    const el = $('#gameover');
    $('#go-title').innerHTML = team
      ? tr('Победа: {team}!', { team: `<span style="color:${safeColor(team.color)}">${esc(team.name)}</span>` })
      : tr('Ничья — никто не выжил!');
    const survivors = team ? team.worms.filter((w) => !w.dead).map((w) => `${w.name} (${w.hp})`).join(', ') : '';
    $('#go-sub').textContent = survivors ? tr('Выжили: {list}', { list: survivors }) : '';
    setTimeout(() => el.classList.remove('hidden'), 1200);
  }

  showDisconnected() {
    $('#go-title').textContent = tr('Соперник отключился');
    $('#go-sub').textContent = tr('Партия прервана.');
    $('#gameover').classList.remove('hidden');
  }

  hideHud() {
    $('#hud').classList.add('hidden');
  }
}
