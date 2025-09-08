const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { google } = require("googleapis");
const { DateTime } = require('luxon');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración adaptable
const CONFIG = {
  // Configuración de Google Sheets
  SHEET_ID: process.env.SHEET_ID,
  SHEET_NAME: process.env.SHEET_NAME || 'Citas',
  
  // Configuración de horarios (adaptable según negocio)
  BUSINESS_HOURS: {
    start: parseInt(process.env.BUSINESS_START_HOUR) || 9,
    end: parseInt(process.env.BUSINESS_END_HOUR) || 18,
    workDays: (process.env.WORK_DAYS || '1,2,3,4,5').split(',').map(Number), // Lun-Vie por defecto
  },
  
  // Duración de citas en minutos (adaptable)
  DEFAULT_APPOINTMENT_DURATION: parseInt(process.env.APPOINTMENT_DURATION) || 60,
  
  // Buffer entre citas en minutos
  APPOINTMENT_BUFFER: parseInt(process.env.APPOINTMENT_BUFFER) || 15,
  
  // Zona horaria
  TIMEZONE: process.env.TIMEZONE || 'America/Mexico_City',
  
  // Configuración de servicios (adaptable según negocio)
  SERVICES: JSON.parse(process.env.SERVICES || JSON.stringify([
    { id: 'instalacion', name: 'Instalación de llantas', duration: 60 },
    { id: 'balanceo', name: 'Balanceo', duration: 30 },
    { id: 'alineacion', name: 'Alineación', duration: 45 },
    { id: 'cambio_aceite', name: 'Cambio de aceite', duration: 30 }
  ])),
  
  // Campos personalizables del formulario
  FORM_FIELDS: JSON.parse(process.env.FORM_FIELDS || JSON.stringify([
    { name: 'nombre', required: true, type: 'string', label: 'Nombre completo' },
    { name: 'telefono', required: true, type: 'phone', label: 'Teléfono' },
    { name: 'email', required: false, type: 'email', label: 'Email' },
    { name: 'servicio', required: true, type: 'select', label: 'Servicio', options: 'SERVICES' },
    { name: 'vehiculo', required: false, type: 'string', label: 'Vehículo (marca/modelo)' },
    { name: 'notas', required: false, type: 'text', label: 'Notas adicionales' }
  ]))
};

// Validación de variables de entorno
const validateConfig = () => {
  const required = ['SHEET_ID', 'GOOGLE_PROJECT_ID', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_CLIENT_EMAIL'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('Variables de entorno faltantes:', missing);
    process.exit(1);
  }
  console.log('Configuración validada correctamente');
};

validateConfig();

// Configuración Google Sheets
const GOOGLE_CREDENTIALS = {
  type: "service_account",
  project_id: process.env.GOOGLE_PROJECT_ID,
  private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  client_id: process.env.GOOGLE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
  universe_domain: "googleapis.com"
};

const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50,
  message: 'Demasiadas solicitudes, intenta más tarde.'
});
app.use(limiter);

// Utilidades
class AppointmentError extends Error {
  constructor(message, statusCode = 400, type = 'VALIDATION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.type = type;
  }
}

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const logger = {
  info: (msg, data = {}) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, data),
  error: (msg, error = {}) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, error),
  warn: (msg, data = {}) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, data)
};

// Generador de códigos únicos
const generateAppointmentCode = () => {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substring(2, 4).toUpperCase();
  return `${process.env.APPOINTMENT_PREFIX || 'CITA'}-${timestamp}-${random}`;
};

// Clase principal de gestión de citas
class AppointmentManager {
  constructor() {
    this.sheetsClient = null;
  }

  async initialize() {
    try {
      const client = await auth.getClient();
      this.sheetsClient = google.sheets({ version: "v4", auth: client });
      logger.info('Google Sheets client inicializado');
    } catch (error) {
      logger.error('Error inicializando Google Sheets:', error);
      throw new AppointmentError('Error de configuración', 500, 'SETUP_ERROR');
    }
  }

  // Obtener todas las citas existentes
  async getExistingAppointments() {
    try {
      const response = await this.sheetsClient.spreadsheets.values.get({
        spreadsheetId: CONFIG.SHEET_ID,
        range: `${CONFIG.SHEET_NAME}!A:Z`,
      });

      const rows = response.data.values || [];
      if (rows.length === 0) return [];

      const headers = rows[0];
      const appointments = rows.slice(1).map(row => {
        const appointment = {};
        headers.forEach((header, index) => {
          appointment[header] = row[index] || '';
        });
        return appointment;
      });

      logger.info(`Obtenidas ${appointments.length} citas existentes`);
      return appointments;
    } catch (error) {
      logger.error('Error obteniendo citas:', error);
      throw new AppointmentError('Error accediendo al calendario', 500, 'SHEETS_ERROR');
    }
  }

