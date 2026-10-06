/* =========================================================================
   MAIN.JS — запуск игры: класс Game, главный цикл, клавиатура, кнопки
   Загружается последним.
   ========================================================================= */
'use strict';

/* ---------- панели (реестр для refreshPanels) ---------- */
const PANELS = {
  build:  buildPanel,
  squads: squadsPanel,
  tech:   techPanel,
  log:    logPanel,
};

class Game {
  constructor() {
    this.canvas = document.getElementById('stage');
    this.ctx = this.canvas.getContext('2d');
    this.hudRoot = document.getElementById('hud');
    this.sideRoot = document.getElementById('sidepanel');
    this.modalRoot = document.getElementById('modal');

    this.audio = new AudioEngine();
    this.sky = new Sky();
    this.modal = new Modal(this.modalRoot, this.audio);

    this.cityView = new CityView();
    this.mapView = new MapView();
    this.expView = new ExpView();

    this.state = null;
    this.scene = 'city';
    this.panelEl = null;
    this.panelName = null;

    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.last = performance.now();

    this._resize();
    window.addEventListener('resize', () => this._resize());

    this._bindKeys();
    this._bindPointer();
    this._bindMapInput();

    this.showTitle();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /* ---------- размеры ---------- */
  _resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.sky.resize(this.w, this.h);
    if (this.state) this.mapView.fit(this.w, this.h, this.state);
  }

  /* ---------- клавиатура ---------- */
  _bindKeys() {
    window.addEventListener('keydown', (e) => {
      if (this.modal.open) {
        if (e.key === 'Escape') this.modal.close();
        return;
      }
      if (!this.state) return;

      switch (e.key) {
        case '1': this.setScene('city'); break;
        case '2': this.setScene('map'); break;
        case 'b': case 'B': case 'и': case 'И':
          this.openPanel('build'); break;
        case 's': case 'S': case 'ы': case 'Ы':
          this.openPanel('squads'); break;
        case 't': case 'T': case 'е': case 'Е':
          this.openPanel('tech'); break;
        case 'l': case 'L': case 'д': case 'Д':
          this.openPanel('log'); break;
        case 'Escape': this.closePanel(); break;
        case 'Enter':
          if (this.scene !== 'expedition') this.doEndTurn();
          break;
      }
    });
  }

