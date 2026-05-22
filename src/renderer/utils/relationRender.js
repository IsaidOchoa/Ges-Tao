// src/renderer/utils/relationTemplate.js

export class RelationTemplate {
  static async render(templateName, data) {
    try {
      // Importar template HTML dinámicamente
      const template = await import(`../config/relationships/templates/${templateName}.html?raw`);
      let html = template.default;
      
      // Reemplazar variables simples {{variable}}
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, data[key] || '');
      });
      
      // Reemplazar condicionales {{#if variable}}...{{/if}}
      html = this.processConditionals(html, data);
      
      // Reemplazar loops {{#each array}}...{{/each}}
      html = this.processEach(html, data);
      
      return html;
    } catch (error) {
      console.error(`❌ Error renderizando template ${templateName}:`, error);
      return `<div class="error">Error cargando vista: ${error.message}</div>`;
    }
  }
  
  static processConditionals(html, data) {
    // Simplificación: buscar {{#if variable}}content{{/if}}
    const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    return html.replace(ifRegex, (match, variable, content) => {
      return data[variable] ? content : '';
    });
  }
  
  static processEach(html, data) {
    // Simplificación: buscar {{#each array}}...{{/each}}
    const eachRegex = /{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g;
    return html.replace(eachRegex, (match, arrayName, template) => {
      const array = data[arrayName];
      if (!Array.isArray(array) || array.length === 0) return '';
      
      return array.map(item => {
        let itemHtml = template;
        Object.keys(item).forEach(key => {
          itemHtml = itemHtml.replace(new RegExp(`{{${key}}}`, 'g'), item[key] || '');
        });
        return itemHtml;
      }).join('');
    });
  }
}