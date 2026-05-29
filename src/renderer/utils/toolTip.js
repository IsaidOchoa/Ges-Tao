// src/renderer/utils/toolTip.js

export class Tooltip {
  constructor(options = {}) {
    this.target = options.target;
    this.content = options.content;
    this.position = options.position || 'top';
    this.delay = options.delay || 200;
    this.tooltip = null;
    this.timeoutId = null;
    this.isVisible = false;
    
    // Clases CSS personalizables
    this.className = options.className || 'tooltip-custom';
    
    this.init();
  }

  init() {
    if (!this.target) {
      console.error('Tooltip: target element is required');
      return;
    }

    // Event listeners
    this.target.addEventListener('mouseenter', () => this.show());
    this.target.addEventListener('mouseleave', () => this.hide());
    this.target.addEventListener('focus', () => this.show());
    this.target.addEventListener('blur', () => this.hide());
    this.target.addEventListener('click', (e) => {
      // Si es clic, toggle en lugar de solo mostrar
      e.stopPropagation();
      this.isVisible ? this.hide() : this.show();
    });

    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  show() {
    if (this.isVisible) return;

    this.timeoutId = setTimeout(() => {
      this.createTooltip();
      this.positionTooltip();
      this.isVisible = true;
      
      // Animación de entrada
      requestAnimationFrame(() => {
        this.tooltip.style.opacity = '1';
        this.tooltip.style.transform = 'translateY(0)';
      });

      // Cerrar al hacer clic fuera
      setTimeout(() => {
        document.addEventListener('click', this.handleOutsideClick);
      }, 100);
    }, this.delay);
  }

  hide() {
    if (!this.isVisible) return;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.tooltip) {
      // Animación de salida
      this.tooltip.style.opacity = '0';
      this.tooltip.style.transform = 'translateY(-5px)';
      
      setTimeout(() => {
        this.destroyTooltip();
      }, 200);
    }

    this.isVisible = false;
    document.removeEventListener('click', this.handleOutsideClick);
  }

  createTooltip() {
    // Eliminar tooltip existente si lo hay
    this.destroyTooltip();

    this.tooltip = document.createElement('div');
    this.tooltip.className = `tooltip-custom ${this.className}`;
    this.tooltip.setAttribute('role', 'tooltip');
    
    // Contenido (soporta HTML)
    if (typeof this.content === 'function') {
      this.tooltip.innerHTML = this.content();
    } else {
      this.tooltip.innerHTML = this.content;
    }

    document.body.appendChild(this.tooltip);
  }

  positionTooltip() {
    if (!this.tooltip) return;

    const targetRect = this.target.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let top, left;

    // Calcular posición según la dirección solicitada
    switch (this.position) {
      case 'top':
        top = targetRect.top + scrollY - tooltipRect.height - 10;
        left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        top = targetRect.bottom + scrollY + 10;
        left = targetRect.left + scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.left + scrollX - tooltipRect.width - 10;
        break;
      case 'right':
      default:
        top = targetRect.top + scrollY + (targetRect.height / 2) - (tooltipRect.height / 2);
        left = targetRect.right + scrollX + 10;
        break;
    }

    // Ajustar si se sale del viewport
    if (left < scrollX) {
      left = targetRect.right + scrollX + 10;
    }
    if (left + tooltipRect.width > viewportWidth + scrollX) {
      left = targetRect.left + scrollX - tooltipRect.width - 10;
    }
    if (top < scrollY) {
      top = targetRect.bottom + scrollY + 10;
    }
    if (top + tooltipRect.height > viewportHeight + scrollY) {
      top = targetRect.top + scrollY - tooltipRect.height - 10;
    }

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.position = 'fixed';
    this.tooltip.style.zIndex = '10000';
  }

  destroyTooltip() {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  handleOutsideClick = (e) => {
    if (this.tooltip && !this.tooltip.contains(e.target) && !this.target.contains(e.target)) {
      this.hide();
    }
  };

  // Método público para actualizar contenido dinámicamente
  updateContent(newContent) {
    this.content = newContent;
    if (this.isVisible) {
      this.destroyTooltip();
      this.createTooltip();
      this.positionTooltip();
    }
  }

  // Destruir instancia y limpiar listeners
  destroy() {
    this.hide();
    this.target = null;
  }
}