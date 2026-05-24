export const relacionAlumnoEE = {
  tabId: 'alumno-ee',
  label: 'EE Inscritas',
  compatibleWith: ['alumno'],
  workspaceConfig: { modes: ['gestionar', 'consultar'], priority: 2, sectionTitle: 'Experiencias Educativas' },

  renderWorkspace(context, periodId, mode) {
    if (mode === 'gestionar') {
      return `
        <section class="workspace-card" data-relation="alumno-ee">
          <header class="card-header">
            <h4>📚 ${this.workspaceConfig.sectionTitle}</h4>
            ${periodId ? `<span class="badge-period">${periodId}</span>` : ''}
          </header>
          <div class="card-body">
            <p class="summary-text">Administra las materias en las que el alumno está inscrito.</p>
            <div class="card-actions">
              <button class="btn btn-sm btn-primary">➕ Asignar EE</button>
              <button class="btn btn-sm btn-secondary">📋 Ver Inscritos</button>
            </div>
          </div>
        </section>`;
    }
    return `
      <section class="workspace-card" data-relation="alumno-ee">
        <header class="card-header"><h4>📜 Historial Académico</h4></header>
        <div class="card-body"><p class="summary-text">2024: Programación, Bases de Datos | 2023: Física</p></div>
      </section>`;
  }
};