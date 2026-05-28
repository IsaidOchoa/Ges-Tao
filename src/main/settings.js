// src/main/settings.js
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(app.getPath('userData'), 'settings.json');
const DEFAULTS = { rutaConstancias: app.getPath('documents') };

module.exports = {
  get() {
    try {
      return fs.existsSync(CONFIG_PATH) 
        ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) 
        : DEFAULTS;
    } catch { return DEFAULTS; }
  },
  set(key, value) {
    const current = this.get();
    current[key] = value;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(current, null, 2));
    return current;
  }
};