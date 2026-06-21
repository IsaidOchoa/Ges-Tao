// src/renderer/config/relationships/relacion-docente-tutorados.js

export const relacionDocenteTutorados = {
  tabId: 'tutorados',
  label: '🎓 Tutorados',
  description: 'Asigna alumnos a tutelar en este periodo',
  compatibleWith: ['docente'],
  
  // Configuración del workspace: modos disponibles y prioridad de renderizado
  workspaceConfig: { 
    modes: ['gestionar', 'consultar'], 
    priority: 2 
  },

  /**
   * Renderiza la card operativa para gestionar tutorados (pestaña "Gestionar")
   * @param {Object} context - Contexto de la entidad {entityType, entityId, entityName}
   * @param {number|string} periodId - ID del periodo seleccionado
   * @returns {string} HTML de la card
   */
  renderOperationalCard: (context, periodId) => {
    // Estado deshabilitado: sin periodo seleccionado
    if (!periodId) {
      return `
        <section class="workspace-card relation-card disabled" data-relation="tutorados">
          <header class="card-header">
            <h4><i class="fa-solid fa-user-graduate"></i> Tutorados</h4>
            <span class="badge badge-counter" style="background:rgba(127,140,141,0.2); color:var(--text-muted); padding:2px 8px; border-radius:12px; font-size:0.8rem;">–</span>
          </header>
          <div class="card-body">
            <p class="summary-text">
              <i class="fa-solid fa-circle-info" style="margin-right:6px;"></i>
              Selecciona un periodo en el sidebar para gestionar tutorados.
            </p>
          </div>
        </section>
      `;
    }

    // ✅ Card completa con selector + botón + LISTA DE ASIGNADOS
    return `
      <section class="workspace-card relation-card" data-relation="tutorados">
        <header class="card-header">
          <h4><i class="fa-solid fa-user-graduate"></i> Tutorados</h4>
          <span class="badge badge-counter" 
                id="counter-tutorados-${context.entityId}" 
                style="background:rgba(52,152,219,0.15); color:#3498db; padding:2px 8px; border-radius:12px; font-size:0.8rem; font-weight:700; min-width:24px; text-align:center;">
            0
          </span>
        </header>
        
        <div class="card-body">
          <!-- Selector para asignar nuevo tutorado -->
          <p class="summary-text" style="margin-bottom:0.75rem;">
            Selecciona un alumno para asignarlo como tutorado en este periodo.
          </p>
          
          <select class="form-select form-select-sm" 
                  id="select-tutorado-${context.entityId}" 
                  style="width:100%; margin-bottom:0.5rem; font-size:0.9rem;">
            <option value="">Cargando alumnos disponibles...</option>
          </select>
          
          <button class="btn btn-sm btn-primary" 
                  style="width:100%;" 
                  data-action="assign" 
                  data-relation="tutorados">
            <i class="fa-solid fa-user-plus"></i> Asignar Tutorado
          </button>
          
          <!-- 🔹 NUEVO: Separador visual -->
          <div style="margin:1.25rem 0; border-top:1px solid rgba(255,255,255,0.1);"></div>
          
          <!-- 🔹 NUEVO: Lista de tutorados asignados (se llena dinámicamente) -->
          <div>
            <h5 style="font-size:0.85rem; margin:0 0 0.75rem 0; color:var(--text-muted); display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-list"></i> Alumnos asignados
            </h5>
            <div id="assigned-tutorados-list-${context.entityId}" 
                 class="assigned-list-container"
                 style="display:flex; flex-direction:column; gap:0.5rem; max-height:180px; overflow-y:auto; padding-right:4px;">
              <!-- 🔹 JS inyecta items aquí con estructura:
                   <div class="assigned-tutorado-item">
                     <div class="info">Nombre, matrícula...</div>
                     <button data-action="remove-tutorado">Quitar</button>
                   </div>
              -->
              <span class="loading-text" style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:0.5rem;">
                <i class="fa-solid fa-spinner fa-spin" style="margin-right:4px;"></i>
                Cargando...
              </span>
            </div>
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Renderiza la vista de consulta/historial (pestaña "Consultar")
   * @param {Object} context - Contexto de la entidad
   * @param {number|string} periodId - ID del periodo
   * @param {string} mode - Modo de vista: 'gestionar' | 'consultar'
   * @returns {string|null} HTML de la vista o null si no aplica
   */
  renderWorkspace: (context, periodId, mode) => {
    if (mode !== 'consultar') return null;
    
    return `
      <section class="workspace-card" data-relation="tutorados">
        <header class="card-header">
          <h4><i class="fa-solid fa-clock-rotate-left"></i> Historial de Tutorados</h4>
        </header>
        <div class="card-body">
          <div id="historial-tutorados-list" class="assigned-list-container">
            <span class="loading-text">
              <i class="fa-solid fa-spinner fa-spin" style="margin-right:4px;"></i>
              Cargando historial...
            </span>
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Carga datos históricos para la vista de consulta
   * @param {string} entityType - Tipo de entidad ('docente', 'alumno', etc.)
   * @param {number|string} entityId - ID de la entidad
   * @returns {Promise<Array>} Lista de registros históricos
   */
  async loadHistorialData(entityType, entityId) {
    try {
      // 🔹 Implementación futura: consultar asignaciones activas e inactivas
      // Por ahora retorna array vacío (se puede extender con llamada a API)
      
      if (!window.electronAPI?.obtenerHistorialTutorados) {
        console.warn('[tutorados] API de historial no disponible');
        return [];
      }
      
      const res = await window.electronAPI.obtenerHistorialTutorados({ 
        docenteId: entityId 
      });
      
      return res?.success ? res.data : [];
      
    } catch (error) {
      console.error('[tutorados] Error cargando historial:', error);
      return [];
    }
  }
};