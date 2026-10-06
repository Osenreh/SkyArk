/* =========================================================================
   DATA.JS — весь контент игры: биомы, здания, технологии, события, мир
   Загружается вторым, после core.js. Не знает об UI.
   ========================================================================= */
'use strict';

/* ---------- иконки ресурсов ---------- */
const ICON = {
  food: '❦', materials: '⚙', energy: '⚡',
  crystals: '◈', research: '⌬',
};
const RNAME = {
  food: 'Еда', materials: 'Материалы', energy: 'Энергия',
  crystals: 'Кристаллы', research: 'Наука',
};

/* =========================================================================
   БИОМЫ
   ========================================================================= */
const BIOMES = {
  ruins: {
    name: 'Руины', color: '#8a7f6b', accent: '#c4a97a', danger: 1,
    loot: { materials: 1.4, food: 0.3, energy: 0.2, crystals: 0.05 },
    desc: 'Обрушенные кварталы старого мира. Много металла, мало жизни.',
    names: ['Серый Провал', 'Костяной Квартал', 'Осыпь', 'Бетонная Могила', 'Старый Узел'],
  },
  forest: {
    name: 'Лес', color: '#3f7a56', accent: '#7fd6a0', danger: 1,
    loot: { materials: 0.5, food: 1.6, energy: 0.1, crystals: 0.05 },
    desc: 'Плотный зелёный ковёр, пробившийся сквозь асфальт.',
    names: ['Зелёный Разлив', 'Кроны', 'Тихая Чаща', 'Мшистый Дол', 'Поющие Деревья'],
  },
  wastes: {
    name: 'Пустошь', color: '#8a6a3c', accent: '#e0b070', danger: 2,
    loot: { materials: 0.7, food: 0.3, energy: 1.5, crystals: 0.15 },
    desc: 'Выжженная равнина, дрожащая от остаточной энергии.',
    names: ['Ржавое Поле', 'Стеклянная Степь', 'Сухой Гром', 'Пепельный Тракт', 'Зной'],
  },
  ghostcity: {
    name: 'Город-призрак', color: '#5a5f8a', accent: '#9aa4e8', danger: 2,
    loot: { materials: 1.1, food: 0.5, energy: 0.9, crystals: 0.25 },
    desc: 'Целые кварталы стоят нетронутыми. Слишком тихо.',
    names: ['Молчаливый Проспект', 'Спальный Район', 'Вокзал', 'Высотки', 'Ночлежка'],
  },
  crystal: {
    name: 'Кристаллическое поле', color: '#4a7f9e', accent: '#8fe6ff', danger: 3,
    loot: { materials: 0.4, food: 0.1, energy: 0.8, crystals: 1.6 },
    desc: 'Осколки поют на ветру. Опасное, но бесценное место.',
    names: ['Поющий Разлом', 'Синий Сад', 'Осколки', 'Резонанс', 'Стеклянный Лес'],
  },
  lake: {
    name: 'Мёртвое море', color: '#2f6a8a', accent: '#7fd4e8', danger: 2,
    loot: { materials: 0.3, food: 1.1, energy: 0.4, crystals: 0.3 },
    desc: 'Стоячая вода до горизонта. Где-то в глубине что-то движется.',
    names: ['Тихий Плёс', 'Соль', 'Заводь', 'Разлив', 'Глубина'],
  },
};

const BIOME_ICON = {
  ruins: '⌗', forest: '❦', wastes: '≋',
  ghostcity: '⌂', crystal: '◈', lake: '≈',
};

/* =========================================================================
   ЗДАНИЯ
   ========================================================================= */
