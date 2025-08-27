/// <reference types="react-scripts" />

interface Window {
  electronAPI?: {
    guardarRegistro: (datosRegistro: any) => Promise<{
      success: boolean;
      message: string;
      online?: boolean;
    }>;
    autenticarUsuario: (data: { codigo: string }) => Promise<{
      success: boolean;
      message?: string;
      usuario?: any;
      online?: boolean;
    }>;
    guardarSesion: (data: any) => Promise<{
      success: boolean;
      online?: boolean;
      message?: string;
    }>;
    obtenerEstadoConexion: () => Promise<{
      online: boolean;
      db: boolean;
    }>;
    obtenerFechaHora: () => Promise<string>;
  };
}