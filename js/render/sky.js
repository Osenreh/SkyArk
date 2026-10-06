/* =========================================================================
   RENDER/SKY.JS — небо, звёзды, солнце/луна, облака, облачное море
   Загружается после turn.js. Используется всеми сценами.
   ========================================================================= */
'use strict';

/* ---------- палитры суток ---------- */
const PALETTES = [
  { top: '#05070f', mid: '#0b1122', bot: '#131c33', cloud: '#2a3550', sun: '#9fb8ff', star: 1.00 },
  { top: '#131a35', mid: '#3a3560', bot: '#8a5c72', cloud: '#c08a92', sun: '#ffd3a8', star: 0.35 },
  { top: '#2a4a7f', mid: '#4f7bb5', bot: '#9dc0dd', cloud: '#ffffff', sun: '#fff6dd', star: 0.00 },
  { top: '#181d3d', mid: '#5a3a63', bot: '#c76b52', cloud: '#e8a07a', sun: '#ffcf8a', star: 0.20 },
];

function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r  = Math.round(((pa >> 16) & 255) + (((pb >> 16) & 255) - ((pa >> 16) & 255)) * t);
  const g  = Math.round(((pa >> 8) & 255)  + (((pb >> 8) & 255)  - ((pa >> 8) & 255))  * t);
  const bl = Math.round((pa & 255)          + ((pb & 255)          - (pa & 255))          * t);
  return `rgb(${r},${g},${bl})`;
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function glow(cx, x, y, r, col, a) {
  a = a === undefined ? 1 : a;
  const g = cx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(col, 0.85 * a));
  g.addColorStop(0.4, hexA(col, 0.3 * a));
  g.addColorStop(1, hexA(col, 0));
  cx.fillStyle = g;
  cx.beginPath(); cx.arc(x, y, r, 0, Math.PI * 2); cx.fill();
}