const BUILDINGS = {
  habitat: {
    name: 'Жилой блок', icon: '⌂', max: 3,
    desc: 'Ярус с каютами и общими залами. Расширяет вместимость Ковчега.',
    cost: [{ materials: 40 }, { materials: 90, energy: 20 }, { materials: 180, crystals: 2 }],
    popCap: l => 6 * l,
    produce: () => ({}), upkeep: () => ({}),
  },
  farm: {
    name: 'Аэропонная ферма', icon: '❦', max: 3,
    desc: 'Закрытые ярусы с гидропоникой. Кормит население.',
    cost: [{ materials: 35 }, { materials: 80, energy: 15 }, { materials: 160, crystals: 2 }],
    produce: l => ({ food: 6 * l }),
    upkeep:  l => ({ energy: 1 * l }),
  },
  reactor: {
    name: 'Реакторный узел', icon: '⚡', max: 3,
    desc: 'Сердце Ковчега. Питает двигатели и модули.',
    cost: [{ materials: 50 }, { materials: 110, crystals: 1 }, { materials: 230, crystals: 4 }],
    produce: l => ({ energy: 7 * l }),
    upkeep:  () => ({}),
  },
  extractor: {
    name: 'Перерабатывающий цех', icon: '⚙', max: 3,
    desc: 'Разбирает обломки и мусор на материалы прямо на борту.',
    cost: [{ materials: 45 }, { materials: 100, energy: 20 }, { materials: 200, crystals: 2 }],
    produce: l => ({ materials: 5 * l }),
    upkeep:  l => ({ energy: 2 * l }),
  },
  crystal: {
    name: 'Резонатор', icon: '◈', max: 2,
    desc: 'Улавливает кристаллическую пыль из верхних слоёв атмосферы.',
    cost: [{ materials: 90, energy: 30 }, { materials: 200, crystals: 3 }],
    produce: l => ({ crystals: l >= 2 ? 2 : 0 }),
    upkeep:  l => ({ energy: 3 * l }),
  },
  hospital: {
    name: 'Медицинский отсек', icon: '✚', max: 2,
    desc: 'Заживляет раны бойцов между вылазками.',
    cost: [{ materials: 60, energy: 15 }, { materials: 130, crystals: 2 }],
    produce: () => ({}),
    upkeep:  l => ({ energy: 1 * l }),
    special: { heal: l => 5 * l },
  },
  barracks: {
    name: 'Тренировочный лагерь', icon: '⚔', max: 2,
    desc: 'Гоняет отряды по полигону — они получают опыт каждый ход.',
    cost: [{ materials: 70, energy: 20 }, { materials: 150, crystals: 2 }],
    produce: () => ({}),
    upkeep:  l => ({ food: 1 * l }),
    special: { train: l => 3 * l },
  },
  hangar: {
    name: 'Ангар десанта', icon: '⛊', max: 2,
    desc: 'Спускаемые капсулы и снаряжение. Позволяет держать больше отрядов.',
    cost: [{ materials: 80 }, { materials: 180, crystals: 3 }],
    produce: () => ({}),
    upkeep:  l => ({ energy: 1 * l }),
    special: { maxSquads: l => 1 + l },
  },
  workshop: {
    name: 'Мастерская', icon: '⚒', max: 2,
    desc: 'Облегчённые контейнеры: отряды уносят больше добычи.',
    cost: [{ materials: 65 }, { materials: 140, crystals: 1 }],
    produce: () => ({}),
    upkeep:  l => ({ energy: 1 * l }),
    special: { carry: l => 6 * l },
  },
  radar: {
    name: 'Дальний радар', icon: '◎', max: 2,
    desc: 'Прощупывает окрестности — открывает узлы карты.',
    cost: [{ materials: 55, energy: 20 }, { materials: 120, crystals: 2 }],
    produce: () => ({}),
    upkeep:  l => ({ energy: 2 * l }),
    special: { vision: l => l },
  },
  lab: {
    name: 'Лаборатория', icon: '⌬', max: 2,
    desc: 'Исследования и очки науки для новых способностей города.',
    cost: [{ materials: 90, energy: 25 }, { materials: 190, crystals: 3 }],
    produce: () => ({}),
    upkeep:  l => ({ energy: 2 * l }),
    special: { research: l => 2 * l },
  },
  garden: {
    name: 'Сады равновесия', icon: '❀', max: 2,
    desc: 'Тихие оранжереи. Поднимают дух жителей.',
    cost: [{ materials: 50, energy: 10 }, { materials: 110 }],
    produce: () => ({}),
    upkeep:  l => ({ food: 1 * l }),
    special: { morale: l => 3 * l },
  },
};

