// src/renderer/components/modals/AssignmentModal/relations/BaseRelationRenderer.js

import { DOMHelpers } from '../utils/DOMHelpers.js';

export class BaseRelationRenderer {
  constructor({ api, toast, confirm }) {
    if (new.target === BaseRelationRenderer) {
      throw new Error('BaseRelationRenderer es abstracta');
    }

    this.api = api;
    this.toast = toast;
    this.confirm = confirm;
    this.helpers = new DOMHelpers();
    this._abortController = null;
    this._cardRefs = null;
    this._context = null;
    this._periodId = null;
  }

  async render(context, periodId, cardRefs) {
    this._context = context;
    this._periodId = periodId;
    this._cardRefs = cardRefs;

    this.unbindEvents();

    await this.loadSelect();
    await this.renderList();
    await this.refreshCounter();

    this.bindEvents();
  }

  async refresh() {
    if (!this._cardRefs || !this._context || !this._periodId) return;

    await this.loadSelect();
    await this.renderList();
    await this.refreshCounter();
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
  }
}