// src/renderer/utils/AssignmentModal.js

import { uiLoader } from './uiLoader';
import modalAsignacionesHtml from '../config/relationships/templates/modal-asignaciones.html';

export class AssignmentModal {
  constructor() {
    this.modal = null;
    this.state = {
      context: null,       // { entityType, entityId, entityName }
      activePeriod: null,  // ID del periodo activo (global para todo el modal)
      activeTab: 'gestionar', // 'gestionar' o 'consultar'
      isLoading: false     // Estado para tu Loader
    };
    
    // Referencias al DOM para manipulación rápida
    this.elements = {
      overlay: null,
      sidebarPeriodSelect: null,
      sidebarContextInfo: null,
      workspaceContent: null,
      workspaceTabs: null,
      workspaceLoader: null
    };

    this._initialized = false;
  }

  // ==========================================
  // 1. INICIALIZACIÓN E INYECCIÓN DE UI
  // ==========================================
  _ensureInitialized() {
    if (this._initialized) return;

    // Inyectamos el nuevo layout de 2 columnas
    this._injectModalStructure();
    
    // Capturamos referencias a los elementos clave
    this.elements.overlay = document.getElementById('modal-asignaciones');
    this.elements.sidebarPeriodSelect = document.getElementById('ctx-period-selector');
    this.elements.sidebarContextInfo = document.getElementById('ctx-context-info');
    this.elements.workspaceContent = document.getElementById('workspace-content');
    this.elements.workspaceTabs = document.getElementById('workspace-tabs');

    this._bindGlobalEvents();
    this._initialized = true;
    console.log('✅ [AssignmentModal] Estructura inyectada y lista.');
  }

  _injectModalStructure() {
    
    document.body.insertAdjacentHTML('beforeend', modalAsignacionesHtml);
  }

  // ==========================================
  // 2. APERTURA Y CARGA DE DATOS
  // ==========================================
  open(context) {
    this._ensureInitialized();
    
    // 1. Guardar contexto inicial
    this.state.context = { ...context };
    this.state.activePeriod = null; // Reset periodo
    this.state.activeTab = 'gestionar';
    
    // 2. Mostrar Modal
    this.elements.overlay.classList.remove('hidden');
    
    // 3. Mostrar tu Loader (Aquí es donde lo integraremos)
    this.showLoader();

    // 4. Cargar datos asíncronos (Periodos + Info del Contexto)
    this._loadInitialData();
  }

  async _loadInitialData() {
    try {
      // Mostrar loader en el workspace (no en toda la pantalla)
      this._showWorkspaceLoader('Cargando datos del docente...');
      
      // A. Cargar Selector de Periodos
      await this._loadPeriodsIntoSidebar();
      
      // B. Renderizar Info del Contexto
      this._renderSidebarContext();

      // C. Cargar contenido inicial
      await this._switchTab('gestionar');

    } catch (error) {
      console.error('❌ Error cargando modal:', error);
      this.elements.workspaceContent.innerHTML = `<p class="error-msg">Error al cargar datos.</p>`;
    } finally {
      // Ocultar loader siempre
      this._hideWorkspaceLoader();
    }
  }

