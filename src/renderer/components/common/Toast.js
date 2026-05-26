// src/renderer/components/common/Toast.js
export class Toast {
  static container = null;
  static maxVisible = 3;
  static queue = [];
  static defaults = { success: 3000, warning: 5000, error: 8000, info: 4000 };

  static _init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.id = 'toast-container';
    this.container.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.container);
  }

  static show(message, type = 'info', duration = null) {
    this._init();
    const dur = duration ?? this.defaults[type] ?? 4000;
    const item = { 
      id: Date.now() + Math.random(), 
      message, type, duration: dur, 
      paused: false, pausedAt: null, timer: null 
    };
    this.queue.push(item);
    this._processQueue();
  }

  static _processQueue() {
    const currentVisible = this.container.querySelectorAll('.toast:not(.removing)').length;
    while (this.queue.length > 0 && currentVisible < this.maxVisible) {
      this._render(this.queue.shift());
    }
  }

  static _render(item) {
    const el = document.createElement('div');
    el.className = `toast toast-${item.type}`;
    el.dataset.id = item.id;
    el.innerHTML = `
      <span class="toast-icon">${item.type === 'success' ? '✓' : item.type === 'warning' ? '⚠' : item.type === 'error' ? '✕' : 'ℹ'}</span>
      <div class="toast-content"><span class="toast-message">${item.message}</span></div>
      <button class="toast-close" aria-label="Cerrar">&times;</button>
      <div class="toast-progress" style="animation-duration: ${item.duration}ms;"></div>
    `;

    this.container.appendChild(el);
    this._startTimer(item, el);
    this._bindHover(item, el);

    el.querySelector('.toast-close').addEventListener('click', () => this._dismiss(item.id));
  }

  static _startTimer(item, el) {
    item.timer = setTimeout(() => this._dismiss(item.id), item.duration);
  }

  static _bindHover(item, el) {
    el.addEventListener('mouseenter', () => {
      if (item.timer) clearTimeout(item.timer);
      item.paused = true;
      item.pausedAt = Date.now();
      el.querySelector('.toast-progress').style.animationPlayState = 'paused';
    });

    el.addEventListener('mouseleave', () => {
      if (!item.paused) return;
      const pausedTime = Date.now() - item.pausedAt;
      item.duration -= pausedTime; // Resta el tiempo pausado
      item.paused = false;
      item.pausedAt = null;
      el.querySelector('.toast-progress').style.animationPlayState = 'running';
      item.timer = setTimeout(() => this._dismiss(item.id), item.duration);
    });
  }

  static _dismiss(id) {
    const el = this.container.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    el.classList.add('removing');
    el.addEventListener('animationend', () => {
      el.remove();
      this._processQueue(); // Saca el siguiente de la cola
    });
  }

  // Atajos
  static success(msg, dur) { this.show(msg, 'success', dur); }
  static warning(msg, dur) { this.show(msg, 'warning', dur); }
  static error(msg, dur) { this.show(msg, 'error', dur); }
  static info(msg, dur) { this.show(msg, 'info', dur); }
}