/* =========================================================================
   CITY.JS — город, экономика, строительство, технологии
   Загружается после data.js. Использует BUILDINGS, TECH из data.js.
   ========================================================================= */
'use strict';

/* ---------- поиск модулей ---------- */
function findModule(state, type) {
  return state.city.modules.find(m => m.type === type);
}
function moduleLevel(state, type) {
  const m = findModule(state, type);
  return m ? m.level : 0;
}

/* ---------- население ---------- */
function popCapacity(state) {
  let cap = 0;
  for (const m of state.city.modules) {
    const def = BUILDINGS[m.type];
    if (def && def.popCap) cap += def.popCap(m.level);
  }
  cap += techEffect(state, 'popCap', 0);
  return Math.max(4, cap);
}

function foodUpkeep(state) {
  return Math.round(state.population.current * 0.25 * 10) / 10;
}

/* ---------- экономика ---------- */
function computeEconomy(state) {
  const produce = { food: 0, materials: 0, energy: 0, crystals: 0 };
  const upkeep  = { food: 0, materials: 0, energy: 0, crystals: 0 };

  for (const m of state.city.modules) {
    const def = BUILDINGS[m.type];
    if (!def) continue;

    if (def.produce) {
      const p = def.produce(m.level) || {};
      for (const k in p) produce[k] = (produce[k] || 0) + p[k];
    }
    if (def.upkeep) {
      const u = def.upkeep(m.level) || {};
      for (const k in u) upkeep[k] = (upkeep[k] || 0) + u[k];
    }
  }

  // пассивные эффекты технологий
  const passiveMat = techEffect(state, 'passiveMaterials', 0);
  if (passiveMat) produce.materials += passiveMat;

  const prodMul = techMul(state, 'prodMul');
  if (prodMul !== 1) {
    produce.materials = Math.round(produce.materials * prodMul);
    produce.energy    = Math.round(produce.energy * prodMul);
  }

  // еда населения
  upkeep.food += foodUpkeep(state);

  const net = {
    food:      +(produce.food      - upkeep.food).toFixed(1),
    materials: +(produce.materials - upkeep.materials).toFixed(1),
    energy:    +(produce.energy    - upkeep.energy).toFixed(1),
    crystals:  +(produce.crystals  - upkeep.crystals).toFixed(1),
  };

  return { produce, upkeep, net };
}

/* ---------- технологии ---------- */
function hasTech(state, id) {
  return state.city.tech.indexOf(id) >= 0;
}

function techEffect(state, key, fallback) {
  let total = 0, found = false;
  for (const id of state.city.tech) {
    const def = TECH[id];
    if (def && def.effects && def.effects[key] !== undefined) {
      total += def.effects[key];
      found = true;
    }
  }
  return found ? total : (fallback || 0);
}

function techMul(state, key) {
  let m = 1;
  for (const id of state.city.tech) {
    const def = TECH[id];
    if (def && def.effects && typeof def.effects[key] === 'number') {
      m *= def.effects[key];
    }
  }
  return m;
}

function researchTech(state, id) {
  const def = TECH[id];
  if (!def) return { ok: false, reason: 'Неизвестная технология' };
  if (hasTech(state, id)) return { ok: false, reason: 'Уже изучена' };
  if (state.resources.research < def.cost) {
    return { ok: false, reason: 'Недостаточно очков науки' };
  }

  state.resources.research -= def.cost;
  state.city.tech.push(id);

  if (def.effects.instantPop) {
    state.population.current = Math.min(
      popCapacity(state),
      state.population.current + def.effects.instantPop
    );
  }
  state.population.capacity = popCapacity(state);

  return { ok: true };
}

/* ---------- строительство ---------- */
function canAfford(state, cost) {
  if (!cost) return false;
  for (const k in cost) {
    if ((state.resources[k] || 0) < cost[k]) return false;
  }
  return true;
}

