// Eliminamos la importación innecesaria de React
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Verificamos si el archivo logo.png existe en la carpeta assets
import logo from './assets/logo.png';
import { AlertCircle, Database, Laptop, Clock, Activity, EyeIcon, EyeOffIcon } from 'lucide-react';

// Definimos la interfaz para los datos de autenticación
interface AuthData {
  codigo: string;
  actividad: string;
  tiempo: string;
  equipo: string;
}

// Definir la interfaz para mensajeAlerta
interface MensajeAlerta {
  mensaje: string;
  tipo: 'exito' | 'error';
}

// Definir la interfaz para el estado
interface EstadoApp {
  fechaHora: string;
  codigo: string;
  mostrarCodigo: boolean;
  actividad: string;
  tiempo: string;
  tiempoPersonalizado: string;
  equipo: string;
  isElectron: boolean;
  mostrarAlerta: boolean;
  mensajeAlerta: MensajeAlerta;
  errores: Record<string, string>;
  conexion: boolean;
  conexionDB: boolean;
}

// Quitamos las declaraciones redundantes de electronAPI
// Ya están definidas correctamente en src/types/electron.d.ts

function App() {
  const navigate = useNavigate();
  const [fechaHora, setFechaHora] = useState<string>('');
  const [codigo, setCodigo] = useState<string>('');
  const [mostrarCodigo, setMostrarCodigo] = useState<boolean>(false);
  const [actividad, setActividad] = useState<string>('');
  const [tiempo, setTiempo] = useState<string>('');
  const [tiempoPersonalizado, setTiempoPersonalizado] = useState<string>('');
  const [equipo, setEquipo] = useState<string>('');
  const [isElectron, setIsElectron] = useState<boolean>(false);
  const [mostrarAlerta, setMostrarAlerta] = useState<boolean>(false);
  const [mensajeAlerta, setMensajeAlerta] = useState<MensajeAlerta>({ mensaje: '', tipo: 'error' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [conexion, setConexion] = useState<boolean>(false);
  const [conexionDB, setConexionDB] = useState<boolean>(false);
  const [mostrarBotonAceptar, setMostrarBotonAceptar] = useState<boolean>(false);
  const [mensajeResultadoLogin, setMensajeResultadoLogin] = useState<string>('');
  const [adminVisible, setAdminVisible] = useState<boolean>(false);
  const [adminPin, setAdminPin] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [mostrarAdminPin, setMostrarAdminPin] = useState<boolean>(false);

  useEffect(() => {
    // Detectar si estamos en Electron
    const electronDetected = typeof window !== 'undefined' && window.electronAPI !== undefined;
    setIsElectron(electronDetected);
    
    // Obtener la fecha y hora actual
    const obtenerFechaHora = async () => {
      try {
        if (window.electronAPI) {
          const fecha = await window.electronAPI.obtenerFechaHora();
          setFechaHora(fecha);
        }
      } catch (error) {
        console.error('Error al obtener fecha y hora:', error);
      }
    };

    // Verificar estado de conexión
    const verificarConexion = async () => {
      try {
        if (window.electronAPI) {
          const estado = await window.electronAPI.obtenerEstadoConexion();
          setConexion(estado.online);
          // Guardamos también el estado de conexión de la base de datos si existe
          if ('db' in estado) {
            setConexionDB(estado.db);
          }
        }
      } catch (error) {
        console.error('Error al verificar conexión:', error);
        setConexion(false);
        setConexionDB(false);
      }
    };
    
    // Función para escuchar eventos de redirección
    const handleRedirectToRegister = (event: any) => {
      console.log('Se recibió evento para redirigir a registro:', event.detail);
      setMensajeAlerta({ mensaje: event.detail.mensaje || 'Este usuario no está registrado. Por favor, regístrese primero.', tipo: 'error' });
      setMostrarAlerta(true);
      
      // Configurar redirección después de cerrar la alerta
      const timer = setTimeout(() => {
        navigate('/registro');
      }, 2000);
      
      return () => clearTimeout(timer);
    };
    
    // Función para escuchar actualizaciones del estado de conexión
    const handleDbConnectionStatus = (event: any) => {
      console.log('Actualización de estado de conexión recibida:', event.detail);
      setConexion(event.detail.connected);
      setConexionDB(event.detail.db);
    };
    
    // Inicializar
    obtenerFechaHora();
    verificarConexion();
    // Atajo para abrir modal de admin: Ctrl+Shift+D
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setAdminVisible(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown as any);
    
    // Registrar eventos
    window.addEventListener('redirigir-a-registro', handleRedirectToRegister);
    window.addEventListener('db-connection-status', handleDbConnectionStatus);
    
    // Configurar intervalos
    const intervalFechaHora = setInterval(obtenerFechaHora, 1000);
    const intervalConexion = setInterval(verificarConexion, 30000);
    
    return () => {
      clearInterval(intervalFechaHora);
      clearInterval(intervalConexion);
      window.removeEventListener('redirigir-a-registro', handleRedirectToRegister);
      window.removeEventListener('db-connection-status', handleDbConnectionStatus);
    };
    return () => {
      window.removeEventListener('keydown', handleKeyDown as any);
    };
  }, [isElectron, navigate]);

  useEffect(() => {
    if (!adminVisible) return;
    const handleAdminKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        intentarLoginAdmin();
      } else if (e.key === 'Escape') {
        setAdminVisible(false);
      }
    };
    window.addEventListener('keydown', handleAdminKeyDown);
    return () => window.removeEventListener('keydown', handleAdminKeyDown);
  }, [adminVisible, adminPin]);

  // Validar que el código solo contiene números y puntos
  const validarCodigo = (valor: string) => {
    // Si está vacío, no mostrar error
    if (!valor.trim()) {
      setErrores({...errores, codigo: ''});
      return false;
    }
    
    // Validar que contiene solo números y puntos
    const regex = /^[0-9.]*$/;
    if (!regex.test(valor)) {
      setErrores({...errores, codigo: 'Solo se permiten números y puntos'});
      return false;
    }
    
    // Validar longitud mínima
    if (valor.length < 8) {
      setErrores({...errores, codigo: 'El código debe tener al menos 8 caracteres'});
      return false;
    }
    
    // Si pasa todas las validaciones
    setErrores({...errores, codigo: ''});
    return true;
  };

  // Validar que el nombre solo contiene letras y espacios
  const validarNombre = (valor: string) => {
    const regex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]*$/;
    if (!regex.test(valor)) {
      setErrores({...errores, nombre: 'Solo se permiten letras y espacios'});
      return false;
    } else {
      setErrores({...errores, nombre: ''});
      return true;
    }
  };

  const handleCodigoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setCodigo(valor);
    validarCodigo(valor);
  };

  const handleAceptarAlerta = () => {
    const mensajeActual = mensajeAlerta.mensaje;
    const tipoMensaje = mensajeAlerta.tipo;
    setMostrarAlerta(false); // Ocultar la alerta siempre

    // Si es un mensaje de éxito, cerrar la aplicación
    if (tipoMensaje === 'exito') {
        if (isElectron && window.electronAPI) {
            window.electronAPI.cerrarAplicacion();
        }
    } else if (mensajeActual === 'Usted no está registrado') {
        // Redirigir al formulario de registro después de un breve retraso
        setTimeout(() => {
            navigate('/registro');
        }, 1000); // Retraso de 1000ms (1 segundo)
    } else if (mensajeActual === 'Este código ya está registrado') {
         // Redirigir al formulario de inicio de sesión después de un breve retraso
         setTimeout(() => {
             navigate('/');
         }, 1000); // Retraso de 1000ms (1 segundo)
    }
    // Limpiar el mensaje de resultado del login para la próxima operación
    setMensajeResultadoLogin('');
  };

  const mostrarMensajeExito = (mensaje: string = 'Sesión iniciada con éxito') => {
    setMensajeAlerta({ mensaje, tipo: 'exito' });
    setMostrarAlerta(true);
  };

  const mostrarMensajeError = (mensaje: string) => {
    setMensajeAlerta({ mensaje, tipo: 'error' });
    setMostrarAlerta(true);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar que todos los campos estén completos
    if (!codigo || !actividad || !tiempo || !equipo) {
      mostrarMensajeError('Por favor complete todos los campos del formulario');
      return;
    }

    // Validar el formato del código
    if (!validarCodigo(codigo)) {
      return;
    }
    
    const tiempoFinal = tiempo === 'Personalizado' ? tiempoPersonalizado : tiempo;
    
    const datosLogin = {
      codigo: codigo.trim(),
      actividad: actividad,
      tiempo: tiempoFinal,
      equipo: equipo,
    };
    
    if (isElectron && typeof window !== 'undefined' && window.electronAPI) {
      try {
        const resultado = await window.electronAPI.iniciarSesion(datosLogin);
        
        console.log('Frontend: Resultado de window.electronAPI.iniciarSesion:', resultado);
        
        limpiarFormulario();

        if (resultado.success) {
          // Si el login es exitoso, mostrar mensaje (respetando modo local)
          const msg = resultado?.mode === 'local'
            ? (resultado.message || 'Inicio de sesión exitoso (modo local)')
            : (resultado.message || 'Sesión iniciada correctamente');
          mostrarMensajeExito(msg);
          setMensajeResultadoLogin(msg);
          setMostrarBotonAceptar(true);
        } else {
          console.error('Frontend: Error al iniciar sesión:', resultado.message);
          mostrarMensajeError(resultado.message || 'Error al iniciar sesión');
          setMostrarBotonAceptar(true);
        }
      } catch (error) {
        console.error('Frontend: Error en la llamada IPC de iniciarSesion:', error);
        mostrarMensajeError('Error de comunicación con el backend durante el inicio de sesión.');
        setMostrarBotonAceptar(true);
      }
    } else {
      // Simulamos autenticación en web
      console.log('Datos de inicio de sesión (modo web):', datosLogin);
      mostrarMensajeExito();
    }
  };

  const handleGoToRegistro = () => {
    navigate('/registro');
  };

  const intentarLoginAdmin = async () => {
    if (adminPin.trim().length === 0) return;
    
    const pinLimpio = adminPin.trim();
    console.log('=== DEBUG FRONTEND ===');
    console.log('PIN ingresado:', `"${adminPin}"`);
    console.log('PIN después de trim():', `"${pinLimpio}"`);
    console.log('Longitud del PIN:', pinLimpio.length);
    console.log('¿Contiene espacios?', pinLimpio.includes(' '));
    
    // Prueba de comunicación IPC
    try {
      console.log('Probando comunicación IPC...');
      const testRes = await (window as any).electronAPI?.testPing('test-data');
      console.log('Test IPC resultado:', testRes);
    } catch (error) {
      console.error('Error en test IPC:', error);
    }
    
    try {
      console.log('Enviando PIN al backend...');
      const res = await (window as any).electronAPI?.adminLogin(pinLimpio);
      console.log('Respuesta del backend:', res);
      
      if (res?.success) {
        console.log('Login exitoso, navegando a admin...');
        setIsAdmin(true);
        setAdminVisible(false);
        setAdminPin('');
        navigate('/admin');
      } else {
        console.log('Login fallido');
        setMensajeAlerta({ mensaje: 'PIN incorrecto', tipo: 'error' });
        setMostrarAlerta(true);
      }
    } catch (error) {
      console.error('Error en login admin:', error);
      setMensajeAlerta({ mensaje: 'Error al validar PIN', tipo: 'error' });
      setMostrarAlerta(true);
    }
    console.log('=== FIN DEBUG FRONTEND ===');
  };

  const toggleMostrarCodigo = () => {
    setMostrarCodigo(!mostrarCodigo);
  };

  const limpiarFormulario = () => {
    setCodigo('');
    setActividad('');
    setTiempo('');
    setEquipo('');
    setTiempoPersonalizado('');
  };

  // Formatear la fecha y hora para mostrar en formato local legible - Actualizado para PostgreSQL 17
  const fechaHoraFormateada = fechaHora
    ? (() => {
        // PostgreSQL 17 usa formato ISO 8601 por defecto (YYYY-MM-DDTHH:mm:ss.sssZ)
        // Convertimos a formato de visualización DD/MM/YYYY HH:MM
        const d = new Date(fechaHora);
        const dia = d.getDate().toString().padStart(2, '0');
        const mes = (d.getMonth() + 1).toString().padStart(2, '0');
        const anio = d.getFullYear();
        const hora = d.getHours().toString().padStart(2, '0');
        const minuto = d.getMinutes().toString().padStart(2, '0');
        return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
      })()
    : '';

  return (
    <div className="min-h-screen bg-[#002B5C] text-white">
      <div className="min-h-screen bg-[#001640] relative overflow-hidden flex items-center justify-center p-6">
        {/* Fondo azul oscuro simple */}
        <div className="absolute top-0 left-0 w-full h-full bg-[#001640]"></div>
        
        {/* Contenedor principal con borde brillante azul cielo */}
        <div className="w-full max-w-md bg-[#002862] rounded-xl overflow-hidden shadow-2xl relative z-10 border-2 border-[#4DA6FF] shadow-[0_0_15px_rgba(77,166,255,0.5)]">
          <div className="p-8">
            {isAdmin && (
              <div className="mb-4 text-xs text-yellow-300">Modo Super Administrador</div>
            )}
            {/* Logo y Header */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-48 h-48 rounded-full p-0 relative overflow-hidden border-4 border-[#4DA6FF]/50 shadow-lg">
                <div className="absolute inset-0 bg-white rounded-full flex items-center justify-center">
                  <img 
                    src={logo}
                    alt="Facultad de Ciencias Médicas - UNASAM" 
                    className="w-[90%] h-[90%] object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Form */}
            <form className="space-y-5" onSubmit={handleLogin}>
              {/* Código de Matrícula/DNI */}
              <div>
                <label className="flex items-center text-white text-sm font-medium mb-2">
                  <svg className="h-5 w-5 mr-2 text-[#4DA6FF]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  Código de matrícula o DNI
                </label>
                <div className="flex gap-2">
                  <input
                    type={mostrarCodigo ? "text" : "password"}
                    className={`block w-full px-3 py-3 bg-[#003a7a] border-0 text-white placeholder-[#B0C4DE]/80 focus:outline-none rounded-lg ${errores.codigo ? 'border-2 border-red-500' : ''}`}
                    placeholder="Ingrese su código"
                    value={codigo}
                    onChange={handleCodigoChange}
                    required
                  />
                  <button 
                    type="button"
                    className="px-3 bg-[#003a7a] text-white rounded-lg flex items-center justify-center"
                    onClick={toggleMostrarCodigo}
                  >
                    {mostrarCodigo ? (
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
                {errores.codigo && (
                  <p className="text-red-500 text-xs mt-1">{errores.codigo}</p>
                )}
              </div>

              {/* Actividad a Desarrollar */}
              <div>
                <label className="flex items-center text-white text-sm font-medium mb-2">
                  <svg className="h-5 w-5 mr-2 text-[#4DA6FF]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  Tarea que Vas a Realizar
                </label>
                <textarea
                  className="block w-full px-3 py-3 bg-[#003a7a] border-0 text-white placeholder-[#B0C4DE]/80 focus:outline-none rounded-lg resize-none"
                  placeholder="Describa la actividad"
                  rows={3}
                  value={actividad}
                  onChange={(e) => setActividad(e.target.value)}
                  required
                  spellCheck={false}
                />
              </div>

              {/* Tiempo Estimado */}
              <div>
                <label className="flex items-center text-white text-sm font-medium mb-2">
                  <svg className="h-5 w-5 mr-2 text-[#4DA6FF]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                  Uso Estimado
                </label>
                <select
                  className="block w-full px-3 py-3 bg-[#003a7a] border-0 text-white placeholder-[#B0C4DE]/80 focus:outline-none rounded-lg appearance-none"
                  value={tiempo}
                  onChange={(e) => setTiempo(e.target.value)}
                  required
                >
                  <option value="" disabled className="bg-[#002B5C]">Seleccione el tiempo</option>
                  <option value="15 minutos" className="bg-[#002B5C]">15 minutos</option>
                  <option value="30 minutos" className="bg-[#002B5C]">30 minutos</option>
                  <option value="45 minutos" className="bg-[#002B5C]">45 minutos</option>
                  <option value="60 minutos" className="bg-[#002B5C]">60 minutos</option>
                  <option value="120 minutos" className="bg-[#002B5C]">120 minutos</option>
                  <option value="Personalizado" className="bg-[#002B5C]">Otro (personalizado)</option>
                </select>
                
                {tiempo === 'Personalizado' && (
                  <input
                    type="text"
                    className="block w-full mt-2 px-3 py-3 bg-[#003a7a] border-0 text-white placeholder-[#B0C4DE]/80 focus:outline-none rounded-lg"
                    placeholder="Ingrese el tiempo (ej: 75 minutos)"
                    value={tiempoPersonalizado}
                    onChange={(e) => setTiempoPersonalizado(e.target.value)}
                    required
                  />
                )}
              </div>

              {/* Número de Equipo */}
              <div>
                <label className="flex items-center text-white text-sm font-medium mb-2">
                  <svg className="h-5 w-5 mr-2 text-[#4DA6FF]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                  Cabina N.º
                </label>
                <select
                  className="block w-full px-3 py-3 bg-[#003a7a] border-0 text-white placeholder-[#B0C4DE]/80 focus:outline-none rounded-lg appearance-none"
                  value={equipo}
                  onChange={(e) => setEquipo(e.target.value)}
                  required
                >
                  <option value="" disabled className="bg-[#002B5C]">Seleccione el equipo</option>
                  {[...Array(26)].map((_, i) => (
                    <option key={i} value={`PC${i+1}`} className="bg-[#002B5C]">
                      PC{i+1}
                    </option>
                  ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="pt-6 flex gap-4">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 border-0 rounded-lg text-sm font-medium text-white bg-[#2366cc]"
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  onClick={handleGoToRegistro}
                  className="flex-1 py-3 px-4 border-0 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-[#4DA6FF]/40 to-[#FFD700]/30"
                >
                  Registrarse
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Alerta personalizada */}
        {mostrarAlerta && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black/70" onClick={handleAceptarAlerta}></div>
            <div className="relative z-10 bg-white rounded-lg shadow-xl overflow-hidden max-w-sm w-full mx-4 transform transition-all duration-300 ease-out opacity-100 translate-y-0">
              <div className={`p-4 text-center ${mensajeAlerta.tipo === 'exito' ? 'bg-gradient-to-r from-[#4DA6FF] to-[#0056b3]' : 'bg-gradient-to-r from-[#FF4D4D] to-[#B30000]'}`}>
                <div className="rounded-full bg-white/20 w-16 h-16 mx-auto flex items-center justify-center">
                  {mensajeAlerta.tipo === 'exito' ? (
                    <svg className="h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                  ) : (
                    <svg className="h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                  )}
                </div>
                <h3 className="text-white text-lg font-bold mt-3">{mensajeAlerta.mensaje}</h3>
              </div>
              <div className="p-6 text-center">
                <div className="mb-6">
                  <div className="flex items-center space-x-2 mb-1">
                    <AlertCircle className={`h-5 w-5 ${conexion ? 'text-green-500' : 'text-red-500'}`} />
                    <span className="text-sm font-medium">
                      {conexion ? 'Conectado al servidor' : 'Sin conexión al servidor'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Database className={`h-5 w-5 ${conexionDB ? 'text-green-500' : 'text-red-500'}`} />
                    <span className="text-sm font-medium">
                      {conexionDB ? 'BD conectada' : 'BD desconectada'}
                    </span>
                  </div>
                </div>
                <p className="text-gray-600 mb-6">{mensajeAlerta.mensaje}</p>
                <button
                  onClick={handleAceptarAlerta}
                  className={`w-full py-3 rounded-lg text-white font-medium transition-all duration-300 shadow-md ${
                    mensajeAlerta.tipo === 'exito' 
                      ? 'bg-gradient-to-r from-[#4DA6FF] to-[#0056b3] hover:from-[#3d8bde] hover:to-[#00489a]' 
                      : 'bg-gradient-to-r from-[#FF4D4D] to-[#B30000] hover:from-[#e64444] hover:to-[#990000]'
                  }`}
                >
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal PIN Admin */}
        {adminVisible && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="absolute inset-0 bg-black/70" onClick={() => setAdminVisible(false)}></div>
            <div className="relative z-10 bg-white rounded-lg shadow-xl overflow-hidden max-w-sm w-full mx-4">
              <div className="bg-gradient-to-r from-[#4DA6FF] to-[#0056b3] p-4 text-center">
                <h3 className="text-white text-lg font-bold">Acceso Super Administrador</h3>
              </div>
              <div className="p-6 text-black">
                <div className="relative mb-4">
                  <input
                    type={mostrarAdminPin ? 'text' : 'password'}
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="Ingrese PIN"
                    className="w-full pl-3 pr-10 py-3 bg-[#f1f5f9] rounded-lg outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarAdminPin(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#0f172a]"
                    aria-label={mostrarAdminPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                  >
                    {mostrarAdminPin ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setAdminVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-300 text-black font-medium">Cancelar</button>
                  <button onClick={intentarLoginAdmin} className="flex-1 py-3 rounded-lg bg-[#0056b3] text-white font-medium">Ingresar</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;