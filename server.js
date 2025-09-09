const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { google } = require("googleapis");
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuración de Google Sheets ---
const GOOGLE_SHEETS_CREDENTIALS = {
  "type": "service_account",
  "project_id": process.env.GOOGLE_PROJECT_ID,
  "private_key_id": process.env.GOOGLE_PRIVATE_KEY_ID,
  "private_key": process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  "client_email": process.env.GOOGLE_CLIENT_EMAIL,
  "client_id": process.env.GOOGLE_CLIENT_ID,
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": process.env.GOOGLE_CLIENT_X509_CERT_URL,
  "universe_domain": "googleapis.com"
};

const SHEET_ID_CITAS = process.env.SHEET_ID_CITAS; // ID de tu hoja de cálculo para citas
const SHEET_NAME_CITAS = process.env.SHEET_NAME_CITAS || 'Citas'; // Nombre de la hoja donde se guardarán las citas

const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_SHEETS_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// --- Helpers de Google Sheets ---

/**
 * Obtiene todas las citas existentes de la hoja de cálculo.
 * @returns {Promise<Array<Array<string>>>} Una promesa que resuelve a un array de filas.
 */
async function obtenerCitas() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID_CITAS,
      range: `${SHEET_NAME_CITAS}!A:I`, // Lee todas las columnas que usaremos
    });

    const rows = response.data.values || [];
    // Omitimos la primera fila (encabezados) si existe
    return rows.length > 1 ? rows.slice(1) : [];
  } catch (error) {
    console.error('Error al leer las citas de la hoja:', error);
    // Si la hoja no existe o hay otro error, devolvemos un array vacío para no bloquear el sistema
    return [];
  }
}


/**
 * Agrega una nueva fila (cita) a la hoja de cálculo.
 * @param {Array<string>} valores Los valores de la nueva cita.
 * @returns {Promise<boolean>} True si se agregó correctamente, de lo contrario false.
 */
async function agregarFila(valores) {
    try {
        const client = await auth.getClient();
        const sheets = google.sheets({ version: "v4", auth: client });

        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID_CITAS,
            range: `${SHEET_NAME_CITAS}!A:I`, // Ajustado al número de columnas
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
                values: [valores],
            },
        });
        console.log("Fila de cita añadida correctamente.");
        return true;
    } catch (error) {
        console.error('Error al agregar la fila:', error);
        return false;
    }
}


// --- Middlewares ---
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.'
});
app.use(limiter);


// --- Rutas de la API ---

app.get('/', (req, res) => {
    res.json({
      message: 'API de Agendamiento de Citas',
      version: '1.0.0',
      endpoints: {
        '/api/citas/agendar': 'POST - Crea una nueva cita, verificando disponibilidad.'
      }
    });
});

/**
 * Endpoint para agendar una nueva cita.
 * Verifica la disponibilidad y, si está ocupado, sugiere nuevos horarios.
 */
