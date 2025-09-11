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

const SHEET_ID_CITAS = process.env.SHEET_ID_CITAS;
const SHEET_NAME_CITAS = process.env.SHEET_NAME_CITAS || 'Citas';

const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_SHEETS_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// --- Helpers de Google Sheets ---

async function obtenerCitas() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID_CITAS,
      range: `${SHEET_NAME_CITAS}!A:J`, // Ajustado a 10 columnas
    });

    const rows = response.data.values || [];
    return rows.length > 1 ? rows.slice(1) : [];
  } catch (error) {
    console.error('Error al leer las citas de la hoja:', error);
    return [];
  }
}

async function agregarFila(valores) {
    try {
        const client = await auth.getClient();
        const sheets = google.sheets({ version: "v4", auth: client });

        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID_CITAS,
            range: `${SHEET_NAME_CITAS}!A:J`, // Ajustado a 10 columnas
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
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.'
});
app.use(limiter);

// --- Rutas de la API ---

app.get('/', (req, res) => {
    res.json({
      message: 'API de Agendamiento de Citas',
      version: '1.1.0',
      endpoints: {
        '/api/citas/agendar': 'POST - Crea una nueva cita, verificando disponibilidad.'
      }
    });
});

app.post('/api/citas/agendar', async (req, res) => {
    try {
        const {
            nombre, telefono, industria, solicitudes, empleados,
            fecha, hora, servicio, notas
        } = req.body;

        if (!nombre || !fecha || !hora || !servicio) {
            // ... (validación se mantiene igual)
        }

        const duracionMinutos = servicio.toLowerCase() === 'cita' ? 60 : 30;
        const fechaHoraSolicitada = new Date(`${fecha}T${hora}:00`);
        // Validar que la fecha de entrada sea válida
        if (isNaN(fechaHoraSolicitada.getTime())) {
            return res.status(400).json({ estado: 'error', mensaje: 'El formato de fecha o hora proporcionado es inválido.' });
        }
        const fechaHoraFinSolicitada = new Date(fechaHoraSolicitada.getTime() + duracionMinutos * 60000);
        
        const citasExistentes = await obtenerCitas();
        let hayConflicto = false;

        for (const cita of citasExistentes) {
            const fechaExistenteStr = cita[6];
            const horaExistenteStr = cita[7];
            const servicioExistente = cita[8];

            if (!fechaExistenteStr || !horaExistenteStr || !servicioExistente) continue;

            // --- NUEVA LÓGICA DE PARSEO DE FECHA ROBUSTA ---
            // Intenta normalizar la fecha a YYYY-MM-DD antes de crear el objeto Date
            let parts = fechaExistenteStr.split(/[-/]/);
            let isoDateStr;
            if (parts.length === 3) {
                // Si el primer segmento es > 31, asumimos que es el año (YYYY-MM-DD)
                if (parseInt(parts[0], 10) > 31) {
                    isoDateStr = `${parts[0]}-${parts[1]}-${parts[2]}`;
                } else { // Asumimos DD-MM-YYYY o similar, lo reordenamos
                    isoDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            } else {
                // Si el formato es inesperado, saltamos esta cita para evitar errores
                console.warn(`Formato de fecha inesperado en la hoja: ${fechaExistenteStr}`);
                continue;
            }

            const inicioExistente = new Date(`${isoDateStr}T${horaExistenteStr}:00`);

            // Si después de nuestro intento, la fecha sigue siendo inválida, la ignoramos.
            if (isNaN(inicioExistente.getTime())) {
                console.warn(`No se pudo interpretar la fecha: '${fechaExistenteStr}'. Saltando verificación para esta fila.`);
                continue;
            }
            // --- FIN DE LA NUEVA LÓGICA ---

            const duracionExistente = servicioExistente.toLowerCase() === 'cita' ? 60 : 30;
            const finExistente = new Date(inicioExistente.getTime() + duracionExistente * 60000);

            if (fechaHoraSolicitada < finExistente && fechaHoraFinSolicitada > inicioExistente) {
                hayConflicto = true;
                break;
            }
        }

        if (hayConflicto) {
            // ... (la lógica para sugerir horarios se mantiene igual)
            return res.status(409).json({
                estado: 'conflicto',
                mensaje: `El horario de ${hora} no está disponible.`,
                horariosSugeridos: [] // Aquí iría la lógica para sugerir
            });
        }
        
        // ... (el resto del código para agendar, la doble verificación y la respuesta se mantiene igual)
        // ... (código para generar idCita, agregarFila, verificar carrera y responder con JSON)

    } catch (error) {
        // ... (manejo de errores se mantiene igual)
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
    error: 'Endpoint no encontrado'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de citas corriendo en el puerto ${PORT}`);
});

module.exports = app;