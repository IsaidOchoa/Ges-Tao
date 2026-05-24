// src/renderer/config/relationships/relacion-docente-ee.js
import docenteEETemplate from './templates/docente-ee-form.html';

export const relacionDocenteEE = {
  tabId: 'ee_asignadas',
  label: '📚 EE Asignadas',
  compatibleWith: ['docente', 'ee', 'periodo'],

  // Contexto estático
  getContextInfo(context) {
    return {
      header: `Experiencias Educativas de: ${context.entityName || 'Docente'}`,
      entityName: context.entityName || 'Dr. Pérez',
      entityType: 'docente'
    };
  },

  // ✅ DATOS FALSOS (MOCK) PARA PRUEBA VISUAL
  async loadData(context) {
    console.log('🎨 [DOCENTE-EE] Cargando datos visuales de prueba...');
    
    // Simulamos una espera de carga
    await new Promise(r => setTimeout(r, 500));

    return {
      // Filtro: Forzamos que se vea seleccionado para mostrar el diseño completo
      hasPeriodSelected: true,
      selectedPeriodId: 1,
      selectedPeriodName: 'AGO-DIC24',
      
      // Lista de periodos para el filtro
      periodos: [
        { id: 1, clave: 'AGO-DIC24', descripcion: 'Agosto 2024 - Dic 2024' },
        { id: 2, clave: 'FEB-JUL25', descripcion: 'Febrero 2025 - Julio 2025' }
      ],

      // Lista de EE disponibles para el dropdown derecho
      availableEE: [
        { value: 101, label: 'Programación Orientada a Objetos' },
        { value: 102, label: 'Base de Datos Avanzadas' },
        { value: 103, label: 'Ingeniería de Software' }
      ],

      // Datos para la tabla de asignados
      hasAssigned: true,
      assigned: [
        { 
          id: 1, 
          periodoId: 1, 
          periodo: 'AGO-DIC24', 
          eeNombre: 'Programación Orientada a Objetos', 
          eeClave: 'POO-101',
          cargaHoraria: 4 
        },
        { 
          id: 2, 
          periodoId: 1, 
          periodo: 'AGO-DIC24', 
          eeNombre: 'Base de Datos', 
          eeClave: 'BD-200',
          cargaHoraria: 8 
        },
        { 
          id: 3, 
          periodoId: 2, 
          periodo: 'FEB-JUL24', 
          eeNombre: 'Redes de Computadoras', 
          eeClave: 'NET-305',
          cargaHoraria: 4 
        }
      ]
    };
  },

  // ✅ IMPORTANTE: NO es async para evitar [object Promise]
  render(data, context) {
    const info = this.getContextInfo(context);
    const templateData = { ...info, ...data };
    return this.renderTemplate(docenteEETemplate, templateData);
  },

  // Motor de plantillas
  renderTemplate(template, data) {
    let html = template;
    // If/Else
    html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, (m, v, b1, b2) => data[v] ? b1 : b2);
    html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (m, v, b) => data[v] ? b : '');
    // Loops
    html = html.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (m, arrName, itemTpl) => {
      const arr = data[arrName] || [];
      return arr.map(item => {
        let h = itemTpl;
        Object.keys(item).forEach(k => h = h.replace(new RegExp(`{{${k}}}`, 'g'), item[k] || ''));
        return h;
      }).join('');
    });
    // Variables
    Object.keys(data).forEach(k => {
      if (typeof data[k] !== 'object') html = html.replace(new RegExp(`{{${k}}}`, 'g'), data[k] || '');
    });
    return html.replace(/{{[^}]+}}/g, '').trim();
  }
};