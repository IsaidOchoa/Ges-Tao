// src/renderer/config/relationships/relacion-docente-ee.js
import docenteEETemplate from './templates/docente-ee-form.html';

export const relacionDocenteEE = {
  tabId: 'ee_asignadas',
  label: '📚 Experiencias Educativas',
  description: 'Asigna materias que el docente impartirá en este periodo',
  compatibleWith: ['docente'],
  workspaceConfig: { modes: ['gestionar', 'consultar'], priority: 1 },

  // src/renderer/config/relationships/relacion-docente-ee.js
// Dentro de renderOperationalCard:

renderOperationalCard: (context, periodId) => {
  if (!periodId) {
    return `<section class="workspace-card relation-card disabled" data-relation="ee_asignadas">
      <header class="card-header"><h4>📚 Experiencias Educativas</h4></header>
      <div class="card-body"><p class="summary-text">Selecciona un periodo para gestionar EE.</p></div>
    </section>`;
  }

  return `
    <section class="workspace-card relation-card" data-relation="ee_asignadas">
      <header class="card-header">
        <h4>📚 Experiencias Educativas</h4>
        <span class="badge badge-period">${periodId}</span>
      </header>
      <div class="card-body">
        <!-- Selector para asignar nuevas -->
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label" style="font-size:0.8rem; color:#999;">Asignar nueva EE:</label>
          <select class="form-select form-select-sm" id="select-ee-${context.entityId}" style="width:100%;">
            <option value="">Cargando...</option>
          </select>
        </div>
        <button class="btn btn-sm btn-primary" style="width:100%; margin-bottom: 1rem;" 
          data-action="assign" data-relation="ee_asignadas">
          <i class="fa-solid fa-link"></i> Asignar Materia
        </button>

        <!-- ✅ NUEVO: Lista de ya asignadas en este periodo -->
        <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.75rem;">
          <label class="form-label" style="font-size:0.8rem; color:#999;">Asignadas en este periodo:</label>
          <div id="assigned-ee-list-${context.entityId}" style="display: flex; flex-direction: column; gap: 0.5rem; min-height: 24px;">
            <span style="color: #666; font-size: 0.85rem;">Cargando...</span>
          </div>
        </div>
      </div>
    </section>
  `;
},

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

  async loadHistorialData(entityType, entityId) {
    // TODO: Implementar llamada real al backend
    return [];
  }
};