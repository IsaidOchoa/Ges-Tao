// src/renderer/config/relationships/relacion-tutoria.js
import tutoriaTemplate from './templates/tutoria-form.html';

export const relacionTutoria = {
  tabId: 'tutorados',
  label: '👨‍🎓 Tutorados',
  compatibleWith: ['docente', 'alumno'],
  requiresPeriod: false,

  // Contexto para el template
  getContextInfo(context) {
    if (!context) return { header: 'Tutoría', actionLabel: 'Asignar', entityName: 'Docente' };
    return {
      header: `Asignar alumnos a: ${context.entityName}`,
      actionLabel: 'Asignar Tutorado',
      entityName: context.entityName || 'Docente'
    };
  },

  // Carga de datos (Con datos falsos para ver diseño)
  loadData(context) {
  // Datos de prueba para ver el diseño
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
    ]
  };
},

  // Renderizado
  render(data, context) {
    const info = this.getContextInfo(context);
    // Unimos info con datos
    const templateData = { ...info, ...data };
    
    return this.renderTemplate(tutoriaTemplate, templateData);
  },
  
  // Motor de templates (Corregido)
  renderTemplate(template, data) {
    let html = template;
    
    // 1. Condicionales {{#if}}...{{else}}...{{/if}}
    html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, (m, v, b1, b2) => data[v] ? b1 : b2);
    
    // 2. Condicionales {{#if}}...{{/if}}
    html = html.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (m, v, b) => data[v] ? b : '');
    
    // 3. Loops {{#each}}...{{/each}}
    html = html.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (m, arrName, itemTpl) => {
      const arr = data[arrName] || [];
      return arr.map(item => {
        let h = itemTpl;
        Object.keys(item).forEach(k => h = h.replace(new RegExp(`{{${k}}}`, 'g'), item[k] || ''));
        return h;
      }).join('');
    });
    
    // 4. Variables {{variable}}
    Object.keys(data).forEach(k => {
      if (typeof data[k] !== 'object') html = html.replace(new RegExp(`{{${k}}}`, 'g'), data[k] || '');
    });
    
    // Limpieza
    return html.replace(/{{[^}]+}}/g, '').trim();
  }
};