// src/renderer/utils/uiHelpers.js
/**
 * Utilitarios de UI para manipulación segura del DOM
 * @module uiHelpers
 */

/**
 * Espera a que el DOM esté completamente listo antes de ejecutar código
 * Útil para SPAs donde el contenido se inyecta dinámicamente
 * 
 * @param {number} timeout - Tiempo máximo de espera en ms (default: 3000)
 * @returns {Promise<boolean>} - Resuelve true si el DOM está listo, false si timeout
 */
export async function waitForDOMReady(timeout = 3000) {
  return new Promise((resolve) => {
    // Si ya está listo, resolver inmediatamente
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      resolve(true);
      return;
    }
    
    // Timeout de seguridad
    const timeoutId = setTimeout(() => {
      console.warn('[uiHelpers] waitForDOMReady: timeout alcanzado');
      resolve(false);
    }, timeout);
    
    // Escuchar evento de DOM listo
    const onReady = () => {
      clearTimeout(timeoutId);
      document.removeEventListener('DOMContentLoaded', onReady);
      document.removeEventListener('load', onReady);
      resolve(true);
    };
    
    document.addEventListener('DOMContentLoaded', onReady);
    document.addEventListener('load', onReady);
  });
}

/**
 * Espera a que un elemento específico exista en el DOM
 * @param {string} selector - Selector CSS del elemento
 * @param {number} timeout - Tiempo máximo en ms
 * @returns {Promise<Element|null>}
 */
export async function waitForElement(selector, timeout = 3000) {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
    
    // Timeout de seguridad
    setTimeout(() => {
      observer.disconnect();
      console.warn(`[uiHelpers] waitForElement: timeout para "${selector}"`);
      resolve(null);
    }, timeout);
  });
}

/**
 * Aplica una clase temporalmente para animación/feedback visual
 * @param {Element} element - Elemento a animar
 * @param {string} className - Clase a agregar
 * @param {number} duration - Duración en ms antes de removerla
 */
export function flashClass(element, className, duration = 300) {
  if (!element) return;
  
  element.classList.add(className);
  setTimeout(() => {
    element.classList.remove(className);
  }, duration);
}

/**
 * Trunca texto con ellipsis si excede longitud máxima
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string}
 */
export function truncateText(text, maxLength = 50) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Genera un ID único para elementos temporales
 * @param {string} prefix - Prefijo opcional
 * @returns {string}
 */
export function generateId(prefix = 'temp') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Escapa caracteres HTML para prevenir XSS en inyección de texto
 * @param {string} text - Texto a escapar
 * @returns {string}
 */
export function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Formatea fecha para visualización legible
 * @param {string|Date} date - Fecha a formatear
 * @param {string} locale - Locale para Intl.DateTimeFormat
 * @returns {string}
 */
export function formatDate(date, locale = 'es-MX') {
  try {
    const d = date instanceof Date ? date : new Date(date);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return date?.toString() || '-';
  }
}

/**
 * Convierte un objeto a query string para URLs
 * @param {Object} params - Parámetros a convertir
 * @returns {string}
 */
export function objectToQueryString(params) {
  return Object.entries(params)
    .filter(([_, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * Parsea query string a objeto
 * @param {string} queryString - Query string a parsear
 * @returns {Object}
 */
export function parseQueryString(queryString) {
  if (!queryString) return {};
  
  return queryString
    .replace(/^\?/, '')
    .split('&')
    .reduce((acc, pair) => {
      const [key, value] = pair.split('=');
      if (key) {
        acc[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
      return acc;
    }, {});
}