const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');
const os = require('os');
let electron;
try {
  electron = require('electron');
} catch (error) {
  // Electron no disponible, usando modo de respaldo
}

// Variables para la conexión
let sequelize = null;
let dbConnected = false;
let currentHost = '10.30.1.36'; // Valor por defecto; puede ser sobrescrito por config/env
let Usuario = null;
let InicioSesion = null;
let dbInitialized = false; // Nueva bandera para controlar la inicialización de la BD
let lastCacheRefreshAtMs = 0;

// Utilidades para caché local unificada (no es otra BD; es un caché para modo offline)
function getDataDir() {
  try {
    if (electron && electron.app) {
      const dir = path.join(electron.app.getPath('userData'), 'data');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      return dir;
    }
  } catch (_) {}
  const tempDir = path.join(os.tmpdir(), 'lab_fmc_data');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function readJsonSafe(filePath, defaultValue = []) {
  try {
    if (!fs.existsSync(filePath)) return JSON.parse(JSON.stringify(defaultValue));
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || '[]');
  } catch (_) {
    return JSON.parse(JSON.stringify(defaultValue));
  }
}

function writeJsonSafe(filePath, data) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (_) {}
}

// Genera fecha local en formato YYYY-MM-DD (no UTC)
// Función actualizada para PostgreSQL 17
function getLocalDateYMD(date = new Date()) {
  // PostgreSQL 17 usa formato ISO 8601 (YYYY-MM-DD) por defecto
  // Este formato ya es compatible con el estándar ISO
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Obtener todas las direcciones IP/hosts configurados (sin fallbacks a localhost)
function getLocalIpAddresses() {
  try {
    const configPath = path.join(__dirname, 'server-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf8');
      const json = JSON.parse(raw);
      if (Array.isArray(json.hosts) && json.hosts.length > 0) {
        return [...new Set(json.hosts)];
      }
    }
  } catch (_) {}
  return ['10.30.1.36'];
}

// Define los modelos de la base de datos
function defineModels(connection) {
  // Define el modelo de usuario
  const UserModel = connection.define('usuario', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    codigo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    perfil: {
      type: DataTypes.STRING,
      allowNull: false
    },
    escuela: {
      type: DataTypes.STRING,
      allowNull: false
    },
    fecha_registro: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    timestamps: false,
    tableName: 'usuario'
  });

  // Define el modelo de iniciosesion
  const SessionModel = connection.define('iniciosesion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    codigo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    actividad: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tiempoestimado: {
      type: DataTypes.STRING,
      allowNull: true
    },
    numeroequipo: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    fecha: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW
    },
    horainicio: {
      type: DataTypes.TIME,
      defaultValue: Sequelize.fn('NOW')
    }
  }, {
    timestamps: false,
    tableName: 'iniciosesion'
  });
  
  return { Usuario: UserModel, InicioSesion: SessionModel };
}

// Configura la conexión a la base de datos
async function setupDatabase() {
  try {
    // Intentar con múltiples hosts
    const hosts = getLocalIpAddresses();
    let connected = false;
    let lastError = null;
    
    // Credenciales de conexión
    const username = 'postgres';
    const password = 'admin';
    
    // Intentar cada host en secuencia
    for (const host of hosts) {
      if (connected) break;
      
      try {
        
        // Intentar conectar directamente a la BD
        const tempSequelize = new Sequelize('laboratorio-fcm', username, password, {
          host: host, // Usar el host actual del bucle
          port: 5432,
          dialect: 'postgres',
          logging: console.log, // Habilitar logging para debug
          pool: {
            max: 5,
            min: 0,
            acquire: 60000, // Aumentado a 60 segundos
            idle: 10000
          },
          dialectOptions: {
            connectTimeout: 30000, // Aumentado a 30 segundos
            statement_timeout: 60000, // 60 segundos para statements
            idle_in_transaction_session_timeout: 60000 // 60 segundos para transacciones idle
          },
          retry: {
            max: 3, // Número máximo de intentos
            match: [/Deadlock/i, /Connection lost/i, /Connection refused/i] // Errores que deben causar reintento
          }
        });
        
        // Probar la conexión con timeout
        await Promise.race([
          tempSequelize.authenticate(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout de conexión')), 30000)
          )
        ]);
        
        // Si llegamos aquí, la conexión fue exitosa
        sequelize = tempSequelize;
        currentHost = host;
        
        // Definir los modelos
        const models = defineModels(sequelize);
        Usuario = models.Usuario;
        InicioSesion = models.InicioSesion;
        
        // Sincronizar para crear tablas si no existen
        await sincronizarModelos();
        
        // Verificar estado de IDs después de la sincronización
        await verificarEstadoIDs();
        
        dbConnected = true;
        connected = true;
        return { sequelize, Usuario, InicioSesion };
      } catch (error) {
        // Error al conectar a PostgreSQL en ${host}
        lastError = error;
      }
    }
    
    // Si llegamos aquí, es que no pudimos conectar con ningún host
    // Activando modo local - la aplicación funcionará sin conexión a base de datos
    
    // Activamos modo local
    dbConnected = false;
    return { sequelize: null, Usuario: null, InicioSesion: null };
  } catch (error) {
    // Error general al configurar la base de datos
    // Activando modo local - la aplicación funcionará sin conexión a base de datos
    return { sequelize: null, Usuario: null, InicioSesion: null };
  }
}

