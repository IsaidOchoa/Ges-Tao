// src/renderer/utils/assignment-modal/StateManager.js

export class StateManager {
  constructor() {
    this.context = null;
    this.activePeriod = null;
    this.activeTab = "gestionar";
    this.isLoading = false;
    this.viewCache = {
      gestionar: null,
      consultar: null
    };
    this._forceRefresh = false;
  }

  setContext(context) {
    this.context = { ...context };
  }

  setActivePeriod(periodId) {
    this.activePeriod = periodId;
  }

  setActiveTab(tabId) {
    this.activeTab = tabId;
  }

  setLoading(isLoading) {
    this.isLoading = isLoading;
  }

  getCacheKey() {
    const { entityType, entityId } = this.context || {};
    const periodId = this.activePeriod || "global";
    return `${entityType}_${entityId}_${periodId}`;
  }

  invalidateCache() {
    this.viewCache.gestionar = null;
    this.viewCache.consultar = null;
  }

  isCached(viewName, cacheKey) {
    return this.viewCache[viewName]?.key === cacheKey && 
           this.viewCache[viewName]?.rendered;
  }

  setCached(viewName, cacheKey) {
    this.viewCache[viewName] = { key: cacheKey, rendered: true };
    this._forceRefresh = false;
  }

   invalidateCache(force = true) {
    this.viewCache.gestionar = null;
    this.viewCache.consultar = null;
    if (force) this._forceRefresh = true;
  }
  getState() {
    return {
      context: this.context,
      activePeriod: this.activePeriod,
      activeTab: this.activeTab,
      isLoading: this.isLoading
    };
  }
}