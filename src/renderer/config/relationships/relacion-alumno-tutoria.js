export const relacionAlumnoTutoria = {
  tabId: 'alumno-tutoria',
  label: 'Tutoría',
  compatibleWith: ['alumno'], // Solo visible para Alumnos
  workspaceConfig: { modes: ['gestionar', 'consultar'], priority: 1, sectionTitle: 'Tutor Académico' },

  renderWorkspace(context, periodId, mode) {
    if (mode === 'gestionar') {
      return `
        <section class="workspace-card" data-relation="alumno-tutoria">
          <header class="card-header">
            <h4>👨‍ ${this.workspaceConfig.sectionTitle}</h4>
            ${periodId ? `<span class="badge-period">${periodId}</span>` : ''}
          </header>
          <div class="card-body">
            <p class="summary-text">Gestiona el tutor académico asignado a este alumno.</p>
            <div class="summary-stats">
              <span class="stat-item"><strong>Dr. Pérez</strong> (Actual)</span>
            </div>
            <div class="card-actions">
              <button class="btn btn-sm btn-secondary">🔄 Cambiar Tutor</button>
              <button class="btn btn-sm btn-primary">👁️ Ver Historial</button>
            </div>
          </div>
        </section>`;
    }
    return `
      <section class="workspace-card" data-relation="alumno-tutoria">
        <header class="card-header"><h4>📜 Historial de Tutores</h4></header>
        <div class="card-body"><p class="summary-text">Ago-Dic23: Lic. López | Ago-Dic24: Dr. Pérez</p></div>
      </section>`;
  }
};