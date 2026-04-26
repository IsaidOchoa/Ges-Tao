const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { getDB } = require('./database'); // Importamos nuestra nueva BD modular

let mainWindow;

console.log('🚀 [MAIN] Iniciando proceso principal de Ges-TAO...');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  console.log('🪟 [MAIN] Creando ventana principal...');
  
  let preloadPath;
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    preloadPath = path.join(__dirname, '../renderer/main_window/preload.js');
    console.log('🔧 [DEV] Preload:', preloadPath);
  } else {
    preloadPath = path.join(__dirname, 'preload.js');
  }

  mainWindow = new BrowserWindow({
    width: 1200, // Un poco más ancho para las tablas
    height: 800,
    center: true,
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

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
  // Inicializar BD antes de crear la ventana
  try {
    getDB(); 
    createWindow();
  } catch (e) {
    console.error('❌ [MAIN] Error fatal al iniciar:', e);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// =======================================================
// HANDLERS IPC (Comunicación con el Frontend)
// =======================================================

// 1. LOGIN
ipcMain.handle('login-user', async (event, { username, password }) => {
  console.log(`🔐 [IPC] Login intento: ${username}`);
  try {
    const db = getDB();
    const stmt = db.prepare('SELECT * FROM usuarios WHERE username = ? AND password_hash = ?');
    const user = stmt.get(username, password);

    if (user) {
      return { 
        success: true, 
        user: { 
          id: user.id, 
          nombre: user.nombre_completo, 
          rol: user.rol 
        } 
      };
    }
    return { success: false, error: 'Credenciales incorrectas' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 2. LISTAR DOCENTES
ipcMain.handle('obtener-docentes', async () => {
  try {
    const db = getDB();
    const stmt = db.prepare('SELECT * FROM docentes ORDER BY apellido_paterno ASC');
    const rows = stmt.all();
    return { success: true, data: rows };
  } catch (error) {
    console.error('❌ [IPC] Error listando docentes:', error);
    return { success: false, error: error.message };
  }
});

// 3. GUARDAR DOCENTE
ipcMain.handle('guardar-docente', async (event, datos) => {
  console.log('📩 [IPC] Guardando docente:', datos.nombres);
  try {
    const db = getDB();
    const stmt = db.prepare(`
      INSERT INTO docentes (codigo, apellido_paterno, apellido_materno, nombres, correo_contacto, telefono_contacto, nivel_academico, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      datos.codigo,
      datos.apellido_paterno,
      datos.apellido_materno || '',
      datos.nombres,
      datos.correo_contacto || '',
      datos.telefono_contacto || '',
      datos.nivel_academico || '',
      datos.estado || 'activo'
    );
    
    return { success: true, message: 'Docente registrado correctamente' };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'El código de docente ya existe.' };
    }
    return { success: false, error: error.message };
  }
});

// 4. ELIMINAR DOCENTE
ipcMain.handle('eliminar-docente', async (event, id) => {
  try {
    const db = getDB();
    const stmt = db.prepare('DELETE FROM docentes WHERE id = ?');
    stmt.run(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// =======================================================
// NUEVOS HANDLERS PARA CATÁLOGOS ADICIONALES
// =======================================================

// 5. EXPERIENCIAS EDUCATIVAS (EE)
ipcMain.handle('obtener-ee', async () => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM experiencias_educativas ORDER BY nombre ASC').all();
    return { success: true, data: rows };
  } catch (error) {
    console.error('Error obteniendo EE:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('guardar-ee', async (event, datos) => {
  try {
    const db = getDB();
    const stmt = db.prepare(`
      INSERT INTO experiencias_educativas (clave_ee, nombre, tipo, creditos, horas_teoria, horas_practica, programa_academico, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      datos.clave_ee, 
      datos.nombre, 
      datos.tipo, 
      datos.creditos, 
      datos.horas_teoria, 
      datos.horas_practica, 
      datos.programa_academico, 
      datos.estado || 'activa'
    );
    return { success: true, message: 'EE guardada correctamente' };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'La clave de la EE ya existe.' };
    }
    return { success: false, error: error.message };
  }
});

// 6. PERIODOS ESCOLARES
ipcMain.handle('obtener-periodos', async () => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM periodos ORDER BY fecha_inicio DESC').all();
    return { success: true, data: rows };
  } catch (error) {
    console.error('Error obteniendo periodos:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('guardar-periodo', async (event, datos) => {
  try {
    const db = getDB();
    const stmt = db.prepare(`
      INSERT INTO periodos (clave, descripcion, fecha_inicio, fecha_fin, estado)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(datos.clave, datos.descripcion, datos.fecha_inicio, datos.fecha_fin, datos.estado || 'abierto');
    return { success: true, message: 'Periodo guardado correctamente' };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'La clave del periodo ya existe.' };
    }
    return { success: false, error: error.message };
  }
});

// 7. PROGRAMAS INSTITUCIONALES
ipcMain.handle('obtener-programas', async () => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM programas_institucionales ORDER BY nombre ASC').all();
    return { success: true, data: rows };
  } catch (error) {
    console.error('Error obteniendo programas:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('guardar-programa', async (event, datos) => {
  try {
    const db = getDB();
    const stmt = db.prepare(`
      INSERT INTO programas_institucionales (nombre, descripcion, responsable, fecha_registro, estado)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(datos.nombre, datos.descripcion, datos.responsable, datos.fecha_registro, datos.estado || 'vigente');
    return { success: true, message: 'Programa guardado correctamente' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// =======================================================
// HANDLERS PARA CONSTANCIAS E HISTORIAL
// =======================================================

// 8. OBTENER DATOS PARA CONSTANCIAS
ipcMain.handle('obtener-datos-constancia', async () => {
  try {
    const db = getDB();
    
    const docentes = db.prepare('SELECT id, codigo, apellido_paterno, nombres FROM docentes WHERE estado = "activo" ORDER BY apellido_paterno ASC').all();
    const periodos = db.prepare('SELECT id, clave, descripcion FROM periodos WHERE estado != "cerrado" ORDER BY fecha_inicio DESC').all();
    const ee = db.prepare('SELECT id, clave_ee, nombre FROM experiencias_educativas WHERE estado = "activa" ORDER BY nombre ASC').all();
    const programas = db.prepare('SELECT id, nombre FROM programas_institucionales WHERE estado = "vigente" ORDER BY nombre ASC').all();

    return { 
      success: true, 
      data: { docentes, periodos, ee, programas } 
    };
  } catch (error) {
    console.error('Error obteniendo datos:', error);
    return { success: false, error: error.message };
  }
});

// 9. GUARDAR CONSTANCIA
ipcMain.handle('guardar-constancia', async (event, datos) => {
  try {
    const db = getDB();
    const folio = `CONST-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;
    
    const stmt = db.prepare(`
      INSERT INTO constancias (folio, docente_id, periodo_id, ee_id, programa_id, tipo_constancia, estado, fecha_emision)
      VALUES (?, ?, ?, ?, ?, ?, 'emitida', date('now'))
    `);
    
    stmt.run(
      folio,
      datos.docente_id,
      datos.periodo_id || null,
      datos.ee_id || null,
      datos.programa_id || null,
      datos.tipo_constancia
    );

    // Registrar en auditoría
    db.prepare(`INSERT INTO historial_auditoria (accion, tabla_afectada, detalles, fecha_sistema) VALUES (?, ?, ?, datetime('now'))`)
      .run('EMITIR_CONSTANCIA', 'constancias', JSON.stringify({ folio, ...datos }));

    return { success: true, folio, message: 'Constancia emitida y guardada correctamente.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 10. OBTENER HISTORIAL
ipcMain.handle('obtener-historial', async () => {
  try {
    const db = getDB();
    
    const query = `
      SELECT 
        h.id, h.accion, h.tabla_afectada, h.detalles, h.fecha_sistema,
        c.folio, c.tipo_constancia,
        d.apellido_paterno, d.nombres
      FROM historial_auditoria h
      LEFT JOIN constancias c ON h.registro_id = c.id AND h.tabla_afectada = 'constancias'
      LEFT JOIN docentes d ON c.docente_id = d.id
      ORDER BY h.fecha_sistema DESC
      LIMIT 100
    `;
    
    const rows = db.prepare(query).all();
    return { success: true, data: rows };
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    return { success: false, error: error.message };
  }
});