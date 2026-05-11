// =======================================================
// CATALOGO MODULE - ORQUESTADOR RE-ENTRANTE
// =======================================================

import modalEEHtml from '../views/partials/modals/modal-ee.html';
import modalTiposHtml from '../views/partials/modals/modal-tipos-constancia.html';
import modalPeriodoHtml from '../views/partials/modals/modal-periodo.html';
import modalProgramaHtml from '../views/partials/modals/modal-programa.html';
import modalAlumnoHtml from '../views/partials/modals/modal-alumno.html';

import { DocenteModule } from './DocenteModule.js';
import { EEModule } from './EEModule.js';
import { AlumnoModule } from './AlumnoModule.js';
import { TipoConstanciaModule } from './TipoConstanciaModule.js';
import { PeriodoModule } from './PeriodoModule.js';
import { ProgramaModule } from './ProgramaModule.js';

export class CatalogoModule {
  constructor() {
    // Las instancias de los módulos persisten en memoria (Singletons)
    this.docenteModule = new DocenteModule();
    this.eeModule = new EEModule();
    this.alumnoModule = new AlumnoModule();
    this.tipoConstanciaModule = new TipoConstanciaModule();
    this.periodoModule = new PeriodoModule();
    this.programaModule = new ProgramaModule();
    
    this.tabButtons = [];
    this.tabContents = [];
    this.initialized = false; // Control interno ligero
  }

  // =========================================
  // INICIALIZACIÓN CON DETECCIÓN DE RE-ENTRADA
  // =========================================
  async init(defaultTab = null) {
    // ✅ Detectar si necesitamos re-inicializar porque el DOM cambió
    const tabsContainer = document.querySelector('.tabs-container');
    if (!tabsContainer) {
      console.warn('⚠️ [CatalogoModule] Contenedor de pestañas no encontrado en DOM');
      return false;
    }

    console.log('🚀 [CatalogoModule] Sincronizando con vista...');
    
    // Inyectar modales (protegido contra duplicados)
    this.injectModals();
    
    // Configurar pestañas (siempre, porque el DOM es nuevo)
    this.setupTabs();
    
    // Configurar navegación por flechas
    this.setupTabNavigation();
    
    // Configurar delegación de eventos
    this.setupDelegation(tabsContainer);

    // Determinar qué pestaña cargar
    const tabToLoad = defaultTab || this.getActiveTabId();
    if (tabToLoad) {
      console.log(`🔄 Pestaña activa: ${tabToLoad}. Inicializando módulo...`);
      // Delay para asegurar que el DOM está pintado
      setTimeout(() => this.initializeModuleByTab(tabToLoad), 50);
    }

    // Helpers globales
    this.setupGlobalHelpers();
    this.setupPanelTabs();
    
    console.log('✅ [CatalogoModule] Sincronización completa');
    return true;
  }

  // =========================================
  // HELPERS
  // =========================================
  getActiveTabId() {
    const activeBtn = document.querySelector('.tabs-container .tab-btn.active');
    return activeBtn ? activeBtn.id : null;
  }

  injectModals() {
    const modals = [modalEEHtml, modalTiposHtml, modalPeriodoHtml, modalProgramaHtml, modalAlumnoHtml];
    modals.forEach(htmlString => {
      const temp = document.createElement('div');
      temp.innerHTML = htmlString;
      const modal = temp.firstElementChild;
      // Solo inyectar si no existe
      if (modal && !document.getElementById(modal.id)) {
        document.body.appendChild(modal);
      }
    });
  }

  setupTabs() {
    this.tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
    this.tabContents = document.querySelectorAll('.tab-content');

    this.tabButtons.forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      const index = this.tabButtons.indexOf(btn);
      this.tabButtons[index] = newBtn;

      newBtn.addEventListener('click', () => {
        this.tabButtons.forEach(b => b.classList.remove('active'));
        this.tabContents.forEach(c => c.classList.remove('active'));
        newBtn.classList.add('active');
        const targetId = newBtn.id.replace('btn-', ''); 
        document.getElementById(targetId)?.classList.add('active');
      });
    });
  }

  setupDelegation(container) {
    const moduleMap = {
      'btn-tab-docentes': () => this.docenteModule.init(),
      'btn-tab-ee': () => this.eeModule.init(),
      'btn-tab-alumnos': () => this.alumnoModule.init(),
      'btn-tab-tipos-constancia': () => this.tipoConstanciaModule.init(),
      'btn-tab-periodos': () => this.periodoModule.init(),
      'btn-tab-programas': () => this.programaModule.init()
    };

    // Listener limpio (el contenedor es nuevo, así que no hay listeners viejos)
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      const initFn = moduleMap[btn.id];
      if (initFn) {
        console.log(`🔗 Delegando a ${btn.id}...`);
        setTimeout(() => initFn(), 50);
      }
    });
  }

  async initializeModuleByTab(tabId) {
    const moduleMap = {
      'btn-tab-docentes': () => this.docenteModule.init(),
      'btn-tab-ee': () => this.eeModule.init(),
      'btn-tab-alumnos': () => this.alumnoModule.init(),
      'btn-tab-tipos-constancia': () => this.tipoConstanciaModule.init(),
      'btn-tab-periodos': () => this.periodoModule.init(),
      'btn-tab-programas': () => this.programaModule.init()
    };

    const initFn = moduleMap[tabId];
    if (initFn) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      await initFn();
      document.getElementById(tabId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  setupGlobalHelpers() {
    window.abrirModal = (id) => {
      const modal = document.getElementById(id);
      if (modal) { modal.classList.remove('hidden'); modal.querySelector('form')?.reset(); }
    };
    window.cerrarModal = (id) => document.getElementById(id)?.classList.add('hidden');
    
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.data-row') && !e.target.closest('.context-menu')) {
        this.closeAllMenus();
      }
      if (!e.target.closest('.data-table')) {
        document.querySelectorAll('.data-row.selected').forEach(row => {
          row.classList.remove('selected');
        });
      }
    });
  }

  // =========================================
