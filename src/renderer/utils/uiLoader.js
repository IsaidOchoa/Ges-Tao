// src/renderer/utils/uiLoader.js

/**
 * Loader reutilizable para overlays de carga
 * Reutiliza el diseño de AuthModule pero desacoplado
 */
export const uiLoader = {
  element: null,

  show(message, subMessage = 'Procesando...') {
    // Si ya existe, lo removemos primero
    if (this.element) this.element.remove();

    this.element = document.createElement('div');
    this.element.className = 'loading-overlay fade-in-up';
    this.element.innerHTML = `
      <div class="spinner"></div>
      <div class="loading-text">${message}</div>
      ${subMessage ? `<div class="loading-subtext">${subMessage}</div>` : ''}
    `;
    
    document.body.appendChild(this.element);
  },

  hide() {
    if (!this.element) return;
    
    this.element.classList.add('hidden');
    setTimeout(() => {
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
    }, 300);
  },

  // Método para usar dentro de un contenedor específico (ej: el workspace)
  showInContainer(container, message = 'Cargando...') {
    // Guardamos referencia al contenedor para limpiar después
    container.dataset.loading = 'true';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    
    const overlay = document.createElement('div');
    overlay.className = 'loader-inline';
    overlay.innerHTML = `
      <div class="spinner spinner-sm"></div>
      <div class="loading-text-sm">${message}</div>
    `;
    
    container.appendChild(overlay);
    return overlay; // Retornamos para poder removerlo después
  },

  hideInContainer(container, overlayEl) {
    delete container.dataset.loading;
    if (overlayEl) {
      overlayEl.classList.add('hidden');
      setTimeout(() => overlayEl.remove(), 200);
    }
  }
};