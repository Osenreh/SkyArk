/* =========================================================================
   TURN.JS — завершение хода, перелёты между узлами, прибытие
   Загружается после expedition.js.
   ========================================================================= */
'use strict';

/* ---------- завершение хода ---------- */
function doEndTurn(app) {
  const S = app.state;
  const report = { lines: [], warnings: [], event: null };

  /* --- 1. экономика --- */
  const econ = computeEconomy(S);
  for (const k of ['food', 'materials', 'energy', 'crystals']) {
    S.resources[k] = +((S.resources[k] || 0) + (econ.net[k] || 0)).toFixed(1);
  }

  /* --- 2. голод --- */
  if (S.resources.food < 0) {
    const deficit = Math.abs(Math.round(S.resources.food));
    S.resources.food = 0;
    S.population.morale = Math.max(0, S.population.morale - 8);
    const lost = Math.max(1, Math.floor(deficit / 12));
    S.population.current = Math.max(1, S.population.current - lost);
    report.warnings.push(`Голод: −${lost} жителей`);
    addLog(S, `Голод на борту. Погибло ${lost}.`, 'bad');
  }

  /* --- 3. дефицит энергии --- */
  if (S.resources.energy < 0) {
    S.resources.energy = 0;
    S.city.hull = Math.max(0, S.city.hull - 3);
    report.warnings.push('Нехватка энергии: корпус −3');
  }

  /* --- 4. наука --- */
  let research = 0;
  for (const m of S.city.modules) {
    if (m.type === 'lab') research += BUILDINGS.lab.special.research(m.level);
  }
  if (research) S.resources.research += research;

  /* --- 5. бодрость --- */
  let moraleDelta = 0;
  for (const m of S.city.modules) {
    if (m.type === 'garden') moraleDelta += BUILDINGS.garden.special.morale(m.level);
  }
  moraleDelta += S.population.morale > 50 ? -1 : 1;
  S.population.morale = U.clamp(S.population.morale + moraleDelta, 0, 100);
  if (S.population.morale <= 15) report.warnings.push('Бодрость критическая');

  /* --- 6. медицина и тренировки --- */
  let heal = 0, train = 0;
  for (const m of S.city.modules) {
    if (m.type === 'hospital') heal  += BUILDINGS.hospital.special.heal(m.level);
    if (m.type === 'barracks') train += BUILDINGS.barracks.special.train(m.level);
  }
  for (const sq of S.squads) {
    if (sq.status === 'expedition' || sq.status === 'downed') continue;
    if (heal)  healSquad(sq, heal);
    if (train) grantXp(sq, train);
  }

  /* --- 7. ремонт корпуса на стоянке --- */
  if (!S.travel && S.city.hull < S.city.hullMax) repairHull(S, 2);

  /* --- 8. перелёт --- */
  if (S.travel) {
    S.resources.energy = Math.max(0, S.resources.energy - 4);
    S.resources.food   = Math.max(0, S.resources.food - 2);
    S.travel.turnsLeft--;
    report.lines.push(`Перелёт: осталось ${S.travel.turnsLeft} х.`);
    if (S.travel.turnsLeft <= 0) arriveAt(S, app);
  }

  /* --- 9. вылазка --- */
  if (S.expedition && !S.expedition.over) {
    Expedition.tick(S);
    if (S.expedition.actionsLeft <= 0 && !S.expedition.encounter) {
      const sq = S.squads.find(x => x.id === S.expedition.squadId);
      const res = Expedition.finish(S, sq);
      if (res.ok) {
        addLog(S, `«${sq.name}» вернулся с вылазки. ${res.summary}.`, 'good');
        report.lines.push(`Вылазка завершена: ${res.summary}`);
        if (app.onExpeditionReturn) app.onExpeditionReturn();
      }
    }
  }

  /* --- 10. случайное событие --- */
  const reduce = techEffect(S, 'eventReduce', 0);
  if (Math.random() < 0.34 * (1 - reduce)) {
    const ev = rollEvent(S);
    if (ev) {
      S.seen[ev.id] = true;
      report.event = ev;
    }
  }

  /* --- 11. время --- */
  S.turn++;
  S.day++;
  S.stats.turnsSurvived++;
  S.population.capacity = popCapacity(S);
  if (S.population.current > S.population.capacity) {
    S.population.current = S.population.capacity;
  }

  // автосохранение раз в 5 ходов
  if (S.turn % 5 === 0) saveGame(S, 0);

  return report;
}

/* ---------- прибытие в узел ---------- */
function arriveAt(S, app) {
  const node = World.nodeById(S.world, S.travel.toId);
  if (!node) return;

  S.city.nodeId = node.id;
  node.visited = true;
  S.travel = null;
  S.stats.nodesVisited++;

  revealAround(S, node, visionRadius(S));

  addLog(S, `Ковчег прибыл в «${node.name}».`, 'info');
  if (app && app.audio) app.audio.travel();
  if (app && app.onArrive) app.onArrive(node);
}

/* ---------- начало перелёта ---------- */
function beginTravel(app, targetId) {
  const S = app.state;

  if (S.travel) return { ok: false, reason: 'Ковчег уже в пути' };
  if (S.expedition && !S.expedition.over) {
    return { ok: false, reason: 'Отряд ещё на поверхности' };
  }

  const from = World.nodeById(S.world, S.city.nodeId);
  const to   = World.nodeById(S.world, targetId);
  if (!from || !to) return { ok: false, reason: 'Узел не найден' };
  if (from.edges.indexOf(targetId) < 0) {
    return { ok: false, reason: 'Нет прямого маршрута' };
  }

  const turns = World.travelTurns(from, to);
  const cost  = turns * 4;

  if (S.resources.energy < cost) {
    return { ok: false, reason: `Нужно ${cost} ⚡ на перелёт` };
  }

  S.travel = { fromId: from.id, toId: to.id, turnsLeft: turns, total: turns };
  addLog(S, `Курс на «${to.name}». В пути ${turns} х.`, 'info');
  if (app.audio) app.audio.travel();

  return { ok: true, turns, to };
}

/* ---------- экспорт ---------- */
window.doEndTurn = doEndTurn;
window.arriveAt = arriveAt;
window.beginTravel = beginTravel;
