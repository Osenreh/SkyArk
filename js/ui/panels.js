/* =========================================================================
   UI/PANELS.JS — боковые панели: строительство, отряды, технологии, журнал
   Загружается после modal.js. Использует elem, ICON, BUILDINGS, TECH.
   ========================================================================= */
'use strict';

/* ---------- СТРОИТЕЛЬСТВО ---------- */
function buildPanel(app, container) {
  const S = app.state;
  container.innerHTML = '';

  const head = elem('div', 'side-head');
  head.innerHTML = `
    <h3>Модули Ковчега</h3>
    <span class="sub">${S.city.modules.length} постр.</span>`;
  container.appendChild(head);

  const body = elem('div', 'side-body');
  const econ = computeEconomy(S);

  /* баланс */
  const ecoCard = elem('div', 'card');
  const ecoStats = ['food', 'materials', 'energy', 'crystals']
    .filter(k => Math.abs(econ.net[k]) > 0.05)
    .map(k => `<span class="stat ${econ.net[k] > 0 ? 'pos' : 'neg'}">
      ${ICON[k]} ${econ.net[k] > 0 ? '+' : ''}${econ.net[k]}
    </span>`).join('');

  ecoCard.innerHTML = `
    <div class="card-top">
      <div class="ic">Σ</div>
      <div class="ttl">Баланс за ход</div>
    </div>
    <div class="stats">${ecoStats || '<span class="stat">всё в равновесии</span>'}</div>`;
  body.appendChild(ecoCard);

  /* список зданий */
  for (const type of BUILD_ORDER) {
    const def = BUILDINGS[type];
    const lvl = moduleLevel(S, type);
    const chk = buildCheck(S, type);

    const card = elem('div', `card ${chk.ok ? 'click' : 'dis'}`);

    // точки уровней
    let dots = '';
    for (let i = 0; i < def.max; i++) {
      dots += `<span style="color:${i < lvl ? '#7fe3d4' : 'rgba(255,255,255,.2)'}">●</span>`;
    }

    // эффекты
    const eff = [];
    if (def.produce && lvl) {
      const p = def.produce(lvl);
      for (const k in p) {
        if (p[k]) eff.push(`<span class="stat pos">${ICON[k]} +${p[k]}</span>`);
      }
    }
    if (def.upkeep && lvl) {
      const u = def.upkeep(lvl);
      for (const k in u) {
        if (u[k]) eff.push(`<span class="stat neg">${ICON[k]} −${u[k]}</span>`);
      }
    }
    if (def.special && lvl) {
      const names = {
        heal: 'лечение', train: 'опыт', maxSquads: 'отрядов',
        carry: 'груз', vision: 'обзор', research: 'наука', morale: 'бодрость',
      };
      for (const k in def.special) {
        const v = def.special[k](lvl);
        if (v) eff.push(`<span class="stat key">${names[k] || k} ${v}</span>`);
      }
    }

    const costStr = chk.cost
      ? costLabel(chk.cost)
      : (lvl >= def.max ? 'Максимум' : '—');
    const costCls = chk.ok ? 'pos' : 'neg';

    card.innerHTML = `
      <div class="card-top">
        <div class="ic">${def.icon}</div>
        <div class="ttl">${def.name}</div>
        <div class="lvl">${dots}</div>
      </div>
      <p>${def.desc}</p>
      ${eff.length ? `<div class="stats">${eff.join('')}</div>` : ''}
      <div class="stats" style="margin-top:6px">
        ${lvl >= def.max
          ? '<span class="stat key">Максимум</span>'
          : `<span class="stat ${costCls}">${costStr}</span>`}
      </div>`;

    if (chk.ok) {
      card.addEventListener('mouseenter', () => {
        if (app.audio) app.audio.hover();
      });
      card.addEventListener('click', () => {
        const res = doBuild(S, type);
        if (res.ok) {
          if (app.audio) app.audio.build();
          addLog(S, `${def.name} — уровень ${moduleLevel(S, type)}.`, 'good');
          app.modal.toast(`${def.name} улучшен`, 'good');
          app.refreshPanels();
        } else {
          if (app.audio) app.audio.deny();
          app.modal.toast(res.reason || 'Нельзя', 'bad');
        }
      });
    }
    body.appendChild(card);
  }

  container.appendChild(body);

  const foot = elem('div', 'side-foot');
  const close = elem('button', 'btn ghost', 'Закрыть');
  close.style.flex = '1';
  close.addEventListener('click', () => {
    if (app.audio) app.audio.click();
    app.closePanel();
  });
  foot.appendChild(close);
  container.appendChild(foot);
}

