//main/handlers/configHandlers.js
const { ipcMain, dialog } = require('electron');
const settings = require('../settings');

module.exports = () => {
  ipcMain.handle('obtener-config', () => settings.get());
  
  ipcMain.handle('guardar-config', (event, { key, value }) => {
    return settings.set(key, value);
  });

  ipcMain.handle('seleccionar-directorio', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Seleccionar carpeta para constancias'
    });
    return result.canceled ? null : result.filePaths[0];
  });
};