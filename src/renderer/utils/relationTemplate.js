// src/renderer/utils/relationTemplate.js
export class RelationTemplate {
  /**
   * Renderiza un template HTML con datos
   * @param {string} templateName - Nombre del archivo HTML (sin extensión)
   * @param {object} data - Datos para el template
   */
  static async render(templateName, data) {
    try {
      // Importar template HTML dinámicamente
      const template = await import(`../config/relationships/templates/${templateName}.html?raw`);
      let html = template.default;
      
      // Reemplazar variables simples {{variable}}
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, this.escapeHtml(data[key] || ''));
      });
      
      // Reemplazar condicionales {{#if variable}}...{{/if}}
      html = this.processConditionals(html, data);
      
      // Reemplazar loops {{#each array}}...{{/each}}
      html = this.processEach(html, data);
      
      return html;
    } catch (error) {
      console.error(`❌ Error renderizando template ${templateName}:`, error);
      return `<div class="error-state" style="padding:1rem;color:var(--danger-color);background:rgba(231,76,60,0.1);border-radius:6px">
        Error cargando vista: ${error.message}
      </div>`;
    }
  }
  
  /**
   * Procesa condicionales {{#if variable}}content{{/if}}
   */
  static processConditionals(html, data) {
    const ifRegex = /{{#if\s+([\w.]+)}}([\s\S]*?){{\/if}}/g;
    return html.replace(ifRegex, (match, variable, content) => {
      const value = this.getNestedValue(data, variable);
      return value ? content : '';
    });
  }
  
  /**
   * Procesa loops {{#each array}}...{{/each}}
   */
  static processEach(html, data) {
    const eachRegex = /{{#each\s+([\w.]+)}}([\s\S]*?){{\/each}}/g;
    return html.replace(eachRegex, (match, arrayName, template) => {
      const array = this.getNestedValue(data, arrayName);
      if (!Array.isArray(array) || array.length === 0) return '';
      
      return array.map(item => {
        let itemHtml = template;
        // Soportar tanto objetos como valores primitivos
        if (typeof item === 'object') {
          Object.keys(item).forEach(key => {
            itemHtml = itemHtml.replace(new RegExp(`{{${key}}}`, 'g'), this.escapeHtml(item[key] || ''));
          });
        }
        return itemHtml;
      }).join('');
    });
  }
  
  /**
   * Obtiene valor anidado (ej: "user.name" de {user: {name: "Juan"}})
   */
  static getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  /**
   * Escapa HTML para prevenir XSS
   */
  static escapeHtml(text) {
    if (typeof text !== 'string') return text;
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }
}