/* =========================================================================
   SQUADS.JS — отряды: роли, черты, здоровье, опыт
   Загружается третьим. Зависит только от core.js.
   ========================================================================= */
'use strict';

/* ---------- роли ---------- */
const ROLES = {
  scout:    { name: 'Разведчик', icon: '◈', hp: 26, atk: 5, def: 2, gather: 1.15, color: '#7fd6a0' },
  gunner:   { name: 'Стрелок',   icon: '◆', hp: 34, atk: 9, def: 3, gather: 1.00, color: '#ff9a76' },
  engineer: { name: 'Инженер',   icon: '⬢', hp: 24, atk: 4, def: 4, gather: 1.50, color: '#e0b070' },
  medic:    { name: 'Медик',     icon: '✚', hp: 22, atk: 3, def: 2, gather: 1.00, color: '#8fe6ff' },
};

/* ---------- черты характера ---------- */
const TRAITS = [
  { id: 'hardy',   name: 'Крепкий', desc: '+8 к максимуму HP',
    apply: m => { m.maxHp += 8; m.hp += 8; } },
  { id: 'sharp',   name: 'Меткий',  desc: '+2 к атаке',
    apply: m => { m.atk += 2; } },
  { id: 'lucky',   name: 'Везучий', desc: '+10% к добыче',
    apply: m => { m.gather += 0.1; } },
  { id: 'quick',   name: 'Быстрый', desc: '+1 к защите, +5 HP',
    apply: m => { m.def += 1; m.maxHp += 5; m.hp += 5; } },
  { id: 'veteran', name: 'Ветеран', desc: '+1 к атаке и защите',
    apply: m => { m.atk += 1; m.def += 1; } },
];

/* ---------- имена ---------- */
const NAMES_M = ['Кир','Рон','Дав','Илья','Марк','Ян','Тор','Савва','Лёк','Грим','Нэйт','Орсо'];
const NAMES_F = ['Мира','Лета','Ая','Нора','Вера','Соль','Кира','Юна','Тая','Рика','Инга','Эва'];
const CALLSIGNS = ['Сойка','Пепел','Кремень','Тихий','Волна','Гром','Тень','Искра','Клык','Заря'];

/* ---------- создание ---------- */
function makeMember(roleKey, level) {
  level = level || 1;
  const role = ROLES[roleKey] || ROLES.gunner;
  const isF = Math.random() < 0.45;
  const base = isF ? U.pick(NAMES_F) : U.pick(NAMES_M);

  const m = {
    id: 'u' + Math.floor(Math.random() * 1e9).toString(36),
    name: `${base} «${U.pick(CALLSIGNS)}»`,
    role: roleKey,
    level,
    maxHp: role.hp + (level - 1) * 4,
    hp:    role.hp + (level - 1) * 4,
    atk: role.atk + (level - 1),
    def: role.def,
    gather: role.gather,
    traits: [],
  };

  if (level >= 2 && Math.random() < 0.7) {
    const t = U.pick(TRAITS);
    m.traits.push(t.id);
    t.apply(m);
  }
  return m;
}

function makeSquad(name, roles, level) {
  roles = roles || ['gunner', 'scout', 'engineer'];
  level = level || 1;
  return {
    id: 'sq' + Math.floor(Math.random() * 1e9).toString(36),
    name,
    members: roles.map(r => makeMember(r, level)),
    level,
    xp: 0,
    xpNext: 40 + level * 25,
    status: 'idle',
    nodeId: null,
    expeditions: 0,
    kills: 0,
  };
}

/* ---------- характеристики ---------- */
function squadMaxHp(sq) { return sq.members.reduce((s, m) => s + m.maxHp, 0); }
function squadHp(sq)    { return sq.members.reduce((s, m) => s + Math.max(0, m.hp), 0); }
function squadAtk(sq)   { return sq.members.reduce((s, m) => s + m.atk, 0); }
function squadDef(sq)   { return sq.members.reduce((s, m) => s + m.def, 0); }
function squadAlive(sq) { return sq.members.filter(m => m.hp > 0).length; }
function isWiped(sq)    { return sq.members.every(m => m.hp <= 0); }

function squadGather(sq) {
  const alive = sq.members.filter(m => m.hp > 0);
  if (!alive.length) return 0;
  return alive.reduce((s, m) => s + m.gather, 0) / alive.length;
}

function squadPower(sq) {
  const alive = sq.members.filter(m => m.hp > 0);
  if (!alive.length) return 0;
  const raw = alive.reduce((s, m) => s + m.atk + m.def * 0.5 + m.hp * 0.12, 0);
  return raw * (1 + sq.level * 0.08);
}

/* ---------- урон и лечение ---------- */
function damageSquad(sq, amount) {
  const alive = sq.members.filter(m => m.hp > 0);
  if (!alive.length) return [];
  const per = amount / alive.length;
  const fallen = [];
  for (const m of alive) {
    m.hp -= per * (1 + (Math.random() - 0.5) * 0.4);
    if (m.hp <= 0) { m.hp = 0; fallen.push(m); }
  }
  return fallen;
}

function healSquad(sq, amount) {
  const hurt = sq.members.filter(m => m.hp > 0 && m.hp < m.maxHp);
  if (!hurt.length) return 0;
  let healed = 0;
  const per = amount / hurt.length;
  for (const m of hurt) {
    const before = m.hp;
    m.hp = Math.min(m.maxHp, m.hp + per);
    healed += m.hp - before;
  }
  return healed;
}

/* ---------- опыт ---------- */
function grantXp(sq, amount) {
  sq.xp += amount;
  let leveled = false;

  while (sq.xp >= sq.xpNext) {
    sq.xp -= sq.xpNext;
    sq.level++;
    sq.xpNext = 40 + sq.level * 25;
    leveled = true;

    for (const m of sq.members) {
      if (m.hp <= 0) continue;
      m.level = sq.level;
      m.maxHp += 3;
      m.hp = Math.min(m.maxHp, m.hp + 3);
      m.atk += 1;
    }

    const candidates = sq.members.filter(m => m.hp > 0);
    if (candidates.length) {
      const m = U.pick(candidates);
      const avail = TRAITS.filter(t => m.traits.indexOf(t.id) < 0);
      if (avail.length) {
        const t = U.pick(avail);
        m.traits.push(t.id);
        t.apply(m);
        sq.lastTrait = { member: m.name, trait: t.name, desc: t.desc };
      }
    }
  }
  return leveled;
}

/* ---------- экспорт ---------- */
window.ROLES = ROLES;
window.TRAITS = TRAITS;
window.makeMember = makeMember;
window.makeSquad = makeSquad;
window.squadMaxHp = squadMaxHp;
window.squadHp = squadHp;
window.squadAtk = squadAtk;
window.squadDef = squadDef;
window.squadAlive = squadAlive;
window.isWiped = isWiped;
window.squadGather = squadGather;
window.squadPower = squadPower;
window.damageSquad = damageSquad;
window.healSquad = healSquad;
window.grantXp = grantXp;
