// src/renderer/config/relationships/relacion-docente-ee.js

export const relacionDocenteEE = {
  tabId: 'ee_asignadas',
  label: '📚 Experiencias Educativas',
  description: 'Asigna materias que el docente impartirá en este periodo',
  compatibleWith: ['docente'],
  workspaceConfig: { modes: ['gestionar', 'consultar'], priority: 1 },

  /**
   * Renderiza la card operativa para gestionar EE asignadas
   */
  renderOperationalCard: (context, periodId) => {
    if (!periodId) {
      return `
        <section class="workspace-card relation-card disabled" data-relation="ee_asignadas">
          <header class="card-header">
            <h4>📚 Experiencias Educativas</h4>
            <span class="badge badge-counter" style="background:rgba(127,140,141,0.2); color:var(--text-muted); padding:2px 8px; border-radius:12px; font-size:0.8rem;">–</span>
          </header>
          <div class="card-body">
            <p class="summary-text">Selecciona un periodo para gestionar EE.</p>
          </div>
        </section>
      `;
    }

    return `
      <section class="workspace-card relation-card" data-relation="ee_asignadas">
        <header class="card-header">
          <h4>📚 Experiencias Educativas</h4>
          <!-- ✅ CORREGIDO: ID del contador para _updateDocenteCounters -->
          <span class="badge badge-counter" 
                id="counter-ee-${context.entityId}" 
                style="background:rgba(52,152,219,0.15); color:#3498db; padding:2px 8px; border-radius:12px; font-size:0.8rem; font-weight:700; min-width:24px; text-align:center;">
            0
          </span>
        </header>
        <div class="card-body">
          <!-- Selector para asignar nuevas -->
          <div class="form-group" style="margin-bottom: 0.75rem;">
            <label class="form-label" style="font-size:0.8rem; color:var(--text-muted);">Asignar nueva EE:</label>
            <select class="form-select form-select-sm" id="select-ee-${context.entityId}" style="width:100%;">
              <option value="">Cargando...</option>
            </select>
          </div>
          <button class="btn btn-sm btn-primary" style="width:100%; margin-bottom: 1rem;" 
            data-action="assign" data-relation="ee_asignadas">
            <i class="fa-solid fa-link"></i> Asignar Materia
          </button>

          <!-- Lista de ya asignadas en este periodo -->
          <div style="border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
            <label class="form-label" style="font-size:0.8rem; color:var(--text-muted);">Asignadas en este periodo:</label>
            <div id="assigned-ee-list-${context.entityId}" style="display: flex; flex-direction: column; gap: 0.5rem; min-height: 24px;">
              <span style="color: var(--text-muted); font-size: 0.85rem;">Cargando...</span>
            </div>
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Renderiza la vista de historial (pestaña "Consultar")
   */
  renderWorkspace: (context, periodId, mode) => {
    if (mode === 'consultar') {
      return `
        <section class="workspace-card" data-relation="${relacionDocenteEE.tabId}">
          <header class="card-header"><h4>📚 Historial de Docencia</h4></header>
          <div class="card-body">
            <div id="historial-ee-list" class="historial-list">
              <span class="loading-text">Cargando historial...</span>
            </div>
          </div>
        </section>
      `;
    }
    return null;
  },

  /**
   * Carga datos históricos para la vista de consulta
   */
  async loadHistorialData(entityType, entityId) {
    try {
      if (!window.electronAPI?.obtenerHistorialEE) {
        console.warn('[ee_asignadas] API de historial no disponible');
        return [];
      }
      
      const res = await window.electronAPI.obtenerHistorialEE({ docenteId: entityId });
      return res?.success ? res.data : [];
      
    } catch (error) {
      console.error('[ee_asignadas] Error cargando historial:', error);
      return [];
    }
  }
};