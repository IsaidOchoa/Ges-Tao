// src/renderer/components/modals/AssignmentModal/relations/consult/ConsultRenderer.js

import { DataTable } from '../../../../DataTable/DataTable.js';

export class ConsultRenderer {
  constructor({ api, stateManager, container }) {
    this.api = api;
    this.stateManager = stateManager;
    this.container = container;
    this.dataTable = null;
    
    // Bind del método para poder remover el listener si es necesario
    this.handleExpandEvent = this.handleExpandEvent.bind(this);
  }

  async render() {
    const { entityType, entityId } = this.stateManager.context || {};
    
    console.log('🚀 [ConsultRenderer] Renderizando para:', { entityType, entityId });
    
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

    const columns = [{ key: 'descripcion', label: 'Periodo Académico' }];

    // ️ CLAVE: No pasar onExpandAction para que no aparezca el botón "Gestionar"
    this.dataTable = new DataTable({
      tbodyId: 'historial-tbody',
      columns: columns,
      expandable: true,
      actions: false,
      // ❌ NO pasar onExpandAction aquí
    });

    await this.loadData();

    // 🔥 ESCUCHAR EL EVENTO GLOBAL
    console.log(' [ConsultRenderer] Agregando listener para table:rowExpanded');
    this.container.addEventListener('table:rowExpanded', this.handleExpandEvent);
  }

  handleExpandEvent(e) {
    const { rowId, isExpanded } = e.detail;
    console.log('📡 [ConsultRenderer] Evento recibido:', { rowId, isExpanded });
    
    if (isExpanded) {
      const { entityType, entityId } = this.stateManager.context || {};
      console.log('🔍 [ConsultRenderer] Cargando detalles para periodo:', rowId);
      this.loadPeriodDetails(rowId, entityType, entityId);
    }
  }

  async loadData() {
    const { entityType, entityId } = this.stateManager.context || {};
    
    try {
      console.log('📡 [ConsultRenderer] Llamando a obtenerPeriodosDeEntidad:', { entityType, entityId });
      const res = await this.api.obtenerPeriodosDeEntidad({ entityType, entityId });
      const periodos = res?.success ? res.data : [];
      
      console.log('📊 [ConsultRenderer] Periodos recibidos:', periodos.length);
      
      if (periodos.length === 0) {
        this.container.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem; color: var(--text-muted); font-style: italic; background: var(--bg-white); border-radius: 10px; border: 1px dashed var(--border-color);">
            <i class="fa-regular fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
            Esta entidad no tiene historial de periodos asignados.
          </div>`;
        return;
      }

      periodos.sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || ''));
      
      this.dataTable.setData(periodos);
      
    } catch (error) {
      console.error('❌ [ConsultRenderer] Error cargando historial:', error);
      this.container.innerHTML = '<div class="error-text" style="padding: 2rem; text-align: center;">Error al cargar el historial.</div>';
    }
  }

  async loadPeriodDetails(rowId, entityType, entityId) {
    console.log('🔎 [ConsultRenderer] loadPeriodDetails llamado con:', { rowId, entityType, entityId });
    
    //Buscar por id, clave o descripción
    const period = this.dataTable.data.find(p => 
      String(p.id) === String(rowId) || 
      String(p.clave) === String(rowId) || 
      String(p.descripcion) === String(rowId)
    );
    
    if (!period) {
      console.error('❌ [ConsultRenderer] Periodo no encontrado para rowId:', rowId);
      console.log('🔍 [ConsultRenderer] Datos disponibles:', this.dataTable.data);
      return;
    }

    console.log('✅ [ConsultRenderer] Periodo encontrado:', period);

    const summaryContainer = document.getElementById(`summary-${rowId}`);
    if (!summaryContainer) {
      console.error('❌ [ConsultRenderer] Contenedor de chips no encontrado:', `summary-${rowId}`);
      return;
    }

    summaryContainer.innerHTML = '<span class="chip">⏳ Cargando detalles...</span>';

    try {
      let eeInfo = null;
      let tutorInfo = null;

      console.log('📡 [ConsultRenderer] Consultando APIs para periodo ID:', period.id);

      if (entityType === 'docente') {
        const eeRes = await this.api.obtenerEEDelDocente({ docenteId: entityId, periodoId: period.id });
        eeInfo = eeRes?.success ? eeRes.data : [];
        console.log('📚 [ConsultRenderer] EE del docente:', eeInfo);
        
        const tutRes = await this.api.obtenerTutorados({ docenteId: entityId, periodoId: period.id });
        tutorInfo = tutRes?.success ? tutRes.data : [];
        console.log('👥 [ConsultRenderer] Tutorados:', tutorInfo);
      } 
      else if (entityType === 'alumno') {
        const tutRes = await this.api.obtenerTutorDeAlumno({ alumnoId: entityId, periodoId: period.id });
        tutorInfo = tutRes?.success ? tutRes.data : [];
        console.log('👨‍🏫 [ConsultRenderer] Tutor del alumno:', tutorInfo);
        
        const eeRes = await this.api.obtenerEEDeAlumno({ alumnoId: entityId });
        eeInfo = eeRes?.success ? eeRes.data.filter(e => String(e.periodo_id) === String(period.id) || e.periodo === period.descripcion) : [];
        console.log('📚 [ConsultRenderer] EE del alumno (filtradas):', eeInfo);
      }
      else if (entityType === 'ee') {
        const docRes = await this.api.obtenerDocenteDeEE({ eeId: entityId, periodoId: period.id });
        eeInfo = docRes?.success ? docRes.data : [];
        console.log('👨‍🏫 [ConsultRenderer] Docente de la EE:', eeInfo);
      }

      console.log('🎨 [ConsultRenderer] Renderizando chips...');
      this.renderChips(summaryContainer, entityType, eeInfo, tutorInfo);

    } catch (error) {
      console.error('❌ [ConsultRenderer] Error cargando detalles del periodo:', error);
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
      const count = tutorInfo ? tutorInfo.length : 0;
      html += `<span class="chip"><i class="fa-solid fa-users"></i> ${count} tutorado${count !== 1 ? 's' : ''}</span>`;
    }

    container.innerHTML = html;
    console.log('✅ [ConsultRenderer] Chips renderizados:', html);
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    // Limpiar listener al destruir
    this.container.removeEventListener('table:rowExpanded', this.handleExpandEvent);
    console.log('[ConsultRenderer] Listener removido');
  }
}