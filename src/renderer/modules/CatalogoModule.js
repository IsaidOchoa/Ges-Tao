// =======================================================
// CATALOGO MODULE - ORQUESTADOR RE-ENTRANTE
// =======================================================

import modalEEHtml from '../views/partials/modals/modal-ee.html';
import modalTiposHtml from '../views/partials/modals/modal-tipos-constancia.html';
import modalPeriodoHtml from '../views/partials/modals/modal-periodo.html'; // ✅ Re-agregado
import modalProgramaHtml from '../views/partials/modals/modal-programa.html';
import modalAlumnoHtml from '../views/partials/modals/modal-alumno.html';
import modalPlanHtml from '../views/partials/modals/modal-plan.html';
import modalSemestreHtml from '../views/partials/modals/modal-semestre.html';
import modalGeneracionHtml from '../views/partials/modals/modal-generacion.html';

import { DocenteModule } from './DocenteModule.js';
import { EEModule } from './EEModule.js';
import { AlumnoModule } from './AlumnoModule.js';
import { TipoConstanciaModule } from './TipoConstanciaModule.js';
import { PeriodoModule } from './PeriodoModule.js'; // ✅ Re-agregado
import { ProgramaModule } from './ProgramaModule.js';
import { PlanModule } from './PlanModule.js';
import { SemestreModule } from './SemestreModule.js';
import { GeneracionModule } from './GeneracionModule.js';

export class CatalogoModule {
  constructor() {
    // Instancias de módulos
    this.docenteModule = new DocenteModule();
    this.eeModule = new EEModule();
    this.alumnoModule = new AlumnoModule();
    this.tipoConstanciaModule = new TipoConstanciaModule();
    this.periodoModule = new PeriodoModule(); // ✅ Re-agregado
    this.programaModule = new ProgramaModule();
    this.planModule = new PlanModule();
    this.semestreModule = new SemestreModule();
    this.generacionModule = new GeneracionModule();
    
    // Referencias DOM
    this.tabButtons = [];
    this.tabContents = [];
    this.initialized = false;
    
    // Mapeo: entrada → ID de botón
    this.tabMap = {
      'docentes': 'btn-tab-docentes',
      'alumnos': 'btn-tab-alumnos',
      'ee': 'btn-tab-ee',
      'tipos-constancia': 'btn-tab-tipos-constancia',
      'tipos': 'btn-tab-tipos-constancia',
      'periodos': 'btn-tab-periodos', // ✅ Re-agregado
      'programas': 'btn-tab-programas',
      'planes': 'btn-tab-planes',
      'planes-estudio': 'btn-tab-planes',
      'semestres': 'btn-tab-semestres',
      'generaciones': 'btn-tab-generaciones',
      'tab-docentes': 'btn-tab-docentes',
      'tab-alumnos': 'btn-tab-alumnos',
      'tab-ee': 'btn-tab-ee',
      'tab-tipos-constancia': 'btn-tab-tipos-constancia',
      'tab-tipos': 'btn-tab-tipos-constancia',
      'tab-periodos': 'btn-tab-periodos', // ✅ Re-agregado
      'tab-programas': 'btn-tab-programas',
      'tab-planes': 'btn-tab-planes',
      'tab-planes-estudio': 'btn-tab-planes',
      'tab-semestres': 'btn-tab-semestres',
      'tab-generaciones': 'btn-tab-generaciones',
      'btn-tab-docentes': 'btn-tab-docentes',
      'btn-tab-alumnos': 'btn-tab-alumnos',
      'btn-tab-ee': 'btn-tab-ee',
      'btn-tab-tipos-constancia': 'btn-tab-tipos-constancia',
      'btn-tab-periodos': 'btn-tab-periodos', // ✅ Re-agregado
      'btn-tab-programas': 'btn-tab-programas',
      'btn-tab-planes': 'btn-tab-planes',
      'btn-tab-semestres': 'btn-tab-semestres',
      'btn-tab-generaciones': 'btn-tab-generaciones'
    };
    
    // Mapeo: botón → función de inicialización
    this.moduleMap = {
      'btn-tab-docentes': () => this.docenteModule.init(),
      'btn-tab-alumnos': () => this.alumnoModule.init(),
      'btn-tab-ee': () => this.eeModule.init(),
      'btn-tab-tipos-constancia': () => this.tipoConstanciaModule.init(),
      'btn-tab-periodos': () => this.periodoModule.init(), // ✅ Re-agregado
      'btn-tab-programas': () => this.programaModule.init(),
      'btn-tab-planes': () => this.planModule.init(),
      'btn-tab-semestres': () => this.semestreModule.init(),
      'btn-tab-generaciones': () => this.generacionModule.init()
    };
  }

