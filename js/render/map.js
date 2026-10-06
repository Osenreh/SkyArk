/* =========================================================================
   RENDER/MAP.JS — карта мира: узлы, маршруты, туман войны, тултипы
   Загружается после city.js (render). Использует BIOMES, BIOME_ICON.
   ========================================================================= */
'use strict';

class MapView {
  constructor() {
    this.t = 0;
    this.cam = { x: 0, y: 0, zoom: 0.62 };
    this.tgt = { x: 0, y: 0, zoom: 0.62 };
    this.hover = null;
    this.drag = false;
    this.lastMouse = { x: 0, y: 0 };
    this._downPos = { x: 0, y: 0 };
    this.inited = false;
  }

  update(dt) {
    this.t += dt;
    const kx = 1 - Math.pow(0.001, dt);
    const kz = 1 - Math.pow(0.004, dt);
    this.cam.x    += (this.tgt.x    - this.cam.x)    * kx;
    this.cam.y    += (this.tgt.y    - this.cam.y)    * kx;
    this.cam.zoom += (this.tgt.zoom - this.cam.zoom) * kz;
  }

  centerOn(S, id) {
    const n = World.nodeById(S.world, id);
    if (n) { this.tgt.x = n.x; this.tgt.y = n.y; }
  }

  fit(w, h, S) {
    const z = Math.min(w / (S.world.width + 200), h / (S.world.height + 260));
    this.tgt.zoom = U.clamp(z, 0.3, 1.1);
    this.cam.zoom = this.tgt.zoom;
  }

  w2s(w, h, x, y) {
    const z = this.cam.zoom;
    return [(x - this.cam.x) * z + w / 2, (y - this.cam.y) * z + h / 2];
  }

  s2w(w, h, sx, sy) {
    const z = this.cam.zoom;
    return [(sx - w / 2) / z + this.cam.x, (sy - h / 2) / z + this.cam.y];
  }

  /* ---------- клик по узлу ---------- */
  pickNode(w, h, mx, my, S) {
    let found = null;
    let bestD = 34;
    for (const n of S.world.nodes) {
      if (!n.revealed) continue;
      const [sx, sy] = this.w2s(w, h, n.x, n.y);
      const d = Math.hypot(sx - mx, sy - my);
      if (d < bestD) { bestD = d; found = n; }
    }
    return found;
  }

