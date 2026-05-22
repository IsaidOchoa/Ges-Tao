// src/renderer/utils/AssignmentModal.js

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
    // Formato: Map<cacheKey, Array<{ type, target, handler, options? }>>
    this._tabEventListeners = new Map();
  }

  // =========================================
  // INICIALIZACIÓN PEREZOSA (Lazy Init)
  // =========================================
  _ensureInitialized() {
    if (this._initialized) return;
    
    if (!document.getElementById('modal-asignaciones')) {
      this._injectModalHtml();
    }
    
    this.modal = document.getElementById('modal-asignaciones');
    this._bindEvents();
    this._initialized = true;
    console.log('✅ [AssignmentModal] Inicializado correctamente');
  }

  _injectModalHtml() {
    const html = `
      <div id="modal-asignaciones" class="modal-overlay hidden">
        <div class="modal-content modal-lg">
          <div class="modal-header">
            <h3 id="asig-modal-title">Gestionar Asignaciones</h3>
            <button class="btn-close" id="btn-cerrar-asig" type="button" aria-label="Cerrar">&times;</button>
          </div>
          <div id="asig-tabs-container" class="tabs-container" role="tablist"></div>
          <div id="asig-content-area" class="tab-content-area" role="tabpanel">
            <div class="empty-state" id="asig-loading">Cargando...</div>
          </div>
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
    
    const close = () => {
      this.modal?.classList.add('hidden');
      this.currentContext = null;
      this._activeTab = null;
      document.getElementById('asig-content-area').innerHTML = '';
      this._cleanupTabListeners();
    };
    
    document.getElementById('btn-cerrar-asig')?.addEventListener('click', close);
    document.getElementById('btn-cancelar-asig')?.addEventListener('click', close);
    
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) close();
    });
    
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
  registerTab(entityType, config) {
    if (!this.tabRegistry.has(entityType)) {
      this.tabRegistry.set(entityType, []);
    }
    
    if (!config.tabId || !config.label || typeof config.loadData !== 'function') {
      console.warn(`⚠️ [AssignmentModal] Configuración inválida para ${entityType}.${config.tabId}`);
      return;
    }
    
    this.tabRegistry.get(entityType).push({
      ...config,
      visible: config.visible || (() => true)
    });
    
    console.log(`✅ [AssignmentModal] Pestaña "${config.label}" registrada para "${entityType}"`);
  }

  // =========================================
  // APERTURA DEL MODAL
  // =========================================
  open(context) {
    this._ensureInitialized();
    
    if (!context?.entityType || !context?.entityId) {
      console.error('❌ [AssignmentModal] Contexto inválido: requiere entityType y entityId');
      return;
    }
    
    this.currentContext = { ...context, activeTab: null };
    
    const titleEl = document.getElementById('asig-modal-title');
    if (titleEl) {
      titleEl.textContent = `Asignaciones: ${context.entityName || context.entityType.toUpperCase()}`;
    }
    
    this._renderTabs(context.tabs || []);
    
    if (this.modal) {
      this.modal.classList.remove('hidden');
      void this.modal.offsetWidth;
    }
    
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
    if (this._activeTab === tabId) return;
    
    document.querySelectorAll('#asig-tabs-container .tab-btn').forEach(btn => {
      const isActive = btn.dataset.tabId === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    
    this._activeTab = tabId;
    this.currentContext.activeTab = tabId;
    
    this._loadTabContentCached(tabId);
    
    console.log(`🔄 [AssignmentModal] Pestaña activada: ${tabId}`);
  }

  async _loadTabContentCached(tabId) {
    const area = document.getElementById('asig-content-area');
    if (!area) return;
    
    const cacheKey = `${this.currentContext.entityType}:${this.currentContext.entityId}:${tabId}`;
    
    if (this._contentCache.has(cacheKey)) {
      area.innerHTML = this._contentCache.get(cacheKey);
      this._bindTabEvents(tabId, area);
      console.log(`⚡ [AssignmentModal] Contenido servido desde caché: ${cacheKey}`);
      return;
    }
    
    area.innerHTML = '<div class="empty-state" style="padding:2rem;text-align:center"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;margin-bottom:0.5rem"></i><br>Cargando...</div>';
    
    const { entityType, entityId } = this.currentContext;
    const tabConfig = (this.tabRegistry.get(entityType) || []).find(t => t.tabId === tabId);
    
    if (!tabConfig) {
      area.innerHTML = '<div class="empty-state">⚠️ Pestaña no configurada</div>';
      return;
    }
    
    try {
      if ('requestIdleCallback' in window) {
        await new Promise(resolve => {
          requestIdleCallback(async () => {
            const data = await tabConfig.loadData(entityId, entityType);
            const html = tabConfig.render?.(data, this.currentContext) || '<div class="empty-state">Sin registros</div>';
            this._contentCache.set(cacheKey, html);
            area.innerHTML = html;
            this._bindTabEvents(tabId, area);
            resolve();
          }, { timeout: 2000 });
        });
      } else {
        const data = await tabConfig.loadData(entityId, entityType);
        const html = tabConfig.render?.(data, this.currentContext) || '<div class="empty-state">Sin registros</div>';
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
  // ✅ CORREGIDO: EVENTOS DINÁMICOS POR PESTAÑA
  // =========================================
  _bindTabEvents(tabId, container) {
    if (!container) return;
    
    // Limpiar listeners anteriores de esta pestaña
    this._cleanupTabListeners(tabId);
    
    const listeners = [];
    const { entityType, entityId } = this.currentContext;
    
    // ✅ 1. Delegación para botones con [data-action] (ej: eliminar, editar)
    const delegationHandler = (e) => {
      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;
      
      console.log(`🎯 [AssignmentModal] Acción "${action}" en ID: ${id}, Tab: ${tabId}`);
      
      // Aquí se puede expandir con lógica específica por acción
      // Ejemplo: this._handleAction(action, id, { entityType, entityId, tabId });
    };
    
    container.addEventListener('click', delegationHandler, { capture: true });
    listeners.push({ 
      type: 'click', 
      target: container, 
      handler: delegationHandler,
      options: { capture: true }
    });
    
    // ✅ 2. Botón específico: #btn-add-tutor (para asignar tutoría)
    const btnAddTutor = container.querySelector('#btn-add-tutor');
    if (btnAddTutor) {
      const addHandler = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const selectEl = container.querySelector('#select-alumno-target');
        const targetId = selectEl?.value;
        
        if (!targetId) {
          if (typeof window.toast !== 'undefined') {
            window.toast.warning?.('Selecciona un elemento del dropdown');
          } else {
            alert('⚠️ Selecciona un elemento del dropdown');
          }
          return;
        }
        
        // Confirmación de seguridad (siempre, como pediste)
        const confirmed = await this._showConfirmation(
          '¿Confirmar asignación?', 
          'Esta acción creará una relación entre las entidades. Puedes modificarla después.'
        );
        
        if (!confirmed) return;
        
        try {
          // Botón en estado de carga
          btnAddTutor.disabled = true;
          const originalText = btnAddTutor.textContent;
          btnAddTutor.textContent = '⏳ Procesando...';
          
          // Llamar al endpoint IPC correspondiente
          // NOTA: Ajusta el nombre del endpoint según tu backend
          const res = await window.electronAPI?.asignarTutor?.({
            docenteId: entityType === 'docente' ? entityId : null,
            alumnoId: entityType === 'alumno' ? entityId : null,
            targetId: targetId,
            periodoId: this.currentContext.periodId || null
          });
          
          if (res?.success) {
            if (typeof window.toast !== 'undefined') {
              window.toast.success?.('✅ Asignación realizada');
            } else {
              alert('✅ Asignación realizada');
            }
            // Recargar contenido para reflejar cambios
            this._loadTabContentCached(tabId);
          } else {
            throw new Error(res?.error || 'Error al asignar');
          }
        } catch (error) {
          console.error('❌ Error en asignación:', error);
          if (typeof window.toast !== 'undefined') {
            window.toast.error?.(`❌ ${error.message}`);
          } else {
            alert(`❌ Error: ${error.message}`);
          }
        } finally {
          if (btnAddTutor) {
            btnAddTutor.disabled = false;
            btnAddTutor.textContent = originalText || '✨ Asignar';
          }
        }
      };
      
      btnAddTutor.addEventListener('click', addHandler);
      listeners.push({ type: 'click', target: btnAddTutor, handler: addHandler });
    }
    
    // ✅ 3. Botones de remover con [data-action="remove"]
    container.querySelectorAll('[data-action="remove"]').forEach(btn => {
      const removeHandler = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const id = btn.dataset.id;
        if (!id) return;
        
        const confirmed = await this._showConfirmation(
          '¿Quitar asignación?', 
          'Esta acción eliminará la relación. Los datos originales no se borrarán.'
        );
        
        if (!confirmed) return;
        
        try {
          const res = await window.electronAPI?.removerTutor?.({
            docenteId: entityType === 'docente' ? entityId : null,
            alumnoId: entityType === 'alumno' ? entityId : null,
            targetId: id
          });
          
          if (res?.success) {
            if (typeof window.toast !== 'undefined') {
              window.toast.success?.('✅ Asignación removida');
            }
            this._loadTabContentCached(tabId);
          } else {
            throw new Error(res?.error || 'Error al remover');
          }
        } catch (error) {
          console.error('❌ Error removiendo:', error);
          if (typeof window.toast !== 'undefined') {
            window.toast.error?.(`❌ ${error.message}`);
          }
        }
      };
      
      btn.addEventListener('click', removeHandler);
      listeners.push({ type: 'click', target: btn, handler: removeHandler });
    });
    
    // ✅ 4. Selector de periodo dinámico (si la pestaña lo requiere)
    const periodSelector = container.querySelector('#modal-period-selector');
    if (periodSelector) {
      const periodChangeHandler = async (e) => {
        const newPeriodId = e.target.value;
        if (!newPeriodId) return;
        
        // Actualizar contexto con nuevo periodo
        this.currentContext.periodId = newPeriodId;
        
        // Recargar contenido de esta pestaña con el nuevo periodo
        // Usamos _loadTabContentCached directamente para forzar recarga (ignorar caché)
        const area = document.getElementById('asig-content-area');
        if (area) {
          area.innerHTML = '<div class="empty-state" style="padding:2rem;text-align:center"><i class="fa-solid fa-spinner fa-spin"></i><br>Cargando...</div>';
          await this._loadTabContentCached(tabId);
        }
      };
      
      periodSelector.addEventListener('change', periodChangeHandler);
      listeners.push({ type: 'change', target: periodSelector, handler: periodChangeHandler });
    }
    
    // Guardar listeners para cleanup futuro
    const cacheKey = `${entityType}:${tabId}`;
    this._tabEventListeners.set(cacheKey, listeners);
    
    console.log(`🔗 [AssignmentModal] ${listeners.length} listeners vinculados para ${cacheKey}`);
  }

  // =========================================
  // UTILIDAD: Mostrar confirmación (compatible con toast o alert)
  // =========================================
  async _showConfirmation(title, message) {
    // Si existe globalConfirm, usarlo (más elegante)
    if (typeof globalConfirm !== 'undefined' && globalConfirm.ask) {
      return await globalConfirm.ask(`${title}\n\n${message}`);
    }
    // Fallback a confirm nativo
    return confirm(`${title}\n\n${message}`);
  }

  // =========================================
  // ✅ CORREGIDO: Limpieza de listeners
  // =========================================
  _cleanupTabListeners(tabId = null) {
    const prefix = tabId 
      ? `${this.currentContext?.entityType}:${tabId}` 
      : `${this.currentContext?.entityType}:`;
    
    for (const [key, listeners] of this._tabEventListeners) {
      if (key.startsWith(prefix)) {
        listeners.forEach(({ type, target, handler, options }) => {
          if (target && typeof handler === 'function') {
            target.removeEventListener(type, handler, options);
          }
        });
        this._tabEventListeners.delete(key);
        console.log(`🧹 [AssignmentModal] Listeners limpiados: ${key}`);
      }
    }
  }

  // =========================================
  // GESTIÓN DE MEMORIA
  // =========================================
  clearCache(entityType = null, tabId = null) {
    if (!entityType && !tabId) {
      this._contentCache.clear();
      console.log('🧹 [AssignmentModal] Caché completo limpiado');
      return;
    }
    
    for (const key of this._contentCache.keys()) {
      if (key.startsWith(`${entityType}:`) && (!tabId || key.endsWith(`:${tabId}`))) {
        this._contentCache.delete(key);
        console.log(`🧹 [AssignmentModal] Caché limpiado: ${key}`);
      }
    }
  }

  destroy() {
    if (!this._initialized) return;
    
    this.modal?.classList.add('hidden');
    this._contentCache.clear();
    this._cleanupTabListeners();
    this._tabEventListeners.clear();
    
    // Remover listeners globales (referencias directas)
    const btnCerrar = document.getElementById('btn-cerrar-asig');
    const btnCancelar = document.getElementById('btn-cancelar-asig');
    if (btnCerrar) {
      const clone = btnCerrar.cloneNode(true);
      btnCerrar.parentNode.replaceChild(clone, btnCerrar);
    }
    if (btnCancelar) {
      const clone = btnCancelar.cloneNode(true);
      btnCancelar.parentNode.replaceChild(clone, btnCancelar);
    }
    
    this.modal = null;
    this.currentContext = null;
    this._activeTab = null;
    this._initialized = false;
    
    console.log('🗑️ [AssignmentModal] Recursos liberados');
  }
}

// ✅ Instancia global única (lazy: no se inicializa hasta el primer open())
export const assignmentModal = new AssignmentModal();