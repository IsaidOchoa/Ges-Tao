// src/renderer/components/modals/AssignmentModal/core/StateManager.js

export class StateManager {
  constructor() {
    this.context = null;
    this.activePeriod = null;
    this.activeTab = "gestionar";
    this.isLoading = false;
    this._cache = new Map();
    this._subscribers = new Map();
  }

  setContext(context) {
    this.context = { ...context };
    this.invalidateAll();
    this._notify('context', this.context);
  }

  setActivePeriod(periodId) {
    this.activePeriod = periodId;
    this.invalidateAll();
    this._notify('period', periodId);
  }

  setActiveTab(tabId) {
    this.activeTab = tabId;
    this._notify('tab', tabId);
  }

  setLoading(isLoading) {
    this.isLoading = isLoading;
    this._notify('loading', isLoading);
  }

  getCacheKey() {
    const { entityType, entityId } = this.context || {};
    const periodId = this.activePeriod || "global";
    return `${entityType}_${entityId}_${periodId}`;
  }

  setCache(module, data) {
    this._cache.set(module, {
      data,
      valid: true,
      timestamp: Date.now(),
      key: this.getCacheKey()
    });
  }

  getCache(module) {
    const entry = this._cache.get(module);
    if (!entry) return null;
    if (!entry.valid) return null;
    if (entry.key !== this.getCacheKey()) {
      entry.valid = false;
      return null;
    }
    return entry.data;
  }

  isCacheValid(module) {
    const entry = this._cache.get(module);
    if (!entry) return false;
    if (!entry.valid) return false;
    return entry.key === this.getCacheKey();
  }

  invalidate(module) {
    if (module === 'all') {
      this.invalidateAll();
      return;
    }
    const entry = this._cache.get(module);
    if (entry) {
      entry.valid = false;
    }
    this._notify('cacheInvalidated', module);
  }

  invalidateAll() {
    this._cache.forEach(entry => { entry.valid = false; });
    this._notify('cacheInvalidated', 'all');
  }

  invalidateModules(modules) {
    if (!Array.isArray(modules)) {
      this.invalidate(modules);
      return;
    }
    modules.forEach(module => this.invalidate(module));
  }

  getState() {
    return {
      context: this.context,
      activePeriod: this.activePeriod,
      activeTab: this.activeTab,
      isLoading: this.isLoading
    };
  }

  subscribe(eventType, callback) {
    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, []);
    }
    this._subscribers.get(eventType).push(callback);
  }

  unsubscribe(eventType, callback) {
    if (!this._subscribers.has(eventType)) return;
    const subscribers = this._subscribers.get(eventType);
    const index = subscribers.indexOf(callback);
    if (index > -1) subscribers.splice(index, 1);
  }

  _notify(eventType, data) {
    if (!this._subscribers.has(eventType)) return;
    this._subscribers.get(eventType).forEach(callback => {
      try { callback(data); } catch (error) {
        console.error(`Error en subscriber de ${eventType}:`, error);
      }
    });
  }
}