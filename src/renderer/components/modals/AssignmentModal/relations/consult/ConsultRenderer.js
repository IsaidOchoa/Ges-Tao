// src/renderer/components/modals/AssignmentModal/relations/consult/ConsultRenderer.js

import { DataTable } from '../../../../DataTable/DataTable.js'; // Ajusta la ruta según tu estructura

export class ConsultRenderer {
  constructor({ api, stateManager, container }) {
    this.api = api;
    this.stateManager = stateManager;
    this.container = container;
    this.dataTable = null;
  }

  async render() {
    const { entityType, entityId } = this.stateManager.context || {};
    
    // 1. Estructura base que espera tu DataTable
    this.container.innerHTML = `
      <div class="section-header">
        <h4>Histórico de Asignaciones</h4>
        <span class="section-desc">Periodos en los que esta entidad ha tenido relaciones activas</span>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <tbody id="historial-tbody"></tbody>
        </table>
      </div>
    `;

    // 2. Configuración de columnas para el historial (solo mostramos el periodo)
    const columns = [
      { key: 'descripcion', label: 'Periodo Académico' }
    ];

    // 3. Instanciar tu DataTable existente
    this.dataTable = new DataTable({
      tbodyId: 'historial-tbody',
      columns: columns,
      expandable: true,
      actions: false, // No necesitamos menú contextual de 3 puntos en el historial
      onExpand: (rowId, isExpanded) => this.handleExpand(rowId, isExpanded, entityType, entityId)
    });

    // 4. Cargar datos
    await this.loadData();
  }

  async loadData() {
    const { entityType, entityId } = this.stateManager.context || {};
    
    try {
      // Obtener SOLO los periodos asignados a esta entidad
      const res = await this.api.obtenerPeriodosDeEntidad({ entityType, entityId });
      const periodos = res?.success ? res.data : [];
      
      if (periodos.length === 0) {
        this.container.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-style: italic; background: var(--bg-white); border-radius: 10px; border: 1px dashed var(--border-color);">
            <i class="fa-regular fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
            Esta entidad no tiene historial de periodos asignados.
          </div>`;
        return;
      }

      // Ordenar por fecha de inicio (descendente)
      periodos.sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || ''));
      
      // Alimentar la tabla
      this.dataTable.setData(periodos);
      
    } catch (error) {
      console.error('Error cargando historial:', error);
      this.container.innerHTML = '<div class="error-text" style="padding: 2rem; text-align: center;">Error al cargar el historial.</div>';
    }
  }

  async handleExpand(rowId, isExpanded, entityType, entityId) {
    // Solo cargamos datos cuando se expande (isExpanded === true)
    if (!isExpanded) return;

    const period = this.dataTable.data.find(p => String(p.id) === String(rowId));
    if (!period) return;

    const summaryContainer = document.getElementById(`summary-${rowId}`);
    if (!summaryContainer) return;

    // Mostrar estado de carga en los chips
    summaryContainer.innerHTML = '<span class="chip">⏳ Cargando detalles...</span>';

    try {
      let eeInfo = null;
      let tutorInfo = null;

      // Consultas específicas según el contexto
      if (entityType === 'docente') {
        const eeRes = await this.api.obtenerEEDelDocente({ docenteId: entityId, periodoId: period.id });
        eeInfo = eeRes?.success ? eeRes.data : [];
        
        const tutRes = await this.api.obtenerTutorados({ docenteId: entityId, periodoId: period.id });
        tutorInfo = tutRes?.success ? tutRes.data : [];
      } 
      else if (entityType === 'alumno') {
        const tutRes = await this.api.obtenerTutorDeAlumno({ alumnoId: entityId, periodoId: period.id });
        tutorInfo = tutRes?.success ? tutRes.data : [];
        
        const eeRes = await this.api.obtenerEEDeAlumno({ alumnoId: entityId });
        // Filtramos el historial de EE por este periodo específico
        eeInfo = eeRes?.success ? eeRes.data.filter(e => String(e.periodo_id) === String(period.id) || e.periodo === period.descripcion) : [];
      }
      else if (entityType === 'ee') {
        const docRes = await this.api.obtenerDocenteDeEE({ eeId: entityId, periodoId: period.id });
        eeInfo = docRes?.success ? docRes.data : []; // Aquí 'eeInfo' representa al docente asignado
      }

      this.renderChips(summaryContainer, entityType, eeInfo, tutorInfo);

    } catch (error) {
      console.error('Error cargando detalles del periodo:', error);
      summaryContainer.innerHTML = '<span class="chip" style="color: var(--danger-color); border-color: var(--danger-color);">Error al cargar</span>';
    }
  }

  renderChips(container, entityType, eeInfo, tutorInfo) {
    let html = '';

    // 1. EE (o Docente si el contexto es EE)
    if (entityType === 'ee') {
      if (eeInfo && eeInfo.length > 0) {
        const doc = eeInfo[0];
        const nombre = doc.nombre_completo || `${doc.tratamiento || ''} ${doc.apellido_paterno || ''}`.trim();
        html += `<span class="chip accent"><i class="fa-solid fa-chalkboard-user"></i> ${this.escapeHtml(nombre)}</span>`;
      } else {
        html += `<span class="chip"><i class="fa-solid fa-chalkboard-user"></i> Sin docente asignado</span>`;
      }
    } else {
      // Contexto Docente o Alumno
      if (eeInfo && eeInfo.length > 0) {
        const nombres = eeInfo.map(e => this.escapeHtml(e.nombre)).join(', ');
        html += `<span class="chip accent" title="${nombres}"><i class="fa-solid fa-book-open"></i> ${nombres}</span>`;
      } else {
        html += `<span class="chip"><i class="fa-solid fa-book-open"></i> Sin EE asignada</span>`;
      }
    }

    // 2. Tutorados (o Tutor si el contexto es Alumno)
    if (entityType === 'alumno') {
      if (tutorInfo && tutorInfo.length > 0) {
        const tutor = tutorInfo[0];
        const nombre = tutor.nombre_completo || `${tutor.tratamiento || ''} ${tutor.apellido_paterno || ''}`.trim();
        html += `<span class="chip accent"><i class="fa-solid fa-user-graduate"></i> Tutor: ${this.escapeHtml(nombre)}</span>`;
      } else {
        html += `<span class="chip"><i class="fa-solid fa-user-graduate"></i> Sin tutor asignado</span>`;
      }
    } else {
      // Contexto Docente o EE
      const count = tutorInfo ? tutorInfo.length : 0;
      html += `<span class="chip"><i class="fa-solid fa-users"></i> ${count} tutorado${count !== 1 ? 's' : ''}</span>`;
    }

    container.innerHTML = html;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}