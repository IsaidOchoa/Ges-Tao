// src/renderer/components/modals/AssignmentModal/utils/DOMHelpers.js

export class DOMHelpers {
  escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };
    return str.replace(/[&<>"'`=/]/g, m => map[m]);
  }

  loadingTemplate(message = 'Cargando...') {
    return `<span class="loading-text">
      <i class="fa-solid fa-spinner fa-spin"></i> ${message}
    </span>`;
  }

  emptyTemplate(message = 'Sin datos') {
    return `<span class="empty-text">${message}</span>`;
  }

  errorTemplate(message = 'Error al cargar') {
    return `<span class="error-text">
      <i class="fa-solid fa-triangle-exclamation"></i> ${this.escapeHtml(message)}
    </span>`;
  }

  createElement(tag, className = '', dataset = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    Object.entries(dataset).forEach(([key, value]) => {
      el.dataset[key] = value;
    });
    return el;
  }
}