  // Validar disponibilidad de horario
  async validateTimeSlot(requestedDate, requestedTime, serviceDuration) {
    const existingAppointments = await this.getExistingAppointments();
    
    // Convertir fecha y hora solicitada a DateTime
    const requestedDateTime = DateTime.fromFormat(
      `${requestedDate} ${requestedTime}`, 
      'yyyy-MM-dd HH:mm', 
      { zone: CONFIG.TIMEZONE }
    );

    if (!requestedDateTime.isValid) {
      throw new AppointmentError('Formato de fecha/hora inválido. Use YYYY-MM-DD HH:MM');
    }

    // Validar día laboral
    const dayOfWeek = requestedDateTime.weekday;
    if (!CONFIG.BUSINESS_HOURS.workDays.includes(dayOfWeek)) {
      throw new AppointmentError('La fecha seleccionada no es un día laboral');
    }

    // Validar horario de negocio
    const hour = requestedDateTime.hour;
    if (hour < CONFIG.BUSINESS_HOURS.start || hour >= CONFIG.BUSINESS_HOURS.end) {
      throw new AppointmentError(
        `Horario fuera del rango de atención (${CONFIG.BUSINESS_HOURS.start}:00 - ${CONFIG.BUSINESS_HOURS.end}:00)`
      );
    }

    // Calcular ventana de la cita solicitada
    const requestedStart = requestedDateTime;
    const requestedEnd = requestedStart.plus({ minutes: serviceDuration });

    // Verificar traslapes con citas existentes
    for (const appointment of existingAppointments) {
      if (!appointment.fecha || !appointment.hora || appointment.estado === 'cancelada') {
        continue;
      }

      const existingDateTime = DateTime.fromFormat(
        `${appointment.fecha} ${appointment.hora}`, 
        'yyyy-MM-dd HH:mm', 
        { zone: CONFIG.TIMEZONE }
      );

      if (!existingDateTime.isValid) continue;

      const existingDuration = this.getServiceDuration(appointment.servicio);
      const existingStart = existingDateTime;
      const existingEnd = existingStart.plus({ minutes: existingDuration + CONFIG.APPOINTMENT_BUFFER });

      // Verificar traslape
      const hasOverlap = requestedStart < existingEnd && requestedEnd.plus({ minutes: CONFIG.APPOINTMENT_BUFFER }) > existingStart;

      if (hasOverlap) {
        throw new AppointmentError(
          `Horario no disponible. Conflicto con cita existente a las ${existingStart.toFormat('HH:mm')}`
        );
      }
    }

    return {
      isAvailable: true,
      requestedDateTime: requestedDateTime.toISO(),
      suggestedSlots: await this.getSuggestedSlots(requestedDate, serviceDuration)
    };
  }

  // Obtener duración del servicio
  getServiceDuration(serviceName) {
    const service = CONFIG.SERVICES.find(s => 
      s.name.toLowerCase() === serviceName?.toLowerCase() || 
      s.id === serviceName
    );
    return service ? service.duration : CONFIG.DEFAULT_APPOINTMENT_DURATION;
  }