app.post('/api/citas/agendar', async (req, res) => {
  try {
    const {
        nombre,
        telefono,
        industria,
        solicitudes,
        empleados,
        fecha, // Formato esperado: YYYY-MM-DD
        hora,  // Formato esperado: HH:MM (en sistema de 24h)
        servicio, // "Cita" o "Llamada"
        notas
    } = req.body;

    // Validación de campos esenciales
    if (!nombre || !fecha || !hora || !servicio) {
      return res.status(400).json({
        estado: 'error',
        mensaje: 'Faltan campos requeridos: nombre, fecha, hora y servicio son obligatorios.'
      });
    }

    const duracionMinutos = servicio.toLowerCase() === 'cita' ? 60 : 30;
    const fechaHoraSolicitada = new Date(`${fecha}T${hora}:00`);
    const fechaHoraFinSolicitada = new Date(fechaHoraSolicitada.getTime() + duracionMinutos * 60000);

    const citasExistentes = await obtenerCitas();
    let hayConflicto = false;

    // Verificar si el horario solicitado se superpone con una cita existente
    for (const cita of citasExistentes) {
        // Asumiendo que la fecha está en la columna F (índice 5) y la hora en G (índice 6)
        const fechaExistente = cita[5];
        const horaExistente = cita[6];
        const servicioExistente = cita[7];

        if (!fechaExistente || !horaExistente || !servicioExistente) continue;

        const duracionExistente = servicioExistente.toLowerCase() === 'cita' ? 60 : 30;
        const inicioExistente = new Date(`${fechaExistente}T${horaExistente}:00`);
        const finExistente = new Date(inicioExistente.getTime() + duracionExistente * 60000);

        // Lógica de superposición de rangos: (InicioA < FinB) y (FinA > InicioB)
        if (fechaHoraSolicitada < finExistente && fechaHoraFinSolicitada > inicioExistente) {
            hayConflicto = true;
            break;
        }
    }
    
    // Si no hay conflicto, agendar la cita
    if (!hayConflicto) {
        const nuevaFila = [
            nombre,
            telefono || '',
            industria || '',
            solicitudes || '',
            empleados || '',
            fecha,
            hora,
            servicio,
            notas || ''
        ];

        const exito = await agregarFila(nuevaFila);

        if (exito) {
            return res.status(201).json({
                estado: 'agendada',
                mensaje: 'Cita confirmada exitosamente.',
                detalles: { nombre, fecha, hora, servicio }
            });
        } else {
             return res.status(500).json({
                estado: 'error_guardado',
                mensaje: 'No se pudo guardar la cita en la hoja de cálculo. Intente de nuevo.'
            });
        }
    }

    // Si hay conflicto, encontrar y sugerir horarios disponibles
    else {
        const horariosDisponibles = [];
        const inicioJornada = new Date(`${fecha}T09:00:00`);
        const finJornada = new Date(`${fecha}T18:00:00`);

        let tiempoPrueba = new Date(inicioJornada);

        while (tiempoPrueba < finJornada) {
            const finTiempoPrueba = new Date(tiempoPrueba.getTime() + duracionMinutos * 60000);
            
            // El horario no debe terminar después del fin de la jornada
            if (finTiempoPrueba > finJornada) {
                break;
            }

            let slotDisponible = true;
            for (const cita of citasExistentes) {
                const fechaExistente = cita[5];
                const horaExistente = cita[6];
                const servicioExistente = cita[7];

                if (!fechaExistente || !horaExistente || !servicioExistente) continue;

                // Solo nos importan las citas del mismo día para la sugerencia
                if (fechaExistente !== fecha) continue;

                const duracionExistente = servicioExistente.toLowerCase() === 'cita' ? 60 : 30;
                const inicioExistente = new Date(`${fechaExistente}T${horaExistente}:00`);
                const finExistente = new Date(inicioExistente.getTime() + duracionExistente * 60000);

                if (tiempoPrueba < finExistente && finTiempoPrueba > inicioExistente) {
                    slotDisponible = false;
                    break;
                }
            }

            if (slotDisponible) {
                horariosDisponibles.push(tiempoPrueba.toTimeString().substring(0, 5));
            }

            // Avanzamos en intervalos de 30 minutos para no omitir posibles slots
            tiempoPrueba.setMinutes(tiempoPrueba.getMinutes() + 30);
        }

        return res.status(409).json({
            estado: 'conflicto',
            mensaje: `El horario de ${hora} no está disponible.`,
            horariosSugeridos: horariosDisponibles
        });
    }

  } catch (error) {
    console.error('Error en el endpoint de agendar cita:', error);
    res.status(500).json({
      estado: 'error_servidor',
      mensaje: 'Ocurrió un error interno en el servidor.'
    });
  }
});


// --- Manejo de errores y 404 ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado',
    availableEndpoints: {
      'citas': [
        'POST /api/citas/agendar'
      ]
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de citas corriendo en el puerto ${PORT}`);
});

module.exports = app;