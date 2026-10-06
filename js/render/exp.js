/* =========================================================================
   RENDER/EXP.JS — поверхность планеты во время вылазки: ландшафт, отряд, враг
   Загружается после map.js. Использует Expedition, ZONES.
   ========================================================================= */
'use strict';

class ExpView {
  constructor() {
    this.t = 0;
    this.shake = 0;
    this.flash = 0;
  }

  update(dt) {
    this.t += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.6);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
  }

  hit() { this.shake = 1; this.flash = 0.7; }

  draw(cx, w, h, S, squad) {
    const node = Expedition.node(S);
    if (!node) return;

    const b = BIOMES[node.biome];
    const z = Expedition.ZONES[S.expedition.zone];

    const sx = this.shake ? (Math.random() - 0.5) * 12 * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * 12 * this.shake : 0;

    cx.save();
    cx.translate(sx, sy);

    this._terrain(cx, w, h, b, z);
    this._squad(cx, w, h, squad);
    this._encounter(cx, w, h, S);
    this._badge(cx, z);

    cx.restore();

    if (this.flash > 0) {
      cx.fillStyle = hexA('#ff3b3b', 0.14 * this.flash);
      cx.fillRect(0, 0, w, h);
    }
  }

  _terrain(cx, w, h, b, z) {
    const hz = h * 0.56;

    // небо
    const sky = cx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0,   hexA(b.color, 0.12));
    sky.addColorStop(0.6, 'rgba(10,14,24,.5)');
    sky.addColorStop(1,   'rgba(8,11,19,.8)');
    cx.fillStyle = sky;
    cx.fillRect(0, 0, w, hz);

    // дальние силуэты
    for (let L = 0; L < 3; L++) {
      const depth = L / 2;
      const yB = hz - 40 + L * 26;
      const speed = this.t * (3 + L * 5);

      cx.beginPath();
      cx.moveTo(0, h);
      cx.lineTo(0, yB);
      for (let x = 0; x <= w; x += 10) {
        const nn = noise1((x + speed) * 0.0035, L * 17) * 0.6
                 + noise1((x + speed) * 0.011, L * 41) * 0.4;
        cx.lineTo(x, yB - (40 + L * 30) * (0.35 + nn));
      }
      cx.lineTo(w, h);
      cx.closePath();
      cx.fillStyle = hexA(b.color, 0.13 + depth * 0.16);
      cx.fill();
    }

    // земля
    const gr = cx.createLinearGradient(0, hz, 0, h);
    gr.addColorStop(0,    hexA(b.color, 0.55));
    gr.addColorStop(0.35, hexA(b.color, 0.34));
    gr.addColorStop(1,    'rgba(6,9,16,.95)');
    cx.fillStyle = gr;
    cx.fillRect(0, hz, w, h - hz);

    // линия горизонта
    cx.strokeStyle = hexA(b.accent, 0.32);
    cx.lineWidth = 1.4;
    cx.beginPath();
    cx.moveTo(0, hz);
    cx.lineTo(w, hz);
    cx.stroke();

    // частицы среды
    for (let i = 0; i < 26; i++) {
      const px = ((i * 137.5 + this.t * (12 + i % 7)) % (w + 60)) - 30;
      const py = hz - 120 + ((i * 71.3 + Math.sin(this.t * 0.7 + i) * 22) % (h - hz + 120));
      cx.fillStyle = hexA(b.accent, 0.06 + 0.06 * Math.sin(this.t * 1.4 + i));
      cx.beginPath();
      cx.arc(px, py, 1.2 + (i % 3) * 0.6, 0, 6.28);
      cx.fill();
    }
  }

  _squad(cx, w, h, squad) {
    if (!squad) return;
    const baseX = w * 0.36;
    const baseY = h * 0.72;
    const alive = squad.members.filter(m => m.hp > 0);

    alive.forEach((m, i) => {
      const ox = (i - (alive.length - 1) / 2) * 46;
      const bob = Math.sin(this.t * 2 + i * 1.3) * 2.5;
      const x = baseX + ox;
      const y = baseY + bob;
      const R = ROLES[m.role] || ROLES.gunner;

      // тень
      cx.beginPath();
      cx.ellipse(x, baseY + 20, 15, 5, 0, 0, 6.28);
      cx.fillStyle = 'rgba(0,0,0,.45)';
      cx.fill();

      glow(cx, x, y, 32, R.color, 0.22);

      // тело
      cx.fillStyle = '#2f3949';
      roundRect(cx, x - 8, y - 4, 16, 22, 4);
      cx.fill();

      // голова
      cx.beginPath();
      cx.arc(x, y - 12, 7.5, 0, 6.28);
      cx.fillStyle = R.color;
      cx.fill();
      cx.strokeStyle = 'rgba(255,255,255,.35)';
      cx.lineWidth = 1.2;
      cx.stroke();

      // иконка роли
      cx.font = '600 9px system-ui,sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillStyle = 'rgba(10,14,22,.9)';
      cx.fillText(R.icon, x, y - 12);

      // полоса HP
      const hpF = Math.max(0, m.hp / m.maxHp);
      roundRect(cx, x - 13, y + 22, 26, 4, 2);
      cx.fillStyle = 'rgba(0,0,0,.55)';
      cx.fill();
      roundRect(cx, x - 13, y + 22, 26 * hpF, 4, 2);
      cx.fillStyle = hpF > 0.5 ? '#5fd68a' : hpF > 0.25 ? '#ffb457' : '#ff6b6b';
      cx.fill();
    });
  }

  _encounter(cx, w, h, S) {
    const enc = S.expedition && S.expedition.encounter;
    if (!enc) return;

    const en = enc.enemy;
    const x = w * 0.72;
    const y = h * 0.66;
    const pulse = 0.6 + 0.4 * Math.sin(this.t * 4);

    // тень
    cx.beginPath();
    cx.ellipse(x, y + 36, 34, 9, 0, 0, 6.28);
    cx.fillStyle = 'rgba(0,0,0,.5)';
    cx.fill();

    glow(cx, x, y, 70, '#ff6b6b', 0.32 * pulse);

    // тело
    cx.beginPath();
    cx.moveTo(x - 30, y + 32);
    cx.quadraticCurveTo(x - 34, y - 16, x, y - 30);
    cx.quadraticCurveTo(x + 34, y - 16, x + 30, y + 32);
    cx.closePath();
    const g = cx.createLinearGradient(x, y - 30, x, y + 32);
    g.addColorStop(0, '#3a2530');
    g.addColorStop(1, '#16101a');
    cx.fillStyle = g;
    cx.fill();
    cx.strokeStyle = hexA('#ff6b6b', 0.5);
    cx.lineWidth = 1.6;
    cx.stroke();

    // глаза
    for (const dx of [-9, 9]) {
      glow(cx, x + dx, y - 8, 14, '#ff4d4d', 0.75 * pulse);
      cx.beginPath();
      cx.arc(x + dx, y - 8, 3.4, 0, 6.28);
      cx.fillStyle = '#ffdada';
      cx.fill();
    }

    // полоса HP врага
    const frac = Math.max(0, enc.enemyHp / en.maxHp);
    roundRect(cx, x - 60, y - 62, 120, 7, 4);
    cx.fillStyle = 'rgba(0,0,0,.6)';
    cx.fill();
    roundRect(cx, x - 60, y - 62, 120 * frac, 7, 4);
    cx.fillStyle = '#ff6b6b';
    cx.fill();

    // имя
    cx.font = '600 12px "Segoe UI",system-ui,sans-serif';
    cx.textAlign = 'center';
    cx.textBaseline = 'alphabetic';
    cx.fillStyle = '#ffd9d9';
    cx.shadowColor = 'rgba(0,0,0,.8)';
    cx.shadowBlur = 6;
    cx.fillText(en.n, x, y - 70);
    cx.shadowBlur = 0;
  }

  _badge(cx, z) {
    roundRect(cx, 16, 16, 190, 46, 10);
    cx.fillStyle = 'rgba(10,15,26,.78)';
    cx.fill();
    cx.strokeStyle = 'rgba(91,140,255,.3)';
    cx.lineWidth = 1;
    cx.stroke();

    cx.font = '600 11px "Segoe UI",system-ui,sans-serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'middle';
    cx.fillStyle = '#dfe7f5';
    cx.fillText(`Зона: ${z.n}`, 28, 34);

    cx.font = '10px ui-monospace,monospace';
    cx.fillStyle = '#8d9cb8';
    cx.fillText(`риск ×${z.dm}  добыча ×${z.lm}`, 28, 50);
  }
}

window.ExpView = ExpView;
