const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { 
  testConnection, 
  isConnected, 
  guardarUsuario, 
  buscarUsuarioPorCodigo, 
  guardarSesion,
  sincronizarDatosPendientes
} = require('./database');

// Variable global para mantener referencia a la ventana principal
let mainWindow;
let adminSessionActive = false;
const SUPER_ADMIN_PIN = 'FCMBDpass!7';

// Estado de conexión con el servidor central
let dbConectada = false;

// Verificar conexión con la base de datos central
async function verificarConexionBD() {
  try {
    const conectado = await testConnection();
    dbConectada = conectado && isConnected();
    
    const modo = dbConectada ? 'CONECTADO' : 'MODO LOCAL';
    console.log(`Estado de conexión: ${modo}`);
    
    // Si está conectado, intentar sincronizar datos pendientes
    if (dbConectada) {
      await sincronizarDatosPendientes();
      // Refrescar caché local desde BD para disponibilidad en modo local
      try {
        const db = require('./database');
        if (typeof db.refreshLocalCacheFromDB === 'function') {
          await db.refreshLocalCacheFromDB(15000);
          // Emitir evento al renderer para informar que el snapshot está actualizado
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('db-connection-status', { connected: true, db: true });
          }
        }
      } catch (e) {
        console.warn('No se pudo refrescar la caché local:', e.message);
      }
    }
    
    return dbConectada;
  } catch (error) {
    console.error('Error al verificar conexión con BD:', error);
    dbConectada = false;
    return false;
  }
}

function createWindow() {
  // Crear la ventana del navegador
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    fullscreen: true,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    backgroundColor: '#002B5C'
  });

  // Asegurar que la ventana esté en pantalla completa
  mainWindow.setFullScreen(true);

  // Deshabilitar acciones de ventana para cierre/min/max desde UI
  mainWindow.setClosable(false);
  mainWindow.setMinimizable(false);
  mainWindow.setMaximizable(false);
  
  // Forzar que la ventana permanezca al frente (kiosco parcial)
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setSkipTaskbar(true);
  mainWindow.setFocusable(true);

  console.log("Creando ventana principal...");

  // Cargar el archivo index.html de la aplicación
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    try {
      // En desarrollo, cargar desde el servidor de desarrollo de Vite
      const startUrl = 'http://localhost:5174';
      console.log('Cargando aplicación desde:', startUrl);
      // Mostrar la ventana cuando esté lista
      mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        console.log('Ventana lista y visible');
      });

      // Abrir DevTools para depuración
      mainWindow.webContents.openDevTools();
      
      // Cargar la URL
      mainWindow.loadURL(startUrl)
        .then(() => {
          console.log('URL cargada con éxito');
        })
        .catch((err) => {
          console.error('Error al cargar URL:', err);
          setTimeout(() => {
            console.log('Reintentando cargar la aplicación tras error...');
            mainWindow.loadURL(startUrl);
          }, 3000);
        });
      
      // Mostrar la ventana solo cuando esté lista y cargada
      mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.show();
        mainWindow.focus();
        console.log('Ventana lista y visible');
      });
      
      mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.log(`Error al cargar la aplicación: ${errorCode} - ${errorDescription}`);
        
        // Reintentar la carga con diferente estrategia
        setTimeout(() => {
          console.log('Reintentando cargar la aplicación...');
          mainWindow.loadURL('http://127.0.0.1:5173');
        }, 2000);
      });
    } catch (error) {
      console.error('Error al cargar la aplicación:', error);
    }
  } else {
    try {
      // En producción, cargar desde el archivo HTML empaquetado
      const indexPath = path.join(__dirname, '../dist/index.html');
      console.log(`Cargando aplicación desde ${indexPath}`);
      
      // Mostrar la ventana cuando esté lista
      mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
      });
      
      mainWindow.loadFile(indexPath);
    } catch (error) {
      console.error('Error al cargar la aplicación:', error);
    }
  }

  // Bloquear cierre con Alt+F4, solo permitir cierre programático
  mainWindow.on('close', function (event) {
    // Bloquear el cierre manual, solo permitir cierre programático
    event.preventDefault();
    console.log('Cierre de aplicación bloqueado - solo se permite cierre programático');
  });
  
  // Reforzar foco si la ventana pierde foco (mitigación, no bloquea Alt+Tab a nivel SO)
  mainWindow.on('blur', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    setTimeout(() => {
      try {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      } catch (_) {}
    }, 50);
  });

  // Cuando la ventana se cierra (solo si se fuerza)
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Al iniciar la aplicación
app.whenReady().then(async () => {
  try {
    // Verificar conexión con la base de datos 
    await verificarConexionBD();
    
    // Crear ventana principal
    createWindow();
    
    // Habilitar inicio automático con Windows (solo producción)
    try {
      const isDevEnv = process.env.NODE_ENV === 'development';
      if (process.platform === 'win32' && !isDevEnv) {
        app.setLoginItemSettings({
          openAtLogin: true,
          path: process.execPath,
          args: []
        });
        const current = app.getLoginItemSettings();
        console.log(`Auto-inicio Windows: ${current.openAtLogin ? 'habilitado' : 'deshabilitado'}`);
      }
    } catch (autoErr) {
      console.warn('No se pudo configurar el inicio automático:', autoErr.message);
    }
    
    // Iniciar verificación periódica de conexión
    setInterval(verificarConexionBD, 30000); // Cada 30 segundos

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  } catch (error) {
    console.error('Error durante la inicialización de la aplicación:', error);
  }
});

