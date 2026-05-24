export const relacionEEDocente = {
  tabId: 'ee-docente',
  label: '👨‍🏫 Docente',
  compatibleWith: ['ee'], // Solo visible para EE
  workspaceConfig: { modes: ['gestionar', 'consultar'], priority: 1, sectionTitle: 'Docente Responsable' },

  renderWorkspace(context, periodId, mode) {
    if (mode === 'gestionar') {
      return `
        <section class="workspace-card" data-relation="ee-docente">
          <header class="card-header">
            <h4>👨‍🏫 ${this.workspaceConfig.sectionTitle}</h4>
            ${periodId ? `<span class="badge-period">${periodId}</span>` : ''}
          </header>
          <div class="card-body">
            <p class="summary-text">Asigna el docente titular para esta Experiencia Educativa.</p>
            <div class="summary-stats"><span class="stat-item"><strong>Dr. García</strong> (Titular)</span></div>
            <div class="card-actions">
              <button class="btn btn-sm btn-primary">✏️ Asignar Docente</button>
            </div>
          </div>
        </section>`;
    }
    return `
      <section class="workspace-card" data-relation="ee-docente">
        <header class="card-header"><h4>📜 Historial de Docentes</h4></header>
        <div class="card-body"><p class="summary-text">Ago-Dic24: Dr. García | Ago-Dic23: Mtra. Ruiz</p></div>
      </section>`;
  }
};