const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { getDB } = require('./database');

let mainWindow;

console.log('🚀 [MAIN] Iniciando proceso principal de Ges-TAO...');

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  console.log('🪟 [MAIN] Creando ventana principal...');
  
  let preloadPath;
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    // Ajusta esta ruta según tu estructura real de build en dev
    preloadPath = path.join(__dirname, '../renderer/main_window/preload.js');
    console.log('🔧 [DEV] Preload:', preloadPath);
  } else {
    preloadPath = path.join(__dirname, '../renderer/main_window/preload.js');
    console.log('📦 [PROD] Preload ruta calculada:', preloadPath);
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

  // Cargar la URL generada por Webpack
  if (MAIN_WINDOW_WEBPACK_ENTRY) {
    mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  } else {
    // Fallback para entornos sin variable global (raro en electron-forge)
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
  // Inicializar BD antes de crear la ventana
  try {
    const db = getDB(); 
    console.log('✅ [MAIN] Base de datos inicializada correctamente.');
    createWindow();
  } catch (e) {
    console.error('❌ [MAIN] Error fatal al iniciar BD:', e);
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
    // En producción real, usa bcrypt para comparar hashes
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

// 2. DOCENTES
ipcMain.handle('obtener-docentes', async () => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM docentes ORDER BY apellido_paterno ASC').all();
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('guardar-docente', async (event, datos) => {
  console.log('📩 [IPC] Guardando docente:', datos.nombres);
  try {
    const db = getDB();
    let stmt;
    if (datos.id) {
      // Actualizar
      stmt = db.prepare(`UPDATE docentes SET 
        codigo=?, apellido_paterno=?, apellido_materno=?, nombres=?, 
        correo_contacto=?, telefono_contacto=?, nivel_academico=?, estado=? 
        WHERE id=?`);
      stmt.run(datos.codigo, datos.apellido_paterno, datos.apellido_materno, datos.nombres, 
               datos.correo_contacto, datos.telefono_contacto, datos.nivel_academico, datos.estado, datos.id);
    } else {
      // Insertar
      stmt = db.prepare(`INSERT INTO docentes (codigo, apellido_paterno, apellido_materno, nombres, correo_contacto, telefono_contacto, nivel_academico, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      stmt.run(datos.codigo, datos.apellido_paterno, datos.apellido_materno || '', datos.nombres, 
               datos.correo_contacto || '', datos.telefono_contacto || '', datos.nivel_academico || '', datos.estado || 'activo');
    }
    return { success: true, message: 'Docente guardado correctamente' };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'El código de docente ya existe.' };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('eliminar-docente', async (event, id) => {
  try {
    const db = getDB();
    db.prepare('DELETE FROM docentes WHERE id = ?').run(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 3. EXPERIENCIAS EDUCATIVAS (EE)
ipcMain.handle('obtener-ee', async () => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM experiencias_educativas ORDER BY nombre ASC').all();
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('guardar-ee', async (event, datos) => {
  try {
    const db = getDB();
    let stmt;
    if (datos.id) {
      // Actualizar
      stmt = db.prepare(`UPDATE experiencias_educativas SET 
        clave_ee=?, nombre=?, tipo=?, creditos=?, horas_teoria=?, horas_practica=?, 
        programa_academico=?, estado=? WHERE id=?`);
      stmt.run(datos.clave_ee, datos.nombre, datos.tipo, datos.creditos, datos.horas_teoria, 
               datos.horas_practica, datos.programa_academico, datos.estado, datos.id);
    } else {
      // Insertar
      stmt = db.prepare(`INSERT INTO experiencias_educativas (clave_ee, nombre, tipo, creditos, horas_teoria, horas_practica, programa_academico, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      stmt.run(datos.clave_ee, datos.nombre, datos.tipo, datos.creditos, datos.horas_teoria, 
               datos.horas_practica, datos.programa_academico, datos.estado || 'activa');
    }
    return { success: true, message: 'EE guardada correctamente' };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'La clave de la EE ya existe.' };
    }
    return { success: false, error: error.message };
  }
});

// 4. PERIODOS ESCOLARES
ipcMain.handle('obtener-periodos', async () => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM periodos ORDER BY fecha_inicio DESC').all();
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('guardar-periodo', async (event, datos) => {
  try {
    const db = getDB();
    let stmt;
    if (datos.id) {
       // Actualizar
       stmt = db.prepare(`UPDATE periodos SET clave=?, descripcion=?, fecha_inicio=?, fecha_fin=?, estado=? WHERE id=?`);
       stmt.run(datos.clave, datos.descripcion, datos.fecha_inicio, datos.fecha_fin, datos.estado, datos.id);
    } else {
      // Insertar
      stmt = db.prepare(`INSERT INTO periodos (clave, descripcion, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?, ?)`);
      stmt.run(datos.clave, datos.descripcion, datos.fecha_inicio, datos.fecha_fin, datos.estado || 'abierto');
    }
    return { success: true, message: 'Periodo guardado correctamente' };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'La clave del periodo ya existe.' };
    }
    return { success: false, error: error.message };
  }
});

// 5. PROGRAMAS INSTITUCIONALES
ipcMain.handle('obtener-programas', async () => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM programas_institucionales ORDER BY nombre ASC').all();
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('guardar-programa', async (event, datos) => {
  try {
    const db = getDB();
    let stmt;
    if (datos.id) {
      // Actualizar
      stmt = db.prepare(`UPDATE programas_institucionales SET nombre=?, descripcion=?, responsable=?, fecha_registro=?, estado=? WHERE id=?`);
      stmt.run(datos.nombre, datos.descripcion, datos.responsable, datos.fecha_registro, datos.estado, datos.id);
    } else {
      // Insertar
      stmt = db.prepare(`INSERT INTO programas_institucionales (nombre, descripcion, responsable, fecha_registro, estado) VALUES (?, ?, ?, ?, ?)`);
      stmt.run(datos.nombre, datos.descripcion, datos.responsable, datos.fecha_registro, datos.estado || 'vigente');
    }
    return { success: true, message: 'Programa guardado correctamente' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 6. 🆕 TIPOS DE CONSTANCIA (NUEVO)
ipcMain.handle('listar-tipos-constancia', async () => {
  try {
    const db = getDB();
    const rows = db.prepare('SELECT * FROM tipos_constancia ORDER BY nombre ASC').all();
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('guardar-tipo-constancia', async (event, datos) => {
  try {
    const db = getDB();
    let stmt;
    if (datos.id) {
      // Actualizar
      stmt = db.prepare(`UPDATE tipos_constancia SET 
        clave=?, nombre=?, descripcion=?, requiere_ee=?, requiere_periodo=?, estado=? 
        WHERE id=?`);
      stmt.run(datos.clave, datos.nombre, datos.descripcion, 
             datos.requiere_ee ? 1 : 0, datos.requiere_periodo ? 1 : 0, datos.estado, datos.id);
    } else {
      // Insertar
      stmt = db.prepare(`INSERT INTO tipos_constancia (clave, nombre, descripcion, requiere_ee, requiere_periodo, estado) 
        VALUES (?, ?, ?, ?, ?, ?)`);
      stmt.run(datos.clave, datos.nombre, datos.descripcion, 
             datos.requiere_ee ? 1 : 0, datos.requiere_periodo ? 1 : 0, datos.estado);
    }
    return { success: true, message: 'Tipo de constancia guardado correctamente' };
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return { success: false, error: 'La clave del tipo ya existe.' };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('eliminar-tipo-constancia', async (event, id) => {
  try {
    const db = getDB();
    // Validar si hay constancias usando este tipo antes de borrar (opcional pero recomendado)
    const count = db.prepare('SELECT COUNT(*) as count FROM constancias WHERE tipo_constancia_id = ?').get(id);
    if (count.count > 0) {
      return { success: false, error: 'No se puede eliminar: Hay constancias emitidas con este tipo.' };
    }
    
    db.prepare('DELETE FROM tipos_constancia WHERE id = ?').run(id);
    return { success: true, message: 'Tipo eliminado correctamente' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 7. CONSTANCIAS Y DATOS MAESTROS
ipcMain.handle('obtener-datos-constancia', async () => {
  try {
    const db = getDB();
    const docentes = db.prepare("SELECT id, codigo, apellido_paterno, nombres FROM docentes WHERE estado = 'activo' ORDER BY apellido_paterno ASC").all();
    const periodos = db.prepare("SELECT id, clave, descripcion FROM periodos WHERE estado != 'cerrado' ORDER BY fecha_inicio DESC").all();
    const ee = db.prepare("SELECT id, clave_ee, nombre FROM experiencias_educativas WHERE estado = 'activa' ORDER BY nombre ASC").all();
    const programas = db.prepare("SELECT id, nombre FROM programas_institucionales WHERE estado = 'vigente' ORDER BY nombre ASC").all();
    
    // 🆕 AGREGAR ESTO:
    const tipos = db.prepare("SELECT id, nombre, requiere_ee, requiere_periodo FROM tipos_constancia WHERE estado = 'activo' ORDER BY nombre ASC").all();

    return { 
      success: true, 
      data: { docentes, periodos, ee, programas, tipos } // 🔗 Incluir tipos en la respuesta
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('guardar-constancia', async (event, datos) => {
  try {
    const db = getDB();
    const folio = `CONST-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    
    // 🆕 Usamos tipo_constancia_id (INTEGER) en lugar de texto
    const stmt = db.prepare(`
      INSERT INTO constancias (folio, docente_id, periodo_id, ee_id, programa_id, tipo_constancia_id, estado, fecha_emision)
      VALUES (?, ?, ?, ?, ?, ?, 'emitida', date('now'))
    `);
    
    stmt.run(
      folio,
      datos.docente_id,
      datos.periodo_id || null,
      datos.ee_id || null,
      datos.programa_id || null,
      datos.tipo_constancia_id // Ahora es un ID numérico
    );

    // Auditoría
    db.prepare(`INSERT INTO historial_auditoria (accion, tabla_afectada, registro_id, detalles, fecha_sistema) 
                VALUES ('EMITIR_CONSTANCIA', 'constancias', last_insert_rowid(), ?, datetime('now'))`)
      .run(JSON.stringify({ folio, ...datos }));

    return { success: true, folio, message: 'Constancia emitida correctamente.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('obtener-biblioteca-constancias', async () => {
  try {
    const db = getDB();
    const query = `
      SELECT 
        c.id, c.folio, c.estado, c.fecha_emision,
        t.nombre as tipo_nombre, -- 🆕 Unir con la tabla de tipos
        d.apellido_paterno, d.nombres,
        p.clave as periodo_clave
      FROM constancias c
      LEFT JOIN docentes d ON c.docente_id = d.id
      LEFT JOIN periodos p ON c.periodo_id = p.id
      LEFT JOIN tipos_constancia t ON c.tipo_constancia_id = t.id -- 🆕 Join con tipos
      ORDER BY c.fecha_emision DESC
    `;
    const rows = db.prepare(query).all();
    return { success: true, rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 8. HISTORIAL Y UTILIDADES
ipcMain.handle('obtener-historial', async () => {
  try {
    const db = getDB();
    const query = `
      SELECT h.*, u.nombre_completo as usuario_nombre
      FROM historial_auditoria h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      ORDER BY h.fecha_sistema DESC
      LIMIT 100
    `;
    const rows = db.prepare(query).all();
    return { success: true, data: rows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('abrir-archivo-pdf', async (event, rutaArchivo) => {
  try {
    if (!rutaArchivo) return { success: false, error: 'Ruta no disponible' };
    await shell.openPath(rutaArchivo);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'No se pudo abrir el archivo' };
  }
});