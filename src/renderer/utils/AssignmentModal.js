// src/renderer/utils/AssignmentModal.js
// 🎯 Mega Modal Universal de Asignaciones
// ✅ Features: Caché de contenido, lazy loading, tabs universales, responsive-ready

export class AssignmentModal {
  constructor() {
    this.modal = null;
    this.currentContext = null;
    this.tabRegistry = new Map();
    this._initialized = false;
    
    // ✅ Caché de contenido renderizado por tab (entityType:tabId -> HTML)
    this._contentCache = new Map();
    
    // ✅ Track de pestaña activa para evitar re-renders innecesarios
    this._activeTab = null;
    
    // ✅ Track de listeners para cleanup de eventos dinámicos
    this._tabEventListeners = new Map();
  }

  // =========================================
  // INICIALIZACIÓN PEREZOSA (Lazy Init)
  // =========================================
  /**
   * Inicializa el modal solo cuando se usa por primera vez
   * Evita inyección de DOM innecesaria al cargar la app
   */
  _ensureInitialized() {
    if (this._initialized) return;
    
    // 1. Inyectar HTML si no existe en el DOM
    if (!document.getElementById('modal-asignaciones')) {
      this._injectModalHtml();
    }
    
    this.modal = document.getElementById('modal-asignaciones');
    this._bindEvents();
    this._initialized = true;
    console.log('✅ [AssignmentModal] Inicializado correctamente');
  }

  /**
   * Inyecta el HTML base del modal en el body
   * Usa clases CSS para estilos (ver styles/modals/modal-asignaciones.css)
   */
  _injectModalHtml() {
    const html = `
      <div id="modal-asignaciones" class="modal-overlay hidden">
        <div class="modal-content modal-lg">
          
          <!-- Header: Título + Botón cerrar -->
          <div class="modal-header">
            <h3 id="asig-modal-title">Gestionar Asignaciones</h3>
            <button class="btn-close" id="btn-cerrar-asig" type="button" aria-label="Cerrar">&times;</button>
          </div>
          
          <!-- Tabs de navegación con scroll horizontal en móvil -->
          <div id="asig-tabs-container" class="tabs-container" role="tablist"></div>
          
          <!-- Área de contenido con scroll interno -->
          <div id="asig-content-area" class="tab-content-area" role="tabpanel">
            <div class="empty-state" id="asig-loading">Cargando...</div>
          </div>
          
          <!-- Footer: Acciones globales -->
          <div class="modal-footer">
            <button class="btn btn-cancel" id="btn-cancelar-asig" type="button">Cerrar</button>
          </div>
          
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  // =========================================
  // EVENTOS GLOBALES DEL MODAL
  // =========================================
  _bindEvents() {
    if (!this.modal) return;
    
    // Función centralizada de cierre
    const close = () => {
      this.modal?.classList.add('hidden');
      this.currentContext = null;
      this._activeTab = null;
      // ✅ Limpiar contenido pero NO el caché (para navegación rápida)
      document.getElementById('asig-content-area').innerHTML = '';
      // ✅ Limpiar listeners de pestañas anteriores
      this._cleanupTabListeners();
    };
    
    // Botones de cierre
    document.getElementById('btn-cerrar-asig')?.addEventListener('click', close);
    document.getElementById('btn-cancelar-asig')?.addEventListener('click', close);
    
    // Click en overlay (fuera del modal)
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) close();
    });
    
    // Tecla Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && !this.modal.classList.contains('hidden')) {
        e.preventDefault();
        close();
      }
    });
  }

  // =========================================
  // REGISTRO DE PESTAÑAS
  // =========================================
  /**
   * Registra una pestaña para un tipo de entidad
   * @param {string} entityType - 'docente', 'alumno', 'ee', etc.
   * @param {object} config - { tabId, label, loadData(), render(), visible()? }
   */
  registerTab(entityType, config) {
    if (!this.tabRegistry.has(entityType)) {
      this.tabRegistry.set(entityType, []);
    }
    
    // Validar configuración mínima
    if (!config.tabId || !config.label || typeof config.loadData !== 'function') {
      console.warn(`⚠️ [AssignmentModal] Configuración inválida para ${entityType}.${config.tabId}`);
      return;
    }
    
    this.tabRegistry.get(entityType).push({
      ...config,
      // Default: visible para todos si no se especifica
      visible: config.visible || (() => true)
    });
    
    console.log(`✅ [AssignmentModal] Pestaña "${config.label}" registrada para "${entityType}"`);
  }

  // =========================================
  // APERTURA DEL MODAL
  // =========================================
  /**
   * Abre el modal con contexto específico
   * @param {object} context - { entityType, entityId, entityName, tabs: [] }
   */
  open(context) {
    this._ensureInitialized();
    
    // Validar contexto mínimo
    if (!context?.entityType || !context?.entityId) {
      console.error('❌ [AssignmentModal] Contexto inválido: requiere entityType y entityId');
      return;
    }
    
    this.currentContext = { ...context, activeTab: null };
    
    // Actualizar título dinámico
    const titleEl = document.getElementById('asig-modal-title');
    if (titleEl) {
      titleEl.textContent = `Asignaciones: ${context.entityName || context.entityType.toUpperCase()}`;
    }
    
    // Renderizar pestañas disponibles para este contexto
    this._renderTabs(context.tabs || []);
    
    // Mostrar modal con animación suave
    if (this.modal) {
      this.modal.classList.remove('hidden');
      // ✅ Forzar reflow para evitar glitches de animación CSS
      void this.modal.offsetWidth;
    }
    
    // Activar primera pestaña disponible (con pequeño delay para permitir render)
    if (context.tabs?.length > 0) {
      setTimeout(() => this._activateTab(context.tabs[0]), 50);
    }
    
    console.log(`🚀 [AssignmentModal] Abierto para ${context.entityType} #${context.entityId}`);
  }

