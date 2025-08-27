const { contextBridge, ipcRenderer } = require('electron');

// Función para hacer log en la consola del renderer
function log(...args) {
  console.log('[Preload]:', ...args);
}

log('Preload script ejecutándose');

// Configurar eventos de redirección
const setupRedirectionEvents = () => {
  // Evento para redireccionar al login cuando un usuario intenta registrarse con un código existente
  ipcRenderer.on('redirigir-a-login', (event, data) => {
    window.dispatchEvent(new CustomEvent('redirigir-a-login', { detail: data }));
  });

  // Evento para redireccionar al registro cuando un usuario intenta iniciar sesión con un código no registrado
  ipcRenderer.on('redirigir-a-registro', (event, data) => {
    window.dispatchEvent(new CustomEvent('redirigir-a-registro', { detail: data }));
  });
  
  // Evento para actualizar el estado de conexión de la base de datos
  ipcRenderer.on('db-connection-status', (event, data) => {
    console.log('Recibido estado de conexión:', data);
    window.dispatchEvent(new CustomEvent('db-connection-status', { detail: data }));
  });
};

// Inicializar eventos de redirección
setupRedirectionEvents();

// Exponer funciones protegidas a la aplicación web
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Métodos existentes (mantenidos para compatibilidad)
    guardarRegistro: async (datosRegistro) => {
      try {
        // Usar el nuevo endpoint registrarUsuario
        return await ipcRenderer.invoke('registrarUsuario', datosRegistro);
      } catch (error) {
        console.error('Error al guardar registro:', error);
        return { success: false, message: error.message };
      }
    },
    
    guardarSesion: async (datosSesion) => {
      try {
        // Usar el nuevo método iniciarSesion pero solo retornar la parte de sesión
        const resultado = await ipcRenderer.invoke('iniciarSesion', datosSesion);
        return { 
          success: resultado.success, 
          message: resultado.message,
          online: resultado.online 
        };
      } catch (error) {
        console.error('Error al guardar sesión:', error);
        return { success: false, message: error.message };
      }
    },
    
    autenticarUsuario: async (datos) => {
      try {
        // Simulamos la autenticación con el nuevo método
        const datosSesion = {
          codigo: datos.codigo,
          actividad: 'Autenticación',
          tiempo: '5 minutos',
          equipo: 'PC1'
        };
        
        const resultado = await ipcRenderer.invoke('iniciarSesion', datosSesion);
        
        // Solo retornar la parte de autenticación
        return { 
          success: resultado.success, 
          message: resultado.message,
          usuario: resultado.usuario,
          online: resultado.online,
          needsRegistration: resultado.needsRegistration
        };
      } catch (error) {
        console.error('Error al autenticar usuario:', error);
        return { success: false, message: error.message };
      }
    },
    
    // Nuevos métodos
    iniciarSesion: async (datosSesion) => {
      try {
        return await ipcRenderer.invoke('iniciarSesion', datosSesion);
      } catch (error) {
        console.error('Error al iniciar sesión:', error);
        return { success: false, message: error.message, online: false };
      }
    },
    
    registrarUsuario: async (datosRegistro) => {
      try {
        return await ipcRenderer.invoke('registrarUsuario', datosRegistro);
      } catch (error) {
        console.error('Error al registrar usuario:', error);
        return { success: false, message: error.message, online: false };
      }
    },
    
    sincronizarDatos: async () => {
      try {
        return await ipcRenderer.invoke('sincronizarDatos');
      } catch (error) {
        console.error('Error al sincronizar datos:', error);
        return { success: false, message: error.message };
      }
    },
    
    // Nuevo método para verificar datos en BD (debug)
    verificarDatosBD: async () => {
      try {
        return await ipcRenderer.invoke('verificarDatosBD');
      } catch (error) {
        console.error('Error al verificar datos en BD:', error);
        return { success: false, message: error.message };
      }
    },
    
    // Estado de conexión
    obtenerEstadoConexion: async () => {
      try {
        const estado = await ipcRenderer.invoke('obtenerEstadoConexion');
        return { 
          online: estado.connected,
          mode: estado.mode
        };
      } catch (error) {
        console.error('Error al obtener estado de conexión:', error);
        return { online: false, mode: 'local' };
      }
    },
    
    // Sistema
    obtenerFechaHora: async () => {
      try {
        return await ipcRenderer.invoke('obtenerFechaHora');
      } catch (error) {
        console.error('Error al obtener fecha y hora:', error);
        return new Date().toISOString();
      }
    },
    
    cerrarAplicacion: () => ipcRenderer.send('cerrar-aplicacion'),

    // --- Admin ---
    adminLogin: async (pin) => {
      try { return await ipcRenderer.invoke('admin:login', pin); } catch (e) { return { success: false, message: e.message }; }
    },
    adminLogout: async () => {
      try { return await ipcRenderer.invoke('admin:logout'); } catch (e) { return { success: false, message: e.message }; }
    },
    adminListarUsuarios: async (params) => {
      try { return await ipcRenderer.invoke('admin:listarUsuarios', params); } catch (e) { return { success: false, message: e.message }; }
    },
    adminListarSesiones: async (params) => {
      try { return await ipcRenderer.invoke('admin:listarSesiones', params); } catch (e) { return { success: false, message: e.message }; }
    },
    adminEliminarUsuario: async (params) => {
      try { return await ipcRenderer.invoke('admin:eliminarUsuario', params); } catch (e) { return { success: false, message: e.message }; }
    },
    adminEliminarSesion: async (params) => {
      try { return await ipcRenderer.invoke('admin:eliminarSesion', params); } catch (e) { return { success: false, message: e.message }; }
    },
    
    // Función de prueba
    testPing: async (data) => {
      try { return await ipcRenderer.invoke('test:ping', data); } catch (e) { return { success: false, message: e.message }; }
    },
  });
  
  log('API de Electron expuesta correctamente');
} catch (error) {
  console.error('Error al exponer API de Electron:', error);
} 