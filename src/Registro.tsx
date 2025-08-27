import React, { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from './assets/logo.png';

// Define type for electronAPI for type checking
type ElectronAPI = {
  obtenerFechaHora: () => Promise<string>;
  obtenerEstadoConexion: () => Promise<{ online: boolean; mode: string }>;
  guardarRegistro: (datosRegistro: any) => Promise<{ success: boolean; message: string; online?: boolean }>;
  autenticarUsuario: (data: { codigo: string }) => Promise<{ success: boolean; message?: string; usuario?: any; online?: boolean }>;
  guardarSesion: (data: any) => Promise<{ success: boolean; message: string; online?: boolean }>;
  registrarUsuario: (data: any) => Promise<{ success: boolean; message: string; online?: boolean; mode?: string }>;
  iniciarSesion: (data: any) => Promise<{ success: boolean; message: string; online?: boolean; mode?: string }>;
};

function Registro() {
  const navigate = useNavigate();
  const [fechaRegistro, setFechaRegistro] = useState<string>('');
  const [perfil, setPerfil] = useState<string>('');
  const [codigo, setCodigo] = useState<string>('');
  const [mostrarCodigo, setMostrarCodigo] = useState<boolean>(false);
  const [nombre, setNombre] = useState<string>('');
  const [escuela, setEscuela] = useState<string>('');
  const [isElectron, setIsElectron] = useState<boolean>(false);
  const [mostrarAlerta, setMostrarAlerta] = useState<boolean>(false);
  const [errores, setErrores] = useState({
    codigo: '',
    nombre: ''
  });
  const [mensajeAlerta, setMensajeAlerta] = useState({
    titulo: '',
    mensaje: '',
    tipo: 'exito'
  });

  // Detectar si estamos en Electron
  useEffect(() => {
    setIsElectron(typeof window !== 'undefined' && window.electronAPI !== undefined);
    
    // Función para escuchar eventos de redirección
    const handleRedirectToLogin = (event: any) => {
      console.log('Se recibió evento para redirigir a login:', event.detail);
      setMensajeAlerta({
        titulo: 'Usuario ya registrado',
        mensaje: event.detail.mensaje || 'Este código ya está registrado. Por favor, inicie sesión.',
        tipo: 'info'
      });
      setMostrarAlerta(true);
      
      // Configurar redirección después de cerrar la alerta
      const timer = setTimeout(() => {
        navigate('/');
      }, 2000);
      
      return () => clearTimeout(timer);
    };
    
    // Registrar eventos
    window.addEventListener('redirigir-a-login', handleRedirectToLogin);
    
    return () => {
      window.removeEventListener('redirigir-a-login', handleRedirectToLogin);
    };
  }, [navigate]);

  // Actualizar la fecha y hora actual
  useEffect(() => {
    if (isElectron && typeof window !== 'undefined' && window.electronAPI) {
      // Usar async/await para manejar la promesa
      // Actualizado para PostgreSQL 17
      const actualizarFecha = async () => {
        try {
          if (window.electronAPI) {
            // obtenerFechaHora devuelve en formato ISO 8601 compatible con PostgreSQL 17
            const fecha = await window.electronAPI.obtenerFechaHora();
            // Convertimos a formato legible para mostrar al usuario
            const d = new Date(fecha);
            setFechaRegistro(d.toLocaleString());
          } else {
            // Si no está disponible electronAPI, usamos el método del navegador ajustado a Perú
            const d = new Date();
            const fechaPeru = new Date(d.getTime() - (5 * 60 * 60 * 1000));
            
            const dia = fechaPeru.getUTCDate().toString().padStart(2, '0');
            const mes = (fechaPeru.getUTCMonth() + 1).toString().padStart(2, '0');
            const anio = fechaPeru.getUTCFullYear();
            const hora = fechaPeru.getUTCHours().toString().padStart(2, '0');
            const min = fechaPeru.getUTCMinutes().toString().padStart(2, '0');
            const seg = fechaPeru.getUTCSeconds().toString().padStart(2, '0');
            
            setFechaRegistro(`${dia}/${mes}/${anio} ${hora}:${min}:${seg}`);
          }
        } catch (error) {
          console.error('Error al obtener fecha y hora:', error);
          // En caso de error, usar el método del navegador
          setFechaRegistro(new Date().toLocaleString());
        }
      };
      
      // Llamar inmediatamente
      actualizarFecha();
      
      // Actualizar cada minuto
      const interval = setInterval(actualizarFecha, 60000);
      
      return () => clearInterval(interval);
    } else {
      // Método del navegador
      const ahora = new Date();
      setFechaRegistro(ahora.toLocaleString());
      
      // Actualizar cada minuto
      const interval = setInterval(() => {
        setFechaRegistro(new Date().toLocaleString());
      }, 60000);
      
      return () => clearInterval(interval);
    }
  }, [isElectron]);

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

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setNombre(valor);
    validarNombre(valor);
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleAceptarAlerta = () => {
    const mensajeActual = mensajeAlerta.mensaje;
    const tipoMensaje = mensajeAlerta.tipo;
    setMostrarAlerta(false);

    // Si es un mensaje de éxito, redirigir al formulario de inicio de sesión
    if (tipoMensaje === 'exito') {
      navigate('/');
    } else {
      // Si es un error, volver al formulario de inicio de sesión
      navigate('/');
    }
  };

  const toggleMostrarCodigo = () => {
    setMostrarCodigo(!mostrarCodigo);
  };

  const handleRegistro = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Validar que todos los campos estén completos
    if (!perfil || !codigo || !nombre || !escuela) {
      alert('Por favor complete todos los campos del formulario');
      return;
    }

    // Validar el formato del código y nombre
    if (!validarCodigo(codigo) || !validarNombre(nombre)) {
      return;
    }
    
    const datosRegistro = {
      perfil,
      codigo,
      nombre,
      escuela,
      fecha_registro: new Date().toISOString()
    };
    
    if (isElectron && typeof window !== 'undefined' && window.electronAPI) {
      try {
        // Usar el nuevo método registrarUsuario directamente
        const resultado = await (window.electronAPI as any).registrarUsuario(datosRegistro);
        
        if (resultado.success) {
          const msg = resultado?.mode === 'local'
            ? (resultado.message || 'Registro exitoso (modo local)')
            : (resultado.message || 'Usuario registrado correctamente');
          setMensajeAlerta({
            titulo: 'Registro exitoso',
            mensaje: msg,
            tipo: 'exito'
          });
          setMostrarAlerta(true);
        } else {
          let mensaje = resultado.message || 'Ocurrió un error al procesar el registro';
          setMensajeAlerta({
            titulo: 'Error de registro',
            mensaje,
            tipo: 'error'
          });
          setMostrarAlerta(true);
        }
      } catch (error) {
        console.error('Error al guardar el registro:', error);
        setMensajeAlerta({
          titulo: 'Error de sistema',
          mensaje: 'Ocurrió un error al comunicarse con el sistema. Por favor intente nuevamente.',
          tipo: 'error'
        });
        setMostrarAlerta(true);
      }
    } else {
      // Versión web - simulamos el guardado
      console.log('Datos de registro (modo web):', datosRegistro);
      setMensajeAlerta({
        titulo: 'Registro exitoso',
        mensaje: 'Usuario registrado correctamente',
        tipo: 'exito'
      });
      setMostrarAlerta(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#001640] relative overflow-hidden flex items-center justify-center p-6">
      {/* Fondo azul oscuro simple */}
      <div className="absolute top-0 left-0 w-full h-full bg-[#001640]"></div>
      
      {/* Contenedor principal con borde brillante azul cielo */}
      <div className="w-full max-w-md bg-[#002862] rounded-xl overflow-hidden shadow-2xl relative z-10 border-2 border-[#4DA6FF] shadow-[0_0_15px_rgba(77,166,255,0.5)]">
        <div className="p-8">
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
          <form className="space-y-5" onSubmit={handleRegistro}>
            {/* Perfil */}
            <div>
              <label className="flex items-center text-white text-sm font-medium mb-2">
                <svg className="h-5 w-5 mr-2 text-[#4DA6FF]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Perfil
              </label>
              <select
                className="block w-full px-3 py-3 bg-[#003a7a] border-0 text-white placeholder-[#B0C4DE]/80 focus:outline-none rounded-lg appearance-none"
                value={perfil}
                onChange={(e) => setPerfil(e.target.value)}
                required
              >
                <option value="" disabled className="bg-[#002B5C]">Seleccione el perfil</option>
                <option value="Estudiante" className="bg-[#002B5C]">Estudiante</option>
                <option value="Docente" className="bg-[#002B5C]">Docente</option>
                <option value="Otros" className="bg-[#002B5C]">Otros</option>
              </select>
            </div>
            
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
            
            {/* Nombre completo */}
            <div>
              <label className="flex items-center text-white text-sm font-medium mb-2">
                <svg className="h-5 w-5 mr-2 text-[#4DA6FF]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Nombre y Apellidos
              </label>
              <input
                type="text"
                className="block w-full px-3 py-3 bg-[#003a7a] border-0 text-white placeholder-[#B0C4DE]/80 focus:outline-none rounded-lg"
                placeholder="Ingrese su nombre completo"
                value={nombre}
                onChange={handleNombreChange}
                required
                spellCheck={false}
              />
              {errores.nombre && (
                <p className="text-red-500 text-xs mt-1">{errores.nombre}</p>
              )}
            </div>

            {/* Escuela */}
            <div>
              <label className="flex items-center text-white text-sm font-medium mb-2">
                <svg className="h-5 w-5 mr-2 text-[#4DA6FF]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                  <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
                </svg>
                Escuela
              </label>
              <select
                className="block w-full px-3 py-3 bg-[#003a7a] border-0 text-white placeholder-[#B0C4DE]/80 focus:outline-none rounded-lg appearance-none"
                value={escuela}
                onChange={(e) => setEscuela(e.target.value)}
                required
              >
                <option value="" disabled className="bg-[#002B5C]">Seleccione la escuela</option>
                <option value="Enfermería" className="bg-[#002B5C]">Enfermería</option>
                <option value="Obstetricia" className="bg-[#002B5C]">Obstetricia</option>
                <option value="Otros" className="bg-[#002B5C]">Otros</option>
              </select>
            </div>

            {/* Buttons */}
            <div className="pt-6 flex gap-4">
              <button
                type="button"
                onClick={handleBack}
                className="flex-1 py-3 px-4 border-0 rounded-lg text-sm font-medium text-white bg-[#2366cc]"
              >
                Regresar
              </button>
              <button
                type="submit"
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
            <div className="bg-gradient-to-r from-[#4DA6FF] to-[#0056b3] p-4 text-center">
              <div className="rounded-full bg-white/20 w-16 h-16 mx-auto flex items-center justify-center">
                <svg className="h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h3 className="text-white text-lg font-bold mt-3">{mensajeAlerta.titulo}</h3>
            </div>
            <div className="p-6 text-center">
              <p className="text-gray-600 mb-6">{mensajeAlerta.mensaje}</p>
              <button
                onClick={handleAceptarAlerta}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-[#4DA6FF] to-[#0056b3] text-white font-medium hover:from-[#3d8bde] hover:to-[#00489a] transition-all duration-300 shadow-md"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Registro;