// Inicializar la configuración de la base de datos
let dbSetup = { sequelize: null, Usuario: null, InicioSesion: null };

// Función para sincronizar los modelos con la base de datos
async function sincronizarModelos() {
  try {
    if (!sequelize) return false;
    
    // Verificar y crear las tablas si no existen de forma explícita
    
    // Solo sincronizar si la BD no ha sido inicializada previamente
    if (!dbInitialized) {
      // Primero intentar con alter: true para actualizar estructura si existe
      try {
        await sequelize.sync({ alter: true });
      } catch (syncError) {
        // Error al sincronizar tablas con alter:true
        
        // Si falla, intentar con force: false (solo crear si no existen)
        try {
          await sequelize.sync({ force: false });
        } catch (forceSyncError) {
          // Error al sincronizar tablas con force:false
          return false;
        }
      }
      
              // Verificar si las tablas existen después de la sincronización
        try {
          // Verificar tabla usuario
          await sequelize.query("SELECT * FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuario'");
          
          // Verificar tabla iniciosesion
          await sequelize.query("SELECT * FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'iniciosesion'");
          
          // Verificar y corregir secuencias para autoincrement
          try {
            // Verificar secuencia de usuario
            const usuarioSeqResult = await sequelize.query("SELECT last_value FROM usuario_id_seq");
            console.log('Secuencia usuario_id_seq existe, último valor:', usuarioSeqResult[0][0].last_value);
          } catch (seqError) {
            console.log('Secuencia usuario_id_seq no existe, creando...');
            await sequelize.query("CREATE SEQUENCE IF NOT EXISTS usuario_id_seq START WITH 1");
            await sequelize.query("ALTER TABLE usuario ALTER COLUMN id SET DEFAULT nextval('usuario_id_seq')");
          }
          
          try {
            // Verificar secuencia de iniciosesion
            const sesionSeqResult = await sequelize.query("SELECT last_value FROM iniciosesion_id_seq");
            console.log('Secuencia iniciosesion_id_seq existe, último valor:', sesionSeqResult[0][0].last_value);
          } catch (seqError) {
            console.log('Secuencia iniciosesion_id_seq no existe, creando...');
            await sequelize.query("CREATE SEQUENCE IF NOT EXISTS iniciosesion_id_seq START WITH 1");
            await sequelize.query("ALTER TABLE iniciosesion ALTER COLUMN id SET DEFAULT nextval('iniciosesion_id_seq')");
          }
        
        // Intentar crear tablas manualmente si es necesario
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS usuario (
            id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
            codigo VARCHAR(50) UNIQUE NOT NULL,
            nombre VARCHAR(100) NOT NULL,
            perfil VARCHAR(50) NOT NULL,
            escuela VARCHAR(100) NOT NULL,
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        
        await sequelize.query(`
          CREATE TABLE IF NOT EXISTS iniciosesion (
            id INTEGER PRIMARY KEY GENERATED BY DEFAULT AS IDENTITY,
            codigo VARCHAR(50) NOT NULL,
            actividad TEXT,
            tiempoestimado VARCHAR(50),
            numeroequipo INTEGER,
            fecha DATE DEFAULT CURRENT_DATE,
            horainicio TIME DEFAULT CURRENT_TIME
          );
        `);
        
      } catch (checkError) {
        // Error al verificar existencia de tablas
      }
      
      dbInitialized = true; // Marcar como inicializada
    }
    
    return true;
  } catch (error) {
    // Error general al sincronizar tablas
    return false;
  }
}

// Función para verificar el estado de los IDs en la base de datos
async function verificarEstadoIDs() {
  try {
    if (!dbConnected || !sequelize) return false;
    
    console.log('=== VERIFICANDO ESTADO DE IDs ===');
    
    // Verificar usuarios
    const usuarios = await sequelize.query("SELECT id, codigo, nombre FROM usuario ORDER BY id");
    console.log('Usuarios en BD:', usuarios[0].length);
    if (usuarios[0].length > 0) {
      console.log('Primer usuario ID:', usuarios[0][0].id);
      console.log('Último usuario ID:', usuarios[0][usuarios[0].length - 1].id);
    }
    
    // Verificar sesiones
    const sesiones = await sequelize.query("SELECT id, codigo, fecha FROM iniciosesion ORDER BY id");
    console.log('Sesiones en BD:', sesiones[0].length);
    if (sesiones[0].length > 0) {
      console.log('Primera sesión ID:', sesiones[0][0].id);
      console.log('Última sesión ID:', sesiones[0][sesiones[0].length - 1].id);
    }
    
    // Verificar secuencias
    try {
      const usuarioSeq = await sequelize.query("SELECT last_value FROM usuario_id_seq");
      console.log('Secuencia usuario_id_seq último valor:', usuarioSeq[0][0].last_value);
    } catch (e) {
      console.log('Secuencia usuario_id_seq no existe');
    }
    
    try {
      const sesionSeq = await sequelize.query("SELECT last_value FROM iniciosesion_id_seq");
      console.log('Secuencia iniciosesion_id_seq último valor:', sesionSeq[0][0].last_value);
    } catch (e) {
      console.log('Secuencia iniciosesion_id_seq no existe');
    }
    
    console.log('=== FIN VERIFICACIÓN ===');
    return true;
  } catch (error) {
    console.error('Error al verificar estado de IDs:', error);
    return false;
  }
}

// Función para reintentar la conexión a la base de datos
async function reconnectIfNeeded() {
  if (!dbConnected || !sequelize) {
    // Reintentando conectar a la base de datos
    // No ejecutar setupDatabase completo aquí, solo intentar conectar
    try {
      // Intentar conectar directamente usando el host guardado o la lista
      const hostsToTry = [currentHost, ...getLocalIpAddresses()].filter((value, index, self) => self.indexOf(value) === index); // Evitar duplicados
      let connectedAttempt = false;

      for (const host of hostsToTry) {
        if (connectedAttempt) break;
        try {
          const tempSequelize = new Sequelize('laboratorio-fcm', 'postgres', 'admin', {
            host: host,
            port: 5432,
            dialect: 'postgres',
            logging: false,
            pool: {
              max: 5,
              min: 0,
              acquire: 30000,
              idle: 10000
            },
            dialectOptions: {
              connectTimeout: 10000
            }
          });
          await tempSequelize.authenticate();
          sequelize = tempSequelize;
          currentHost = host; // Actualizar host si se conectó con uno diferente
          // Redefinir modelos con la nueva conexión si es necesario
          const models = defineModels(sequelize);
          Usuario = models.Usuario;
          InicioSesion = models.InicioSesion;
          dbConnected = true;
          connectedAttempt = true;
          
          // Sincronizar modelos solo si no se ha hecho antes
          if (!dbInitialized) {
               await sincronizarModelos();
               dbInitialized = true; // Marcar como inicializada
          }

        } catch (error) {
          // Falló reconexión a PostgreSQL
        }
      }
      return dbConnected;
    } catch (error) {
       // Error general al reintentar conexión
       dbConnected = false;
       return false;
    }
  }
  return true;
}

// Función para guardar un nuevo usuario
async function guardarUsuario(datosRegistro) {
  try {
    // Verificar conexión rápidamente sin reintentos
    if (!dbConnected || !sequelize || !Usuario) {
      // Modo offline: cachear cambios pero mantener una sola fuente de verdad (PostgreSQL)
      try {
        const dataDir = getDataDir();
        const usuariosPath = path.join(dataDir, 'usuarios.json');
        const operacionesPath = path.join(dataDir, 'pendientes.json');

        const usuarios = readJsonSafe(usuariosPath, []);
        const pendientes = readJsonSafe(operacionesPath, []);

        // Evitar duplicados por codigo
        if (usuarios.some(u => String(u.codigo) === String(datosRegistro.codigo))) {
          return { success: false, message: 'Este código ya está registrado. Por favor inicie sesión.', redirectToLogin: true, needsRegistration: false, mode: 'local' };
        }

        const nuevoUsuario = {
          id: usuarios.length + 1,
          codigo: datosRegistro.codigo,
          nombre: datosRegistro.nombre,
          perfil: datosRegistro.perfil,
          escuela: datosRegistro.escuela,
          fecha_registro: getLocalDateYMD(new Date()),
          sincronizado: false
        };

        usuarios.push(nuevoUsuario);
        pendientes.push({ tipo: 'usuario', payload: nuevoUsuario });

        writeJsonSafe(usuariosPath, usuarios);
        writeJsonSafe(operacionesPath, pendientes);

        return { success: true, message: 'Registro exitoso (modo local)', redirectToLogin: true, needsRegistration: false, mode: 'local' };
      } catch (error) {
        return { success: false, message: `Error al registrar: ${error.message}`, redirectToLogin: false, needsRegistration: false, mode: 'local' };
      }
    }

    // Intentando guardar usuario en PostgreSQL

    // Verificar si el usuario ya existe
    const usuarioExistente = await Usuario.findOne({
      where: { codigo: datosRegistro.codigo }
    });

    if (usuarioExistente) {
      return { 
        success: false, 
        message: 'Este código ya está registrado. Por favor inicie sesión.',
        redirectToLogin: true,
        needsRegistration: false,
        mode: 'online'
      };
    }

    // Iniciar transacción explícita
    const transaction = await sequelize.transaction();
    
    try {
      // Crear el nuevo usuario dentro de la transacción
      const nuevoUsuario = await Usuario.create({
        codigo: datosRegistro.codigo,
        nombre: datosRegistro.nombre,
        perfil: datosRegistro.perfil,
        escuela: datosRegistro.escuela,
        fecha_registro: new Date()
      }, { transaction });

      // Confirmar la transacción
      await transaction.commit();
      
      // Verificar si el usuario fue guardado
      const usuarioGuardado = await Usuario.findOne({
        where: { codigo: datosRegistro.codigo }
      });

      return { 
        success: true, 
        message: 'Usuario registrado correctamente',
        redirectToLogin: true,
        needsRegistration: false,
        mode: 'online'
      };
    } catch (txError) {
      // Revertir transacción en caso de error
      await transaction.rollback();
              console.error('Error en transacción al registrar usuario:', txError.message);
      return { 
        success: false, 
        message: `Error al registrar: ${txError.message}`,
        redirectToLogin: false,
        needsRegistration: false,
        mode: 'online'
      };
    }
  } catch (error) {
          console.error('Error al registrar usuario en PostgreSQL:', error.message);
    return { 
      success: false, 
      message: `Error al registrar: ${error.message}`,
      redirectToLogin: false,
      needsRegistration: false,
      mode: 'online'
    };
  }
}

// Función para buscar un usuario por código
async function buscarUsuarioPorCodigo(codigo) {
  try {
    // Verificar conexión rápidamente sin reintentos
    if (!dbConnected || !sequelize || !Usuario) {
      // Modo offline: leer de caché local
      try {
        const dataDir = getDataDir();
        const usuariosPath = path.join(dataDir, 'usuarios.json');
        const usuarios = readJsonSafe(usuariosPath, []);
        const usuario = usuarios.find(u => String(u.codigo) === String(codigo));
        if (usuario) {
          return { usuario, error: null, needsRegistration: false, mode: 'local' };
        }
        return { usuario: null, error: 'Usted no está registrado', needsRegistration: true, mode: 'local' };
      } catch (error) {
        return { usuario: null, error: `Error al buscar usuario: ${error.message}`, needsRegistration: false, mode: 'local' };
      }
    }

    const usuario = await Usuario.findOne({
      where: { codigo }
    });

    if (usuario) {
              console.log('Usuario encontrado en PostgreSQL:', codigo);
      return { 
        usuario: usuario, 
        error: null,
        needsRegistration: false,
        mode: 'online'
      };
    } else {
              console.log('Usuario no encontrado en PostgreSQL:', codigo);
      return { 
        usuario: null, 
        error: 'Usted no está registrado',
        needsRegistration: true,
        mode: 'online'
      };
    }
  } catch (error) {
          console.error('Error al buscar usuario en PostgreSQL:', error.message);
    return { 
      usuario: null, 
      error: `Error al buscar usuario: ${error.message}`,
      needsRegistration: false,
      mode: 'online'
    };
  }
}

// Función para probar la conexión
async function testConnection() {
  // Si ya verificamos recientemente, no intentar nuevamente para evitar mensajes repetitivos
  const ahora = Date.now();
  const ultimaVerificacion = this.ultimaVerificacion || 0;
  
  if (ahora - ultimaVerificacion < 10000) { // Solo verificar cada 10 segundos
    return dbConnected;
  }
  
  this.ultimaVerificacion = ahora;
  
  try {
    // Si no estamos conectados o no hay instancia, intentar reconectar
    if (!dbConnected || !sequelize) {
      const reconnected = await reconnectIfNeeded();
      if (!reconnected || !sequelize) {
        return false;
      }
    }

    // Intentar autenticar
    await sequelize.authenticate();
    dbConnected = true;

    // Asegurar modelos listos
    await sincronizarModelos();

    return true;
  } catch (error) {
    dbConnected = false;
    return false;
  }
}

// Función para guardar una nueva sesión
async function guardarSesion(datosSesion) {
  try {
    // Verificar conexión rápidamente sin reintentos
    if (!dbConnected || !sequelize || !InicioSesion) {
      // Modo offline: cachear la sesión para sincronizarla luego
      try {
        const dataDir = getDataDir();
        const sesionesPath = path.join(dataDir, 'sesiones.json');
        const operacionesPath = path.join(dataDir, 'pendientes.json');

        const sesiones = readJsonSafe(sesionesPath, []);
        const pendientes = readJsonSafe(operacionesPath, []);

        const ahora = new Date();
        const horaActual = ahora.toTimeString().split(' ')[0];

        const nuevaSesion = {
          id: sesiones.length + 1,
          codigo: datosSesion.codigo,
          actividad: datosSesion.actividad,
          tiempoestimado: datosSesion.tiempo,
          numeroequipo: parseInt(datosSesion.equipo.replace('PC', ''), 10) || 1,
          fecha: getLocalDateYMD(ahora),
          horainicio: horaActual,
          sincronizado: false
        };

        sesiones.push(nuevaSesion);
        pendientes.push({ tipo: 'sesion', payload: nuevaSesion });

        writeJsonSafe(sesionesPath, sesiones);
        writeJsonSafe(operacionesPath, pendientes);

        return { success: true, message: 'Inicio de sesión exitoso (modo local)', mode: 'local' };
      } catch (error) {
        return { success: false, message: `Error al iniciar sesión: ${error.message}`, mode: 'local' };
      }
    }

    // Guardando sesión en PostgreSQL

    // Asegurar que el usuario existe en la BD actual; si no existe, guardar en modo local
    try {
      const usuarioEnDb = await Usuario.findOne({ where: { codigo: datosSesion.codigo } });
      if (!usuarioEnDb) {
        // Guardar en modo local si el usuario no existe en la BD para evitar fallos por FK
        try {
          let sesionesPath;
          if (electron && electron.app) {
            sesionesPath = path.join(electron.app.getPath('userData'), 'data', 'sesiones.json');
          } else {
            const tempDir = os.tmpdir();
            sesionesPath = path.join(tempDir, 'lab_fmc_data', 'sesiones.json');
            if (!fs.existsSync(path.dirname(sesionesPath))) {
              fs.mkdirSync(path.dirname(sesionesPath), { recursive: true });
            }
          }
          let sesiones = [];
          if (fs.existsSync(sesionesPath)) {
            const contenido = fs.readFileSync(sesionesPath, 'utf8');
            sesiones = JSON.parse(contenido);
          }
          const ahora = new Date();
          const horaActual = ahora.toTimeString().split(' ')[0];
          const nuevaSesion = {
            id: sesiones.length + 1,
            codigo: datosSesion.codigo,
            actividad: datosSesion.actividad,
            tiempoestimado: datosSesion.tiempo,
            numeroequipo: parseInt(datosSesion.equipo.replace('PC', ''), 10) || 1,
            fecha: getLocalDateYMD(ahora),
            horainicio: horaActual,
            sincronizado: false
          };
          sesiones.push(nuevaSesion);
          fs.writeFileSync(sesionesPath, JSON.stringify(sesiones, null, 2));
          return {
            success: true,
            message: 'Sesión iniciada en modo local (usuario no existe en BD)'.trim(),
            mode: 'local'
          };
        } catch (e) {
          return { success: false, message: `Error al iniciar sesión en modo local: ${e.message}`, mode: 'local' };
        }
      }
    } catch (_) {
      // Si falla la verificación del usuario, continuamos e intentamos guardar en BD; errores se manejarán abajo
    }

    // Iniciar transacción explícita
    const transaction = await sequelize.transaction();
    
    try {
      // Preparar los datos para el formato de la tabla
      const ahora = new Date();
      
      // Extraer solo la parte de la hora de la fecha
      const horaActual = ahora.toTimeString().split(' ')[0];

      // Crear la sesión dentro de la transacción
      const nuevaSesion = await InicioSesion.create({
        codigo: datosSesion.codigo,
        actividad: datosSesion.actividad,
        tiempoestimado: datosSesion.tiempo,
        numeroequipo: parseInt(datosSesion.equipo.replace('PC', ''), 10) || 1,
        fecha: getLocalDateYMD(ahora),
        horainicio: horaActual
      }, { transaction });

      // Confirmar la transacción
      await transaction.commit();
      
      // Verificar si la sesión fue guardada
      const sesionGuardada = await InicioSesion.findByPk(nuevaSesion.id);
      
      if (sesionGuardada) {
        console.log('Sesión registrada y verificada en PostgreSQL:', nuevaSesion.id);
      } else {
        console.log('⚠️ Sesión registrada pero no se pudo verificar en PostgreSQL');
      }

      // Verificación de sesión completada

      return { 
        success: true, 
        message: 'Sesión iniciada correctamente',
        mode: 'online'
      };
    } catch (txError) {
      // Revertir transacción en caso de error
      await transaction.rollback();
              console.error('Error en transacción al registrar sesión:', txError.message);
      return { 
        success: false, 
        message: `Error al iniciar sesión: ${txError.message}`,
        mode: 'online'
      };
    }
  } catch (error) {
          console.error('Error al registrar sesión en PostgreSQL:', error.message);
    return { 
      success: false, 
      message: `Error al iniciar sesión: ${error.message}`,
      mode: 'online'
    };
  }
}

// Función para verificación periódica de conexión
let intervalId = null;
function iniciarVerificacionPeriodica(intervaloMs = 60000) { // Por defecto cada minuto
  // Detener intervalo anterior si existe
  if (intervalId) {
    clearInterval(intervalId);
  }
  
  // Crear nuevo intervalo
  intervalId = setInterval(async () => {
    // Intentar reconectar si es necesario y verificar conexión
    const conectado = await testConnection();
    if (!conectado) {
      // Un intento adicional directo de reconexión, por si la caché de testConnection devolviera false
      await reconnectIfNeeded();
    } else {
      // Si hay conexión, refrescar caché local periódicamente
      try { await refreshLocalCacheFromDB(60000); } catch (_) {}
    }
  }, intervaloMs);
  
  return intervalId;
}

// Función para sincronizar datos pendientes (implementación)
async function sincronizarDatosPendientes() {
  try {
    // Verificar si hay conexión a la base de datos
    if (!dbConnected || !sequelize) {
      console.log('No se pueden sincronizar datos sin conexión a la base de datos');
      return { success: false, message: 'Sin conexión a la base de datos' };
    }

    console.log('Iniciando sincronización de datos pendientes...');
    
    // Ruta a archivos locales
    let pendientesPath, usuariosPath, sesionesPath;
    
    if (electron && electron.app) {
      const dataDir = path.join(electron.app.getPath('userData'), 'data');
      pendientesPath = path.join(dataDir, 'pendientes.json');
      usuariosPath = path.join(dataDir, 'usuarios.json');
      sesionesPath = path.join(dataDir, 'sesiones.json');
    } else {
      // Si electron no está disponible, usar un directorio temporal
      const tempDir = os.tmpdir();
      const dataDir = path.join(tempDir, 'lab_fmc_data');
      pendientesPath = path.join(dataDir, 'pendientes.json');
      usuariosPath = path.join(dataDir, 'usuarios.json');
      sesionesPath = path.join(dataDir, 'sesiones.json');
    }
    
    // Verificar si hay archivos pendientes para sincronizar
    if (!fs.existsSync(pendientesPath)) {
      console.log('No hay archivo de pendientes para sincronizar');
      return { success: true, message: 'No hay datos pendientes para sincronizar' };
    }
    
    // Leer pendientes
    const contenidoPendientes = fs.readFileSync(pendientesPath, 'utf8');
    const pendientes = JSON.parse(contenidoPendientes);
    
    if (!pendientes.length) {
      console.log('No hay operaciones pendientes para sincronizar');
      return { success: true, message: 'No hay datos pendientes para sincronizar' };
    }
    
    console.log(`Sincronizando ${pendientes.length} operaciones pendientes...`);
    
    // Sincronizar usuarios pendientes (desde operaciones acumuladas)
    // Cargar pendientes (si se requiere en el futuro)
    let pendientesOps = [];
    if (fs.existsSync(pendientesPath)) {
      try { pendientesOps = JSON.parse(fs.readFileSync(pendientesPath, 'utf8') || '[]'); } catch (_) { pendientesOps = []; }
    }
    if (fs.existsSync(usuariosPath)) {
      const usuariosLocales = JSON.parse(fs.readFileSync(usuariosPath, 'utf8') || '[]');
      const usuariosPendientes = usuariosLocales.filter(u => u.sincronizado === false);
      if (usuariosPendientes.length > 0) {
        console.log(`Sincronizando ${usuariosPendientes.length} usuarios pendientes...`);
        for (const usuario of usuariosPendientes) {
          try {
            const existente = await Usuario.findOne({ where: { codigo: usuario.codigo } });
            if (!existente) {
              // Crear usuario y obtener el ID generado por PostgreSQL
              const usuarioCreado = await Usuario.create({
                codigo: usuario.codigo,
                nombre: usuario.nombre,
                perfil: usuario.perfil,
                escuela: usuario.escuela,
                fecha_registro: new Date(usuario.fecha_registro)
              });
              
              // Actualizar el ID local con el ID generado por PostgreSQL
              const idPostgre = usuarioCreado.id;
              console.log(`Usuario local ${usuario.id} sincronizado correctamente con ID PostgreSQL ${idPostgre}`);
              
              // Actualizar el ID local
              usuario.id = idPostgre;
            }
            usuario.sincronizado = true;
          } catch (error) {
            console.error(`Error al sincronizar usuario ${usuario.codigo}:`, error.message);
          }
        }
        fs.writeFileSync(usuariosPath, JSON.stringify(usuariosLocales, null, 2));
      }
    }
    
    // Sincronizar sesiones pendientes
    if (fs.existsSync(sesionesPath)) {
      const contenidoSesiones = fs.readFileSync(sesionesPath, 'utf8');
      const sesionesLocales = JSON.parse(contenidoSesiones);
      
      // Filtrar sesiones no sincronizadas
      const sesionesPendientes = sesionesLocales.filter(s => s.sincronizado === false);
      
      if (sesionesPendientes.length > 0) {
        console.log(`Sincronizando ${sesionesPendientes.length} sesiones pendientes...`);
        
        for (const sesion of sesionesPendientes) {
          try {
            // Crear sesión en la base de datos y obtener el ID generado por PostgreSQL
            const sesionCreada = await InicioSesion.create({
              codigo: sesion.codigo,
              actividad: sesion.actividad,
              tiempoestimado: sesion.tiempoestimado,
              numeroequipo: sesion.numeroequipo,
              fecha: new Date(sesion.fecha),
              horainicio: sesion.horainicio
            });
            
            // Actualizar el ID local con el ID generado por PostgreSQL
            const idPostgre = sesionCreada.id;
            console.log(`Sesión local ${sesion.id} sincronizada correctamente con ID PostgreSQL ${idPostgre}`);
            
            // Actualizar el ID local y marcar como sincronizado
            sesion.id = idPostgre;
            sesion.sincronizado = true;
          } catch (error) {
            console.error(`Error al sincronizar sesión ${sesion.id}:`, error.message);
          }
        }
        
        // Guardar cambios en el archivo local
        fs.writeFileSync(sesionesPath, JSON.stringify(sesionesLocales, null, 2));
      }
    }
    
    // Limpiar pendientes sincronizados (best-effort)
    try { fs.writeFileSync(pendientesPath, JSON.stringify([], null, 2)); } catch (_) {}
    
    console.log('Sincronización completada');
    return { success: true, message: 'Datos sincronizados correctamente' };
  } catch (error) {
    console.error('Error al sincronizar datos pendientes:', error.message);
    return { success: false, message: `Error al sincronizar: ${error.message}` };
  }
}

// Refrescar caché local desde la BD online para disponibilidad en modo offline
async function refreshLocalCacheFromDB(minIntervalMs = 60000) {
  try {
    if (!dbConnected || !sequelize) return { success: false, skipped: true, reason: 'Sin conexión' };
    const now = Date.now();
    if (now - lastCacheRefreshAtMs < minIntervalMs) {
      return { success: true, skipped: true, reason: 'Throttle' };
    }

    const dataDir = getDataDir();
    const usuariosPath = path.join(dataDir, 'usuarios.json');
    const sesionesPath = path.join(dataDir, 'sesiones.json');

    // Asegurar modelos
    if (!Usuario || !InicioSesion) {
      const models = defineModels(sequelize);
      Usuario = models.Usuario;
      InicioSesion = models.InicioSesion;
    }

    // Leer desde PostgreSQL
    const usuariosDb = await Usuario.findAll({ order: [['id', 'DESC']] });
    const sesionesDb = await InicioSesion.findAll({ order: [['id', 'DESC']] });

    const usuariosPlain = usuariosDb.map(u => ({
      id: u.id,
      codigo: u.codigo,
      nombre: u.nombre,
      perfil: u.perfil,
      escuela: u.escuela,
      fecha_registro: u.fecha_registro ?? u.createdAt ?? null,
      sincronizado: true
    }));

    const sesionesPlain = sesionesDb.map(s => ({
      id: s.id,
      codigo: s.codigo,
      actividad: s.actividad,
      tiempoestimado: s.tiempoestimado,
      numeroequipo: s.numeroequipo,
      fecha: s.fecha ?? s.createdAt ?? null,
      horainicio: s.horainicio,
      sincronizado: true
    }));

    writeJsonSafe(usuariosPath, usuariosPlain);
    writeJsonSafe(sesionesPath, sesionesPlain);

    lastCacheRefreshAtMs = now;
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Inicializar la conexión de base de datos al cargar el módulo
(async () => {
  try {
    console.log('Inicializando conexión a PostgreSQL...');
    // Ejecutar setupDatabase una vez al inicio
    dbSetup = await setupDatabase();
    if (dbConnected) {
      // Sincronizar modelos solo después de la conexión inicial si no se hizo en setup
      if (!dbInitialized) {
        await sincronizarModelos();
        dbInitialized = true; // Marcar como inicializada
      }
      iniciarVerificacionPeriodica();
    } else {
      console.log('⚠️ No se pudo establecer conexión inicial a PostgreSQL');
      // Programar reintento periódico solo si la conexión inicial falló
      setTimeout(() => iniciarVerificacionPeriodica(30000), 5000);
    }
  } catch (error) {
          console.error('Error durante la inicialización:', error);
  }
})();

// Exportar las funciones y variables necesarias
module.exports = {
  testConnection,
  guardarUsuario,
  buscarUsuarioPorCodigo,
  guardarSesion,
  iniciarVerificacionPeriodica,
  sincronizarDatosPendientes,
  verificarEstadoIDs,

  refreshLocalCacheFromDB,
  isConnected: () => dbConnected,
  getCurrentHost: () => currentHost
};

// Exportar `sequelize` como propiedad dinámica para reflejar cambios posteriores
Object.defineProperty(module.exports, 'sequelize', {
  enumerable: true,
  get() {
    return sequelize;
  }
});