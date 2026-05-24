// src/renderer/config/relationships/relacion-tutoria.js
import tutoriaTemplate from './templates/tutoria-form.html';

export const relacionTutoria = {
  // ✅ CONFIGURACIÓN BASE (para registro en app.js)
  tabId: 'tutorados',
  label: '👨‍🎓 Tutorados',
  compatibleWith: ['docente', 'alumno'],
  requiresPeriod: false,

  // ✅ NUEVO: Configuración para el sistema de workspace (modal refactorizado)
  workspaceConfig: {
    modes: ['gestionar', 'consultar'], // En qué tabs del modal aparece
    priority: 1, // Orden de renderizado (menor = primero)
    sectionTitle: 'Tutorados', // Título para la tarjeta
    icon: '👨‍🎓' // Icono opcional
  },

  // =========================================
  // MÉTODOS PARA EL SISTEMA ANTIGUO (Compatibilidad)
  // =========================================
  
  getContextInfo(context) {
    if (!context) return { header: 'Tutoría', actionLabel: 'Asignar', entityName: 'Docente' };
    return {
      header: `Asignar alumnos a: ${context.entityName}`,
      actionLabel: 'Asignar Tutorado',
      entityName: context.entityName || 'Docente'
    };
  },

  loadData(context, periodId = null) {
    // Datos de prueba (mock) para desarrollo visual
    return {
      assignedCount: 3,
      entityName: context?.entityName || 'Docente',
      hasAssigned: true,
      assigned: [
        { id: 1, matricula: 'MAT-2024-001', label: 'Carlos Alberto García López' },
        { id: 2, matricula: 'MAT-2024-002', label: 'Laura Sofía Martínez Ruiz' },
        { id: 3, matricula: 'MAT-2023-015', label: 'Miguel Ángel Hernández Castro' }
      ],
      available: [
        { value: 101, label: 'Ana Pérez' },
        { value: 102, label: 'Juan Gómez' }
      ],
      periodId // Pasamos el periodo para filtrar después
    };
  },

  render(data, context) {
    const info = this.getContextInfo(context);
    const templateData = { ...info, ...data };
    return this.renderTemplate(tutoriaTemplate, templateData);
  },
  
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
  // ✅ NUEVOS MÉTODOS PARA EL WORKSPACE (Modal Refactorizado)
  // =========================================

  /**
   * Renderiza contenido PARCIAL para el nuevo modal de 2 columnas
   * @param {Object} context - { entityType, entityId, entityName }
   * @param {string|null} periodId - Periodo activo (filtro global)
   * @param {'gestionar'|'consultar'} mode - Modo del tab
   * @returns {string} HTML parcial de una tarjeta (no página completa)
   */
  renderWorkspace(context, periodId = null, mode = 'gestionar') {
    if (mode === 'gestionar') {
      return this._renderGestionarCard(context, periodId);
    } else if (mode === 'consultar') {
      return this._renderConsultarCard(context);
    }
    return '';
  },

  /**
   * Tarjeta para modo "Gestionar" (acciones, asignaciones activas)
   */
  _renderGestionarCard(context, periodId) {
    const { entityName, entityType } = context;
    
    // Aquí podrías llamar a loadData() si necesitas datos reales
    // Por ahora, placeholder visual para probar la integración
    return `
      <section class="workspace-card" data-relation="tutoria" data-mode="gestionar">
        <header class="card-header">
          <h4>
            <span class="card-icon">${this.workspaceConfig.icon}</span>
            ${this.workspaceConfig.sectionTitle}
          </h4>
          ${periodId ? `<span class="badge-period">📅 ${periodId}</span>` : ''}
        </header>
        
        <div class="card-body">
          <div class="card-summary">
            <p class="summary-text">
              ${entityType === 'docente' 
                ? `Gestiona los alumnos asignados como tutorados a <strong>${entityName}</strong>.`
                : `Gestiona el tutor asignado a este alumno.`
              }
            </p>
            
            <div class="summary-stats">
              <span class="stat-item">
                <strong>3</strong> activos
              </span>
              ${periodId ? `<span class="stat-item">Periodo: ${periodId}</span>` : ''}
            </div>
          </div>
          
          <div class="card-actions">
            <button class="btn btn-sm btn-primary" data-action="assign-tutor" data-relation="tutoria">
              ✨ Asignar Tutorado
            </button>
            <button class="btn btn-sm btn-secondary" data-action="view-tutorados" data-relation="tutoria">
              👁️ Ver Lista
            </button>
          </div>
        </div>
      </section>
    `;
  },

  /**
   * Tarjeta para modo "Consultar" (histórico, resumen)
   */
  _renderConsultarCard(context) {
    return `
      <section class="workspace-card" data-relation="tutoria" data-mode="consultar">
        <header class="card-header">
          <h4>
            <span class="card-icon">📜</span>
            Historial de Tutorías
          </h4>
        </header>
        
        <div class="card-body">
          <div class="historical-summary">
            <p class="summary-text">
              Resumen de tutorados asignados a lo largo del tiempo.
            </p>
            
            <div class="timeline-preview">
              <div class="timeline-item">
                <span class="timeline-period">AGO-DIC24</span>
                <span class="timeline-count">3 tutorados</span>
              </div>
              <div class="timeline-item">
                <span class="timeline-period">FEB-JUL24</span>
                <span class="timeline-count">2 tutorados</span>
              </div>
              <div class="timeline-item">
                <span class="timeline-period">AGO-DIC23</span>
                <span class="timeline-count">4 tutorados</span>
              </div>
            </div>
          </div>
          
          <div class="card-actions">
            <button class="btn btn-sm btn-secondary" data-action="export-historial" data-relation="tutoria">
              📤 Exportar Historial
            </button>
          </div>
        </div>
      </section>
    `;
  },

  // =========================================
  // UTILIDADES PARA ACCIONES (Opcional, para futuro)
  // =========================================
  
  /**
   * Maneja acciones específicas de esta relación
   * @param {string} action - Nombre de la acción (ej: 'assign-tutor')
   * @param {Object} context - Contexto del modal
   * @param {string|null} periodId - Periodo activo
   */
  async handleAction(action, context, periodId = null) {
    console.log(`🎯 [Tutoria] Acción "${action}" para ${context.entityType} #${context.entityId}`);
    
    switch (action) {
      case 'assign-tutor':
        return await this._handleAssignTutor(context, periodId);
      case 'view-tutorados':
        return await this._handleViewTutorados(context, periodId);
      case 'export-historial':
        return await this._handleExportHistorial(context);
      default:
        console.warn(`⚠️ [Tutoria] Acción no implementada: ${action}`);
    }
  },

  async _handleAssignTutor(context, periodId) {
    console.log('🔧 [TODO] Implementar flujo de asignar tutorado');
    // Ejemplo futuro:
    // const res = await window.electronAPI.asignarTutor({ ... });
    // return res?.success;
    return true;
  },

  async _handleViewTutorados(context, periodId) {
    console.log('🔧 [TODO] Implementar vista detallada de tutorados');
    return true;
  },

  async _handleExportHistorial(context) {
    console.log('🔧 [TODO] Implementar exportación de historial');
    return true;
  }
};