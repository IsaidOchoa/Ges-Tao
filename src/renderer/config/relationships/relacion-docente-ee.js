export const relacionDocenteEE = {
  tabId: 'ee_asignadas',
  label: '📚 EE Asignadas',
  compatibleWith: ['docente', 'ee', 'periodo'],
  requiresPeriod: true,

  getContextInfo(context) {
    const labels = {
      docente: { header: `Asignar Experiencias Educativas a: ${context.entityName}`, action: 'Asignar EE', target: 'EE' },
      ee: { header: `Asignar Docentes a: ${context.entityName}`, action: 'Asignar Docente', target: 'Docente' },
      periodo: { header: `Gestionar en: ${context.entityName}`, action: 'Asignar', target: 'Entidad' }
    };
    return labels[context.entityType] || labels.docente;
  },

  async loadData(context) {
    if (!context.periodId) {
      const res = await window.electronAPI.listarPeriodosSelect();
      return { needsPeriod: true, periodos: res?.success ? res.data : [] };
    }
    try {
      if (context.entityType === 'docente') {
        const [asig, disp] = await Promise.all([
          window.electronAPI.obtenerEEDelDocente({ docenteId: context.entityId, periodoId: context.periodId }),
          window.electronAPI.listarEEDisponibles({ periodoId: context.periodId, excludeAsignadasA: context.entityId })
        ]);
        return {
          assigned: asig?.success ? asig.data.map(e => ({ id: e.id, label: `${e.clave_ee} - ${e.nombre}`, sublabel: `${e.carga_horaria}h` })) : [],
          available: disp?.success ? disp.data.map(e => ({ value: e.id, label: `${e.clave_ee} - ${e.nombre}` })) : [],
          mode: 'docente', currentPeriod: context.periodId
        };
      }
      if (context.entityType === 'ee') {
        const disp = await window.electronAPI.listarDocentesSelect({ periodoId: context.periodId });
        return {
          assigned: [],
          available: disp?.success ? disp.data.map(d => ({ value: d.id, label: `${d.codigo} - ${d.nombres}` })) : [],
          mode: 'ee', currentPeriod: context.periodId
        };
      }
      return { assigned: [], available: [], mode: 'unknown' };
    } catch (e) { return { error: e.message, assigned: [], available: [] }; }
  },

  render(data, context) {
    if (data.error) return `<div style="padding:1rem;color:var(--danger-color)">❌ ${data.error}</div>`;
    if (data.needsPeriod) {
      return `<div style="text-align:center;padding:2rem">
        <p>📅 Selecciona un periodo</p>
        <select id="modal-period-selector" class="form-select" style="width:100%;padding:8px">
          <option value="">Seleccionar...</option>
          ${(data.periodos||[]).map(p => `<option value="${p.id}">${p.clave}</option>`).join('')}
        </select>
      </div>`;
    }
    const info = this.getContextInfo(context);
    const { assigned, available, mode } = data;
    return `
      <div style="margin-bottom:1rem"><h4>${info.header}</h4></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
        <div>
          <h5>✅ Asignados (${assigned.length})</h5>
          ${assigned.length ? assigned.map(a => `
            <div style="display:flex;justify-content:space-between;padding:8px;margin:4px 0;background:var(--bg-card);border-radius:4px">
              <span>${a.label}</span>
              <button data-action="remove" data-id="${a.id}" style="background:none;border:none;color:var(--danger-color);cursor:pointer">✕</button>
            </div>`).join('') : '<p style="color:var(--text-muted)">Sin asignaciones</p>'}
        </div>
        <div style="background:var(--bg-card);padding:1rem;border-radius:8px">
          <h5>🔗 ${info.action}</h5>
          ${available.length ? `
            <select id="select-target" class="form-select" style="width:100%;padding:8px;margin-bottom:0.75rem">
              <option value="">Seleccionar ${info.target}...</option>
              ${available.map(a => `<option value="${a.value}">${a.label}</option>`).join('')}
            </select>
            <button id="btn-assign" style="width:100%;padding:10px;background:var(--accent-color);color:white;border:none;border-radius:6px;cursor:pointer">✨ ${info.action}</button>
          ` : '<p style="color:var(--text-muted)">🚫 No hay disponibles</p>'}
        </div>
      </div>`;
  }
};