const BUILD_ORDER = [
  'habitat', 'farm', 'reactor', 'extractor', 'crystal',
  'hospital', 'barracks', 'hangar', 'workshop', 'radar', 'lab', 'garden',
];

/* =========================================================================
   ТЕХНОЛОГИИ
   ========================================================================= */
const TECH = {
  aerostat:  { name: 'Аэростат-разведчик', icon: '◎', cost: 12,
    desc: 'Дрейфующий зонд расширяет обзор карты на 1 узел.',
    effects: { vision: 1 } },
  drones:    { name: 'Дроны-сборщики', icon: '⬡', cost: 18,
    desc: 'Автономные рои приносят +3 материала каждый ход.',
    effects: { passiveMaterials: 3 } },
  medbay:    { name: 'Наномедицина', icon: '✚', cost: 24,
    desc: 'Отряды на вылазке восстанавливают 3 HP за ход.',
    effects: { expeditionHeal: 3 } },
  exosuits:  { name: 'Экзоскелеты', icon: '⛊', cost: 30,
    desc: '+30% ко всей добыче на вылазках.',
    effects: { gatherMul: 1.3 } },
  shielding: { name: 'Щиты корпуса', icon: '◍', cost: 36,
    desc: 'Урон по городу от событий снижен вдвое.',
    effects: { hullGuard: 0.5 } },
  beacon:    { name: 'Маяк предупреждения', icon: '◈', cost: 42,
    desc: 'Случайные события случаются на 35% реже.',
    effects: { eventReduce: 0.35 } },
  cryo:      { name: 'Криокамеры', icon: '❄', cost: 50,
    desc: '+8 к лимиту населения и +2 жителя сразу.',
    effects: { popCap: 8, instantPop: 2 } },
  cortex:    { name: 'Совет ИИ', icon: '⌬', cost: 64,
    desc: '+1 действие отряду на каждой вылазке.',
    effects: { extraActions: 1 } },
  skyforge:  { name: 'Небесная кузня', icon: '⚒', cost: 80,
    desc: '+25% к производству материалов и энергии города.',
    effects: { prodMul: 1.25 } },
};

const TECH_ORDER = Object.keys(TECH);

/* =========================================================================
   СОБЫТИЯ ГОРОДА
   ========================================================================= */