  // Sugerir horarios alternativos
  async getSuggestedSlots(date, duration) {
    const existingAppointments = await this.getExistingAppointments();
    const requestedDate = DateTime.fromFormat(date, 'yyyy-MM-dd', { zone: CONFIG.TIMEZONE });
    const suggestions = [];

    // Generar slots cada 30 minutos dentro del horario de negocio
    for (let hour = CONFIG.BUSINESS_HOURS.start; hour < CONFIG.BUSINESS_HOURS.end; hour++) {
      for (const minute of [0, 30]) {
        const slotStart = requestedDate.set({ hour, minute });
        const slotEnd = slotStart.plus({ minutes: duration });

        // Verificar si el slot completo está dentro del horario
        if (slotEnd.hour >= CONFIG.BUSINESS_HOURS.end) continue;

        // Verificar traslapes
        let hasConflict = false;
        for (const appointment of existingAppointments) {
          if (!appointment.fecha || appointment.fecha !== date || appointment.estado === 'cancelada') continue;
          
          const existingDateTime = DateTime.fromFormat(
            `${appointment.fecha} ${appointment.hora}`, 
            'yyyy-MM-dd HH:mm', 
            { zone: CONFIG.TIMEZONE }
          );
          
          if (!existingDateTime.isValid) continue;

          const existingDuration = this.getServiceDuration(appointment.servicio);
          const existingEnd = existingDateTime.plus({ minutes: existingDuration + CONFIG.APPOINTMENT_BUFFER });

          if (slotStart < existingEnd && slotEnd.plus({ minutes: CONFIG.APPOINTMENT_BUFFER }) > existingDateTime) {
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          suggestions.push(slotStart.toFormat('HH:mm'));
        }
      }
    }

    return suggestions.slice(0, 5); // Máximo 5 sugerencias
  }

  // Crear nueva cita
  async createAppointment(appointmentData) {
    // Validar campos requeridos
    const validation = this.validateAppointmentData(appointmentData);
    if (!validation.isValid) {
      throw new AppointmentError(`Datos inválidos: ${validation.errors.join(', ')}`);
    }

    // Validar disponibilidad
    const serviceDuration = this.getServiceDuration(appointmentData.servicio);
    await this.validateTimeSlot(appointmentData.fecha, appointmentData.hora, serviceDuration);

    // Generar código único
    const codigo = generateAppointmentCode();

    // Preparar datos para insertar
    const rowData = [
      codigo,
      appointmentData.nombre,
      appointmentData.telefono,
      appointmentData.email || '',
      appointmentData.servicio,
      appointmentData.fecha,
      appointmentData.hora,
      appointmentData.vehiculo || '',
      appointmentData.notas || '',
      'confirmada',
      new Date().toISOString(),
      serviceDuration
    ];

    try {
      await this.sheetsClient.spreadsheets.values.append({
        spreadsheetId: CONFIG.SHEET_ID,
        range: `${CONFIG.SHEET_NAME}!A:L`,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [rowData],
        },
      });

      logger.info('Cita creada exitosamente:', { codigo, servicio: appointmentData.servicio });
      
      return {
        codigo,
        estado: 'confirmada',
        datos: appointmentData,
        duracion: serviceDuration
      };
    } catch (error) {
      logger.error('Error creando cita:', error);
      throw new AppointmentError('Error guardando la cita', 500, 'SHEETS_ERROR');
    }
  }

  // Validar datos de la cita
  validateAppointmentData(data) {
    const errors = [];

    CONFIG.FORM_FIELDS.forEach(field => {
      const value = data[field.name];
      
      if (field.required && (!value || value.trim() === '')) {
        errors.push(`${field.label} es requerido`);
        return;
      }

      if (value && field.type === 'email' && !this.isValidEmail(value)) {
        errors.push(`${field.label} debe tener formato válido`);
      }

      if (value && field.type === 'phone' && !this.isValidPhone(value)) {
        errors.push(`${field.label} debe tener formato válido`);
      }
    });

    // Validar fecha
    if (data.fecha) {
      const date = DateTime.fromFormat(data.fecha, 'yyyy-MM-dd');
      if (!date.isValid) {
        errors.push('Fecha debe tener formato YYYY-MM-DD');
      } else if (date < DateTime.now().startOf('day')) {
        errors.push('No se pueden crear citas en fechas pasadas');
      }
    }

    // Validar hora
    if (data.hora && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.hora)) {
      errors.push('Hora debe tener formato HH:MM');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  isValidPhone(phone) {
    return /^[\d\s\-\+\(\)]{8,15}$/.test(phone);
  }

  // Obtener citas por fecha
  async getAppointmentsByDate(date) {
    const appointments = await this.getExistingAppointments();
    return appointments.filter(apt => apt.fecha === date && apt.estado !== 'cancelada');
  }

  // Cancelar cita
  async cancelAppointment(codigo) {
    // Implementar lógica de cancelación
    // Esto requeriría encontrar la fila específica y actualizar el estado
    logger.info('Solicitud de cancelación para:', codigo);
    // Por simplicidad, no implementado completamente aquí
    throw new AppointmentError('Función de cancelación en desarrollo');
  }
}

// Instancia global del gestor
const appointmentManager = new AppointmentManager();

// Inicializar al arrancar
appointmentManager.initialize().catch(error => {
  logger.error('Error fatal inicializando:', error);
  process.exit(1);
});

// Endpoints

// Documentación de la API
app.get('/', (req, res) => {
  res.json({
    name: 'Sistema de Gestión de Citas',
    version: '1.0.0',
    description: 'API adaptable para gestión de citas con Google Sheets',
    configuration: {
      timezone: CONFIG.TIMEZONE,
      businessHours: CONFIG.BUSINESS_HOURS,
      services: CONFIG.SERVICES,
      appointmentDuration: CONFIG.DEFAULT_APPOINTMENT_DURATION
    },
    endpoints: {
      'GET /': 'Documentación de la API',
      'GET /config': 'Obtener configuración disponible',
      'POST /appointments': 'Crear nueva cita',
      'GET /appointments/availability': 'Verificar disponibilidad',
      'GET /appointments/date/:date': 'Obtener citas por fecha',
      'GET /health': 'Estado del servicio'
    }
  });
});

// Obtener configuración
app.get('/config', (req, res) => {
  res.json({
    services: CONFIG.SERVICES,
    formFields: CONFIG.FORM_FIELDS,
    businessHours: CONFIG.BUSINESS_HOURS,
    timezone: CONFIG.TIMEZONE,
    appointmentDuration: CONFIG.DEFAULT_APPOINTMENT_DURATION
  });
});

// Health check
app.get('/health', asyncHandler(async (req, res) => {
  try {
    // Verificar conexión con Google Sheets
    await appointmentManager.sheetsClient.spreadsheets.get({
      spreadsheetId: CONFIG.SHEET_ID
    });

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        googleSheets: 'connected',
        timezone: CONFIG.TIMEZONE
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Cannot connect to Google Sheets',
      timestamp: new Date().toISOString()
    });
  }
}));

