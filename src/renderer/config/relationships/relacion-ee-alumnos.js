export const relacionEEAlumnos = {
  tabId: 'ee-alumnos',
  label: '👥 Alumnos',
  compatibleWith: ['ee'],
  workspaceConfig: { modes: ['gestionar', 'consultar'], priority: 2, sectionTitle: 'Alumnos Inscritos' },

  renderWorkspace(context, periodId, mode) {
    if (mode === 'gestionar') {
      return `
        <section class="workspace-card" data-relation="ee-alumnos">
          <header class="card-header">
            <h4>👥 ${this.workspaceConfig.sectionTitle}</h4>
            ${periodId ? `<span class="badge-period">${periodId}</span>` : ''}
          </header>
          <div class="card-body">
            <p class="summary-text">Gestiona la lista de alumnos inscritos en esta materia.</p>
            <div class="summary-stats"><span class="stat-item"><strong>32</strong> inscritos</span></div>
            <div class="card-actions">
              <button class="btn btn-sm btn-primary">➕ Agregar Alumno</button>
              <button class="btn btn-sm btn-secondary">📋 Ver Lista</button>
            </div>
          </div>
        </section>`;
    }
    return `
      <section class="workspace-card" data-relation="ee-alumnos">
        <header class="card-header"><h4>📜 Histórico de Grupos</h4></header>
        <div class="card-body"><p class="summary-text">2024: 32 alumnos | 2023: 28 alumnos</p></div>
      </section>`;
  }
};