const EVENTS = [
  {
    id: 'storm_front', title: 'Грозовой фронт', tag: 'Небо', weight: 12, minTurn: 3,
    text: 'Стена чёрных облаков перекрывает курс. Разряды бьют в километре от корпуса.',
    choices: [
      { label: 'Обойти по широкой дуге', hint: '−10 энергии',
        apply(s) {
          s.resources.energy = Math.max(0, s.resources.energy - 10);
          return 'Ковчег заложил вираж и обошёл фронт.';
        } },
      { label: 'Пройти напрямую', hint: 'риск повреждений',
        apply(s) {
          if (Math.random() < 0.55) return 'Прорвались сквозь стену дождя. Обшивка гудит, но всё цело.';
          const dmg = U.ri(8, 18);
          s.city.hull = Math.max(0, s.city.hull - dmg);
          s.population.morale = Math.max(0, s.population.morale - 4);
          return `Молния ударила в левый стабилизатор. Корпус −${dmg}.`;
        } },
    ],
  },
  {
    id: 'calm_skies', title: 'Тихие небеса', tag: 'Небо', weight: 8, minTurn: 2,
    text: 'Воздух неподвижен. Идеальная погода для ремонта и отдыха.',
    choices: [
      { label: 'Провести ремонт корпуса', hint: '+12 корпуса',
        apply(s) {
          s.city.hull = Math.min(s.city.hullMax, s.city.hull + 12);
          return 'Ремонтные бригады заварили трещины. Корпус +12.';
        } },
      { label: 'Дать людям выходной', hint: '+10 бодрости',
        apply(s) {
          s.population.morale = Math.min(100, s.population.morale + 10);
          return 'На палубах устроили праздник.';
        } },
      { label: 'Гнать на полной тяге', hint: '+8 энергии',
        apply(s) {
          s.resources.energy += 8;
          return 'Турбины раскрутились, накопители пополнились.';
        } },
    ],
  },
  {
    id: 'newcomers', title: 'Сигнал с земли', tag: 'Люди', weight: 10, minTurn: 4,
    text: 'Радиоперехват: группа выживших просит забрать их. Они укрылись на крыше высотки.',
    choices: [
      { label: 'Спустить капсулу', hint: '+3 жителя, −10 ❦, −5 ⚡',
        cond: s => s.resources.food >= 10 && s.resources.energy >= 5,
        apply(s) {
          s.resources.food -= 10;
          s.resources.energy -= 5;
          s.population.current += 3;
          s.population.morale = Math.min(100, s.population.morale + 5);
          return 'Капсула вернулась с тремя живыми. +3 жителя.';
        } },
      { label: 'Передать координаты', hint: '−6 бодрости',
        apply(s) {
          s.population.morale = Math.max(0, s.population.morale - 6);
          return 'Мы передали координаты и ушли.';
        } },
      { label: 'Игнорировать', hint: '−10 бодрости',
        apply(s) {
          s.population.morale = Math.max(0, s.population.morale - 10);
          return 'Сигнал стих через час.';
        } },
    ],
  },
  {
    id: 'plague', title: 'Лёгочный грибок', tag: 'Люди', weight: 7, minTurn: 8,
    text: 'В нижнем ярусе вспышка инфекции. Споры уже в вентиляции.',
    choices: [
      { label: 'Сжечь заражённый ярус', hint: '−2 жителя',
        apply(s) {
          s.population.current = Math.max(1, s.population.current - 2);
          return 'Ярус загерметизировали и выжгли. Двое не вышли.';
        } },
      { label: 'Потратить медикаменты', hint: '−15 ⚙, −8 ⚡',
        cond: s => s.resources.materials >= 15,
        apply(s) {
          s.resources.materials -= 15;
          s.resources.energy -= 8;
          s.population.morale = Math.min(100, s.population.morale + 4);
          return 'Лекарства сработали. Все выжили.';
        } },
      { label: 'Ничего не делать', hint: 'риск',
        apply(s) {
          const lost = U.ri(2, 4);
          s.population.current = Math.max(1, s.population.current - lost);
          s.population.morale = Math.max(0, s.population.morale - 12);
          return `Инфекция прошла сама, забрав ${lost} жизней.`;
        } },
    ],
  },
  {
    id: 'drift_cache', title: 'Дрейфующий контейнер', tag: 'Находка', weight: 9,
    text: 'В облаках покачивается довоенный грузовой контейнер.',
    choices: [
      { label: 'Вскрыть резаком', hint: '+25 ⚙',
        apply(s) { s.resources.materials += 25; return 'Внутри — металл и запчасти. +25 материалов.'; } },
      { label: 'Отбуксировать целиком', hint: '+15 ⚙, +10 ⚡',
        apply(s) {
          s.resources.materials += 15;
          s.resources.energy += 10;
          return 'Контейнер подняли и разобрали.';
        } },
      { label: 'Оставить', hint: '—',
        apply() { return 'Мы прошли мимо.'; } },
    ],
  },
  {
    id: 'ghost_signal', title: 'Эхо на частоте', tag: 'Загадка', weight: 6, minTurn: 10,
    text: 'Радио ловит повторяющийся сигнал: четыре ноты, пауза, снова.',
    choices: [
      { label: 'Идти на сигнал', hint: 'риск',
        apply(s) {
          if (Math.random() < 0.6) {
            s.resources.crystals += 2;
            s.resources.research += 8;
            return 'Зонд с кристаллическим ядром. +2 ◈, +8 ⌬.';
          }
          s.city.hull = Math.max(0, s.city.hull - 14);
          return 'Приманка. Из облаков вынырнула стая. Корпус −14.';
        } },
      { label: 'Проанализировать', hint: '+5 ⌬',
        apply(s) { s.resources.research += 5; return 'Сигнал расшифрован частично. +5 ⌬.'; } },
      { label: 'Сменить курс', hint: '—',
        apply() { return 'Мы отвернули.'; } },
    ],
  },
  {
    id: 'rationing', title: 'Спор о пайках', tag: 'Люди', weight: 8,
    cond: s => s.population.morale < 60,
    text: 'На раздаче еды вспыхнула драка. Кричат, что верхние ярусы получают больше.',
    choices: [
      { label: 'Урезать верхним', hint: '+3 бодрости',
        apply(s) {
          s.population.morale = Math.min(100, s.population.morale + 3);
          return 'Решение объявили публично. Ропот стих.';
        } },
      { label: 'Двойная порция всем', hint: '−20 ❦, +12 бодрости',
        cond: s => s.resources.food >= 20,
        apply(s) {
          s.resources.food -= 20;
          s.population.morale = Math.min(100, s.population.morale + 12);
          return 'Праздник примирения.';
        } },
      { label: 'Применить силу', hint: '−8 бодрости',
        apply(s) {
          s.population.morale = Math.max(0, s.population.morale - 8);
          return 'Стало тихо — но это не мир.';
        } },
    ],
  },
  {
    id: 'engine_failure', title: 'Отказ стабилизатора', tag: 'Город', weight: 9, minTurn: 6,
    text: 'Правый стабилизатор воет на пределе. Ковчег начнёт заваливаться.',
    choices: [
      { label: 'Срочный ремонт', hint: '−20 ⚙',
        cond: s => s.resources.materials >= 20,
        apply(s) { s.resources.materials -= 20; return 'Бригада работала в открытом люке.'; } },
      { label: 'Лететь на одном', hint: '−12 ⚡',
        apply(s) {
          s.resources.energy = Math.max(0, s.resources.energy - 12);
          s.population.morale = Math.max(0, s.population.morale - 3);
          return 'Идём медленно, зато без затрат.';
        } },
      { label: 'Ничего не делать', hint: 'риск',
        apply(s) {
          if (Math.random() < 0.5) return 'Обошлось. Пока обошлось.';
          const dmg = U.ri(18, 31);
          s.city.hull = Math.max(0, s.city.hull - dmg);
          return `Стабилизатор вырвало. Корпус −${dmg}.`;
        } },
    ],
  },
  {
    id: 'stowaway', title: 'Безбилетник', tag: 'Люди', weight: 7, minTurn: 5,
    text: 'В грузовом отсеке нашли подростка.',
    choices: [
      { label: 'Принять в общину', hint: '+1 житель, −3 бодрости',
        apply(s) {
          s.population.current += 1;
          s.population.morale = Math.max(0, s.population.morale - 3);
          return 'Мальчишка остался.';
        } },
      { label: 'В ученики инженерам', hint: '+1 житель, +4 ⌬',
        apply(s) {
          s.population.current += 1;
          s.resources.research += 4;
          return 'Он оказался смышлёным.';
        } },
      { label: 'Высадить', hint: '−4 бодрости',
        apply(s) {
          s.population.morale = Math.max(0, s.population.morale - 4);
          return 'Мы высадили его у руин.';
        } },
    ],
  },
  {
    id: 'trade_convoy', title: 'Воздушные торговцы', tag: 'Встреча', weight: 8, minTurn: 7,
    text: 'Три дирижабля под нейтральными флагами предлагают обмен.',
    choices: [
      { label: 'Купить материалы', hint: '−1 ◈ → +30 ⚙',
        cond: s => s.resources.crystals >= 1,
        apply(s) {
          s.resources.crystals -= 1;
          s.resources.materials += 30;
          return 'Сделка состоялась.';
        } },
      { label: 'Продать еду', hint: '−25 ❦ → +20 ⚡',
        cond: s => s.resources.food >= 25,
        apply(s) {
          s.resources.food -= 25;
          s.resources.energy += 20;
          return 'Топливные ячейки на борту.';
        } },
      { label: 'Отказаться', hint: '—',
        apply() { return 'Мы разошлись в облаках.'; } },
    ],
  },
  {
    id: 'morale_slump', title: 'Тишина на палубах', tag: 'Люди', weight: 7,
    cond: s => s.population.morale < 45,
    text: 'Люди перестали выходить из кают. Город медленно теряет волю.',
    choices: [
      { label: 'Устроить общий сбор', hint: '−10 ❦, +14 бодрости',
        cond: s => s.resources.food >= 10,
        apply(s) {
          s.resources.food -= 10;
          s.population.morale = Math.min(100, s.population.morale + 14);
          return 'На главной палубе зажгли огни.';
        } },
      { label: 'Объявить новый курс', hint: '−2 ◈, +8 бодрости',
        cond: s => s.resources.crystals >= 2,
        apply(s) {
          s.resources.crystals -= 2;
          s.population.morale = Math.min(100, s.population.morale + 8);
          return 'В глазах появился блеск.';
        } },
      { label: 'Оставить как есть', hint: '−1 житель',
        apply(s) {
          s.population.current = Math.max(1, s.population.current - 1);
          return 'Один человек ушёл через шлюз.';
        } },
    ],
  },
  {
    id: 'solar_flare', title: 'Солнечная вспышка', tag: 'Небо', weight: 6, minTurn: 12,
    text: 'Аврора полыхает днём. Электроника сходит с ума.',
    choices: [
      { label: 'Заглушить реактор', hint: '−15 ⚡',
        apply(s) {
          s.resources.energy = Math.max(0, s.resources.energy - 15);
          return 'Легли в дрейф на трое суток.';
        } },
      { label: 'Идти сквозь', hint: 'риск',
        apply(s) {
          if (Math.random() < 0.5) {
            s.resources.energy += 14;
            return 'Щиты выдержали, панели собрали избыток.';
          }
          s.population.current = Math.max(1, s.population.current - 1);
          s.population.morale = Math.max(0, s.population.morale - 8);
          return 'Электроника выгорела. Один погиб.';
        } },
      { label: 'Под облака', hint: '−10 ⚡',
        apply(s) {
          s.resources.energy = Math.max(0, s.resources.energy - 10);
          return 'Атмосфера экранировала радиацию.';
        } },
    ],
  },
];

