// Клавиатура, мышь и сенсорные кнопки сводятся к набору действий.
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'fire',
  Enter: 'jump', NumpadEnter: 'jump',
  Backspace: 'backflip',
  Tab: 'next', KeyE: 'next', KeyQ: 'prev',
  Digit1: 'fuse1', Digit2: 'fuse2', Digit3: 'fuse3', Digit4: 'fuse4', Digit5: 'fuse5',
  Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
  Equal: 'zoomIn', NumpadAdd: 'zoomIn', Minus: 'zoomOut', NumpadSubtract: 'zoomOut',
};

export class Input {
  constructor(canvas) {
    this.held = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.clicks = [];
    this.drag = null;
    this.panDelta = { x: 0, y: 0 };
    this.wheel = 0;
    this.mouse = { x: 0, y: 0, inside: false };
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      const act = KEYMAP[e.code];
      if (!act) return;
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Enter' && e.shiftKey) this.press('backflip');
      else this.press(act);
    });
    window.addEventListener('keyup', (e) => {
      const act = KEYMAP[e.code];
      if (!act) return;
      this.release(act);
      if (act === 'jump') this.release('backflip');
    });
    window.addEventListener('blur', () => {
      for (const a of this.held) this.released.add(a);
      this.held.clear();
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // Касания: один палец — тап (цель) или перетаскивание камеры,
    // два пальца — масштаб щипком и сдвиг.
    this.pointers = new Map();
    this.zoomFactor = 1;
    canvas.addEventListener('pointerdown', (e) => {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* синтетическое событие */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, multi: false };
      } else if (this.drag) {
        this.drag.multi = true;
        this.pinch = this.pinchState();
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY, inside: true };
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size >= 2) {
        const now = this.pinchState();
        if (this.pinch && this.pinch.d > 0) {
          this.zoomFactor *= now.d / this.pinch.d;
          this.panDelta.x += now.x - this.pinch.x;
          this.panDelta.y += now.y - this.pinch.y;
        }
        this.pinch = now;
        return;
      }
      const d = this.drag;
      if (!d || d.id !== e.pointerId || d.multi) return;
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 10) d.moved = true;
      if (d.moved) {
        this.panDelta.x += e.clientX - d.x;
        this.panDelta.y += e.clientY - d.y;
      }
      d.x = e.clientX;
      d.y = e.clientY;
    });
    const end = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      const d = this.drag;
      if (!d) return;
      if (d.id === e.pointerId && !d.moved && !d.multi && e.type === 'pointerup') this.clicks.push({ x: e.clientX, y: e.clientY });
      if (this.pointers.size === 0) this.drag = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.mouse.inside = false; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });
  }

  press(act) {
    if (!this.held.has(act)) this.pressed.add(act);
    this.held.add(act);
  }

  release(act) {
    if (this.held.has(act)) this.released.add(act);
    this.held.delete(act);
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  // Привязка экранной кнопки (сенсорное управление).
  bindButton(el, act) {
    const down = (e) => {
      e.preventDefault();
      // Захват: палец может съехать с кнопки, а она остаётся нажатой.
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* синтетическое событие */ }
      el.classList.add('down');
      this.press(act);
      if (navigator.vibrate && this.haptics) navigator.vibrate(8);
    };
    const up = (e) => { e.preventDefault(); el.classList.remove('down'); this.release(act); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  isHeld(act) { return this.enabled && this.held.has(act); }
  wasPressed(act) { return this.enabled && this.pressed.has(act); }
  wasReleased(act) { return this.released.has(act); }

  // Нажатия обрабатываются в первом тике кадра и затем сбрасываются.
  clearEdges() {
    this.pressed.clear();
    this.released.clear();
    this.clicks.length = 0;
  }

  clearFrame() {
    this.panDelta.x = this.panDelta.y = 0;
    this.wheel = 0;
    this.zoomFactor = 1;
  }
}