/* ---------- ОТРЯДЫ ---------- */
function squadsPanel(app, container) {
  const S = app.state;
  container.innerHTML = '';

  const head = elem('div', 'side-head');
  head.innerHTML = `
    <h3>Отряды</h3>
    <span class="sub">${S.squads.length}/${maxSquads(S)}</span>`;
  container.appendChild(head);

  const body = elem('div', 'side-body');

  for (const sq of S.squads) {
    const card = elem('div', 'card');
    const hp = squadHp(sq);
    const maxHp = squadMaxHp(sq);
    const frac = maxHp ? hp / maxHp : 0;

    const status = {
      idle:       '<span class="stat key">в городе</span>',
      expedition: '<span class="stat pos">на вылазке</span>',
      downed:     '<span class="stat neg">потерян</span>',
    }[sq.status] || '';

    const members = sq.members.map(m => {
      const role = ROLES[m.role] || ROLES.gunner;
      const dead = m.hp <= 0;
      const mf = Math.max(0, m.hp / m.maxHp);

      const traits = m.traits.map(tid => {
        const t = TRAITS.find(x => x.id === tid);
        return t ? `<span class="stat key" title="${t.desc}">${t.name}</span>` : '';
      }).join('');

      return `
        <div class="unit ${dead ? 'dead' : ''}">
          <div class="role">${role.icon} ${role.name}</div>
          <div class="hp" style="color:${dead ? '#ff6b6b' : mf > 0.5 ? '#5fd68a' : mf > 0.25 ? '#ffb457' : '#ff6b6b'}">
            ${Math.round(m.hp)}/${m.maxHp}
          </div>
          <div style="margin-top:4px">${traits}</div>
        </div>`;
    }).join('');

    card.innerHTML = `
      <div class="card-top">
        <div class="ic">⛊</div>
        <div class="ttl">${sq.name}</div>
        <div class="lvl">ур. ${sq.level}</div>
      </div>
      <div class="stats">
        ${status}
        <span class="stat">HP ${Math.round(hp)}/${maxHp}</span>
        <span class="stat">вылазок ${sq.expeditions}</span>
        <span class="stat">убито ${sq.kills}</span>
      </div>
      <div class="bar ${frac > 0.5 ? 'g' : frac > 0.25 ? 'w' : 'b'}">
        <i style="width:${frac * 100}%"></i>
      </div>
      <div style="margin-top:8px;font-size:11px;color:#61708c">
        опыт ${sq.xp}/${sq.xpNext}
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        ${members}
      </div>`;

    body.appendChild(card);
  }

  /* новый отряд */
  if (S.squads.length < maxSquads(S)) {
    const cost = { food: 40, materials: 30 };
    const can = S.resources.food >= cost.food && S.resources.materials >= cost.materials;

    const card = elem('div', `card ${can ? 'click' : 'dis'}`);
    card.innerHTML = `
      <div class="card-top">
        <div class="ic">＋</div>
        <div class="ttl">Сформировать отряд</div>
      </div>
      <p>Новый десантный отряд из трёх бойцов.</p>
      <div class="stats">
        <span class="stat ${can ? 'pos' : 'neg'}">${costLabel(cost)}</span>
      </div>`;

    if (can) {
      card.addEventListener('click', () => {
        S.resources.food -= cost.food;
        S.resources.materials -= cost.materials;

        const names = ['Бета', 'Гамма', 'Дельта', 'Эпсилон', 'Дзета'];
        const name = names[S.squads.length - 1] || `Отряд ${S.squads.length + 1}`;
        S.squads.push(makeSquad(name, ['gunner', 'scout', 'medic']));

        if (app.audio) app.audio.confirm();
        addLog(S, `Сформирован отряд «${name}».`, 'good');
        app.modal.toast(`Отряд «${name}» готов`, 'good');
        app.refreshPanels();
      });
    }
    body.appendChild(card);
  }

  container.appendChild(body);

  const foot = elem('div', 'side-foot');
  const close = elem('button', 'btn ghost', 'Закрыть');
  close.style.flex = '1';
  close.addEventListener('click', () => {
    if (app.audio) app.audio.click();
    app.closePanel();
  });
  foot.appendChild(close);
  container.appendChild(foot);
}

/* ---------- ТЕХНОЛОГИИ ---------- */
function techPanel(app, container) {
  const S = app.state;
  container.innerHTML = '';

  const head = elem('div', 'side-head');
  head.innerHTML = `
    <h3>Способности города</h3>
    <span class="sub">⌬ ${Math.floor(S.resources.research)}</span>`;
  container.appendChild(head);

  const body = elem('div', 'side-body');

  for (const id of TECH_ORDER) {
    const def = TECH[id];
    const owned = hasTech(S, id);
    const can = !owned && S.resources.research >= def.cost;

    const card = elem('div', `card ${owned ? 'dis' : can ? 'click' : 'dis'}`);
    card.innerHTML = `
      <div class="card-top">
        <div class="ic">${def.icon}</div>
        <div class="ttl">${def.name}</div>
        ${owned
          ? '<span class="stat key">изучено</span>'
          : `<div class="lvl">${def.cost} ⌬</div>`}
      </div>
      <p>${def.desc}</p>`;

    if (can) {
      card.addEventListener('click', () => {
        const res = researchTech(S, id);
        if (res.ok) {
          if (app.audio) app.audio.levelUp();
          addLog(S, `Изучено: ${def.name}.`, 'good');
          app.modal.toast(`${def.name} — изучено`, 'good');
          app.refreshPanels();
        } else {
          if (app.audio) app.audio.deny();
          app.modal.toast(res.reason, 'bad');
        }
      });
    }
    body.appendChild(card);
  }

  container.appendChild(body);

  const foot = elem('div', 'side-foot');
  const close = elem('button', 'btn ghost', 'Закрыть');
  close.style.flex = '1';
  close.addEventListener('click', () => {
    if (app.audio) app.audio.click();
    app.closePanel();
  });
  foot.appendChild(close);
  container.appendChild(foot);
}

/* ---------- ЖУРНАЛ ---------- */
function logPanel(app, container) {
  const S = app.state;
  container.innerHTML = '';

  const head = elem('div', 'side-head');
  head.innerHTML = `
    <h3>Судовой журнал</h3>
    <span class="sub">${S.log.length}</span>`;
  container.appendChild(head);

  const body = elem('div', 'side-body');

  if (!S.log.length) {
    body.innerHTML = '<p class="hint">Пока ничего не произошло.</p>';
  }

  for (const line of S.log) {
    const d = elem('div', `logline ${line.kind || 'info'}`);
    d.textContent = `[День ${line.day}] ${line.text}`;
    body.appendChild(d);
  }

  container.appendChild(body);
}

/* ---------- экспорт ---------- */
window.buildPanel = buildPanel;
window.squadsPanel = squadsPanel;
window.techPanel = techPanel;
window.logPanel = logPanel;