  /* ---------- отрисовка ---------- */
  draw(cx, w, h, S, opts) {
    opts = opts || {};
    const z = this.cam.zoom;

    // фон-карта
    cx.save();
    const g = cx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(8,12,22,.88)');
    g.addColorStop(1, 'rgba(6,9,17,.94)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, w, h);

    // сетка
    const step = 90 * z;
    const ox = ((-this.cam.x * z + w / 2) % step + step) % step;
    const oy = ((-this.cam.y * z + h / 2) % step + step) % step;
    cx.strokeStyle = 'rgba(91,140,255,.055)';
    cx.lineWidth = 1;
    cx.beginPath();
    for (let x = ox; x < w; x += step) { cx.moveTo(x, 0); cx.lineTo(x, h); }
    for (let y = oy; y < h; y += step) { cx.moveTo(0, y); cx.lineTo(w, y); }
    cx.stroke();
    cx.restore();

    // рёбра
    const drawn = {};
    for (const n of S.world.nodes) {
      if (!n.revealed) continue;
      const [x1, y1] = this.w2s(w, h, n.x, n.y);
      for (const eid of n.edges) {
        const key = [n.id, eid].sort().join('-');
        if (drawn[key]) continue;
        drawn[key] = true;
        const o = S.world.nodes.find(x => x.id === eid);
        if (!o || !o.revealed) continue;
        const [x2, y2] = this.w2s(w, h, o.x, o.y);

        const isPath = S.city.nodeId === n.id || S.city.nodeId === o.id;
        const isTravel = S.travel &&
          ((S.travel.fromId === n.id && S.travel.toId === o.id) ||
           (S.travel.fromId === o.id && S.travel.toId === n.id));

        cx.beginPath();
        cx.moveTo(x1, y1);
        cx.lineTo(x2, y2);

        if (isTravel) {
          cx.setLineDash([10, 6]);
          cx.lineDashOffset = -this.t * 26;
          cx.strokeStyle = hexA('#7fe3d4', 0.85);
          cx.lineWidth = 2.4;
        } else if (isPath) {
          cx.setLineDash([]);
          cx.strokeStyle = hexA('#5b8cff', 0.42);
          cx.lineWidth = 2;
        } else {
          cx.setLineDash([]);
          cx.strokeStyle = 'rgba(140,170,215,.15)';
          cx.lineWidth = 1.4;
        }
        cx.stroke();
        cx.setLineDash([]);
      }
    }

    // узлы
    for (const n of S.world.nodes) {
      if (!n.revealed) continue;
      const [sx, sy] = this.w2s(w, h, n.x, n.y);
      if (sx < -120 || sy < -120 || sx > w + 120 || sy > h + 120) continue;
      this._node(cx, sx, sy, n, S, opts, z);
    }

    // маркер города
    this._marker(cx, w, h, S);

    // тултип
    if (this.hover) this._tip(cx, w, h, this.hover);
  }

  _node(cx, sx, sy, n, S, opts, z) {
    const b = BIOMES[n.biome];
    const isCur = n.id === S.city.nodeId;
    const isTgt = opts.targetId === n.id;
    const isHov = this.hover && this.hover.id === n.id;
    const cur = World.nodeById(S.world, S.city.nodeId);
    const isNb = cur && cur.edges.indexOf(n.id) >= 0;
    const R = 17 * Math.max(0.7, z * 1.5);

    // кольцо опасности
    if (n.danger > 1) {
      cx.beginPath();
      cx.arc(sx, sy, R + 7, 0, 6.28);
      cx.strokeStyle = hexA(n.danger === 3 ? '#ff6b6b' : '#ffb457', 0.3);
      cx.lineWidth = 1.6;
      cx.setLineDash([4, 5]);
      cx.stroke();
      cx.setLineDash([]);
    }

    // свечение текущего/наведённого
    if (isCur || isTgt || isHov) {
      const pulse = 0.6 + 0.4 * Math.sin(this.t * 2.6);
      glow(cx, sx, sy, R * 3.2, isCur ? '#7fe3d4' : '#5b8cff', 0.42 * pulse);
    }

    // тело
    cx.beginPath();
    cx.arc(sx, sy, R, 0, 6.28);
    const g = cx.createRadialGradient(sx - R * 0.3, sy - R * 0.3, 0, sx, sy, R);
    g.addColorStop(0, hexA(b.accent, 0.95));
    g.addColorStop(1, hexA(b.color, 0.85));
    cx.fillStyle = g;
    cx.fill();

    cx.strokeStyle = isCur ? '#7fe3d4'
                  : isTgt ? '#5b8cff'
                  : isNb  ? 'rgba(140,180,255,.65)'
                  :         'rgba(150,180,225,.32)';
    cx.lineWidth = (isCur || isTgt) ? 2.4 : 1.4;
    cx.stroke();

    // иконка биома
    cx.font = `${Math.round(R * 0.95)}px system-ui,sans-serif`;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillStyle = 'rgba(255,255,255,.86)';
    cx.fillText(BIOME_ICON[n.biome] || '·', sx, sy + 0.5);

    // метка «разграблено»
    if (n.cleared > 0) {
      cx.beginPath();
      cx.arc(sx + R * 0.75, sy - R * 0.75, 4.5, 0, 6.28);
      cx.fillStyle = hexA('#5fd68a', 0.9);
      cx.fill();
    }

    // название
    if (z > 0.45 || isCur || isTgt || isHov) {
      cx.font = '600 11px "Segoe UI",system-ui,sans-serif';
      cx.textAlign = 'center';
      cx.textBaseline = 'top';
      cx.fillStyle = isCur ? '#bff5ea' : 'rgba(215,228,245,.82)';
      cx.shadowColor = 'rgba(0,0,0,.9)';
      cx.shadowBlur = 6;
      cx.fillText(n.name, sx, sy + R + 6);
      cx.shadowBlur = 0;
    }
  }

  _marker(cx, w, h, S) {
    const node = World.nodeById(S.world, S.city.nodeId);
    if (!node) return;

    let px = node.x, py = node.y;
    if (S.travel) {
      const from = World.nodeById(S.world, S.travel.fromId);
      const to   = World.nodeById(S.world, S.travel.toId);
      const prog = 1 - S.travel.turnsLeft / S.travel.total;
      px = from.x + (to.x - from.x) * prog;
      py = from.y + (to.y - from.y) * prog;
    }

    const [sx, sy] = this.w2s(w, h, px, py);
    const bob = Math.sin(this.t * 1.5) * 4;

    glow(cx, sx, sy - 34 + bob, 62, '#7fb0ff', 0.5);

    cx.save();
    cx.translate(sx, sy - 34 + bob);
    cx.beginPath();
    cx.ellipse(0, 0, 22, 9, 0, 0, 6.28);
    cx.fillStyle = '#4a5468';
    cx.fill();
    cx.strokeStyle = 'rgba(180,215,255,.75)';
    cx.lineWidth = 1.6;
    cx.stroke();

    cx.beginPath();
    cx.moveTo(-12, 0);
    cx.lineTo(0, 24);
    cx.lineTo(12, 0);
    cx.closePath();
    cx.fillStyle = '#2b3344';
    cx.fill();
    cx.restore();
  }

  _tip(cx, w, h, n) {
    const [sx, sy] = this.w2s(w, h, n.x, n.y);
    const b = BIOMES[n.biome];

    const lines = [
      { t: n.name, f: '600 13px "Segoe UI",system-ui,sans-serif', c: '#eaf1ff' },
      { t: `${b.name} · опасность ${n.danger}/3`, f: '11px "Segoe UI",system-ui,sans-serif', c: b.accent },
      { t: `богатство ×${n.rich}`, f: '10.5px ui-monospace,monospace', c: '#8d9cb8' },
    ];

    const pad = 10;
    const bw = 210;
    const bh = pad * 2 + lines.length * 17;

    let bx = sx + 26;
    let by = sy - bh / 2;
    if (bx + bw > w - 12) bx = sx - bw - 26;
    by = U.clamp(by, 12, h - bh - 12);

    cx.save();
    cx.shadowColor = 'rgba(0,0,0,.6)';
    cx.shadowBlur = 20;
    roundRect(cx, bx, by, bw, bh, 10);
    cx.fillStyle = 'rgba(16,22,38,.96)';
    cx.fill();
    cx.shadowBlur = 0;
    cx.strokeStyle = 'rgba(91,140,255,.35)';
    cx.lineWidth = 1;
    cx.stroke();

    let ty = by + pad + 12;
    for (const l of lines) {
      cx.font = l.f;
      cx.textAlign = 'left';
      cx.textBaseline = 'alphabetic';
      cx.fillStyle = l.c;
      cx.fillText(l.t, bx + pad, ty);
      ty += 17;
    }
    cx.restore();
  }
}

window.MapView = MapView;