  async _loadPeriodsIntoSidebar() {
    const select = this.elements.sidebarPeriodSelect;
    // Aquí usamos tu API real
    try {
      const res = await window.electronAPI.listarPeriodosSelect();
      const periodos = res?.success ? res.data : [];
      
      select.innerHTML = '<option value="">Todos los periodos (Histórico)</option>';
      periodos.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.clave} - ${p.descripcion}`;
        select.appendChild(opt);
      });

      // Listener para cambio de periodo (Refresca todo)
      select.onchange = (e) => {
        this.state.activePeriod = e.target.value || null;
        this._handlePeriodChange();
      };
    } catch (err) {
      select.innerHTML = '<option>Error cargando</option>';
    }
  }

  _renderSidebarContext() {
    const { entityName, entityType, entityId } = this.state.context;
    const container = this.elements.sidebarContextInfo;
    
    // HTML simple para la info fija
    container.innerHTML = `
      <div class="entity-badge ${entityType}">
        <span class="icon">👤</span>
        <div>
          <strong>${entityName}</strong>
          <small>ID: ${entityId}</small>
        </div>
      </div>
      <div class="entity-meta">
        <span class="meta-item">🎓 ${entityType.toUpperCase()}</span>
      </div>
    `;
  }

  // ==========================================
  // 3. GESTIÓN DE TABS Y WORKSPACE
  // ==========================================
  async _switchTab(tabId) {
    this.state.activeTab = tabId;
    
    // Actualizar UI de botones
    this.elements.workspaceTabs.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Loader pequeño al cambiar tab
    this._showWorkspaceLoader('Actualizando vista...');
    await this._renderWorkspaceContent(tabId);
    this._hideWorkspaceLoader();
  }

  _showWorkspaceLoader(message = 'Cargando...') {
    if (this.elements.workspaceLoader) {
      this.elements.workspaceLoader.remove();
    }
    
    this.elements.workspaceLoader = uiLoader.showInContainer(
      this.elements.workspaceContent, 
      message
    );
    this.state.isLoading = true;
  }

  _hideWorkspaceLoader() {
    if (this.elements.workspaceLoader) {
      uiLoader.hideInContainer(this.elements.workspaceContent, this.elements.workspaceLoader);
      this.elements.workspaceLoader = null;
    }
    this.state.isLoading = false;
  }

  async _renderWorkspaceContent(tabId) {
  const container = this.elements.workspaceContent;
  const { entityType, entityId, entityName } = this.state.context;
  const periodId = this.state.activePeriod;

  // ✅ Usar relaciones registradas desde app.js (compatibilidad)
  const compatibleRelations = this._getRegisteredRelations(entityType).filter(rel => {
    const supportsMode = rel.workspaceConfig?.modes?.includes(tabId);
    return supportsMode;
  });

  // Fallback: si no hay relaciones registradas, intentar import dinámico
  if (compatibleRelations.length === 0) {
    try {
      const { allRelationships } = await import('../config/relationships/index.js');
      compatibleRelations.push(...allRelationships.filter(rel => 
        rel.compatibleWith?.includes(entityType) && 
        rel.workspaceConfig?.modes?.includes(tabId)
      ));
    } catch (err) {
      console.warn('⚠️ No se pudieron cargar relaciones dinámicamente:', err);
    }
  }

  // Si no hay nada compatible
  if (compatibleRelations.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No hay relaciones configuradas para ${entityType} en modo "${tabId}".</p>
      </div>
    `;
    return;
  }

  // Renderizar cada relación como tarjeta
  let html = `<div class="workspace-grid">`;
  
  for (const relation of compatibleRelations) {
    if (typeof relation.renderWorkspace === 'function') {
      const cardHtml = relation.renderWorkspace(
        { entityType, entityId, entityName }, 
        periodId, 
        tabId
      );
      if (cardHtml) html += cardHtml;
    }
  }
  
  html += `</div>`;
  container.innerHTML = html;
  