// Al cerrar la aplicación
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Registro de atajos globales (lo que es posible desde la app)
app.on('ready', () => {
  // Nota: Alt+Tab y Win+Tab son atajos del sistema y no pueden bloquearse desde Electron.
  // Alt+F4 sí podemos interceptarlo y anularlo a nivel de app.
  try {
    const ok = globalShortcut.register('Alt+F4', () => {
      console.log('Alt+F4 bloqueado');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
      }
      return false; // anula la acción por defecto
    });
    if (!ok) console.warn('No se pudo registrar Alt+F4');
  } catch (e) {
    console.warn('Error al registrar Alt+F4:', e.message);
  }
  console.log('Atajos: Alt+F4 bloqueado; Alt+Tab/Win+Tab no interceptables por la app');
});

// Liberar todos los atajos registrados al salir
app.on('will-quit', () => {
  try { globalShortcut.unregisterAll(); } catch (_) {}
});

// Manejadores IPC

// Obtener fecha y hora actual - Actualizado para PostgreSQL 17 con zona horaria de Perú
ipcMain.handle('obtenerFechaHora', () => {
  // PostgreSQL 17 usa formato ISO 8601 por defecto
  // Devolvemos en formato ISO 8601 pero ajustado a la zona horaria de Perú (UTC-5)
  // Esto asegura que la fecha se almacene correctamente en la base de datos
  return new Date().toISOString();
});

// Obtener estado de conexión con el servidor
ipcMain.handle('obtenerEstadoConexion', () => {
  return { 
    connected: dbConectada,
    mode: dbConectada ? 'online' : 'local',
    serverUrl: require('./database').getCurrentHost() || 'Sin conexión'
  };
});



// --- Admin IPC (acceso restringido) ---
ipcMain.handle('admin:login', (event, pin) => {
  const ok = typeof pin === 'string' && pin === SUPER_ADMIN_PIN;
  adminSessionActive = ok;
  return { success: ok };
});

ipcMain.handle('admin:logout', () => {
  adminSessionActive = false;
  return { success: true };
});

