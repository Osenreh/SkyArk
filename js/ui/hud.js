/* =========================================================================
   UI/HUD.JS — верхняя панель ресурсов, нижний док, обновление цифр
   Загружается после render/exp.js.
   ========================================================================= */
'use strict';

function elem(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt !== undefined) e.textContent = txt;
  return e;
}

class Hud {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this._build();
  }

  _build() {
    this.root.innerHTML = '';

    /* --- верхняя панель --- */
    const top = elem('div', 'topbar');

    const brand = elem('div', 'brand');
    brand.innerHTML = `
      <div class="mark">◆</div>
      <div>
        <div class="name">Небесный Ковчег</div>
        <div class="turn" id="hud-turn">Ход 1 · День 1</div>
      </div>`;
    top.appendChild(brand);

    this.resEls = {};
    for (const k of ['food', 'materials', 'energy', 'crystals', 'research']) {
      const el = elem('div', 'res');
      el.title = RNAME[k];
      el.innerHTML = `
        <span class="ic">${ICON[k]}</span>
        <span class="v">0</span>
        <span class="d"></span>`;
      top.appendChild(el);
      this.resEls[k] = el;
    }

    const sp = elem('div', 'spacer');
    top.appendChild(sp);

    this.popEl = elem('div', 'res');
    this.popEl.title = 'Население';
    this.popEl.innerHTML = `<span class="ic">☺</span><span class="v">0/0</span>`;
    top.appendChild(this.popEl);

    this.morEl = elem('div', 'res');
    this.morEl.title = 'Бодрость';
    this.morEl.innerHTML = `<span class="ic">♥</span><span class="v">0</span>`;
    top.appendChild(this.morEl);

    this.hullEl = elem('div', 'res');
    this.hullEl.title = 'Корпус';
    this.hullEl.innerHTML = `<span class="ic">⛨</span><span class="v">100</span>`;
    top.appendChild(this.hullEl);

    const settings = elem('button', 'btn ghost', '⚙');
    settings.title = 'Настройки';
    settings.addEventListener('click', () => this.app.openSettings());
    top.appendChild(settings);

    this.root.appendChild(top);

    /* --- нижний док --- */
    this.dock = elem('div', 'dock');
    this.root.appendChild(this.dock);
  }

  renderDock(buttons) {
    this.dock.innerHTML = '';
    for (const b of buttons) {
      const cls = `btn ${b.pri ? 'primary' : ''} ${b.on ? 'on' : ''}`.trim();
      const btn = elem('button', cls);
      btn.innerHTML = b.l + (b.k ? `<span class="k">${b.k}</span>` : '');
      btn.disabled = !!b.dis;
      if (b.t) btn.title = b.t;

      btn.addEventListener('mouseenter', () => {
        if (this.app.audio) this.app.audio.hover();
      });
      btn.addEventListener('click', () => {
        if (this.app.audio) this.app.audio.click();
        if (b.click) b.click();
      });
      this.dock.appendChild(btn);
    }
  }

  update(S) {
    const econ = computeEconomy(S);

    for (const k of ['food', 'materials', 'energy', 'crystals', 'research']) {
      const el = this.resEls[k];
      const v = S.resources[k] || 0;
      const disp = k === 'research'
        ? Math.floor(v)
        : (v >= 100 ? Math.floor(v) : Math.round(v * 10) / 10);

      el.querySelector('.v').textContent = disp;

      const d = el.querySelector('.d');
      const delta = econ.net[k];
      if (delta !== undefined && Math.abs(delta) > 0.05) {
        d.textContent = (delta > 0 ? '+' : '') + (Math.round(delta * 10) / 10);
        d.className = 'd' + (delta < 0 ? ' down' : '');
      } else {
        d.textContent = '';
        d.className = 'd';
      }

      el.classList.toggle('low', k !== 'research' && v < 15);
    }

    const cap = popCapacity(S);
    this.popEl.querySelector('.v').textContent = `${S.population.current}/${cap}`;
    this.popEl.classList.toggle('low', S.population.current >= cap);

    this.morEl.querySelector('.v').textContent = Math.round(S.population.morale);
    this.morEl.classList.toggle('low', S.population.morale < 30);

    this.hullEl.querySelector('.v').textContent = Math.round(S.city.hull);
    this.hullEl.classList.toggle('low', S.city.hull < 35);

    const t = document.getElementById('hud-turn');
    if (t) {
      const tr = S.travel ? ` · в пути ${S.travel.turnsLeft} х.` : '';
      const ex = (S.expedition && !S.expedition.over) ? ' · десант на поверхности' : '';
      t.textContent = `Ход ${S.turn} · День ${S.day}${tr}${ex}`;
    }
  }
}

window.elem = elem;
window.Hud = Hud;