// Verificar disponibilidad
app.get('/appointments/availability', asyncHandler(async (req, res) => {
  const { date, time, service } = req.query;

  if (!date) {
    throw new AppointmentError('Parámetro date es requerido (YYYY-MM-DD)');
  }

  try {
    const duration = appointmentManager.getServiceDuration(service);
    
    if (time) {
      // Verificar horario específico
      const validation = await appointmentManager.validateTimeSlot(date, time, duration);
      res.json({
        available: validation.isAvailable,
        requestedSlot: { date, time, duration },
        suggestedSlots: validation.suggestedSlots
      });
    } else {
      // Obtener todos los horarios disponibles
      const suggestedSlots = await appointmentManager.getSuggestedSlots(date, duration);
      res.json({
        date,
        availableSlots: suggestedSlots,
        service: service || 'default',
        duration
      });
    }
  } catch (error) {
    if (error instanceof AppointmentError) {
      res.status(error.statusCode).json({
        available: false,
        error: error.message,
        type: error.type
      });
    } else {
      throw error;
    }
  }
}));

// Crear cita
app.post('/appointments', asyncHandler(async (req, res) => {
  try {
    const result = await appointmentManager.createAppointment(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Cita creada exitosamente',
      appointment: result,
      nextSteps: [
        'Guarde su código de cita para futuras referencias',
        'Llegue 10 minutos antes de su cita',
        'Contacte si necesita reprogramar'
      ]
    });
  } catch (error) {
    if (error instanceof AppointmentError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        type: error.type
      });
    } else {
      throw error;
    }
  }
}));

// Obtener citas por fecha
app.get('/appointments/date/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  const appointments = await appointmentManager.getAppointmentsByDate(date);
  
  res.json({
    date,
    appointments: appointments.map(apt => ({
      codigo: apt.codigo,
      hora: apt.hora,
      servicio: apt.servicio,
      estado: apt.estado
    })),
    total: appointments.length
  });
}));

// Middleware de manejo de errores
app.use((error, req, res, next) => {
  logger.error('Error no manejado:', error);
  
  if (error instanceof AppointmentError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      type: error.type
    });
  }

  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    type: 'INTERNAL_ERROR'
  });
});

// Middleware 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    availableEndpoints: [
      'GET /',
      'GET /config',
      'GET /health',
      'GET /appointments/availability',
      'POST /appointments',
      'GET /appointments/date/:date'
    ]
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de citas ejecutándose en puerto ${PORT}`);
  console.log(`Zona horaria configurada: ${CONFIG.TIMEZONE}`);
  console.log(`Horario de atención: ${CONFIG.BUSINESS_HOURS.start}:00 - ${CONFIG.BUSINESS_HOURS.end}:00`);
});

module.exports = app;