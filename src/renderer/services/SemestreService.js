// src/renderer/services/SemestreService.js
import BaseService from './BaseService.js';

export default class SemestreService extends BaseService {
  static RESOURCE = 'semestres';
  
  static async getAll() {
    return this._fetch(`${this.RESOURCE}:getAll`);
  }
  
  static async getDisponibles() {
    return this._fetch(`${this.RESOURCE}:getDisponibles`);
  }
  
  static async create(payload) {
    return this._fetch(`${this.RESOURCE}:create`, payload);
  }
  
  static async update(payload) {
    return this._fetch(`${this.RESOURCE}:update`, payload);
  }
}