  // =========================================
  // INICIALIZACIÓN CON NORMALIZACIÓN DE TARGET
  // =========================================
  async init(targetTab = null) {
    const tabsContainer = document.querySelector('.tabs-container');
    if (!tabsContainer) {
      console.warn('⚠️ [CatalogoModule] Contenedor de pestañas no encontrado');
      return false;
    }

    console.log('🚀 [CatalogoModule] Sincronizando con vista...');
    
    this.injectModals();
    this.setupTabs();
    this.setupTabNavigation();
    this.setupDelegation(tabsContainer);

    // 🆕 Normalizar el ID recibido a cualquier formato
    let buttonId = this._normalizeTabId(targetTab) || 'btn-tab-docentes';
    
    console.log(`🔄 Pestaña objetivo normalizada: ${buttonId}`);
    setTimeout(() => this.initializeModuleByTab(buttonId), 50);

    this.setupGlobalHelpers();
    this.setupPanelTabs();
    
    console.log('✅ [CatalogoModule] Sincronización completa');
    return true;
  }

  // =========================================
  // NORMALIZACIÓN DE ID DE PESTAÑA
  // =========================================
  _normalizeTabId(input) {
    if (!input) return null;
    
    // 1. Buscar coincidencia exacta en el mapa
    if (this.tabMap[input]) {
      return this.tabMap[input];
    }
    
    // 2. Si empieza con 'tab-', intentar sin prefijo
    if (input.startsWith('tab-')) {
      const simple = input.replace('tab-', '');
      if (this.tabMap[simple]) {
        return this.tabMap[simple];
      }
    }
    
    // 3. Si empieza con 'btn-tab-', ya es correcto, devolverlo
    if (input.startsWith('btn-tab-')) {
      return input;
    }
    
    // 4. Intentar construir el ID: 'docentes' → 'btn-tab-docentes'
    const constructed = `btn-tab-${input}`;
    if (this.moduleMap[constructed]) {
      return constructed;
    }
    
    // 5. No se pudo normalizar
    console.warn(`⚠️ [CatalogoModule] No se pudo normalizar: "${input}"`);
    return null;
  }

  // =========================================
  // HELPERS DE PESTAÑAS
  // =========================================
  
  getActiveTabId() {
    const activeBtn = document.querySelector('.tabs-container .tab-btn.active');
    return activeBtn ? activeBtn.id : null;
  }
  
  activateTab(buttonId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const targetBtn = document.getElementById(buttonId);
    if (targetBtn) {
      targetBtn.classList.add('active');
      const contentId = buttonId.replace('btn-', '');
      document.getElementById(contentId)?.classList.add('active');
      console.log(`✅ [CatalogoModule] Pestaña activada: ${buttonId}`);
    }
  }

  // =========================================
  // INYECCIÓN DE MODALES
  // =========================================
  injectModals() {
    const modals = [
      modalEEHtml, 
      modalTiposHtml, 
      modalPeriodoHtml, // ✅ Re-agregado
      modalProgramaHtml, 
      modalAlumnoHtml,
      modalPlanHtml,
      modalSemestreHtml,
      modalGeneracionHtml
    ];
    
    modals.forEach(htmlString => {
      const temp = document.createElement('div');
      temp.innerHTML = htmlString;
      const modal = temp.firstElementChild;
      if (modal && !document.getElementById(modal.id)) {
        document.body.appendChild(modal);
      }
    });
  }

