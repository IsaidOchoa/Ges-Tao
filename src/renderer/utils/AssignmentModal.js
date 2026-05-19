// src/renderer/utils/AssignmentModal.js
export class AssignmentModal {
  constructor() {
    this.modal = null;
    this.currentContext = null;
    this.tabRegistry = new Map();
    this._initialized = false;
    // ⚠️ NO inicializar aquí: esperar a que el DOM esté listo o a la primera llamada a open()
  }

  /**
   * Inicialización perezosa: inyecta HTML y vincula eventos solo cuando se necesita
   */
  _ensureInitialized() {
    if (this._initialized) return;
    
    // 1. Inyectar HTML si no existe
    if (!document.getElementById('modal-asignaciones')) {
      this._injectModalHtml();
    }
    
    this.modal = document.getElementById('modal-asignaciones');
    this._bindEvents();
    this._initialized = true;
    console.log('✅ [AssignmentModal] Inicializado');
  }

  _injectModalHtml() {
    const html = `
      <div id="modal-asignaciones" class="modal-overlay hidden">
        <div class="modal-content modal-lg">
          <div class="modal-header">
            <h3 id="asig-modal-title">Gestionar Asignaciones</h3>
            <button class="btn-close" id="btn-cerrar-asig" type="button">&times;</button>
          </div>
          
          <!-- Contenedor dinámico de pestañas -->
          <div id="asig-tabs-container" class="tabs-container" style="display:flex;flex-wrap:wrap;gap:4px;border-bottom:2px solid var(--border-color);margin-bottom:16px;padding-bottom:8px"></div>
          
          <!-- Contenido dinámico -->
          <div id="asig-content-area" class="tab-content-area" style="min-height:200px;max-height:60vh;overflow-y:auto;padding:8px 0">
            <div class="empty-state" id="asig-loading">Cargando...</div>
          </div>
          
          <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;padding-top:20px;border-top:1px solid var(--border-color)">
            <button class="btn btn-cancel" id="btn-cancelar-asig" type="button">Cerrar</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  _bindEvents() {
    if (!this.modal) return;
    
    const close = () => {
      this.modal?.classList.add('hidden');
      this.currentContext = null;
      document.getElementById('asig-content-area').innerHTML = '';
    };
    
    // Usar optional chaining para evitar errores si los elementos no existen
    document.getElementById('btn-cerrar-asig')?.addEventListener('click', close);
    document.getElementById('btn-cancelar-asig')?.addEventListener('click', close);
    
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) close();
    });
    
    // Soporte para tecla Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && !this.modal.classList.contains('hidden')) {
        close();
      }
    });
  }

  /**
   * Registra una pestaña para un tipo de entidad
   */
  registerTab(entityType, config) {
    if (!this.tabRegistry.has(entityType)) {
      this.tabRegistry.set(entityType, []);
    }
    this.tabRegistry.get(entityType).push(config);
  }

  /**
   * Abre el modal con contexto específico (INICIALIZA BAJO DEMANDA)
   */
  open(context) {
    // ✅ Inicializar solo cuando se usa por primera vez
    this._ensureInitialized();
    
    this.currentContext = { ...context, activeTab: null };
    
    // Título dinámico
    const titleEl = document.getElementById('asig-modal-title');
    if (titleEl) {
      titleEl.textContent = `Asignaciones: ${context.entityName || context.entityType.toUpperCase()}`;
    }
    
    // Renderizar pestañas SOLO las configuradas
    this._renderTabs(context.tabs || []);
    
    // Mostrar modal
    if (this.modal) {
      this.modal.classList.remove('hidden');
    }
    
    // Activar primera pestaña por defecto
    if (context.tabs?.length > 0) {
      this._activateTab(context.tabs[0]);
    }
  }

  _renderTabs(allowedTabIds) {
    const container = document.getElementById('asig-tabs-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!this.currentContext) return;
    
    const entityType = this.currentContext.entityType;
    const available = this.tabRegistry.get(entityType) || [];
    
    // Filtrar solo las pestañas permitidas para este contexto
    const tabsToShow = available.filter(t => allowedTabIds.includes(t.tabId));
    
    tabsToShow.forEach(tab => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn';
      btn.dataset.tabId = tab.tabId;
      btn.textContent = tab.label;
      btn.style.cssText = 'padding:8px 16px;border:none;background:var(--bg-light);border-radius:6px 6px 0 0;cursor:pointer;font-size:0.9rem;transition:all 0.2s';
      btn.addEventListener('click', () => this._activateTab(tab.tabId));
      container.appendChild(btn);
    });
  }

  _activateTab(tabId) {
    // Actualizar UI de pestañas
    document.querySelectorAll('#asig-tabs-container .tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tabId === tabId);
      if (b.dataset.tabId === tabId) {
        b.style.background = 'var(--accent-color)';
        b.style.color = 'white';
        b.style.fontWeight = '600';
      } else {
        b.style.background = '';
        b.style.color = '';
        b.style.fontWeight = '';
      }
    });
    
    this.currentContext.activeTab = tabId;
    this._loadTabContent(tabId);
  }

  async _loadTabContent(tabId) {
    const area = document.getElementById('asig-content-area');
    if (!area) return;
    
    area.innerHTML = '<div class="empty-state">⏳ Cargando...</div>';
    
    const entityType = this.currentContext?.entityType;
    const entityId = this.currentContext?.entityId;
    const tabConfig = (this.tabRegistry.get(entityType) || [])
      .find(t => t.tabId === tabId);
    
    if (!tabConfig) {
      area.innerHTML = '<div class="empty-state">⚠️ Pestaña no configurada</div>';
      return;
    }
    
    try {
      const data = await tabConfig.loadData(entityId);
      area.innerHTML = tabConfig.render?.(data) || '<div class="empty-state">Sin registros</div>';
    } catch (error) {
      console.error(`Error cargando ${tabId}:`, error);
      area.innerHTML = `<div class="empty-state" style="color:var(--danger-color)">❌ Error: ${error.message}</div>`;
    }
  }
}

// ✅ Instancia global única (pero lazy: no se inicializa hasta el primer open())
export const assignmentModal = new AssignmentModal();