// Definición de tipos para la API de Electron
interface AuthData {
  codigo: string;
  actividad: string;
  tiempo: string;
  equipo: string;
  fechaHora?: string;
}

interface UserData {
  perfil: string;
  codigo: string;
  nombre: string;
  escuela: string;
  fecha_registro?: string;
}

// Declaraciones de tipos para la API de Electron expuesta al frontend
export interface IElectronAPI {
  // Define aquí los métodos y propiedades que expones desde main.js a preload.js y luego al frontend
  // Ejemplo:
  // loadPreferences: () => Promise<any>;
  // savePreferences: (prefs: any) => Promise<void>;
  
  // Métodos y propiedades expuestas desde preload.js
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, func: (...args: any[]) => void) => () => void;
    send: (channel: string, ...args: any[]) => void;
  };

  // Manejadores IPC que el frontend puede invocar (desde main.js)
  obtenerFechaHora: () => Promise<string>;
  obtenerEstadoConexion: () => Promise<{ online: boolean; serverUrl: string; db?: boolean }>;
  registrarUsuario: (datosRegistro: any) => Promise<any>;
  iniciarSesion: (datosSesion: any) => Promise<any>;
  cerrarAplicacion: () => void;
  adminLogin: (pin: string) => Promise<{ success: boolean }>;
  adminLogout: () => Promise<{ success: boolean }>;
  adminListarUsuarios: (params: { page?: number; pageSize?: number; filtro?: any }) => Promise<any>;
  adminListarSesiones: (params: { page?: number; pageSize?: number; filtro?: any }) => Promise<any>;
  adminEliminarUsuario: (params: { id?: number; codigo?: string }) => Promise<{ success: boolean; message?: string }>;
  adminEliminarSesion: (params: { id: number }) => Promise<{ success: boolean; message?: string }>;

  // Otros métodos si los tienes...
}

// Extender la interfaz Window para incluir electronAPI
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

export {}; 