/* =========================================================================
   RENDER/CITY.JS — летающий город: остров, модули, двигатели
   Загружается после sky.js.
   ========================================================================= */
'use strict';

/* ---------- позиции модулей на палубе ---------- */
const SLOTS = [
  { x: 0.50, y: 0.52, s: 1.15 },
  { x: 0.33, y: 0.56, s: 0.95 },
  { x: 0.67, y: 0.56, s: 0.95 },
  { x: 0.41, y: 0.45, s: 0.85 },
  { x: 0.59, y: 0.45, s: 0.85 },
  { x: 0.24, y: 0.62, s: 0.80 },
  { x: 0.76, y: 0.62, s: 0.80 },
  { x: 0.50, y: 0.40, s: 0.78 },
  { x: 0.16, y: 0.55, s: 0.70 },
  { x: 0.84, y: 0.55, s: 0.70 },
  { x: 0.32, y: 0.68, s: 0.72 },
  { x: 0.68, y: 0.68, s: 0.72 },
];

function roundRect(cx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.arcTo(x + w, y, x + w, y + h, r);
  cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r);
  cx.arcTo(x, y, x + w, y, r);
  cx.closePath();
}

class CityView {
  constructor() {
    this.t = 0;
    this.bob = 0;
    this.arrival = 0;
  }

  update(dt) {
    this.t += dt;
    this.bob = Math.sin(this.t * 0.55) * 4 + Math.sin(this.t * 1.31) * 1.6;
    if (this.arrival > 0) this.arrival -= dt;
  }

  triggerArrival() { this.arrival = 1.6; }

  draw(cx, w, h, S) {
    const cxx = w * 0.5;
    const cyy = h * 0.55 + this.bob;
    const sc = Math.min(w / 1500, h / 900) * 1.25;

    cx.save();
    cx.translate(cxx, cyy);
    cx.scale(sc, sc);

    this._island(cx, S);
    this._modules(cx, S);
    this._engines(cx, S);

    cx.restore();
  }