ipcMain.handle('admin:listarUsuarios', async (event, { page = 1, pageSize = 20, filtro = {} } = {}) => {
  if (!adminSessionActive) return { success: false, message: 'No autorizado' };
  try {
    const db = require('./database');
    if (db.isConnected() && db.sequelize) {
      const offset = (page - 1) * pageSize;
      const Usuario = db.sequelize.models.usuario;
      const where = {};
      if (filtro.codigo) where.codigo = filtro.codigo;
      const { count, rows } = await Usuario.findAndCountAll({ where, limit: pageSize, offset, order: [['id','DESC']] });
      const mapped = rows.map((u) => ({
        id: u.id,
        codigo: u.codigo,
        nombre: u.nombre,
        perfil: u.perfil,
        escuela: u.escuela,
        fecha_registro: u.fecha_registro ?? u.createdAt ?? null,
      }));
      return { success: true, data: mapped, total: count, mode: 'online' };
    } else {
      const fs = require('fs');
      const path = require('path');
      const usuariosPath = path.join(app.getPath('userData'), 'data', 'usuarios.json');
      const all = fs.existsSync(usuariosPath) ? JSON.parse(fs.readFileSync(usuariosPath, 'utf8')) : [];
      const normalized = all.map((u) => ({
        id: u.id,
        codigo: u.codigo,
        nombre: u.nombre,
        perfil: u.perfil,
        escuela: u.escuela,
        fecha_registro: u.fecha_registro || u.fecha || null,
        sincronizado: u.sincronizado,
      }));
      const filtrados = filtro.codigo ? normalized.filter(u => String(u.codigo) === String(filtro.codigo)) : normalized;
      const total = filtrados.length;
      const start = (page - 1) * pageSize;
      const data = filtrados.slice(start, start + pageSize);
      return { success: true, data, total, mode: 'local' };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
});

ipcMain.handle('admin:listarSesiones', async (event, { page = 1, pageSize = 20, filtro = {} } = {}) => {
  if (!adminSessionActive) return { success: false, message: 'No autorizado' };
  try {
    const db = require('./database');
    if (db.isConnected() && db.sequelize) {
      const offset = (page - 1) * pageSize;
      const InicioSesion = db.sequelize.models.iniciosesion;
      const { Op } = require('sequelize');
      const where = {};
      if (filtro.codigo) where.codigo = filtro.codigo;
      if (filtro.fechaDesde || filtro.fechaHasta) {
        where.fecha = {};
        if (filtro.fechaDesde) where.fecha[Op.gte] = filtro.fechaDesde;
        if (filtro.fechaHasta) where.fecha[Op.lte] = filtro.fechaHasta;
      }
      const { count, rows } = await InicioSesion.findAndCountAll({ where, limit: pageSize, offset, order: [['id','DESC']] });
      // Mapear a objetos planos para que IPC los serialice correctamente
      const data = rows.map((s) => ({
        id: s.id,
        codigo: s.codigo,
        actividad: s.actividad,
        tiempoestimado: s.tiempoestimado,
        numeroequipo: s.numeroequipo,
        fecha: s.fecha ?? s.createdAt ?? null, // Mantenemos 'fecha' para sesiones
        horainicio: s.horainicio,
        sincronizado: true,
      }));
      return { success: true, data, total: count, mode: 'online' };
    } else {
      const fs = require('fs');
      const path = require('path');
      const sesionesPath = path.join(app.getPath('userData'), 'data', 'sesiones.json');
      const all = fs.existsSync(sesionesPath) ? JSON.parse(fs.readFileSync(sesionesPath, 'utf8')) : [];
      let filtrados = all;
      if (filtro.codigo) filtrados = filtrados.filter(s => String(s.codigo) === String(filtro.codigo));
      if (filtro.fechaDesde) filtrados = filtrados.filter(s => s.fecha >= filtro.fechaDesde);
      if (filtro.fechaHasta) filtrados = filtrados.filter(s => s.fecha <= filtro.fechaHasta);
      const total = filtrados.length;
      const start = (page - 1) * pageSize;
      const data = filtrados.slice(start, start + pageSize);
      return { success: true, data, total, mode: 'local' };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// Eliminar sesión (admin)
ipcMain.handle('admin:eliminarSesion', async (event, { id } = {}) => {
  if (!adminSessionActive) return { success: false, message: 'No autorizado' };
  if (!id) return { success: false, message: 'Parámetros inválidos' };
  try {
    const db = require('./database');
    if (db.isConnected() && db.sequelize) {
      const InicioSesion = db.sequelize.models.iniciosesion;
      const n = await InicioSesion.destroy({ where: { id } });
      return { success: n > 0 };
    } else {
      const fs = require('fs');
      const path = require('path');
      const sesionesPath = path.join(app.getPath('userData'), 'data', 'sesiones.json');
      const all = fs.existsSync(sesionesPath) ? JSON.parse(fs.readFileSync(sesionesPath, 'utf8')) : [];
      const next = all.filter((s) => s.id !== id);
      fs.writeFileSync(sesionesPath, JSON.stringify(next, null, 2));
      return { success: true };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// Eliminar usuario (admin)
ipcMain.handle('admin:eliminarUsuario', async (event, { id, codigo } = {}) => {
  if (!adminSessionActive) return { success: false, message: 'No autorizado' };
  try {
    const db = require('./database');
    if (db.isConnected() && db.sequelize) {
      const Usuario = db.sequelize.models.usuario;
      const InicioSesion = db.sequelize.models.iniciosesion;
      const where = {};
      if (id) where.id = id; else if (codigo) where.codigo = codigo; else return { success: false, message: 'Parámetros inválidos' };
      
      // Primero eliminar las sesiones asociadas al usuario
      try {
        // Obtener el código del usuario si solo tenemos el ID
        let userCodigo = codigo;
        if (id && !codigo) {
          const user = await Usuario.findByPk(id);
          if (user) userCodigo = user.codigo;
        }
        
        if (userCodigo) {
          // Eliminar todas las sesiones asociadas a este usuario
          await InicioSesion.destroy({ where: { codigo: userCodigo } });
        }
        
        // Ahora eliminar el usuario
        const n = await Usuario.destroy({ where });
        return { success: n > 0 };
      } catch (innerError) {
        return { success: false, message: innerError.message };
      }
    } else {
      const fs = require('fs');
      const path = require('path');
      const usuariosPath = path.join(app.getPath('userData'), 'data', 'usuarios.json');
      const all = fs.existsSync(usuariosPath) ? JSON.parse(fs.readFileSync(usuariosPath, 'utf8')) : [];
      const next = all.filter((u) => (id ? u.id !== id : u.codigo !== codigo));
      fs.writeFileSync(usuariosPath, JSON.stringify(next, null, 2));
      return { success: true };
    }
  } catch (e) {
    return { success: false, message: e.message };
  }
});

// Registrar nuevo usuario
ipcMain.handle('registrarUsuario', async (event, datosRegistro) => {
  try {
    console.log('Recibida solicitud para registrar usuario:', datosRegistro.codigo);
    
    // Verificar conexión rápidamente sin esperar
    const db = require('./database');
    const isConnected = db.isConnected();
    
    // Intentar registrar usuario
    const resultado = await guardarUsuario(datosRegistro);
    
    console.log('Resultado registro de usuario:', resultado);

    // Si el usuario ya existe, indicar que debe redirigir a login
    if (!resultado.success && resultado.redirectToLogin) {
      mainWindow.webContents.send('redirigir-a-login', { mensaje: resultado.message });
    }

    // Retornar el resultado del registro
    return {
      ...resultado,
      mode: isConnected ? 'online' : 'local',
      message: resultado.mode === 'local' ? (resultado.message || 'Registro exitoso (modo local)') : (resultado.message || 'Usuario registrado correctamente')
    };

  } catch (error) {
    console.error('Error al procesar solicitud de registro:', error);
    return { 
      success: false, 
      message: `Error al registrar: ${error.message}`, 
      online: dbConectada,
      mode: 'local'
    };
  }
});

// Iniciar sesión de usuario (autenticar)
ipcMain.handle('iniciarSesion', async (event, datosSesion) => {
  try {
    console.log('Recibida solicitud para iniciar sesión:', datosSesion.codigo);
    
    // Verificar conexión rápidamente sin esperar
    const db = require('./database');
    const isConnected = db.isConnected();
    
    // Buscar usuario
    const resultado = await buscarUsuarioPorCodigo(datosSesion.codigo);
    
    if (!resultado.usuario) {
      // Si el usuario no se encuentra y se necesita registro, enviar evento para redirigir
      if (resultado.needsRegistration) {
        mainWindow.webContents.send('redirigir-a-registro', { mensaje: 'Usuario no encontrado. Por favor regístrese primero.' });
      }
      
      return { 
        success: false, 
        message: resultado.error || 'Usuario no encontrado', 
        online: isConnected,
        mode: isConnected ? 'online' : 'local',
        needsRegistration: resultado.needsRegistration
      };
    }
    
    // Si el usuario existe, registrar la sesión
    const resultadoSesion = await guardarSesion(datosSesion);
    
    console.log('Resultado inicio sesión:', resultadoSesion);

    // Si el inicio de sesión es exitoso, retornar éxito al frontend
    if (resultadoSesion.success) {
      console.log('✅ Inicio de sesión exitoso. Informando al frontend.');
      
      return {
        success: true,
        message: resultadoSesion.mode === 'local' ? (resultadoSesion.message || 'Inicio de sesión exitoso (modo local)') : (resultadoSesion.message || 'Sesión iniciada correctamente'),
        mode: resultadoSesion.mode,
        usuario: {
          codigo: resultado.usuario.codigo,
          nombre: resultado.usuario.nombre,
          perfil: resultado.usuario.perfil,
          escuela: resultado.usuario.escuela
        }
      };
    }

    // Si no fue exitoso, retornar el mensaje de error
    return {
      success: false,
      message: resultadoSesion.message, 
      online: isConnected,
      mode: isConnected ? 'online' : 'local'
    };

  } catch (error) {
    console.error('Error al procesar inicio de sesión:', error);
    return { 
      success: false, 
      message: `Error al iniciar sesión: ${error.message}`, 
      online: isConnected,
      mode: 'local'
    };
  }
});

// Manejador para cerrar la aplicación a petición del frontend
ipcMain.on('cerrar-aplicacion', () => {
  console.log('Recibida solicitud del frontend para cerrar la aplicación.');
  
  // Forzar el cierre de todas las ventanas
  if (mainWindow) {
    mainWindow.destroy();
  }
  
  // Cerrar la aplicación completamente
  app.exit(0);
});

// Forzar sincronización de datos
ipcMain.handle('sincronizarDatos', async () => {
  try {
    // Verificar conexión primero
    const estaConectado = await verificarConexionBD();
    
    if (!estaConectado) {
      return { 
        success: false, 
        message: 'No hay conexión con el servidor central' 
      };
    }
    
    // Sincronizar datos pendientes
    const resultado = await sincronizarDatosPendientes();
    
    return { 
      success: resultado, 
      message: resultado ? 'Sincronización completada' : 'Error al sincronizar' 
    };
  } catch (error) {
    console.error('Error al sincronizar datos:', error);
    return { 
      success: false, 
      message: `Error al sincronizar: ${error.message}` 
    };
  }
});