// NAVEGACIÓN POR FLECHAS EN PESTAÑAS
// =========================================

/**
 * Inicializa la detección de overflow y flechas de navegación
 * Se llama después de setupTabs()
 */
setupTabNavigation() {
  const container = document.getElementById('tabs-container');
  const wrapper = document.getElementById('tabs-wrapper');
  const leftArrow = document.getElementById('tab-arrow-left');
  const rightArrow = document.getElementById('tab-arrow-right');
  
  if (!container || !wrapper || !leftArrow || !rightArrow) {
    console.warn('⚠️ Elementos de navegación de pestañas no encontrados');
    return;
  }

  // Guardar referencias
  this.tabsContainer = container;
  this.tabsWrapper = wrapper;
  this.tabArrowLeft = leftArrow;
  this.tabArrowRight = rightArrow;

  // Listener para scroll manual (actualizar flechas)
  container.addEventListener('scroll', () => this.updateTabArrows(), { passive: true });

  // Listener para resize de ventana
  window.addEventListener('resize', () => this.updateTabArrows());

  // Verificación inicial
  this.updateTabArrows();

  // Animación de entrada para la flecha derecha (indicador sutil)
  setTimeout(() => {
    if (rightArrow.classList.contains('visible')) {
      rightArrow.classList.add('animate-hint');
      setTimeout(() => rightArrow.classList.remove('animate-hint'), 600);
    }
  }, 500);

  console.log('✅ Navegación por flechas de pestañas inicializada');
}

/**
 * Actualiza la visibilidad de las flechas según el scroll
 */
updateTabArrows() {
  if (!this.tabsContainer || !this.tabArrowLeft || !this.tabArrowRight) return;

  const { scrollLeft, scrollWidth, clientWidth } = this.tabsContainer;
  const scrollTolerance = 2; // Píxeles de tolerancia

  const canScrollLeft = scrollLeft > scrollTolerance;
  const canScrollRight = scrollLeft < (scrollWidth - clientWidth - scrollTolerance);

  // Mostrar/ocultar flechas
  this.tabArrowLeft.classList.toggle('visible', canScrollLeft);
  this.tabArrowRight.classList.toggle('visible', canScrollRight);

  // Actualizar clases de wrapper para los gradientes
  this.tabsWrapper.classList.toggle('overflow-left', canScrollLeft);
  this.tabsWrapper.classList.toggle('overflow-right', canScrollRight);
}

scrollTabs(direction) {
  const container = this.tabsContainer;
  if (!container) return;

  // Calculamos el 80% del ancho visible para un desplazamiento significativo
  const scrollAmount = container.clientWidth * 0.8;
  const currentScroll = container.scrollLeft;
  let targetScroll;

  if (direction === 'left') {
    targetScroll = Math.max(0, currentScroll - scrollAmount);
  } else {
    targetScroll = Math.min(container.scrollWidth - container.clientWidth, currentScroll + scrollAmount);
  }

  // Usamos la API nativa para un scroll suave y fiable
  container.scrollTo({
    left: targetScroll,
    behavior: 'smooth'
  });

  // Actualizamos las flechas después de la animación (aprox 350ms)
  setTimeout(() => this.updateTabArrows(), 400);
}


/**
 * Desplaza a una pestaña específica (útil para accesos rápidos)
 */
scrollToTab(tabId) {
  const tabBtn = document.getElementById(tabId);
  if (!tabBtn || !this.tabsContainer) return;

  const container = this.tabsContainer;
  const tabRect = tabBtn.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // Calcular posición para centrar la pestaña
  const targetScroll = container.scrollLeft + (tabRect.left - containerRect.left) - 
                       (containerRect.width / 2) + (tabRect.width / 2);

  this.smoothScrollTo(container, targetScroll, 300);
}

  closeAllMenus() {
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
  }

  setupPanelTabs() {
    const tabs = document.querySelectorAll('.panel-tab-btn');
    tabs.forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.addEventListener('click', () => {
        document.querySelectorAll('.panel-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.panel-tab-content').forEach(c => c.classList.remove('active'));
        newBtn.classList.add('active');
        document.getElementById(newBtn.dataset.target)?.classList.add('active');
      });
    });
  }
}

window.catalogoModuleInstance = new CatalogoModule();
document.addEventListener('DOMContentLoaded', () => window.catalogoModuleInstance.init());