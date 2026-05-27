//config/relationships/relacion-docente-tutorados.js
export const relacionDocenteTutorados = {
  tabId: 'tutorados',
  label: '‍🎓 Tutorados',
  description: 'Asigna alumnos a tutelar en este periodo',
  compatibleWith: ['docente'],
  workspaceConfig: { modes: ['gestionar', 'consultar'], priority: 2 },

  renderOperationalCard: (context, periodId) => {
    if (!periodId) {
      return `<section class="workspace-card relation-card disabled" data-relation="tutorados">
        <header class="card-header"><h4>👨‍🎓 Tutorados</h4></header>
        <div class="card-body"><p class="summary-text">Selecciona un periodo para gestionar tutorados.</p></div>
      </section>`;
    }
    return `
      <section class="workspace-card relation-card" data-relation="tutorados">
        <header class="card-header">
          <h4>👨‍ Tutorados</h4>
          <span class="badge badge-counter" id="counter-tutorados-${context.entityId}" style="background:rgba(52,152,219,0.15); color:#3498db; padding:2px 8px; border-radius:12px; font-size:0.8rem; font-weight:700;">0</span>
        </header>
        <div class="card-body">
          <p class="summary-text">Selecciona un alumno para asignarlo como tutorado.</p>
          <select class="form-select form-select-sm" id="select-tutorado-${context.entityId}" style="width:100%; margin-bottom:0.5rem;">
            <option value="">Cargando alumnos disponibles...</option>
          </select>
          <button class="btn btn-sm btn-primary" style="width:100%;" data-action="assign" data-relation="tutorados">
            <i class="fa-solid fa-user-plus"></i> Asignar Tutorado
          </button>
        </div>
      </section>
    `;
  },

  renderWorkspace: (context, periodId, mode) => {
    return mode === 'consultar' ? `<section class="workspace-card" data-relation="tutorados"><header class="card-header"><h4>‍🎓 Historial de Tutorados</h4></header><div class="card-body"><div id="historial-tutorados-list"><span class="loading-text">Cargando...</span></div></div></section>` : null;
  },

  async loadHistorialData(entityType, entityId) { return []; }
};