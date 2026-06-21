// src/renderer/utils/assignment-modal/utils/DOMHelpers.js

/**
 * Helpers genéricos para manipulación segura del DOM
 * @private
 */
export class DOMHelpers {
  /**
   * Escapa caracteres HTML para prevenir XSS
   * @param {string} str 
   * @returns {string}
   */
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

  /**
   * Template para estado de carga
   */
  loadingTemplate(message = 'Cargando...') {
    return `<span class="loading-text" style="color: var(--text-muted);">
      <i class="fa-solid fa-spinner fa-spin"></i> ${message}
    </span>`;
  }

  /**
   * Template para estado vacío
   */
  emptyTemplate(message = 'Sin datos') {
    return `<span class="empty-text" style="color: var(--text-muted);">${message}</span>`;
  }

  /**
   * Template para estado de error
   */
  errorTemplate(message = 'Error al cargar') {
    return `<span class="error-text" style="color: var(--danger-color);">
      <i class="fa-solid fa-triangle-exclamation"></i> ${this.escapeHtml(message)}
    </span>`;
  }

  /**
   * Crea elemento con clases y dataset
   */
  createElement(tag, className = '', dataset = {}) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    Object.entries(dataset).forEach(([key, value]) => {
      el.dataset[key] = value;
    });
    return el;
  }
}