/* =========================================================================
   ГЕНЕРАЦИЯ МИРА
   ========================================================================= */
const World = {
  generate(seed) {
    const rng = U.mulberry(seed);
    const COLS = 7, ROWS = 5;
    const SX = 210, SY = 190, JITTER = 58;
    const nodes = [];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const off = (r % 2) * (SX / 2);
        const x = c * SX + off + (rng() - 0.5) * JITTER * 2 + 160;
        const y = r * SY + (rng() - 0.5) * JITTER * 2 + 140;

        const cx = (COLS - 1) / 2, cy = (ROWS - 1) / 2;
        const dn = Math.hypot(c - cx, r - cy) / Math.hypot(cx, cy);

        let biome;
        if (dn > 0.72) biome = rng() < 0.4 ? 'crystal' : U.pick(['wastes', 'ghostcity', 'lake']);
        else if (dn > 0.4) biome = U.pick(['ghostcity', 'wastes', 'forest', 'lake', 'ruins']);
        else biome = U.pick(['ruins', 'forest', 'forest', 'ruins', 'lake']);

        const def = BIOMES[biome];
        nodes.push({
          id: 'n' + nodes.length,
          x, y, col: c, row: r, biome,
          danger: Math.min(3, def.danger + (dn > 0.8 && rng() < 0.4 ? 1 : 0)),
          rich: +((0.75 + rng() * 0.6) * (1 + dn * 0.5)).toFixed(2),
          name: U.pick(def.names),
          edges: [], revealed: false, visited: false, cleared: 0,
        });
      }
    }

    // связи с ближайшими соседями
    for (const n of nodes) {
      const sorted = nodes
        .filter(o => o !== n)
        .map(o => ({ o, d: Math.hypot(o.x - n.x, o.y - n.y) }))
        .sort((a, b) => a.d - b.d);
      for (const { o, d } of sorted) {
        if (n.edges.length >= 3) break;
        if (d > 300) break;
        if (n.edges.indexOf(o.id) >= 0) continue;
        n.edges.push(o.id);
        o.edges.push(n.id);
      }
    }

    // гарантия связности
    const byId = {};
    for (const n of nodes) byId[n.id] = n;
    const seen = {};
    const comps = [];
    for (const n of nodes) {
      if (seen[n.id]) continue;
      const comp = [], stack = [n];
      seen[n.id] = true;
      while (stack.length) {
        const cur = stack.pop();
        comp.push(cur);
        for (const e of cur.edges) {
          if (!seen[e]) { seen[e] = true; stack.push(byId[e]); }
        }
      }
      comps.push(comp);
    }
    for (let i = 1; i < comps.length; i++) {
      let best = null;
      for (const a of comps[i]) for (const b of comps[i - 1]) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (!best || d < best.d) best = { a, b, d };
      }
      if (best) {
        best.a.edges.push(best.b.id);
        best.b.edges.push(best.a.id);
      }
    }

    // старт — ближайший к центру
    let start = nodes[0], bestD = Infinity;
    for (const n of nodes) {
      const d = Math.hypot(n.x - 1010, n.y - 620);
      if (d < bestD) { bestD = d; start = n; }
    }
    start.biome = 'ruins';
    start.name = 'Точка Ноль';
    start.danger = 1;
    start.revealed = true;
    start.visited = true;
    for (const e of start.edges) byId[e].revealed = true;

    return {
      nodes, startId: start.id,
      width: COLS * SX + 400,
      height: ROWS * SY + 320,
    };
  },

  nodeById(world, id) {
    return world.nodes.find(n => n.id === id);
  },

  travelTurns(a, b) {
    return Math.max(1, Math.round(Math.hypot(a.x - b.x, a.y - b.y) / 210));
  },
};

/* ---------- выбор события ---------- */
function rollEvent(state) {
  const pool = EVENTS
    .filter(e => !e.minTurn || state.turn >= e.minTurn)
    .filter(e => !e.cond || e.cond(state));
  if (!pool.length) return null;
  const total = pool.reduce((a, e) => a + e.weight, 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return pool[pool.length - 1];
}

/* ---------- экспорт ---------- */
window.ICON = ICON;
window.RNAME = RNAME;
window.BIOMES = BIOMES;
window.BIOME_ICON = BIOME_ICON;
window.BUILDINGS = BUILDINGS;
window.BUILD_ORDER = BUILD_ORDER;
window.TECH = TECH;
window.TECH_ORDER = TECH_ORDER;
window.EVENTS = EVENTS;
window.World = World;
window.rollEvent = rollEvent;
