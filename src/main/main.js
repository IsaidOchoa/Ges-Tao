const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { getDB } = require('./database');
const registerHandlers = require('./handlers');

let mainWindow;

console.log('[MAIN] Iniciando proceso principal de Ges-TAO...');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  console.log('[MAIN] Creando ventana principal...');
  
  let preloadPath;
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    preloadPath = path.join(__dirname, '../renderer/main_window/preload.js');
    console.log('[DEV] Preload:', preloadPath);
  } else {
    preloadPath = path.join(__dirname, '../renderer/main_window/preload.js');
    console.log('[PROD] Preload ruta calculada:', preloadPath);
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    center: true,
    show: false,
    backgroundColor: '#f4f6f9',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_WEBPACK_ENTRY) {
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(() => {
  try {
    const db = getDB(); 
    console.log('[MAIN] Base de datos inicializada correctamente.');
    
    // Registrar todos los handlers IPC
    registerHandlers();
    
    createWindow();
  } catch (e) {
    console.error('[MAIN] Error fatal al iniciar BD:', e);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});