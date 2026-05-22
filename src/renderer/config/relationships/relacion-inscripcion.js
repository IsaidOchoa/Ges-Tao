export const relacionInscripcion = {
  tabId: 'inscripciones',
  label: '📝 Inscripciones EE',
  compatibleWith: ['alumno', 'ee', 'periodo'],
  requiresPeriod: true,

  getContextInfo(context) {
    const labels = {
      alumno: { header: `Inscribir a EE: ${context.entityName}`, action: 'Inscribir', target: 'EE' },
      ee: { header: `Alumnos en: ${context.entityName}`, action: 'Inscribir alumno', target: 'Alumno' }
    };
    return labels[context.entityType] || labels.alumno;
  },

  async loadData(context) {
    if (!context.periodId) {
      const res = await window.electronAPI.listarPeriodosSelect();
      return { needsPeriod: true, periodos: res?.success ? res.data : [] };
    }
    try {
      if (context.entityType === 'alumno') {
        const [insc, disp] = await Promise.all([
          window.electronAPI.obtenerInscritosEnEE({ alumnoId: context.entityId, periodoId: context.periodId }),
          window.electronAPI.listarEEDisponibles({ periodoId: context.periodId })
        ]);
        return {
          assigned: insc?.success ? insc.data.map(i => ({ id: i.ee_id, label: `${i.clave_ee} - ${i.nombre}` })) : [],
          available: disp?.success ? disp.data.map(e => ({ value: e.id, label: `${e.clave_ee} - ${e.nombre}` })) : [],
          mode: 'alumno', currentPeriod: context.periodId
        };
      }
      if (context.entityType === 'ee') {
        const [insc, disp] = await Promise.all([
          window.electronAPI.obtenerInscritosEnEE({ eeId: context.entityId, periodoId: context.periodId }),
          window.electronAPI.listarAlumnosParaInscripcion({ eeId: context.entityId, periodoId: context.periodId })
        ]);
        return {
          assigned: insc?.success ? insc.data.map(a => ({ id: a.id, label: `${a.matricula} - ${a.nombres}` })) : [],
          available: disp?.success ? disp.data.map(a => ({ value: a.id, label: `${a.matricula} - ${a.nombres}` })) : [],
          mode: 'ee', currentPeriod: context.periodId
        };
      }
      return { assigned: [], available: [] };
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
    const { assigned, available } = data;
    return `
      <div style="margin-bottom:1rem"><h4>${info.header}</h4></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
        <div>
          <h5>✅ Inscritos (${assigned.length})</h5>
          ${assigned.length ? assigned.map(a => `
            <div style="display:flex;justify-content:space-between;padding:8px;margin:4px 0;background:var(--bg-card);border-radius:4px">
              <span>${a.label}</span>
              <button data-action="remove" data-id="${a.id}" style="background:none;border:none;color:var(--danger-color);cursor:pointer">✕</button>
            </div>`).join('') : '<p style="color:var(--text-muted)">Sin inscripciones</p>'}
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