function noise1(x, seed) {
  seed = seed || 0;
  const v = Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function paletteFor(t) {
  const p = (t + 0.125) % 1;
  const idx = p * 4;
  const i0 = Math.floor(idx) % 4;
  const i1 = (i0 + 1) % 4;
  const f = idx - Math.floor(idx);
  const a = PALETTES[i0], b = PALETTES[i1];
  return {
    top:   mixHex(a.top,   b.top,   f),
    mid:   mixHex(a.mid,   b.mid,   f),
    bot:   mixHex(a.bot,   b.bot,   f),
    cloud: mixHex(a.cloud, b.cloud, f),
    sun:   mixHex(a.sun,   b.sun,   f),
    star:  a.star + (b.star - a.star) * f,
  };
}

/* ---------- рендерер неба ---------- */
class Sky {
  constructor() {
    this.stars = [];
    this.clouds = [];
    this.w = 0;
    this.h = 0;
    this.t = 0;
    this.timeScale = 1;
    this.ready = false;
    this.shootingStar = null;
    this.nextShooting = 6 + Math.random() * 12;
  }

  resize(w, h) {
    const rebuild = !this.ready || Math.abs(this.w - w) > 400;
    this.w = w;
    this.h = h;
    if (!rebuild) return;

    // звёзды
    this.stars = [];
    const count = Math.round((w * h) / 5200);
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.85,
        r: Math.random() * 1.35 + 0.25,
        tw: Math.random() * Math.PI * 2,
        tws: 0.4 + Math.random() * 1.8,
      });
    }

    // облака — 4 слоя с параллаксом
    this.clouds = [];
    for (let layer = 0; layer < 4; layer++) {
      const n = 5 + layer * 2;
      for (let i = 0; i < n; i++) {
        const puffs = [];
        const np = 5 + Math.floor(Math.random() * 6);
        const spread = 60 + layer * 70;
        for (let k = 0; k < np; k++) {
          puffs.push({
            dx: (Math.random() - 0.5) * spread * 2,
            dy: (Math.random() - 0.5) * spread * 0.42,
            r:  (0.35 + Math.random() * 0.65) * (34 + layer * 42),
          });
        }
        this.clouds.push({
          x: Math.random() * w * 1.4 - w * 0.2,
          y: h * (0.22 + Math.random() * 0.66),
          sp: (0.6 + layer * 1.5) * (0.4 + Math.random() * 0.8),
          a: 0.05 + layer * 0.075 + Math.random() * 0.05,
          puffs,
          L: layer,
        });
      }
    }
    this.clouds.sort((a, b) => a.L - b.L);
    this.ready = true;
  }

  update(dt) {
    this.t = (this.t + dt * this.timeScale * 0.0042) % 1;

    for (const c of this.clouds) {
      c.x += c.sp * dt * (8 + c.L * 10);
      if (c.x - 400 > this.w) c.x = -420;
    }

    // падающая звезда ночью
    const pal = paletteFor(this.t);
    this.nextShooting -= dt;
    if (!this.shootingStar && pal.star > 0.5 && this.nextShooting <= 0) {
      this.shootingStar = {
        x: Math.random() * this.w * 0.8,
        y: Math.random() * this.h * 0.4,
        vx: 320 + Math.random() * 260,
        vy: 130 + Math.random() * 120,
        life: 0,
        max: 0.85,
      };
      this.nextShooting = 9 + Math.random() * 18;
    }
    if (this.shootingStar) {
      const s = this.shootingStar;
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life > s.max) this.shootingStar = null;
    }
  }

  /* ---------- небо ---------- */
  draw(cx, w, h) {
    const pal = paletteFor(this.t);

    // градиент
    const g = cx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.52, pal.mid);
    g.addColorStop(1, pal.bot);
    cx.fillStyle = g;
    cx.fillRect(0, 0, w, h);

    // туманность
    for (let i = 0; i < 3; i++) {
      const nx = w * (0.3 + i * 0.25) + Math.sin(this.t * 6.28 + i) * 30;
      const ny = h * (0.15 + i * 0.1);
      const rad = w * (0.25 + i * 0.1);
      const ng = cx.createRadialGradient(nx, ny, 0, nx, ny, rad);
      const hue = ['#4a3a7a', '#2a3a6a', '#3a2a5a'][i];
      ng.addColorStop(0, hexA(hue, 0.08));
      ng.addColorStop(0.6, hexA(hue, 0.03));
      ng.addColorStop(1, hexA(hue, 0));
      cx.fillStyle = ng;
      cx.beginPath(); cx.arc(nx, ny, rad, 0, Math.PI * 2); cx.fill();
    }

    this._stars(cx, pal);
    this._sunMoon(cx, w, h, pal);
    this._shootingStar(cx);
  }

  _stars(cx, pal) {
    if (pal.star <= 0.02) return;
    const t = performance.now() / 1000;
    cx.save();
    for (const s of this.stars) {
      const tw = 0.55 + 0.45 * Math.sin(t * s.tws + s.tw);
      cx.globalAlpha = pal.star * tw * 0.95;
      cx.fillStyle = '#ffffff';
      cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, Math.PI * 2); cx.fill();

      if (s.r > 1.1) {
        cx.globalAlpha = pal.star * tw * 0.2;
        cx.beginPath(); cx.arc(s.x, s.y, s.r * 3.6, 0, Math.PI * 2); cx.fill();
      }
    }
    cx.restore();
  }

  _sunMoon(cx, w, h, pal) {
    const a = (this.t - 0.25) * Math.PI * 2;
    const sx = w * 0.5 + Math.cos(a - Math.PI / 2) * w * 0.34;
    const sy = h * 0.62 + Math.sin(a - Math.PI / 2) * h * 0.52;
    const isMoon = this.t > 0.62 || this.t < 0.12;
    const r = isMoon ? 26 : 44;

    const halo = cx.createRadialGradient(sx, sy, 0, sx, sy, r * 8);
    halo.addColorStop(0, hexA('#ffffff', isMoon ? 0.16 : 0.4));
    halo.addColorStop(0.25, hexA(pal.sun, isMoon ? 0.07 : 0.16));
    halo.addColorStop(1, hexA(pal.sun, 0));
    cx.fillStyle = halo;
    cx.beginPath(); cx.arc(sx, sy, r * 8, 0, Math.PI * 2); cx.fill();

    cx.save();
    cx.shadowColor = pal.sun;
    cx.shadowBlur = isMoon ? 30 : 60;
    cx.fillStyle = isMoon ? '#e8eeff' : pal.sun;
    cx.beginPath(); cx.arc(sx, sy, r, 0, Math.PI * 2); cx.fill();
    cx.restore();

    // кратеры луны
    if (isMoon) {
      cx.save();
      cx.globalAlpha = 0.16;
      cx.fillStyle = '#8f9dc4';
      for (const [dx, dy, cr] of [[-0.3,-0.2,0.22],[0.28,0.12,0.17],[-0.1,0.38,0.13]]) {
        cx.beginPath();
        cx.arc(sx + dx * r, sy + dy * r, cr * r, 0, Math.PI * 2);
        cx.fill();
      }
      cx.restore();
    }
  }

  _shootingStar(cx) {
    const s = this.shootingStar;
    if (!s) return;
    const k = 1 - s.life / s.max;
    const len = 120;
    const m = Math.hypot(s.vx, s.vy) || 1;
    const g = cx.createLinearGradient(s.x, s.y, s.x - (s.vx / m) * len, s.y - (s.vy / m) * len);
    g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.strokeStyle = g;
    cx.lineWidth = 2;
    cx.beginPath();
    cx.moveTo(s.x, s.y);
    cx.lineTo(s.x - (s.vx / m) * len, s.y - (s.vy / m) * len);
    cx.stroke();
  }

  /* ---------- облака поверх неба ---------- */
  drawClouds(cx, w, h, from, to, alphaMul) {
    from = from || 0;
    to = to || 4;
    alphaMul = alphaMul === undefined ? 1 : alphaMul;
    const pal = paletteFor(this.t);

    for (const cl of this.clouds) {
      if (cl.L < from || cl.L >= to) continue;
      cx.save();
      cx.globalAlpha = cl.a * alphaMul;
      for (const pf of cl.puffs) {
        const px = cl.x + pf.dx;
        const py = cl.y + pf.dy;
        const pg = cx.createRadialGradient(px, py, 0, px, py, pf.r);
        pg.addColorStop(0, hexA(pal.cloud, 0.95));
        pg.addColorStop(0.55, hexA(pal.cloud, 0.4));
        pg.addColorStop(1, hexA(pal.cloud, 0));
        cx.fillStyle = pg;
        cx.beginPath(); cx.arc(px, py, pf.r, 0, Math.PI * 2); cx.fill();
      }
      cx.restore();
    }
  }

  /* ---------- облачное море внизу экрана ---------- */
  drawSea(cx, w, h, t) {
    const pal = paletteFor(this.t);
    const baseY = h * 0.86;

    for (let layer = 0; layer < 3; layer++) {
      const yOff = layer * 34;
      const speed = 12 + layer * 22;
      const alpha = 0.16 + layer * 0.13;

      cx.beginPath();
      cx.moveTo(-10, h + 10);
      for (let x = -10; x <= w + 10; x += 14) {
        const n = noise1((x + t * speed) * 0.004, layer * 31) * 0.6
                + noise1((x + t * speed) * 0.011, layer * 57) * 0.4;
        cx.lineTo(x, baseY + yOff - n * 46);
      }
      cx.lineTo(w + 10, h + 10);
      cx.closePath();

      const g = cx.createLinearGradient(0, baseY - 70 + yOff, 0, h);
      g.addColorStop(0, hexA(pal.cloud, alpha));
      g.addColorStop(1, hexA(pal.cloud, alpha * 1.7));
      cx.fillStyle = g;
      cx.fill();
    }
  }
}

/* ---------- экспорт ---------- */
window.Sky = Sky;
window.hexA = hexA;
window.glow = glow;
window.noise1 = noise1;
window.paletteFor = paletteFor;
