/* =========================================================================
   EXPEDITION.JS — десант: действия на поверхности, бой, зоны опасности
   Загружается после city.js. Использует Squads, techEffect, squadCapacity.
   ========================================================================= */
'use strict';

/* ---------- противники ---------- */
const ENEMIES = [
  { n: 'Пепельные псы',    pw: 16, hp: 26, xp: 10, loot: { materials: 4 },              dg: 1 },
  { n: 'Мародёры',         pw: 24, hp: 40, xp: 16, loot: { materials: 6, energy: 4 },   dg: 2 },
  { n: 'Роевые',           pw: 30, hp: 34, xp: 20, loot: { food: 8 },                   dg: 2 },
  { n: 'Рудный голем',     pw: 42, hp: 70, xp: 34, loot: { materials: 16, crystals: 1 },dg: 3 },
  { n: 'Эхо-тень',         pw: 52, hp: 56, xp: 42, loot: { crystals: 2, research: 8 },  dg: 3 },
  { n: 'Дремлющие турели', pw: 20, hp: 30, xp: 14, loot: { materials: 8, energy: 6 },   dg: 2 },
];

/* ---------- зоны опасности ---------- */
const ZONES = [
  { n: 'Окраина', dm: 1.00, lm: 1.0 },
  { n: 'Глубина', dm: 1.45, lm: 1.7 },
  { n: 'Ядро',    dm: 2.00, lm: 2.8 },
];