  // Bind de eventos
  this._bindWorkspaceEvents(container, tabId);
}

  _handlePeriodChange() {
    console.log(`🔄 Periodo cambiado a: ${this.state.activePeriod}`);
    // Al cambiar periodo, recargamos la tab activa para filtrar datos
    this._switchTab(this.state.activeTab);
  }

  // ==========================================
  // 4. UTILIDADES Y LOADER
  // ==========================================
  showLoader() {
    this.state.isLoading = true;
    // 🔍 AQUI BUSCAREMOS TU LOADER EXISTENTE PARA REUTILIZARLO
    // Por ahora, un spinner básico CSS
    if(this.elements.workspaceContent) {
        this.elements.workspaceContent.style.opacity = '0.5';
        this.elements.workspaceContent.style.pointerEvents = 'none';
    }
    console.log('⏳ Loader Activado');
  }

  hideLoader() {
    this.state.isLoading = false;
    if(this.elements.workspaceContent) {
        this.elements.workspaceContent.style.opacity = '1';
        this.elements.workspaceContent.style.pointerEvents = 'auto';
    }
    console.log('✅ Loader Desactivado');
  }

  _bindGlobalEvents() {
    // Cerrar modal
    const close = () => this.elements.overlay.classList.add('hidden');
    document.getElementById('btn-close-modal').onclick = close;
    document.getElementById('btn-cancelar-asig').onclick = close;
    
    // Click fuera
    this.elements.overlay.addEventListener('click', (e) => {
      if (e.target === this.elements.overlay) close();
    });

    // Tabs click
    this.elements.workspaceTabs.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-btn')) {
        this._switchTab(e.target.dataset.tab);
      }
    });
  }

    // =========================================
  // GESTIÓN DE EVENTOS DEL WORKSPACE
  // =========================================
  
  _bindWorkspaceEvents(container, tabId) {
    // Delegación de eventos: un solo listener para todo el workspace
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      
      const action = btn.dataset.action;
      const relation = btn.closest('[data-relation]')?.dataset.relation;
      
      console.log(`🎯 Acción "${action}" en relación "${relation}" (tab: ${tabId})`);
      
      // Manejar acciones específicas por relación
      if (relation === 'tutoria') {
        this._handleTutoriaAction(action, tabId);
      } else if (relation === 'docente_ee') {
        this._handleDocenteEEAction(action, tabId);
      } else {
        console.log(`⚠️ Acción genérica para ${relation}: ${action}`);
      }
    });
  }

  // =========================================
  // HANDLERS ESPECÍFICOS POR RELACIÓN
  // =========================================
  
  async _handleTutoriaAction(action, tabId) {
    const { entityType, entityId } = this.state.context;
    const periodId = this.state.activePeriod;
    
    console.log(`🔧 [Tutoria] Acción: ${action}`, { entityType, entityId, periodId });
    
    switch (action) {
      case 'assign-tutor':
        await this._handleAssignTutor(entityType, entityId, periodId);
        break;
      case 'view-tutorados':
        await this._handleViewTutorados(entityType, entityId, periodId);
        break;
      default:
        console.warn(`⚠️ Acción de tutoría no implementada: ${action}`);
    }
  }

  async _handleDocenteEEAction(action, tabId) {
    const { entityType, entityId } = this.state.context;
    const periodId = this.state.activePeriod;
    
    console.log(`🔧 [DocenteEE] Acción: ${action}`, { entityType, entityId, periodId });
    
    switch (action) {
      case 'assign-ee':
        await this._handleAssignEE(entityType, entityId, periodId);
        break;
      case 'view-ee':
        await this._handleViewEE(entityType, entityId, periodId);
        break;
      default:
        console.warn(`⚠️ Acción de EE no implementada: ${action}`);
    }
  }

  // =========================================
  // PLACEHOLDERS PARA ACCIONES FUTURAS
  // =========================================
  
  async _handleAssignTutor(entityType, entityId, periodId) {
    console.log('🔧 [TODO] Implementar asignar tutorado');
    // Futuro:
    // const alumnoId = prompt('ID del alumno:');
    // await window.electronAPI.asignarTutor({ docenteId: entityId, alumnoId, periodoId });
    // this._switchTab('gestionar'); // Recargar
  }

  async _handleViewTutorados(entityType, entityId, periodId) {
    console.log('🔧 [TODO] Implementar vista de tutorados');
  }

  async _handleAssignEE(entityType, entityId, periodId) {
    console.log('🔧 [TODO] Implementar asignar EE');
  }

  async _handleViewEE(entityType, entityId, periodId) {
    console.log('🔧 [TODO] Implementar vista de EE');
  }

  // =========================================
// MÉTODO DE COMPATIBILIDAD (para app.js)
// =========================================
registerTab(entityType, config) {
  // Almacena las relaciones registradas desde app.js
  if (!this._registeredRelations) {
    this._registeredRelations = new Map();
  }
  
  if (!this._registeredRelations.has(entityType)) {
    this._registeredRelations.set(entityType, []);
  }
  
  this._registeredRelations.get(entityType).push(config);
  
  // Log opcional para debug
  if (process.env.NODE_ENV === 'development') {
    console.log(`✅ [AssignmentModal] Tab "${config.tabId}" registrada para "${entityType}"`);
  }
}

// Método auxiliar para obtener relaciones registradas
_getRegisteredRelations(entityType) {
  return this._registeredRelations?.get(entityType) || [];
}
}