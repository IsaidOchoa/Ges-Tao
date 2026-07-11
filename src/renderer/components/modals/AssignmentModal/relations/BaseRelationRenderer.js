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
    // Si el contexto y periodo son los mismos, y el cache es válido, NO renderizar
    if (this._context?.entityId === context.entityId && 
        this._periodId === periodId && 
        this.stateManager.isCacheValid(this.moduleName)) {
      return; // Sin parpadeo
    }

    this._context = context;
    this._periodId = periodId;
    this._cardRefs = cardRefs;

    this.unbindEvents();

    await this.loadSelect();
    await this.renderList();
    await this.refreshCounter();

    this.bindEvents();
    this.stateManager.setCache(this.moduleName, true);
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
    const item = this._createItem(itemData);
    this._cardRefs.listContainer.appendChild(item);
    const emptyState = this._cardRefs.listContainer.querySelector('.empty-text');
    if (emptyState) emptyState.remove();
  }

  _removeItemFromList(itemId) {
    if (!this._cardRefs?.listContainer) return;
    const item = this._cardRefs.listContainer.querySelector(`[data-id="${itemId}"]`)?.closest('.assigned-item');
    if (item) {
      item.remove();
      this._currentItems.delete(itemId);
    }
    if (this._cardRefs.listContainer.children.length === 0) {
      this._cardRefs.listContainer.innerHTML = '<span class="empty-text">Ninguno asignado</span>';
    }
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