function payCost(state, cost) {
  for (const k in cost) state.resources[k] -= cost[k];
}

function costLabel(cost) {
  if (!cost) return '—';
  const parts = [];
  for (const k in cost) parts.push((ICON[k] || k) + cost[k]);
  return parts.join('  ');
}

function nextCost(state, type) {
  const def = BUILDINGS[type];
  if (!def) return null;
  const lvl = moduleLevel(state, type);
  if (lvl >= def.max) return null;
  return def.cost[lvl];
}

function buildCheck(state, type) {
  const def = BUILDINGS[type];
  if (!def) return { ok: false, reason: 'Неизвестный модуль' };

  const lvl = moduleLevel(state, type);
  if (lvl >= def.max) return { ok: false, reason: 'Максимальный уровень', maxed: true };

  const cost = def.cost[lvl];
  if (!canAfford(state, cost)) return { ok: false, reason: 'Недостаточно ресурсов', cost };

  return { ok: true, cost, level: lvl, isNew: lvl === 0 };
}

function doBuild(state, type) {
  const chk = buildCheck(state, type);
  if (!chk.ok) return chk;

  payCost(state, chk.cost);

  const existing = findModule(state, type);
  if (existing) existing.level++;
  else state.city.modules.push({ id: 'm' + (++state.counters.m), type, level: 1 });

  state.stats.built++;
  state.population.capacity = popCapacity(state);

  return { ok: true, level: moduleLevel(state, type) };
}

/* ---------- корпус ---------- */
function damageHull(state, amount) {
  const guard = techEffect(state, 'hullGuard', 0);
  const real = Math.max(1, Math.round(amount * (guard ? 1 - guard : 1)));
  state.city.hull = Math.max(0, state.city.hull - real);
  return real;
}

function repairHull(state, amount) {
  state.city.hull = Math.min(state.city.hullMax, state.city.hull + amount);
}

/* ---------- лимиты ---------- */
function visionRadius(state) {
  let r = 1;
  for (const m of state.city.modules) {
    if (m.type === 'radar') r += BUILDINGS.radar.special.vision(m.level);
  }
  return r + techEffect(state, 'vision', 0);
}

function maxSquads(state) {
  let n = 1;
  for (const m of state.city.modules) {
    if (m.type === 'hangar') n = Math.max(n, BUILDINGS.hangar.special.maxSquads(m.level));
  }
  return n;
}

function squadCapacity(state) {
  let c = 20;
  for (const m of state.city.modules) {
    if (m.type === 'workshop') c += BUILDINGS.workshop.special.carry(m.level);
  }
  return c;
}

/* ---------- открытие узлов ---------- */
function revealAround(state, node, radius) {
  const byId = {};
  for (const n of state.world.nodes) byId[n.id] = n;

  let frontier = [node];
  const seen = { [node.id]: true };

  for (let step = 0; step < radius; step++) {
    const next = [];
    for (const n of frontier) {
      for (const eid of n.edges) {
        if (seen[eid]) continue;
        seen[eid] = true;
        const nb = byId[eid];
        if (nb) { nb.revealed = true; next.push(nb); }
      }
    }
    frontier = next;
  }
}

/* ---------- экспорт ---------- */
window.findModule = findModule;
window.moduleLevel = moduleLevel;
window.popCapacity = popCapacity;
window.foodUpkeep = foodUpkeep;
window.computeEconomy = computeEconomy;
window.hasTech = hasTech;
window.techEffect = techEffect;
window.techMul = techMul;
window.researchTech = researchTech;
window.canAfford = canAfford;
window.payCost = payCost;
window.costLabel = costLabel;
window.nextCost = nextCost;
window.buildCheck = buildCheck;
window.doBuild = doBuild;
window.damageHull = damageHull;
window.repairHull = repairHull;
window.visionRadius = visionRadius;
window.maxSquads = maxSquads;
window.squadCapacity = squadCapacity;
window.revealAround = revealAround;
