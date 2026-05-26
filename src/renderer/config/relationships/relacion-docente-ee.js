// src/renderer/config/relationships/relacion-docente-ee.js
import docenteEETemplate from './templates/docente-ee-form.html';

export const relacionDocenteEE = {
  tabId: 'ee_asignadas',
  label: '📚 EE Asignadas',
  compatibleWith: ['docente', 'ee', 'periodo'],
  description: 'Gestiona las experiencias educativas asignadas a este docente',

  // Configuración para AssignmentModal
  workspaceConfig: { 
    modes: ['gestionar', 'consultar'], 
    priority: 1 
  },

  // Contexto estático
  getContextInfo(context) {
    return {
      header: `Experiencias Educativas de: ${context.entityName || 'Docente'}`,
      entityName: context.entityName || 'Dr. Pérez',
      entityType: 'docente'
    };
  },

  // DATOS FALSOS (MOCK) PARA PRUEBA VISUAL
  async loadData(context) {
    console.log('🎨 [DOCENTE-EE] Cargando datos visuales de prueba...');
    await new Promise(r => setTimeout(r, 500));

    return {
      hasPeriodSelected: true,
      selectedPeriodId: 1,
      selectedPeriodName: 'AGO-DIC24',
      periodos: [
        { id: 1, clave: 'AGO-DIC24', descripcion: 'Agosto 2024 - Dic 2024' },
        { id: 2, clave: 'FEB-JUL25', descripcion: 'Febrero 2025 - Julio 2025' }
      ],
      availableEE: [
        { value: 101, label: 'Programación Orientada a Objetos' },
        { value: 102, label: 'Base de Datos Avanzadas' },
        { value: 103, label: 'Ingeniería de Software' }
      ],
      hasAssigned: true,
      assigned: [
        { id: 1, periodoId: 1, periodo: 'AGO-DIC24', eeNombre: 'Programación Orientada a Objetos', eeClave: 'POO-101', cargaHoraria: 4 },
        { id: 2, periodoId: 1, periodo: 'AGO-DIC24', eeNombre: 'Base de Datos', eeClave: 'BD-200', cargaHoraria: 8 },
        { id: 3, periodoId: 2, periodo: 'FEB-JUL24', eeNombre: 'Redes de Computadoras', eeClave: 'NET-305', cargaHoraria: 4 }
      ]
    };
  },

  // Render principal (NO async para evitar [object Promise])
  render(data, context) {
    const info = this.getContextInfo(context);
    const templateData = { ...info, ...data };
    return this.renderTemplate(docenteEETemplate, templateData);
  },

  // Motor de plantillas
  renderTemplate(template, data) {
    let html = template;
    html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, (m, v, b1, b2) => data[v] ? b1 : b2);
    html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (m, v, b) => data[v] ? b : '');
    html = html.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (m, arrName, itemTpl) => {
      const arr = data[arrName] || [];
      return arr.map(item => {
        let h = itemTpl;
        Object.keys(item).forEach(k => h = h.replace(new RegExp(`{{${k}}}`, 'g'), item[k] || ''));
        return h;
      }).join('');
    });
    Object.keys(data).forEach(k => {
      if (typeof data[k] !== 'object') html = html.replace(new RegExp(`{{${k}}}`, 'g'), data[k] || '');
    });
    return html.replace(/{{[^}]+}}/g, '').trim();
  },

  // =========================================
  // ADAPTADORES PARA AssignmentModal v2.0
  // =========================================

  // Card operativa para modo "gestionar"
  renderOperationalCard(context, periodId, handlers) {
    if (!periodId) {
      return `
        <section class="workspace-card relation-card disabled" data-relation="${this.tabId}">
          <header class="card-header"><h4>${this.label}</h4></header>
          <div class="card-body">
            <p class="summary-text">Seleccione un periodo para gestionar EE</p>
          </div>
        </section>`;
    }

    return `
      <section class="workspace-card relation-card" data-relation="${this.tabId}">
        <header class="card-header">
          <h4>${this.label}</h4>
          <span class="badge-period">${periodId}</span>
        </header>
        <div class="card-body">
          <p class="summary-text">Asigna una nueva experiencia educativa en este periodo</p>
          <div class="relation-form">
            <select class="form-select" id="select-ee-${context.entityId}" data-placeholder="Buscar EE...">
              <option value="">Seleccionar EE...</option>
            </select>
          </div>
          <div class="card-actions">
            <button class="btn btn-sm btn-primary" data-action="assign" data-relation="${this.tabId}">
              <i class="fa-solid fa-link"></i> Asignar EE
            </button>
          </div>
        </div>
      </section>
    `;
  },

  // Vista para modo "consultar" (histórico)
  renderWorkspace(context, periodId, mode) {
    if (mode === 'consultar') {
      return `
        <section class="workspace-card" data-relation="${this.tabId}">
          <header class="card-header">
            <h4>📚 Historial de EE Asignadas</h4>
          </header>
          <div class="card-body">
            <p class="summary-text">Todas las experiencias educativas asignadas a través del tiempo</p>
            <div id="historial-ee-list" class="historial-list">
              <span class="loading-text">Cargando histórico...</span>
            </div>
          </div>
        </section>
      `;
    }
    return this.renderOperationalCard(context, periodId, {});
  },

  // Cargar datos para vista histórica (mock para desarrollo)
  async loadHistorialData(entityType, entityId) {
    // TODO: Reemplazar con llamada real al backend
    // const res = await window.electronAPI.obtenerHistorialEE({ entityType, entityId });
    
    // Mock para desarrollo:
    return [
      { periodo: 'AGO-DIC24', ee: 'Programación Orientada a Objetos', clave: 'POO-101', carga: 4 },
      { periodo: 'AGO-DIC24', ee: 'Base de Datos', clave: 'BD-200', carga: 8 },
      { periodo: 'FEB-JUL24', ee: 'Redes de Computadoras', clave: 'NET-305', carga: 4 }
    ];
  }
};