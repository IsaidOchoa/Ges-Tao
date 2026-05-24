// src/renderer/config/relationships/relacion-periodos.js
import periodosTemplate from './templates/periodos-form.html';

export const relacionPeriodos = {
  tabId: 'periodos',
  label: '📅 Periodos', // El nombre de la pestaña
  compatibleWith: ['docente'], // Solo para docentes

  getContextInfo(context) {
    return {
      header: `Periodos Académicos de: ${context.entityName || 'Docente'}`,
      entityName: context.entityName
    };
  },

  // ✅ MOCK DATA (Datos falsos para visualizar)
  async loadData(context) {
    await new Promise(r => setTimeout(r, 300)); // Fake loading

    return {
      // Lista de periodos disponibles para vincular (Dropdown derecho)
      available: [
        { value: 101, label: 'AGO-DIC24 (Agosto - Dic 2024)' },
        { value: 102, label: 'FEB-JUL25 (Febrero - Julio 2025)' },
        { value: 103, label: 'AGO-DIC25 (Agosto - Dic 2025)' }
      ],

      // Lista de periodos ya vinculados (Tabla inferior)
      hasAssigned: true,
      assigned: [
        { 
          id: 1, 
          clave: 'AGO-DIC23', 
          descripcion: 'Agosto 2023 - Diciembre 2023', 
          isActive: false // Se ve gris/inactivo
        },
        { 
          id: 2, 
          clave: 'FEB-JUL24', 
          descripcion: 'Febrero 2024 - Julio 2024', 
          isActive: true // Se ve verde/activo
        },
        { 
          id: 3, 
          clave: 'AGO-DIC24', 
          descripcion: 'Agosto 2024 - Diciembre 2024', 
          isActive: true // Se ve verde/activo
        }
      ],
      // Contador para el badge de resumen
      assignedCount: 2 
    };
  },

  // ⚠️ IMPORTANTE: render NO es async
  render(data, context) {
    const info = this.getContextInfo(context);
    const templateData = { ...info, ...data };
    return this.renderTemplate(periodosTemplate, templateData);
  },

  renderTemplate(template, data) {
    let html = template;
    // Lógica de plantillas (igual que en los otros archivos)
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
  }
};