  /* ---------- разблокировка звука ---------- */
  _bindPointer() {
    const unlock = () => {
      this.audio.init();
      if (this.state) {
        this.audio.setSfx(this.state.settings.sfx);
        this.audio.setMusic(this.state.settings.music);
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  /* ---------- мышь на карте ---------- */
  _bindMapInput() {
    const c = this.canvas;

    c.addEventListener('wheel', (e) => {
      if (this.scene !== 'map') return;
      e.preventDefault();
      const z = this.mapView.tgt.zoom * (e.deltaY > 0 ? 0.9 : 1.1);
      this.mapView.tgt.zoom = U.clamp(z, 0.28, 1.8);
    }, { passive: false });

    c.addEventListener('mousedown', (e) => {
      if (this.scene !== 'map') return;
      this.mapView.drag = true;
      this.mapView.lastMouse = { x: e.clientX, y: e.clientY };
      this.mapView._downPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.state) return;
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (this.scene === 'map') {
        if (this.mapView.drag) {
          const dx = e.clientX - this.mapView.lastMouse.x;
          const dy = e.clientY - this.mapView.lastMouse.y;
          this.mapView.tgt.x -= dx / this.mapView.cam.zoom;
          this.mapView.tgt.y -= dy / this.mapView.cam.zoom;
          this.mapView.lastMouse = { x: e.clientX, y: e.clientY };
        }
        this.mapView.hover = this.mapView.pickNode(this.w, this.h, mx, my, this.state);
        c.style.cursor = this.mapView.drag ? 'grabbing' : (this.mapView.hover ? 'pointer' : 'grab');
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.scene !== 'map') return;
      const wasDragging = this.mapView.drag;
      this.mapView.drag = false;
      c.style.cursor = 'default';

      if (!wasDragging) return;

      const dx = e.clientX - this.mapView._downPos.x;
      const dy = e.clientY - this.mapView._downPos.y;
      if (Math.hypot(dx, dy) > 6) return; // это было перетаскивание

      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const node = this.mapView.pickNode(this.w, this.h, mx, my, this.state);
      if (node) this.onMapNodeClick(node);
    });
  }

  /* ---------- титульный экран ---------- */
  showTitle() {
    this.hudRoot.innerHTML = '';
    this.sideRoot.innerHTML = '';
    this.sideRoot.classList.remove('on');

    const t = document.createElement('div');
    t.className = 'title';
    t.innerHTML = `
      <h1>Небесный Ковчег</h1>
      <div class="tagline">город в облаках · выживание · десант</div>`;

    const menu = document.createElement('div');
    menu.className = 'title-menu';

    const saves = listSaves();
    const hasAny = saves.some(s => s);

    if (hasAny) {
      const b = document.createElement('button');
      b.className = 'btn primary';
      b.textContent = 'Продолжить';
      b.addEventListener('click', () => {
        this.audio.init();
        this.audio.confirm();
        this._loadLatest();
      });
      menu.appendChild(b);
    }

    const bn = document.createElement('button');
    bn.className = `btn ${hasAny ? '' : 'primary'}`;
    bn.textContent = 'Новая игра';
    bn.addEventListener('click', () => {
      this.audio.init();
      this.audio.confirm();
      this._newGameDialog();
    });
    menu.appendChild(bn);

    if (hasAny) {
      const bl = document.createElement('button');
      bl.className = 'btn';
      bl.textContent = 'Загрузить слот';
      bl.addEventListener('click', () => {
        this.audio.click();
        this._loadDialog();
      });
      menu.appendChild(bl);
    }

    const bh = document.createElement('button');
    bh.className = 'btn';
    bh.textContent = 'Как играть';
    bh.addEventListener('click', () => {
      this.audio.click();
      this._help();
    });
    menu.appendChild(bh);

    t.appendChild(menu);

    const foot = document.createElement('div');
    foot.className = 'foot';
    foot.textContent = 'v1.0 · мышь + клавиатура';
    t.appendChild(foot);

    this.hudRoot.appendChild(t);
  }

  _newGameDialog() {
    this.modal.show({
      tag: 'Новая игра',
      title: 'Название мира',
      html: `<p>Каждое имя порождает свою карту.</p>
        <p class="hint">Оставьте пустым для случайного мира.</p>
        <input type="text" class="text" id="seed-in" placeholder="например: Аврора">`,
      choices: [
        { label: 'Начать', hint: 'мир создастся сразу',
          onPick: () => {
            const v = (document.getElementById('seed-in') || {}).value || '';
            this._start(v);
          } },
        { label: 'Отмена', onPick: () => this.showTitle() },
      ],
    });
    setTimeout(() => {
      const el = document.getElementById('seed-in');
      if (el) el.focus();
    }, 80);
  }

  _loadDialog() {
    const saves = listSaves();
    const choices = saves.map((s, i) => {
      if (!s) return { label: `Слот ${i + 1} — пусто`, disabled: true };
      const d = new Date(s.savedAt);
      return {
        label: `Слот ${i + 1} · Ход ${s.turn}`,
        hint: `${s.pop} жителей · корпус ${Math.round(s.hull)}% · ${d.toLocaleString('ru-RU')}`,
        onPick: () => this._load(i),
      };
    });
    choices.push({ label: 'Назад', onPick: () => this.showTitle() });
    this.modal.show({
      tag: 'Загрузка',
      title: 'Выберите сохранение',
      html: '<p class="hint">Прогресс хранится в браузере.</p>',
      choices,
    });
  }

  _help() {
    this.modal.show({
      tag: 'Как играть',
      title: 'Основы',
      html: `
        <p><b>Цель.</b> Провести летающий город через мёртвый мир:
        строить модули, добывать ресурсы, развивать отряды, переживать события.</p>
        <p><b>Ход.</b> Каждый ход город производит ресурсы, население ест еду.
        Нажмите <em>Завершить ход</em> (Enter).</p>
        <p><b>Карта.</b> Клавиша <em>2</em>. Кликните на текущий узел,
        чтобы высадить десант. Кликните на соседний — проложить курс.</p>
        <p><b>Десант.</b> Отряд на поверхности собирает ресурсы, углубляется
        в опасные зоны и сражается. Когда действия закончатся — вернётся сам.</p>
        <p><b>Горячие клавиши.</b>
        <em>B</em> — стройка, <em>S</em> — отряды,
        <em>T</em> — технологии, <em>L</em> — журнал.</p>
        <p class="hint">Колесо мыши — зум карты, зажатая ЛКМ — панорама.</p>`,
      closable: true,
    });
  }

  /* ---------- старт игры ---------- */
  _start(seed) {
    this.state = this._newState(seed);
    this._boot();
    this.modal.toast('Ковчег поднялся в небо', 'good');
    addLog(this.state, 'Ковчег оторвался от земли. Курс — в облака.', 'info');
  }

  _newState(seedStr) {
    const seed = U.hash(seedStr || String(Date.now() ^ (Math.random() * 1e9)));
    const world = World.generate(seed);

    const S = {
      version: 1,
      seed,
      turn: 1,
      day: 1,
      resources: { food: 120, materials: 90, energy: 60, crystals: 0, research: 0 },
      population: { current: 12, capacity: 20, morale: 70 },
      city: {
        name: 'Ковчег',
        hull: 100,
        hullMax: 100,
        modules: [
          { id: 'm1', type: 'habitat', level: 1 },
          { id: 'm2', type: 'farm', level: 1 },
          { id: 'm3', type: 'reactor', level: 1 },
        ],
        tech: [],
        nodeId: world.startId,
      },
      squads: [makeSquad('Альфа', ['gunner', 'scout', 'engineer'])],
      world,
      travel: null,
      expedition: null,
      log: [],
      seen: {},
      flags: {},
      counters: { m: 3 },
      stats: {
        built: 0, expeditions: 0, eventsResolved: 0,
        nodesVisited: 1, turnsSurvived: 0,
      },
      settings: { sfx: true, music: true },
      phase: 'city',
    };
    S.population.capacity = popCapacity(S);
    return S;
  }

  _load(slot) {
    const d = loadGame(slot);
    if (!d) {
      this.modal.toast('Сохранение не найдено', 'bad');
      this.showTitle();
      return;
    }
    // дозаполнение полей
    d.seen ||= {};
    d.flags ||= {};
    d.log ||= [];
    d.counters ||= { m: 3 };
    d.stats ||= { built: 0, expeditions: 0, eventsResolved: 0, nodesVisited: 1, turnsSurvived: 0 };
    d.settings ||= { sfx: true, music: true };
    d.resources.research ??= 0;

    this.state = d;
    this._boot();
    this.modal.toast('Игра загружена', 'good');
  }

  _loadLatest() {
    const saves = listSaves();
    let idx = 0;
    for (let i = 0; i < saves.length; i++) {
      if (saves[i] && (!saves[idx] || saves[i].savedAt > saves[idx].savedAt)) idx = i;
    }
    this._load(idx);
  }

  _boot() {
    this.hudRoot.innerHTML = '';
    this.hud = new Hud(this.hudRoot, this);

    const cur = World.nodeById(this.state.world, this.state.city.nodeId);
    if (cur) revealAround(this.state, cur, visionRadius(this.state));

    this.audio.setSfx(this.state.settings.sfx);
    this.audio.setMusic(this.state.settings.music);

    this.setScene('city');
    this.hud.update(this.state);
  }

  /* ---------- сцены ---------- */
  setScene(name) {
    if (!this.state) return;
    this.scene = name;
    this.state.phase = name;
    this.closePanel();
    this._renderDock();
    if (name === 'map') {
      this.mapView.centerOn(this.state,
        this.state.travel ? this.state.travel.toId : this.state.city.nodeId);
      if (!this.mapView.inited) {
        this.mapView.fit(this.w, this.h, this.state);
        setTimeout(() => this.mapView.fit(this.w, this.h, this.state), 60);
        this.mapView.inited = true;
      }
    }
  }

  _renderDock() {
    if (!this.hud) return;
    const S = this.state;
    const buttons = [];

    if (this.scene === 'expedition') {
      buttons.push({
        l: '⏎ Завершить ход', pri: true, dis: true,
        t: 'Верните отряд с поверхности',
        click: () => {},
      });
      buttons.push({ l: '◂ На карту', click: () => this.setScene('map') });
    } else {
      buttons.push({ l: '⌂ Город', k: '1', on: this.scene === 'city',
        click: () => this.setScene('city') });
      buttons.push({ l: '◎ Карта', k: '2', on: this.scene === 'map',
        click: () => this.setScene('map') });
      buttons.push({ l: 'Строить', k: 'B', click: () => this.openPanel('build') });
      buttons.push({ l: 'Отряды', k: 'S', click: () => this.openPanel('squads') });
      buttons.push({ l: 'Наука',  k: 'T', click: () => this.openPanel('tech') });
      buttons.push({ l: 'Журнал', k: 'L', click: () => this.openPanel('log') });
      buttons.push({
        l: S.travel ? `⏳ В пути (${S.travel.turnsLeft})` : '▶ Завершить ход',
        pri: true, k: '⏎',
        dis: !!(S.expedition && !S.expedition.over),
        t: (S.expedition && !S.expedition.over) ? 'Сначала верните отряд' : '',
        click: () => this.doEndTurn(),
      });
    }

    this.hud.renderDock(buttons);
  }

  /* ---------- панели ---------- */
  openPanel(name) {
    if (this.panelName === name) { this.closePanel(); return; }
    this.closePanel();

    const el = document.createElement('div');
    el.className = 'side-panel on';
    this.sideRoot.appendChild(el);

    PANELS[name](this, el);
    this.panelEl = el;
    this.panelName = name;
    if (this.audio) this.audio.click();
  }

  closePanel() {
    if (this.panelEl) {
      this.panelEl.remove();
      this.panelEl = null;
    }
    this.panelName = null;
  }

  refreshPanels() {
    if (!this.panelName) return;
    const name = this.panelName;
    this.closePanel();
    this.openPanel(name);
    if (this.hud) this.hud.update(this.state);
  }

  /* ---------- ход ---------- */
  doEndTurn() {
    if (!this.state) return;
    if (this.modal.open) return;
    const S = this.state;

    if (S.expedition && !S.expedition.over) {
      this.audio.deny();
      this.modal.toast('Сначала верните отряд с поверхности', 'warn');
      return;
    }

    const report = doEndTurn(this);

    if (this.hud) this.hud.update(S);
    this._renderDock();

    for (const w of report.warnings) {
      this.modal.toast(w, 'warn');
      this.audio.alarm();
    }

    if (report.event) {
      setTimeout(() => this._showEvent(report.event), 240);
    }
  }

  _showEvent(ev) {
    this.audio.event();
    const S = this.state;

    const choices = ev.choices.map(ch => {
      const dis = ch.cond ? !ch.cond(S) : false;
      return {
        label: ch.label,
        hint: ch.hint,
        disabled: dis,
        onPick: () => {
          const result = ch.apply(S);
          S.stats.eventsResolved++;
          addLog(S, `${ev.title}: ${result}`, 'info');
          if (this.hud) this.hud.update(S);
          this._renderDock();
          this.refreshPanels();

          this.modal.show({
            tag: ev.tag || 'Событие',
            title: 'Итог',
            html: `<p>${result}</p>`,
            closable: true,
          });
          this.audio.confirm();
        },
      };
    });

    this.modal.show({
      tag: ev.tag || 'Событие',
      title: ev.title,
      html: `<p>${ev.text}</p>`,
      choices,
    });
  }

  /* ---------- клик по узлу карты ---------- */
  onMapNodeClick(node) {
    const S = this.state;

    if (S.expedition && !S.expedition.over) {
      this.modal.toast('Отряд ещё на поверхности', 'warn');
      return;
    }

    if (node.id === S.city.nodeId) {
      this._showNodeMenu(node);
      return;
    }

    const from = World.nodeById(S.world, S.city.nodeId);
    if (from.edges.indexOf(node.id) < 0) {
      this.modal.toast('Нет прямого маршрута', 'warn');
      return;
    }

    const turns = World.travelTurns(from, node);
    const cost = turns * 4;

    this.modal.show({
      tag: 'Маршрут',
      title: `Курс на «${node.name}»`,
      html: `<p>Перелёт займёт <b>${turns}</b> ходов и потребует <b>${cost} ⚡</b> энергии.</p>
        <p class="hint">В пути каждый ход расходуется 4 ⚡ и 2 ❦.</p>`,
      choices: [
        { label: 'Проложить курс',
          disabled: S.resources.energy < cost,
          onPick: () => {
            const res = beginTravel(this, node.id);
            if (res.ok) {
              this.modal.toast(`Курс на «${node.name}»`, 'good');
              this.setScene('city');
            } else {
              this.audio.deny();
              this.modal.toast(res.reason, 'bad');
            }
          } },
        { label: 'Отмена', onPick: () => {} },
      ],
    });
  }

  /* ---------- меню текущего узла ---------- */
  _showNodeMenu(node) {
    const S = this.state;
    const idle = S.squads.filter(s => s.status === 'idle' && squadAlive(s) > 0);
    const b = BIOMES[node.biome];

    const choices = [];

    if (idle.length) {
      choices.push({
        label: `Отправить десант (${idle.length} отр.)`,
        hint: '−5 ❦, −3 ⚡ · собрать ресурсы',
        onPick: () => this._pickSquad(node, idle),
      });
    } else {
      choices.push({
        label: 'Десант недоступен',
        hint: S.squads.some(s => s.status === 'expedition')
          ? 'Отряд уже на поверхности'
          : 'Нет боеспособных отрядов',
        disabled: true,
      });
    }

    choices.push({ label: 'Закрыть', onPick: () => {} });

    this.modal.show({
      tag: b.name,
      title: node.name,
      html: `
        <p>${b.desc}</p>
        <p><b>Опасность:</b> ${node.danger}/3 &nbsp;·&nbsp;
           <b>Богатство:</b> ×${node.rich} &nbsp;·&nbsp;
           <b>Разграблено:</b> ${node.cleared} раз</p>`,
      choices,
    });
  }

  _pickSquad(node, list) {
    const choices = list.map(sq => {
      const hp = squadHp(sq);
      const max = squadMaxHp(sq);
      return {
        label: `${sq.name} (ур. ${sq.level})`,
        hint: `HP ${Math.round(hp)}/${max} · вылазок ${sq.expeditions}`,
        onPick: () => this._launchExpedition(sq, node),
      };
    });
    choices.push({ label: 'Отмена', onPick: () => {} });

    this.modal.show({
      tag: 'Десант',
      title: `Кого отправить в «${node.name}»?`,
      html: '<p>Стоимость высадки: <b>5 ❦</b> и <b>3 ⚡</b>.</p>',
      choices,
    });
  }

  _launchExpedition(squad, node) {
    const S = this.state;

    if (S.resources.food < 5 || S.resources.energy < 3) {
      this.audio.deny();
      this.modal.toast('Не хватает еды или энергии', 'bad');
      return;
    }

    S.resources.food -= 5;
    S.resources.energy -= 3;

    const res = Expedition.start(S, squad, node.id);
    if (!res.ok) {
      this.audio.deny();
      this.modal.toast(res.reason, 'bad');
      return;
    }

    this.audio.confirm();
    this.setScene('expedition');
  }

  /* ---------- сцена вылазки: действия ---------- */
  expeditionAction(id) {
    const S = this.state;
    if (!S.expedition) return;

    if (id === 'extract') {
      const sq = S.squads.find(x => x.id === S.expedition.squadId);
      const res = Expedition.finish(S, sq);
      if (res.ok) {
        addLog(S, `«${sq.name}» вернулся с вылазки. ${res.summary}.`, 'good');
        this.modal.toast(`Возвращение: ${res.summary}`, 'good');
        S.expedition = null;
        this.setScene('city');
      }
      return;
    }

    const res = Expedition.do(S, id);
    if (!res.ok) {
      this.audio.deny();
      this.modal.toast(res.reason || 'Нельзя', 'bad');
      return;
    }

    this.audio.click();
    if (res.encounter) {
      this.audio.alarm();
      this.audio.duck(true);
      this.expView.hit();
    }
    if (this.hud) this.hud.update(S);
  }

  expeditionFight(mode) {
    const S = this.state;
    const res = Expedition.fight(S, mode);

    if (mode === 'attack') this.audio.hit();
    this.expView.hit();

    if (res.won) {
      this.audio.levelUp();
      this.audio.duck(false);
    } else if (res.wiped) {
      this.audio.alarm();
      this.audio.duck(false);
      this.modal.toast('Отряд уничтожен', 'bad');
      setTimeout(() => {
        S.expedition = null;
        this.setScene('city');
      }, 900);
    } else if (res.fled) {
      this.audio.duck(false);
      this.modal.toast('Отряд отступил', 'warn');
    }

    if (this.hud) this.hud.update(S);
  }

  /* ---------- прибытие в узел ---------- */
  onArrive(node) {
    if (this.cityView) this.cityView.triggerArrival();
    this.modal.toast(`Прибытие: ${node.name}`, 'good');
  }

  /* ---------- настройки ---------- */
  openSettings() {
    const S = this.state;
    if (!S) return;

    this.modal.show({
      tag: 'Настройки',
      title: 'Параметры',
      html: `
        <p><b>Seed:</b> ${S.seed}</p>
        <p><b>Ход:</b> ${S.turn} · <b>День:</b> ${S.day}</p>
        <p><b>Модулей:</b> ${S.city.modules.length} · <b>Технологий:</b> ${S.city.tech.length}</p>
        <p><b>Вылазок:</b> ${S.stats.expeditions} · <b>Событий:</b> ${S.stats.eventsResolved}</p>`,
      choices: [
        { label: `Звук: ${S.settings.sfx ? 'вкл' : 'выкл'}`,
          onPick: () => {
            S.settings.sfx = !S.settings.sfx;
            this.audio.setSfx(S.settings.sfx);
            this.openSettings();
          } },
        { label: `Музыка: ${S.settings.music ? 'вкл' : 'выкл'}`,
          onPick: () => {
            S.settings.music = !S.settings.music;
            this.audio.setMusic(S.settings.music);
            this.openSettings();
          } },
        { label: 'Сохранить в слот 1', hint: 'текущий прогресс',
          onPick: () => {
            const r = saveGame(S, 0);
            this.modal.toast(r.ok ? 'Сохранено' : 'Ошибка', r.ok ? 'good' : 'bad');
          } },
        { label: 'Сохранить в слот 2',
          onPick: () => {
            const r = saveGame(S, 1);
            this.modal.toast(r.ok ? 'Сохранено' : 'Ошибка', r.ok ? 'good' : 'bad');
          } },
        { label: 'Сохранить в слот 3',
          onPick: () => {
            const r = saveGame(S, 2);
            this.modal.toast(r.ok ? 'Сохранено' : 'Ошибка', r.ok ? 'good' : 'bad');
          } },
        { label: 'В главное меню', hint: 'несохранённое потеряется',
          onPick: () => this._confirmQuit() },
        { label: 'Закрыть', onPick: () => {} },
      ],
    });
  }

  _confirmQuit() {
    this.modal.show({
      tag: 'Выход',
      title: 'В главное меню?',
      html: '<p>Несохранённый прогресс будет потерян.</p>',
      choices: [
        { label: 'Сохранить и выйти',
          onPick: () => {
            saveGame(this.state, 0);
            this.state = null;
            this.showTitle();
          } },
        { label: 'Выйти без сохранения',
          onPick: () => {
            this.state = null;
            this.showTitle();
          } },
        { label: 'Отмена', onPick: () => {} },
      ],
    });
  }

  /* ---------- главный цикл ---------- */
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    const cx = this.ctx;
    cx.clearRect(0, 0, this.w, this.h);

    this.sky.update(dt);
    this.cityView.update(dt);
    this.expView.update(dt);
    this.mapView.update(dt);

    if (this.state) {
      if (this.scene === 'map') {
        this.sky.draw(cx, this.w, this.h);
        this.sky.drawClouds(cx, this.w, this.h, 0, 4, 0.2);
        this.mapView.draw(cx, this.w, this.h, this.state, {});
      } else if (this.scene === 'expedition') {
        this.sky.draw(cx, this.w, this.h);
        const sq = Expedition.squad(this.state);
        this.expView.draw(cx, this.w, this.h, this.state, sq);
        this._expeditionUI();
      } else {
        this.sky.draw(cx, this.w, this.h);
        this.sky.drawClouds(cx, this.w, this.h, 0, 2, 0.7);
        this.cityView.draw(cx, this.w, this.h, this.state);
        this.sky.drawClouds(cx, this.w, this.h, 2, 4, 0.5);
        this.sky.drawSea(cx, this.w, this.h, performance.now() / 1000);
      }
      if (this.hud) this.hud.update(this.state);
    } else {
      this.sky.draw(cx, this.w, this.h);
      this.sky.drawSea(cx, this.w, this.h, performance.now() / 1000);
    }

    requestAnimationFrame(this.loop);
  }

  /* ---------- боковая панель вылазки ---------- */
  _expeditionUI() {
    const S = this.state;
    const e = S.expedition;
    if (!e) return;

    // создаём панель один раз
    if (this.panelName !== 'expedition') {
      this.closePanel();
      const el = document.createElement('div');
      el.className = 'side-panel on';
      this.sideRoot.appendChild(el);
      this.panelEl = el;
      this.panelName = 'expedition';
    }

    const container = this.panelEl;
    container.innerHTML = '';

    const node = Expedition.node(S);
    const sq = Expedition.squad(S);

    const head = elem('div', 'side-head');
    head.innerHTML = `<h3>Вылазка</h3>
      <span class="sub">${Expedition.ZONES[e.zone].n}</span>`;
    container.appendChild(head);

    const body = elem('div', 'side-body');

    /* место */
    const loc = elem('div', 'card');
    loc.innerHTML = `
      <div class="card-top">
        <div class="ic">${BIOME_ICON[node.biome]}</div>
        <div class="ttl">${node.name}</div>
        <div class="lvl">опасность ${node.danger}/3</div>
      </div>
      <div class="stats">
        <span class="stat key">действий ${e.actionsLeft}/${e.actionsMax}</span>
      </div>`;
    body.appendChild(loc);

    /* груз */
    const cap = squadCapacity(S);
    const total = Expedition.lootTotal(S);
    const cargo = elem('div', 'card');
    const lootStats = Object.entries(e.loot)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `<span class="stat pos">${ICON[k]} ${Math.round(v)}</span>`)
      .join('') || '<span class="stat">пусто</span>';

    cargo.innerHTML = `
      <div class="card-top">
        <div class="ic">▤</div>
        <div class="ttl">Груз</div>
        <div class="lvl">${Math.round(total)}/${cap}</div>
      </div>
      <div class="bar"><i style="width:${Math.min(100, total / cap * 100)}%"></i></div>
      <div class="stats" style="margin-top:8px">${lootStats}</div>`;
    body.appendChild(cargo);

    /* отряд */
    if (sq) {
      const hp = squadHp(sq);
      const max = squadMaxHp(sq);
      const frac = max ? hp / max : 0;
      const squadCard = elem('div', 'card');
      squadCard.innerHTML = `
        <div class="card-top">
          <div class="ic">⛊</div>
          <div class="ttl">${sq.name}</div>
          <div class="lvl">ур. ${sq.level}</div>
        </div>
        <div class="bar ${frac > 0.5 ? 'g' : frac > 0.25 ? 'w' : 'b'}">
          <i style="width:${frac * 100}%"></i>
        </div>
        <div class="stats" style="margin-top:8px">
          <span class="stat">HP ${Math.round(hp)}/${max}</span>
        </div>`;
      body.appendChild(squadCard);
    }

    /* бой */
    if (e.encounter) {
      const en = e.encounter.enemy;
      const ef = Math.max(0, e.encounter.enemyHp / en.maxHp);
      const fight = elem('div', 'card');
      fight.innerHTML = `
        <div class="card-top">
          <div class="ic">☠</div>
          <div class="ttl">${en.n}</div>
          <div class="lvl">раунд ${e.encounter.round}</div>
        </div>
        <div class="bar b"><i style="width:${ef * 100}%"></i></div>
        <div class="stats" style="margin-top:8px">
          <span class="stat neg">HP ${Math.max(0, Math.round(e.encounter.enemyHp))}/${en.maxHp}</span>
          <span class="stat neg">сила ${en.pw}</span>
        </div>`;
      body.appendChild(fight);

      const atk = elem('button', 'btn primary');
      atk.textContent = '⚔ Атаковать';
      atk.style.width = '100%';
      atk.addEventListener('click', () => this.expeditionFight('attack'));
      body.appendChild(atk);

      const flee = elem('button', 'btn');
      flee.textContent = '↩ Отступить';
      flee.style.width = '100%';
      flee.addEventListener('click', () => this.expeditionFight('flee'));
      body.appendChild(flee);
    } else {
      /* действия */
      const acts = Expedition.actions(S);
      for (const a of acts) {
        const btn = elem('button', 'opt');
        btn.disabled = !a.enabled;
        btn.innerHTML = `<span class="lbl">${a.label}</span>
          ${a.hint ? `<span class="hint">${a.hint}</span>` : ''}`;
        btn.addEventListener('click', () => this.expeditionAction(a.id));
        body.appendChild(btn);
      }
    }

    /* журнал вылазки */
    for (const l of e.log.slice(0, 12)) {
      const d = elem('div', `logline ${l.kind || 'info'}`);
      d.textContent = l.text;
      body.appendChild(d);
    }

    container.appendChild(body);

    const foot = elem('div', 'side-foot');
    const back = elem('button', 'btn ghost', '◂ На карту');
    back.style.flex = '1';
    back.addEventListener('click', () => this.setScene('map'));
    foot.appendChild(back);
    container.appendChild(foot);
  }
}

/* ---------- обработчик ошибок ---------- */
window.addEventListener('error', (e) => {
  console.error('[skyark]', e.error || e.message);
});

/* ---------- старт ---------- */
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
