const { ipcMain } = require('electron');
const { getDB } = require('../database');

module.exports = () => {
  ipcMain.handle('login-user', async (event, { username, password }) => {
    console.log(`[IPC] Login intento: ${username}`);
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
};