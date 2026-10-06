/* =========================================================================
   UI/MODAL.JS — модальные окна и тосты
   Загружается после hud.js. Использует elem из hud.js.
   ========================================================================= */
'use strict';

class Modal {
  constructor(root, audio) {
    this.root = root;
    this.audio = audio;
    this.open = false;
  }

  /* ---------- показать окно ---------- */
  show({ tag, title, html, choices, closable, onClose }) {
    this.root.innerHTML = '';
    this.open = true;
    this.root.classList.add('on');

    const card = elem('div', 'modal-card');

    // шапка
    const header = document.createElement('header');
    if (tag) header.appendChild(elem('div', 'tag', tag));
    header.appendChild(elem('h2', null, title));
    card.appendChild(header);

    // тело
    const body = elem('div', 'body');
    body.innerHTML = html || '';
    card.appendChild(body);

    // подвал с кнопками
    const footer = elem('footer');

    if (choices && choices.length) {
      choices.forEach(ch => {
        const btn = elem('button', 'opt');
        const dis = ch.disabled || (ch.cond ? !ch.cond() : false);
        if (dis) btn.disabled = true;

        btn.appendChild(elem('span', 'lbl', ch.label));
        if (ch.hint) btn.appendChild(elem('span', 'hint', ch.hint));

        btn.addEventListener('mouseenter', () => {
          if (this.audio) this.audio.hover();
        });
        btn.addEventListener('click', () => {
          if (dis) { if (this.audio) this.audio.deny(); return; }
          if (this.audio) this.audio.click();
          this.close();
          if (ch.onPick) ch.onPick();
        });

        footer.appendChild(btn);
      });
    } else if (closable !== false) {
      const btn = elem('button', 'opt');
      btn.innerHTML = '<span class="lbl">Понятно</span>';
      btn.addEventListener('click', () => {
        if (this.audio) this.audio.click();
        this.close();
      });
      footer.appendChild(btn);
    }

    card.appendChild(footer);
    this.root.appendChild(card);
  }

  /* ---------- закрыть ---------- */
  close() {
    this.root.innerHTML = '';
    this.root.classList.remove('on');
    this.open = false;
  }

  /* ---------- тост ---------- */
  toast(text, kind) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = elem('div', `toast ${kind || ''}`, text);
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 2400);
  }
}

window.Modal = Modal;