  // =========================================
  // RENDERIZADO DE PESTAÑAS
  // =========================================
  _renderTabs(allowedTabIds) {
    const container = document.getElementById('asig-tabs-container');
    if (!container) return;
    
    container.innerHTML = '';
    if (!this.currentContext) return;
    
    const { entityType } = this.currentContext;
    const available = this.tabRegistry.get(entityType) || [];
    
    // Filtrar pestañas por: 1) lista permitida, 2) función visible()
    const tabsToShow = available.filter(tab => 
      allowedTabIds.includes(tab.tabId) && 
      (typeof tab.visible !== 'function' || tab.visible(this.currentContext))
    );
    
    if (tabsToShow.length === 0) {
      container.innerHTML = '<span class="empty-state" style="padding:0.5rem 1rem;font-size:0.85rem;color:var(--text-muted)">Sin pestañas disponibles</span>';
      return;
    }
    
    tabsToShow.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.dataset.tabId = tab.tabId;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.textContent = tab.label;
      btn.addEventListener('click', () => this._activateTab(tab.tabId));
      container.appendChild(btn);
    });
  }

  // =========================================
  // ACTIVACIÓN DE PESTAÑAS CON CACHÉ
  // =========================================
  _activateTab(tabId) {
    // ✅ Evitar re-render si ya está activa
    if (this._activeTab === tabId) return;
    
    // Actualizar UI de botones (sin animaciones pesadas)
    document.querySelectorAll('#asig-tabs-container .tab-btn').forEach(btn => {
      const isActive = btn.dataset.tabId === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    
    this._activeTab = tabId;
    this.currentContext.activeTab = tabId;
    
    // ✅ Cargar contenido con sistema de caché
    this._loadTabContentCached(tabId);
    
    console.log(`🔄 [AssignmentModal] Pestaña activada: ${tabId}`);
  }

  /**
   * Carga contenido de pestaña con caché + lazy loading
   * Prioriza velocidad: muestra caché inmediatamente, carga en background si es necesario
   */
  async _loadTabContentCached(tabId) {
    const area = document.getElementById('asig-content-area');
    if (!area) return;
    
    const cacheKey = `${this.currentContext.entityType}:${this.currentContext.entityId}:${tabId}`;
    
    // ✅ CASO 1: Contenido ya en caché → mostrar inmediatamente (sin loading)
    if (this._contentCache.has(cacheKey)) {
      area.innerHTML = this._contentCache.get(cacheKey);
      this._bindTabEvents(tabId, area);
      console.log(`⚡ [AssignmentModal] Contenido servido desde caché: ${cacheKey}`);
      return;
    }
    
    // ✅ CASO 2: No hay caché → mostrar loading mínimo y cargar
    area.innerHTML = '<div class="empty-state" style="padding:2rem;text-align:center"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;margin-bottom:0.5rem"></i><br>Cargando...</div>';
    
    const { entityType, entityId } = this.currentContext;
    const tabConfig = (this.tabRegistry.get(entityType) || []).find(t => t.tabId === tabId);
    
    if (!tabConfig) {
      area.innerHTML = '<div class="empty-state">⚠️ Pestaña no configurada</div>';
      return;
    }
    
    try {
      // ✅ Usar requestIdleCallback para no bloquear el hilo principal (si está disponible)
      if ('requestIdleCallback' in window) {
        await new Promise(resolve => {
          requestIdleCallback(async () => {
            const data = await tabConfig.loadData(entityId, entityType);
            const html = tabConfig.render?.(data) || '<div class="empty-state">Sin registros</div>';
            this._contentCache.set(cacheKey, html);
            area.innerHTML = html;
            this._bindTabEvents(tabId, area);
            resolve();
          }, { timeout: 2000 }); // Fallback a 2s si no hay idle time
        });
      } else {
        // Fallback para navegadores antiguos
        const data = await tabConfig.loadData(entityId, entityType);
        const html = tabConfig.render?.(data) || '<div class="empty-state">Sin registros</div>';
        this._contentCache.set(cacheKey, html);
        area.innerHTML = html;
        this._bindTabEvents(tabId, area);
      }
      
      console.log(`✅ [AssignmentModal] Contenido cargado y cacheado: ${cacheKey}`);
      
    } catch (error) {
      console.error(`❌ Error cargando ${tabId}:`, error);
      area.innerHTML = `<div class="empty-state" style="color:var(--danger-color)"><i class="fa-solid fa-triangle-exclamation"></i><br>Error: ${error.message}</div>`;
    }
  }

  // =========================================
  // EVENTOS DINÁMICOS POR PESTAÑA
  // =========================================
  /**
   * Vincula eventos específicos para contenido dinámico de una pestaña
   * Usa delegación de eventos para eficiencia
   */
  _bindTabEvents(tabId, container) {
    if (!container) return;
    
    // Limpiar listeners anteriores de esta pestaña
    this._cleanupTabListeners(tabId);
    
    const listeners = [];
    
    // ✅ Ejemplo 1: Delegación para botones con data-action
    container.addEventListener('click', (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      
      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;
      
      console.log(`🎯 [AssignmentModal] Acción "${action}" en ID: ${id}`);
      
      // Aquí iría la lógica específica por acción
      // Ejemplo: this._handleAction(action, id, this.currentContext);
    });
    listeners.push({ type: 'click', handler: container.querySelector('[data-action]')?.parentNode });
    
    // ✅ Ejemplo 2: Botones de editar/eliminar con confirmación
    container.querySelectorAll('[data-confirm]').forEach(btn => {
      const handler = (e) => {
        e.preventDefault();
        const message = btn.dataset.confirm || '¿Estás seguro?';
        if (confirm(message)) {
          // Lógica de confirmación aquí
          console.log(`✅ Confirmado: ${btn.dataset.action}`);
        }
      };
      btn.addEventListener('click', handler);
      listeners.push({ type: 'click', target: btn, handler });
    });
    
    // Guardar listeners para cleanup futuro
    this._tabEventListeners.set(`${this.currentContext.entityType}:${tabId}`, listeners);
  }

  /**
   * Limpia listeners de eventos dinámicos para evitar memory leaks
   */
  _cleanupTabListeners(tabId = null) {
    const prefix = tabId 
      ? `${this.currentContext?.entityType}:${tabId}` 
      : `${this.currentContext?.entityType}:`;
    
    for (const [key, listeners] of this._tabEventListeners) {
      if (key.startsWith(prefix)) {
        listeners.forEach(({ type, target, handler }) => {
          target?.removeEventListener?.(type, handler);
        });
        this._tabEventListeners.delete(key);
      }
    }
  }

  // =========================================
  // GESTIÓN DE MEMORIA (Opcional)
  // =========================================
  /**
   * Limpia el caché de contenido para liberar memoria
   * Útil si el modal se usa con muchas entidades diferentes
   */
  clearCache(entityType = null, tabId = null) {
    if (!entityType && !tabId) {
      // Limpieza total
      this._contentCache.clear();
      console.log('🧹 [AssignmentModal] Caché completo limpiado');
      return;
    }
    
    // Limpieza selectiva
    for (const key of this._contentCache.keys()) {
      if (key.startsWith(`${entityType}:`) && (!tabId || key.endsWith(`:${tabId}`))) {
        this._contentCache.delete(key);
        console.log(`🧹 [AssignmentModal] Caché limpiado: ${key}`);
      }
    }
  }

  /**
   * Destruye el modal y libera todos los recursos
   * Útil si se quiere eliminar completamente el modal del DOM
   */
  destroy() {
    if (!this._initialized) return;
    
    // Cerrar modal si está abierto
    this.modal?.classList.add('hidden');
    
    // Limpiar caché y listeners
    this._contentCache.clear();
    this._cleanupTabListeners();
    this._tabEventListeners.clear();
    
    // Remover listeners globales
    document.getElementById('btn-cerrar-asig')?.removeEventListener('click', () => {});
    document.getElementById('btn-cancelar-asig')?.removeEventListener('click', () => {});
    
    // Resetear estado
    this.modal = null;
    this.currentContext = null;
    this._activeTab = null;
    this._initialized = false;
    
    console.log('🗑️ [AssignmentModal] Recursos liberados');
  }
}

// ✅ Instancia global única (lazy: no se inicializa hasta el primer open())
export const assignmentModal = new AssignmentModal();