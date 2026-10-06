/* =========================================================================
   CORE.JS — утилиты, RNG, шина событий, звук, сохранения
   Загружается первым. Ничего не знает об игре.
   ========================================================================= */
'use strict';

/* ---------- утилиты ---------- */
const U = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t)  { return a + (b - a) * t; },
  ri(a, b)       { return a + Math.floor(Math.random() * (b - a + 1)); },
  rf(a, b)       { return a + Math.random() * (b - a); },
  pick(arr)      { return arr[Math.floor(Math.random() * arr.length)]; },
  chance(p)      { return Math.random() < p; },

  hash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },

  mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
};

/* ---------- шина событий ---------- */
class Bus {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) { this.map.get(name)?.delete(fn); }
  emit(name, payload) {
    const set = this.map.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[bus] ${name}:`, err); }
    }
  }
}

/* ---------- звук (Web Audio, без файлов) ---------- */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.started = false;
    this.sfxOn = true;
    this.musicOn = true;
  }

  init() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? 0.5 : 0;
    this.sfxGain.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.14 : 0;
    this.musicGain.connect(this.master);

    this.started = true;
    this._startDrone();
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfxGain) this.sfxGain.gain.value = on ? 0.5 : 0;
  }
  setMusic(on) {
    this.musicOn = on;
    if (this.musicGain) this.musicGain.gain.value = on ? 0.14 : 0;
  }

  _tone({ freq = 440, dur = 0.14, type = 'sine', gain = 0.3, slide = 0 } = {}) {
    if (!this.started || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  _noise({ dur = 0.18, gain = 0.25, lp = 1600 } = {}) {
    if (!this.started || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
  }

  click()  { this._tone({ freq: 620, dur: 0.05, type: 'triangle', gain: 0.16 }); }
  hover()  { this._tone({ freq: 880, dur: 0.03, type: 'sine', gain: 0.05 }); }
  confirm() {
    this._tone({ freq: 520, dur: 0.09, type: 'triangle', gain: 0.2 });
    setTimeout(() => this._tone({ freq: 780, dur: 0.13, type: 'triangle', gain: 0.18 }), 70);
  }
  deny() { this._tone({ freq: 200, dur: 0.16, type: 'sawtooth', gain: 0.13, slide: -70 }); }
  build() {
    this._noise({ dur: 0.34, gain: 0.2, lp: 900 });
    setTimeout(() => this._tone({ freq: 340, dur: 0.24, type: 'sine', gain: 0.2, slide: 260 }), 120);
  }
  coin() {
    this._tone({ freq: 1180, dur: 0.07, type: 'square', gain: 0.11 });
    setTimeout(() => this._tone({ freq: 1560, dur: 0.1, type: 'square', gain: 0.09 }), 60);
  }
  event() { this._tone({ freq: 300, dur: 0.5, type: 'sine', gain: 0.2, slide: 180 }); }
  alarm() {
    this._tone({ freq: 420, dur: 0.22, type: 'square', gain: 0.16, slide: -140 });
    setTimeout(() => this._tone({ freq: 420, dur: 0.22, type: 'square', gain: 0.16, slide: -140 }), 280);
  }
  hit() {
    this._noise({ dur: 0.12, gain: 0.3, lp: 2400 });
    this._tone({ freq: 160, dur: 0.1, type: 'sawtooth', gain: 0.15 });
  }
  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => this._tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.16 }), i * 85));
  }
  travel() { this._tone({ freq: 180, dur: 1.1, type: 'sine', gain: 0.16, slide: 140 }); }

  _startDrone() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    g.connect(this.musicGain);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 3;
    filter.connect(g);
    [55, 82.5, 110, 164.8].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i % 2 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      osc.detune.value = (i - 1.5) * 7;
      const og = this.ctx.createGain();
      og.gain.value = 0.24 / (i + 1);
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.045 + i * 0.017;
      const lg = this.ctx.createGain();
      lg.gain.value = 0.1 / (i + 1);
      lfo.connect(lg);
      lg.connect(og.gain);
      osc.connect(og);
      og.connect(filter);
      osc.start(t);
      lfo.start(t);
    });
  }

  duck(on) {
    if (!this.musicGain) return;
    const target = on ? 0.05 : (this.musicOn ? 0.14 : 0);
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.linearRampToValueAtTime(target, this.ctx.currentTime + 0.6);
  }
}

/* ---------- сохранения ---------- */
const SAVE_KEY = 'skyark.save.v1';
const SAVE_SLOTS = 3;

function saveGame(state, slot = 0) {
  try {
    localStorage.setItem(
      `${SAVE_KEY}.${slot}`,
      JSON.stringify(Object.assign({}, state, { savedAt: Date.now() }))
    );
    return { ok: true };
  } catch (e) {
    console.error('[save]', e);
    return { ok: false, error: e.message };
  }
}

function loadGame(slot = 0) {
  try {
    const raw = localStorage.getItem(`${SAVE_KEY}.${slot}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('[load]', e);
    return null;
  }
}

function listSaves() {
  const out = [];
  for (let i = 0; i < SAVE_SLOTS; i++) {
    try {
      const raw = localStorage.getItem(`${SAVE_KEY}.${i}`);
      if (!raw) { out.push(null); continue; }
      const d = JSON.parse(raw);
      out.push({
        slot: i,
        turn: d.turn,
        day: d.day,
        pop: d.population?.current,
        hull: d.city?.hull,
        savedAt: d.savedAt,
      });
    } catch { out.push(null); }
  }
  return out;
}

function hasAnySave() { return listSaves().some(s => s !== null); }

function deleteSave(slot) {
  try { localStorage.removeItem(`${SAVE_KEY}.${slot}`); } catch {}
}

/* ---------- журнал ---------- */
function addLog(state, text, kind = 'info') {
  state.log.unshift({ text, kind, turn: state.turn, day: state.day });
  if (state.log.length > 60) state.log.length = 60;
}

/* ---------- экспорт в глобальную область ---------- */
window.U = U;
window.Bus = Bus;
window.AudioEngine = AudioEngine;
window.SAVE_KEY = SAVE_KEY;
window.SAVE_SLOTS = SAVE_SLOTS;
window.saveGame = saveGame;
window.loadGame = loadGame;
window.listSaves = listSaves;
window.hasAnySave = hasAnySave;
window.deleteSave = deleteSave;
window.addLog = addLog;