const Expedition = {
  ENEMIES, ZONES,

  /* ---------- старт вылазки ---------- */
  start(S, squad, nodeId) {
    const node = World.nodeById(S.world, nodeId);
    if (!node) return { ok: false, reason: 'Узел не найден' };

    const baseActions = 6 + techEffect(S, 'extraActions', 0);

    S.expedition = {
      squadId: squad.id,
      nodeId,
      zone: 0,
      actionsLeft: baseActions,
      actionsMax: baseActions,
      loot: { food: 0, materials: 0, energy: 0, crystals: 0, research: 0 },
      log: [],
      encounter: null,
      over: false,
      result: null,
      lootMul: 1,
      scouted: false,
    };

    squad.status = 'expedition';
    squad.nodeId = nodeId;

    this.log(S, `Капсула села в «${node.name}». Опасность ${node.danger}/3.`, 'info');
    return { ok: true };
  },

  /* ---------- журнал вылазки ---------- */
  log(S, text, kind) {
    if (!S.expedition) return;
    S.expedition.log.unshift({ text, kind: kind || 'info' });
    if (S.expedition.log.length > 40) S.expedition.log.length = 40;
  },

  /* ---------- помощники ---------- */
  squad(S) {
    return S.squads.find(x => x.id === S.expedition.squadId);
  },

  node(S) {
    return World.nodeById(S.world, S.expedition.nodeId);
  },

  lootTotal(S) {
    const l = S.expedition ? S.expedition.loot : {};
    return Object.values(l).reduce((a, b) => a + b, 0);
  },

  lootSpace(S) {
    return Math.max(0, squadCapacity(S) - this.lootTotal(S));
  },

  /* ---------- спавн врага ---------- */
  rollEnemy(node, zoneIdx) {
    const z = ZONES[zoneIdx];
    const maxDanger = Math.min(3, Math.ceil(node.danger * z.dm));
    const pool = ENEMIES.filter(e => e.dg <= maxDanger);
    const base = U.pick(pool.length ? pool : ENEMIES);

    const scale = 1 + (node.danger - 1) * 0.18 + zoneIdx * 0.28;
    return {
      n: base.n,
      pw: Math.round(base.pw * scale),
      hp: Math.round(base.hp * scale),
      maxHp: Math.round(base.hp * scale),
      xp: Math.round(base.xp * scale),
      loot: base.loot,
    };
  },

  /* ---------- список доступных действий ---------- */
  actions(S) {
    const e = S.expedition;
    if (!e || e.over || e.encounter) return [];

    const sq = this.squad(S);
    const space = this.lootSpace(S);
    const hp = squadHp(sq);
    const maxHp = squadMaxHp(sq);

    return [
      { id: 'scout',  label: 'Осмотреться',  hint: 'повышает добычу следующих действий', enabled: true },
      { id: 'gather', label: `Собрать ресурсы (${ZONES[e.zone].n})`,
        hint: space > 0 ? `свободно ${space} ед. груза` : 'контейнеры полны',
        enabled: space > 0 },
      { id: 'rest',   label: 'Отдохнуть', hint: 'восстановить силы',
        enabled: hp < maxHp, reason: hp >= maxHp ? 'Отряд невредим' : '' },
      { id: 'deeper',
        label: e.zone < 2 ? `Углубиться → ${ZONES[e.zone + 1].n}` : 'Ядро — глубже некуда',
        hint: e.zone < 2 ? `риск ×${ZONES[e.zone + 1].dm}, добыча ×${ZONES[e.zone + 1].lm}` : '',
        enabled: e.zone < 2 },
      { id: 'extract', label: 'Вернуться на Ковчег', hint: 'доставить груз', enabled: true },
    ];
  },

  /* ---------- выполнить действие ---------- */
  do(S, actionId) {
    const e = S.expedition;
    const sq = this.squad(S);
    if (!e || !sq || e.over) return { ok: false };

    const node = this.node(S);
    const biome = BIOMES[node.biome];
    const z = ZONES[e.zone];

    if (actionId === 'extract') return this.finish(S, sq);

    if (e.actionsLeft <= 0) {
      this.log(S, 'Отряд выдохся — нужно возвращаться.', 'bad');
      return { ok: false, reason: 'Нет действий' };
    }
    e.actionsLeft--;

    switch (actionId) {
      case 'scout': {
        e.scouted = true;
        e.lootMul *= 1.35;
        this.log(S, 'Разведка: добыча ×1.35.', 'good');
        if (U.chance(0.35)) {
          const en = this.rollEnemy(node, e.zone);
          this.log(S, `Разведка наткнулась на: ${en.n}!`, 'bad');
          return this.startEncounter(S, en);
        }
        return { ok: true };
      }

      case 'gather': {
        const alive = squadAlive(sq);
        const base = 5 + alive * 2.2;
        const mul = techMul(S, 'gatherMul') * e.lootMul;
        const amount = base * z.lm * mul;

        const gained = {};
        for (const [res, w] of Object.entries(biome.loot)) {
          const val = Math.round(amount * w * (0.85 + Math.random() * 0.3));
          if (val > 0) gained[res] = val;
        }

        let space = this.lootSpace(S);
        for (const k of Object.keys(gained)) {
          const add = Math.min(gained[k], space);
          if (add <= 0) { delete gained[k]; continue; }
          e.loot[k] = (e.loot[k] || 0) + add;
          space -= add;
          gained[k] = add;
        }

        const parts = Object.entries(gained).map(([k, v]) => `${ICON[k]}${v}`).join(' ');
        if (parts) this.log(S, `Собрано: ${parts}.`, 'good');
        else this.log(S, 'Контейнеры полны. Больше не унести.', 'bad');

        grantXp(sq, 4 + e.zone * 3);

        if (U.chance(0.3 + e.zone * 0.1)) {
          const en = this.rollEnemy(node, e.zone);
          this.log(S, `Из укрытия вышли: ${en.n}.`, 'bad');
          return this.startEncounter(S, en);
        }
        return { ok: true };
      }

      case 'rest': {
        const heal = Math.round(squadMaxHp(sq) * 0.22) + techEffect(S, 'expeditionHeal', 0);
        const healed = healSquad(sq, heal);
        this.log(S, `Отряд перевёл дух. Восстановлено ${Math.round(healed)} HP.`, 'good');
        if (U.chance(0.18)) {
          const en = this.rollEnemy(node, e.zone);
          this.log(S, `Отдых прерван: ${en.n}!`, 'bad');
          return this.startEncounter(S, en);
        }
        return { ok: true };
      }

      case 'deeper': {
        e.zone++;
        this.log(S, `Отряд продвинулся в зону «${ZONES[e.zone].n}».`, 'info');
        if (U.chance(0.5 + e.zone * 0.12)) {
          const en = this.rollEnemy(node, e.zone);
          this.log(S, `Впереди движение — ${en.n}.`, 'bad');
          return this.startEncounter(S, en);
        }
        return { ok: true };
      }

      default:
        e.actionsLeft++;
        return { ok: false, reason: 'Неизвестное действие' };
    }
  },

  startEncounter(S, enemy) {
    S.expedition.encounter = {
      enemy,
      enemyHp: enemy.hp,
      round: 0,
      log: [],
    };
    return { ok: true, encounter: true };
  },

  /* ---------- раунд боя ---------- */
  fight(S, mode) {
    const e = S.expedition;
    const sq = this.squad(S);
    const enc = e ? e.encounter : null;
    if (!enc) return { over: true };

    const en = enc.enemy;
    const log = [];
    enc.round++;

    /* --- отступление --- */
    if (mode === 'flee') {
      const cf = 0.45 + squadAlive(sq) * 0.08;
      if (Math.random() < cf) {
        log.push('Отряд оторвался от противника.');
        this.log(S, 'Отряд отступил.', 'info');
        e.encounter = null;
        return { over: true, fled: true, log };
      }
      const dmg = en.pw * 0.55;
      const fallen = damageSquad(sq, dmg);
      log.push(`Отход провалился. ${Math.round(dmg)} урона.`);
      for (const m of fallen) log.push(`${m.name} выбыл.`);
      this.log(S, `Отступление провалилось. −${Math.round(dmg)} HP.`, 'bad');
      if (isWiped(sq)) return this.wipeOut(S, log);
      return { over: false, log };
    }

    /* --- атака отряда --- */
    const power = squadPower(sq);
    const dmgToEnemy = power * (0.7 + Math.random() * 0.5);
    enc.enemyHp -= dmgToEnemy;
    log.push(`Отряд: ${Math.round(dmgToEnemy)} урона (${en.n}: ${Math.max(0, Math.round(enc.enemyHp))} HP).`);

    if (enc.enemyHp <= 0) {
      const leveled = grantXp(sq, en.xp);
      sq.kills++;
      log.push(`${en.n} уничтожен. +${en.xp} опыта.`);

      const mul = techMul(S, 'gatherMul') * e.lootMul * ZONES[e.zone].lm;
      const got = {};
      let space = this.lootSpace(S);
      for (const [k, v] of Object.entries(en.loot || {})) {
        const add = Math.min(Math.round(v * mul), space);
        if (add > 0) {
          e.loot[k] = (e.loot[k] || 0) + add;
          space -= add;
          got[k] = add;
        }
      }
      const ts = Object.entries(got).map(([k, v]) => `${ICON[k]}${v}`).join(' ');
      if (ts) log.push(`Трофеи: ${ts}.`);

      this.log(S, `Победа над «${en.n}». Опыт +${en.xp}${ts ? ', трофеи: ' + ts : ''}.`, 'good');
      if (leveled) this.log(S, `Отряд «${sq.name}» — уровень ${sq.level}!`, 'good');

      enc.dead = true;
      e.encounter = null;
      return { over: true, won: true, log, leveled };
    }

    /* --- ответный удар --- */
    const ed = en.pw * (0.55 + Math.random() * 0.5);
    const fallen = damageSquad(sq, ed);
    log.push