  // =========================================
  // CONFIGURACIÓN DE PESTAÑAS
  // =========================================
  setupTabs() {
    this.tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
    this.tabContents = document.querySelectorAll('.tab-content');

    this.tabButtons.forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      const index = this.tabButtons.indexOf(btn);
      this.tabButtons[index] = newBtn;

      newBtn.addEventListener('click', () => {
        this.activateTab(newBtn.id);
        const initFn = this.moduleMap[newBtn.id];
        if (initFn) {
          setTimeout(() => initFn(), 50);
        }
      });
    });
  }

  // =========================================
  // DELEGACIÓN DE EVENTOS
  // =========================================
  setupDelegation(container) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      
      this.activateTab(btn.id);
      
      const initFn = this.moduleMap[btn.id];
      if (initFn) {
        console.log(`🔗 Delegando a ${btn.id}...`);
        setTimeout(() => initFn(), 50);
      }
    });
  }

  // =========================================
  // INICIALIZACIÓN DE MÓDULO POR PESTAÑA
  // =========================================
  async initializeModuleByTab(buttonId) {
    const initFn = this.moduleMap[buttonId];
    if (initFn) {
      this.activateTab(buttonId);
      await new Promise(resolve => requestAnimationFrame(resolve));
      await initFn();
      
      const tabBtn = document.getElementById(buttonId);
      if (tabBtn && this.tabsContainer) {
        tabBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    } else {
      console.warn(`⚠️ [CatalogoModule] No hay módulo registrado para: ${buttonId}`);
      console.log('🔍 moduleMap keys:', Object.keys(this.moduleMap));
    }
  }

  // =========================================
  // HELPERS GLOBALES
  // =========================================
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

  closeAllMenus() {
    document.querySelectorAll('.context-menu').forEach(m => m.classList.add('hidden'));
  }

  // =========================================
  // PANEL TABS (Sub-pestañas internas)
  // =========================================
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

  // =========================================
  // NAVEGACIÓN POR FLECHAS EN PESTAÑAS
  // =========================================
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

    // 🆕 Agregar listeners de clic a las flechas
    leftArrow.addEventListener('click', () => this.scrollTabs('left'));
    rightArrow.addEventListener('click', () => this.scrollTabs('right'));

    // Listener para scroll manual (actualizar visibilidad de flechas)
    container.addEventListener('scroll', () => this.updateTabArrows(), { passive: true });

    // Listener para resize de ventana
    window.addEventListener('resize', () => {
      this.updateTabArrows();
      this.checkOverflow();
    });

    // Verificación inicial con pequeño delay para asegurar que el DOM está renderizado
    setTimeout(() => {
      this.updateTabArrows();
      this.checkOverflow();
    }, 100);

    console.log('✅ Navegación por flechas de pestañas inicializada');
  }

  /**
   * Actualiza la visibilidad de las flechas según el scroll actual
   */
  updateTabArrows() {
    if (!this.tabsContainer || !this.tabArrowLeft || !this.tabArrowRight) return;

    const { scrollLeft, scrollWidth, clientWidth } = this.tabsContainer;
    const scrollTolerance = 10;

    const canScrollLeft = scrollLeft > scrollTolerance;
    const maxScroll = scrollWidth - clientWidth;
    const canScrollRight = scrollLeft < (maxScroll - scrollTolerance);

    if (canScrollLeft) {
      this.tabArrowLeft.classList.add('visible');
    } else {
      this.tabArrowLeft.classList.remove('visible');
    }

    if (canScrollRight) {
      this.tabArrowRight.classList.add('visible');
    } else {
      this.tabArrowRight.classList.remove('visible');
    }

    this.tabsWrapper.classList.toggle('overflow-left', canScrollLeft);
    this.tabsWrapper.classList.toggle('overflow-right', canScrollRight);
  }

  /**
   * Verifica si el contenedor tiene overflow horizontal
   */
  checkOverflow() {
    if (!this.tabsContainer || !this.tabArrowLeft || !this.tabArrowRight) return;

    const hasOverflow = this.tabsContainer.scrollWidth > this.tabsContainer.clientWidth;
    
    if (hasOverflow) {
      this.updateTabArrows();
    } else {
      this.tabArrowLeft.classList.remove('visible');
      this.tabArrowRight.classList.remove('visible');
    }
  }

  /**
   * Desplaza el contenedor de pestañas hacia izquierda o derecha
   */
  scrollTabs(direction) {
    const container = this.tabsContainer;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.8;
    const currentScroll = container.scrollLeft;
    let targetScroll;

    if (direction === 'left') {
      targetScroll = Math.max(0, currentScroll - scrollAmount);
    } else {
      targetScroll = Math.min(
        container.scrollWidth - container.clientWidth,
        currentScroll + scrollAmount
      );
    }

    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth'
    });

    setTimeout(() => this.updateTabArrows(), 400);
  }

  scrollToTab(tabId) {
    const tabBtn = document.getElementById(tabId);
    if (!tabBtn || !this.tabsContainer) return;

    const container = this.tabsContainer;
    const tabRect = tabBtn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const targetScroll = container.scrollLeft + (tabRect.left - containerRect.left) - 
                         (containerRect.width / 2) + (tabRect.width / 2);

    this.smoothScrollTo(container, targetScroll, 300);
  }
  
  smoothScrollTo(element, target, duration) {
    const start = element.scrollLeft;
    const change = target - start;
    const startTime = performance.now();
    
    const animateScroll = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5 
        ? 2 * progress * progress 
        : -1 + (4 - 2 * progress) * progress;
      
      element.scrollLeft = start + change * ease;
      
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      }
    };
    
    requestAnimationFrame(animateScroll);
  }
}

// Instancia global para acceso desde HTML
window.catalogoModuleInstance = new CatalogoModule();

// Auto-inicialización solo si estamos en la vista de catálogos
document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.tabs-container')) {
    window.catalogoModuleInstance.init();
  }
});