  /* ---------- остров ---------- */
  _island(cx, S) {
    const R = 250, N = 54;

    // контур палубы
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2;
      const n = noise1(a * 2.1, 7) * 0.5 + noise1(a * 4.7, 19) * 0.5;
      const r = R * (1 + (n - 0.5) * 0.22);
      pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.42]);
    }

    // тень в воздухе
    const sh = cx.createRadialGradient(0, 180, 30, 0, 220, R * 1.6);
    sh.addColorStop(0, 'rgba(80,140,255,.13)');
    sh.addColorStop(1, 'rgba(80,140,255,0)');
    cx.fillStyle = sh;
    cx.beginPath(); cx.ellipse(0, 220, R * 1.6, R * 0.7, 0, 0, 6.28); cx.fill();

    // нижний конус (скала)
    const depth = 250;
    const bot = [];
    for (let i = 0; i <= N; i++) {
      const a = i / N * Math.PI * 2;
      const taper = 0.14 + noise1(a * 3.2, 3) * 0.16;
      bot.push([Math.cos(a) * R * taper, depth + Math.sin(a) * R * 0.1 * taper]);
    }

    cx.beginPath();
    cx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]);
    cx.lineTo(bot[bot.length - 1][0], bot[bot.length - 1][1]);
    for (let i = bot.length - 2; i >= 0; i--) cx.lineTo(bot[i][0], bot[i][1]);
    cx.closePath();

    const rg = cx.createLinearGradient(0, -80, 0, depth);
    rg.addColorStop(0,    '#4a5266');
    rg.addColorStop(0.15, '#3a4258');
    rg.addColorStop(0.45, '#252c40');
    rg.addColorStop(0.80, '#14192a');
    rg.addColorStop(1,    '#080c16');
    cx.fillStyle = rg;
    cx.fill();

    // страты породы
    cx.save();
    cx.globalAlpha = 0.28;
    cx.strokeStyle = '#0a0e16';
    for (let s = 0; s < 28; s++) {
      const aa = (s / 28) * Math.PI * 2 + noise1(s * 0.7, 5) * 0.2;
      const sx = Math.cos(aa) * R * 0.94;
      const sy = Math.sin(aa) * R * 0.4;
      const ex = Math.cos(aa) * R * 0.28;
      const ey = depth * (0.35 + noise1(s * 0.9, 11) * 0.6);
      cx.lineWidth = 1.2 + noise1(s, 3) * 1.4;
      cx.beginPath();
      cx.moveTo(sx, sy);
      cx.bezierCurveTo(sx * 0.85, depth * 0.25, ex * 1.3, ey * 0.6, ex, ey);
      cx.stroke();
    }
    cx.restore();

    // кристаллические жилы
    for (let v = 0; v < 10; v++) {
      const va = (v / 10) * Math.PI * 2 + 0.4;
      const vr = R * (0.4 + noise1(v * 0.9, 23) * 0.5);
      const vx = Math.cos(va) * vr;
      const vy = 60 + Math.sin(va) * vr * 0.4 + noise1(v * 1.1, 31) * 110;
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 1.2 + v * 0.7);
      const col = ['#7fe3d4', '#8fe6ff', '#b8f0ff'][v % 3];
      glow(cx, vx, vy, 26, col, 0.22 * pulse);
    }

    // палуба
    cx.beginPath();
    cx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]);
    cx.closePath();

    const dg = cx.createLinearGradient(0, -R * 0.5, 0, R * 0.5);
    dg.addColorStop(0,   '#6b7a94');
    dg.addColorStop(0.4, '#4f5c74');
    dg.addColorStop(1,   '#3a4558');
    cx.fillStyle = dg;
    cx.fill();

    cx.strokeStyle = 'rgba(200,220,255,.45)';
    cx.lineWidth = 2.2;
    cx.stroke();

    // техноразметка
    cx.save();
    cx.globalAlpha = 0.13;
    cx.strokeStyle = '#a8d4ff';
    cx.lineWidth = 1;
    cx.setLineDash([5, 9]);
    for (let ring = 1; ring <= 3; ring++) {
      cx.beginPath();
      cx.ellipse(0, 0, R * 0.9 * (ring / 3.4), R * 0.36 * (ring / 3.4), 0, 0, 6.28);
      cx.stroke();
    }
    for (let rl = 0; rl < 16; rl++) {
      const ra = rl / 16 * 6.28;
      cx.beginPath();
      cx.moveTo(Math.cos(ra) * R * 0.35, Math.sin(ra) * R * 0.15);
      cx.lineTo(Math.cos(ra) * R * 0.85, Math.sin(ra) * R * 0.36);
      cx.stroke();
    }
    cx.setLineDash([]);
    cx.restore();
  }

  /* ---------- модули ---------- */
  _modules(cx, S) {
    S.city.modules.forEach((m, i) => {
      const sl = SLOTS[i % SLOTS.length];
      const jx = (noise1(i * 3.7, 13) - 0.5) * 30;
      const jy = (noise1(i * 5.1, 29) - 0.5) * 14;
      const x = (sl.x - 0.5) * 560 + jx;
      const y = (sl.y - 0.5) * 230 + jy;
      this._building(cx, x, y, sl.s, m, i);
    });
  }

  _building(cx, x, y, s, m, idx) {
    const def = BUILDINGS[m.type];
    if (!def) return;

    const lvl = m.level;
    const bw = 74 * s;
    const bh = 46 * s;
    const hg = (26 + lvl * 20) * s;
    const bt = -hg;

    cx.save();
    cx.translate(x, y);

    // тень на палубе
    cx.save();
    cx.globalAlpha = 0.32;
    cx.fillStyle = '#0a0e16';
    cx.beginPath(); cx.ellipse(0, 6, bw * 0.62, bh * 0.4, 0, 0, 6.28); cx.fill();
    cx.restore();

    // пьедестал
    cx.beginPath();
    cx.moveTo(-bw / 2, 0);
    cx.lineTo(-bw / 2 + 6, bh * 0.55);
    cx.lineTo( bw / 2 - 6, bh * 0.55);
    cx.lineTo( bw / 2, 0);
    cx.closePath();
    cx.fillStyle = '#39445a';
    cx.fill();

    // корпус
    const g = cx.createLinearGradient(0, bt, 0, 0);
    g.addColorStop(0,    '#59677f');
    g.addColorStop(0.55, '#414d63');
    g.addColorStop(1,    '#2c3547');
    cx.fillStyle = g;
    roundRect(cx, -bw / 2, bt, bw, hg + 4, 5);
    cx.fill();
    cx.strokeStyle = 'rgba(150,180,225,.22)';
    cx.lineWidth = 1.2;
    cx.stroke();

    // крыша
    cx.beginPath();
    cx.moveTo(-bw / 2 - 3, bt);
    cx.lineTo(0, bt - 13 * s);
    cx.lineTo(bw / 2 + 3, bt);
    cx.closePath();
    cx.fillStyle = '#4d5a72';
    cx.fill();

    // окна
    const rows = Math.min(3, lvl + 1);
    const ww = bw * 0.16, wh = 7 * s;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 3; c++) {
        const wx = -bw * 0.3 + c * bw * 0.3;
        const wy = bt + 12 * s + r * 14 * s;
        if (wy > -6) continue;
        const on = Math.sin(this.t * 2 + idx * 3 + r * 1.7 + c) > -0.55;
        const fl = 0.8 + 0.2 * Math.sin(this.t * 7 + idx + r * 2 + c);
        cx.fillStyle = on ? hexA('#ffd9a0', 0.9 * fl) : 'rgba(30,40,58,.85)';
        roundRect(cx, wx - ww / 2, wy, ww, wh, 1.6);
        cx.fill();
      }
    }

    this._detail(cx, m, s, bw, bt, hg, idx);

    // индикаторы уровня
    for (let i = 0; i < def.max; i++) {
      cx.beginPath();
      cx.arc(-bw / 2 + 7 + i * 9, 11 * s, 2.6, 0, 6.28);
      cx.fillStyle = i < lvl ? '#7fe3d4' : 'rgba(255,255,255,.16)';
      cx.fill();
    }

    cx.restore();
  }

  _detail(cx, m, s, bw, bt, hg, idx) {
    const t = this.t, lvl = m.level;

    switch (m.type) {
      case 'reactor': {
        const pulse = 0.55 + 0.45 * Math.sin(t * 2.2 + idx);
        glow(cx, 0, bt - 26 * s, 44 * s * (0.9 + pulse * 0.25), '#7fe3d4', 0.55 * pulse);
        cx.beginPath();
        cx.arc(0, bt - 26 * s, 11 * s, 0, 6.28);
        cx.fillStyle = hexA('#d9fffa', 0.92);
        cx.fill();
        break;
      }
      case 'farm': {
        for (let i = 0; i < lvl; i++) {
          const yy = bt + 16 * s + i * 15 * s;
          if (yy > -4) break;
          cx.fillStyle = hexA('#7fd6a0', 0.35);
          roundRect(cx, -bw * 0.42, yy, bw * 0.84, 7 * s, 3);
          cx.fill();
        }
        break;
      }
      case 'habitat': {
        for (let i = 0; i < lvl + 1; i++) {
          const yy = bt + 10 * s + i * 15 * s;
          if (yy > -4) break;
          cx.fillStyle = 'rgba(180,205,240,.16)';
          roundRect(cx, -bw * 0.56, yy, bw * 1.12, 3.4 * s, 1.6);
          cx.fill();
        }
        break;
      }
      case 'crystal': {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.5 + idx);
        for (let i = 0; i < lvl + 1; i++) {
          const ang = (i / (lvl + 1)) * Math.PI - Math.PI / 2;
          const cxx = Math.cos(ang) * 14 * s;
          const cyy = bt - 20 * s - Math.sin(Math.abs(ang)) * 8 * s;
          glow(cx, cxx, cyy, 26 * s, '#8fe6ff', 0.4 * pulse);
        }
        break;
      }
      case 'radar': {
        const ang = t * 0.85 + idx;
        cx.save();
        cx.translate(0, bt - 14 * s);
        cx.rotate(ang);
        cx.beginPath();
        cx.ellipse(0, 0, 20 * s, 7 * s, 0, 0, 6.28);
        cx.fillStyle = 'rgba(190,215,250,.75)';
        cx.fill();
        cx.restore();

        cx.save();
        cx.globalAlpha = 0.14 + 0.06 * Math.sin(t * 3);
        cx.beginPath();
        cx.moveTo(0, bt - 14 * s);
        cx.arc(0, bt - 14 * s, 130 * s, ang - 0.35, ang + 0.35);
        cx.closePath();
        cx.fillStyle = hexA('#7fe3d4', 0.5);
        cx.fill();
        cx.restore();
        break;
      }
      case 'hospital': {
        const cy = bt - 18 * s;
        glow(cx, 0, cy, 30 * s, '#ff8f8f', 0.28);
        cx.fillStyle = hexA('#ff9d9d', 0.9);
        roundRect(cx, -2.6 * s, cy - 9 * s, 5.2 * s, 18 * s, 2);
        cx.fill();
        roundRect(cx, -9 * s, cy - 2.6 * s, 18 * s, 5.2 * s, 2);
        cx.fill();
        break;
      }
      case 'barracks': {
        cx.strokeStyle = 'rgba(190,215,250,.6)';
        cx.lineWidth = 1.6;
        cx.beginPath();
        cx.moveTo(0, bt);
        cx.lineTo(0, bt - 24 * s);
        cx.stroke();
        const wav = Math.sin(t * 3 + idx) * 2.5;
        cx.beginPath();
        cx.moveTo(0, bt - 24 * s);
        cx.quadraticCurveTo(9 * s, bt - 21 * s + wav, 18 * s, bt - 24 * s);
        cx.lineTo(18 * s, bt - 14 * s);
        cx.quadraticCurveTo(9 * s, bt - 11 * s + wav, 0, bt - 14 * s);
        cx.closePath();
        cx.fillStyle = hexA('#ff9a76', 0.85);
        cx.fill();
        break;
      }
      case 'extractor': {
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.35 + i * 0.33 + idx * 0.1) % 1;
          const px = -bw * 0.28 + i * bw * 0.28 + Math.sin(ph * 6) * 5;
          const py = bt - 4 * s - ph * 46 * s;
          cx.globalAlpha = (1 - ph) * 0.24;
          cx.beginPath();
          cx.arc(px, py, (5 + ph * 13) * s, 0, 6.28);
          cx.fillStyle = '#cfd9e8';
          cx.fill();
        }
        cx.globalAlpha = 1;
        break;
      }
      case 'lab': {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.9 + idx);
        glow(cx, 0, bt - 16 * s, 32 * s, '#8f6bff', 0.4 * pulse);
        cx.beginPath();
        cx.arc(0, bt - 16 * s, 8 * s, 0, 6.28);
        cx.fillStyle = hexA('#c8b6ff', 0.9);
        cx.fill();
        break;
      }
      case 'garden': {
        for (let i = 0; i < 3; i++) {
          const px = -18 * s + i * 18 * s;
          const py = bt - 10 * s + Math.sin(t * 1.2 + i + idx) * 2;
          cx.beginPath();
          cx.arc(px, py, 6 * s, 0, 6.28);
          cx.fillStyle = hexA(['#ffb3d1', '#ffe08a', '#b5e8ff'][i], 0.75);
          cx.fill();
        }
        break;
      }
      case 'hangar': {
        cx.fillStyle = 'rgba(10,15,24,.8)';
        roundRect(cx, -bw * 0.3, -hg * 0.35, bw * 0.6, hg * 0.33, 3);
        cx.fill();
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + idx);
        glow(cx, 0, -hg * 0.18, 22 * s, '#7fb0ff', 0.4 * pulse);
        break;
      }
      case 'workshop': {
        if (Math.sin(t * 4 + idx) > 0.75) {
          glow(cx, bw * 0.2, bt - 8 * s, 20 * s, '#ffc078', 0.7);
        }
        break;
      }
    }
  }

  /* ---------- двигатели ---------- */
  _engines(cx, S) {
    const thr = S.travel ? 1 : 0.45;
    const positions = [[-130, 170], [130, 170], [0, 220]];

    for (let i = 0; i < positions.length; i++) {
      const px = positions[i][0], py = positions[i][1];
      const fl = 0.82 + 0.18 * Math.sin(this.t * 9 + i * 2.3);
      const len = (70 + thr * 70) * fl;

      // сопло
      cx.fillStyle = '#252c40';
      cx.beginPath();
      cx.moveTo(px - 16, py - 8);
      cx.lineTo(px + 16, py - 8);
      cx.lineTo(px + 12, py);
      cx.lineTo(px - 12, py);
      cx.closePath();
      cx.fill();

      // внешнее пламя
      const g1 = cx.createLinearGradient(px, py, px, py + len);
      g1.addColorStop(0,   hexA('#8fc4ff', 0.7));
      g1.addColorStop(0.4, hexA('#5b8cff', 0.35));
      g1.addColorStop(1,   hexA('#3a5cc0', 0));
      cx.fillStyle = g1;
      cx.beginPath();
      cx.moveTo(px - 14, py);
      cx.quadraticCurveTo(px - 8, py + len * 0.6, px, py + len);
      cx.quadraticCurveTo(px + 8, py + len * 0.6, px + 14, py);
      cx.closePath();
      cx.fill();

      // среднее пламя
      const g2 = cx.createLinearGradient(px, py, px, py + len * 0.7);
      g2.addColorStop(0,   hexA('#dff5ff', 0.85));
      g2.addColorStop(0.5, hexA('#8fe6ff', 0.5));
      g2.addColorStop(1,   hexA('#7fe3d4', 0));
      cx.fillStyle = g2;
      cx.beginPath();
      cx.moveTo(px - 9, py);
      cx.quadraticCurveTo(px - 5, py + len * 0.35, px, py + len * 0.7);
      cx.quadraticCurveTo(px + 5, py + len * 0.35, px + 9, py);
      cx.closePath();
      cx.fill();

      // свечение
      glow(cx, px, py + len * 0.15, 48 * fl, '#7fb0ff', 0.35 * fl);
    }
  }
}

window.CityView = CityView;
window.roundRect = roundRect;
