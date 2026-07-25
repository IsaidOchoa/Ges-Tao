// src/renderer/components/modals/AssignmentModal/relations/BaseRelationRenderer.js

import { DOMHelpers } from '../utils/DOMHelpers.js';

export class BaseRelationRenderer {
  constructor({ api, toast, confirm, stateManager, moduleName, uiLoader }) {
    if (new.target === BaseRelationRenderer) {
      throw new Error('BaseRelationRenderer es abstracta');
    }

    this.api = api;
    this.toast = toast;
    this.confirm = confirm;
    this.stateManager = stateManager;
    this.moduleName = moduleName;
    this.uiLoader = uiLoader;
    this.helpers = new DOMHelpers();
    this._abortController = null;
    this._cardRefs = null;
    this._context = null;
    this._periodId = null;
    this._currentItems = new Map();
    this._loadingOverlay = null;
  }

  async render(context, periodId, cardRefs) {
  console.log(`[${this.moduleName}] render() llamado`);
  
  // Verificar si el cache es válido para ESTE contexto específico
  const cacheKey = `${this.moduleName}_${context.entityId}_${periodId}`;
  const cachedData = this.stateManager.getCache(cacheKey);
  
  if (cachedData && this._context?.entityId === context.entityId && this._periodId === periodId) {
    console.log(`[${this.moduleName}] Cache válido para contexto, omitiendo render`);
    return;
  }

  this._context = context;
  this._periodId = periodId;
  this._cardRefs = cardRefs;

  this.unbindEvents();

  await this.loadSelect();
  await this.renderList();
  await this.refreshCounter();

  this.bindEvents();
  
  // Guardar en cache con clave específica
  this.stateManager.setCache(cacheKey, true);
  
  console.log(`[${this.moduleName}] Render completado`);
}

  async refresh() {
    if (!this._cardRefs || !this._context || !this._periodId) return;
    
    // Invalidar cache y forzar re-renderizado
    this.stateManager.invalidate(this.moduleName);
    
    await this.loadSelect();
    await this.renderList();
    await this.refreshCounter();
    
    this.stateManager.setCache(this.moduleName, true);
  }

  async incrementalUpdate(action, itemId, itemData = null) {
    if (!this._cardRefs) return;

    switch (action) {
      case 'add':
        await this._addItemToList(itemData);
        await this.refreshCounter();
        await this.loadSelect();
        break;
      case 'remove':
        this._removeItemFromList(itemId);
        await this.refreshCounter();
        await this.loadSelect();
        break;
    }
  }

  async loadSelect() {
    throw new Error('Método loadSelect() debe ser implementado');
  }

  async renderList() {
    throw new Error('Método renderList() debe ser implementado');
  }

  async refreshCounter() {
    throw new Error('Método refreshCounter() debe ser implementado');
  }

  async assign() {
    throw new Error('Método assign() debe ser implementado');
  }

  async remove(itemId, itemName) {
    throw new Error('Método remove() debe ser implementado');
  }

  async _addItemToList(itemData) {
  if (!this._cardRefs?.listContainer) return;
  
  // Remover fila vacía si existe (buscar cualquier tr sin data-id)
  const emptyRow = this._cardRefs.listContainer.querySelector('tr:not([data-id])');
  if (emptyRow) emptyRow.remove();
  
  const item = this._createItem(itemData);
  this._cardRefs.listContainer.appendChild(item);
}

  _removeItemFromList(itemId) {
  if (!this._cardRefs?.listContainer) return;
  
  // Buscar la fila (tr) en lugar del div
  const row = this._cardRefs.listContainer.querySelector(`tr[data-id="${itemId}"]`);
  if (row) {
    row.classList.add('removing');
    setTimeout(() => {
      row.remove();
      this._currentItems.delete(itemId);
      
      // Si no quedan filas, mostrar mensaje vacío
      if (this._cardRefs.listContainer.children.length === 0) {
        this._cardRefs.listContainer.innerHTML = `
          <tr class="empty-row">
            <td colspan="${this._getColumnCount()}">Ninguno asignado</td>
          </tr>
        `;
      }
    }, 200);
  }
}

_getColumnCount() {
  // Obtener número de columnas desde el config
  const card = this._cardRefs?.card;
  if (!card) return 4;
  const ths = card.querySelectorAll('thead th');
  return ths.length;
}

  _updateCounterText(count) {
    if (this._cardRefs?.counter) {
      this._cardRefs.counter.textContent = count;
    }
  }

  _showLoading() {
    if (!this._cardRefs?.listContainer || !this.uiLoader) return;
    this._loadingOverlay = this.uiLoader.showInContainer(
      this._cardRefs.listContainer, 
      'Cargando...'
    );
  }

  _hideLoading() {
    if (!this._cardRefs?.listContainer || !this.uiLoader || !this._loadingOverlay) return;
    this.uiLoader.hideInContainer(this._cardRefs.listContainer, this._loadingOverlay);
    this._loadingOverlay = null;
  }

  bindEvents() {
    if (!this._cardRefs) return;

    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    this._cardRefs.assignButton?.addEventListener('click', () => {
      this.assign();
    }, { signal });

    this._cardRefs.listContainer?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-id]');
      if (btn) {
        const itemId = btn.dataset.id;
        const itemName = btn.dataset.name;
        this.remove(itemId, itemName);
      }
    }, { signal });
  }

  unbindEvents() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  destroy() {
    this.unbindEvents();
    this._cardRefs = null;
    this._context = null;
    this._periodId = null;
    this._currentItems.clear();
  }
}