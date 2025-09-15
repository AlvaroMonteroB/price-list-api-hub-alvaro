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

// --- NUEVO: Helper para respuestas estandarizadas ---
/**
 * Envía una respuesta estandarizada en el formato { raw, markdown, type, desc }.
 * @param {object} res - El objeto de respuesta de Express.
 * @param {number} statusCode - El código de estado HTTP.
 * @param {string} title - Un título descriptivo (ej: "Error de Validación").
 * @param {object} rawData - El objeto de datos para el campo 'raw'.
 */
const responder = (res, statusCode, title, rawData) => {
    let message = rawData.mensaje || 'Operación completada.';
    // Formato especial para incluir sugerencias en el mensaje si existen
    if (rawData.sugerencias && rawData.sugerencias.length > 0) {
        message = `${message}\n\n**Horas alternativas sugeridas:**\n${rawData.sugerencias.join(', ')}`;
    } else if (rawData.sugerencias) {
        message = `${message}\n\nNo se encontraron otras horas disponibles en esta fecha.`;
    }

    const response = {
        raw: {
            status: statusCode >= 400 ? 'error' : 'exito',
            ...rawData
        },
        markdown: `**${title}**\n\n${message}`,
        type: "markdown",
        desc: `**${title}**\n\n${message}`
    };
    res.status(statusCode).json(response);
};


// --- Helpers de Google Sheets ---
async function obtenerCitas() {
  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID_CITAS,
      range: `${SHEET_NAME_CITAS}!A:J`,
    });
    const rows = response.data.values || [];
    return rows.length > 1 ? rows.slice(1) : [];
  } catch (error) {
    console.error('Error al leer las citas de la hoja:', error);
    throw new Error('No se pudieron obtener las citas.');
  }
}

async function agregarFila(valores) {
    try {
        const client = await auth.getClient();
        const sheets = google.sheets({ version: "v4", auth: client });
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID_CITAS,
            range: `${SHEET_NAME_CITAS}!A:J`,
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values: [valores] },
        });
        return true;
    } catch (error) {
        console.error('Error al agregar la fila:', error);
        throw new Error('No se pudo guardar la cita en la hoja de cálculo.');
    }
}

// --- Middlewares ---
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.'
}));

// --- Rutas de la API ---
app.get('/', (req, res) => {
    responder(res, 200, "API de Agendamiento de Citas", {
        version: '1.1.0',
        endpoints: {
          '/api/citas/agendar': 'POST - Crea una nueva cita, verificando disponibilidad.'
        }
    });
});

app.post('/api/citas/agendar', async (req, res) => {
  try {
    const { nombre, telefono, industria, solicitudes, empleados, fecha, hora, servicio, notas } = req.body;

    if (!nombre || !fecha || !hora || !servicio) {
      return responder(res, 400, "Error de Validación", {
          mensaje: 'Faltan campos requeridos: nombre, fecha, hora y servicio son obligatorios.'
      });
    }

    const duracionMinutos = servicio.toLowerCase() === 'cita' ? 60 : 30;
    const fechaHoraSolicitada = new Date(`${fecha}T${hora}:00`);
    if (isNaN(fechaHoraSolicitada.getTime())) {
        return responder(res, 400, "Error de Formato", {
            mensaje: 'El formato de fecha u hora es inválido.'
        });
    }
    const fechaHoraFinSolicitada = new Date(fechaHoraSolicitada.getTime() + duracionMinutos * 60000);

    const citasExistentes = await obtenerCitas();
    const hayConflicto = citasExistentes.some(cita => {
        const [, , , , , , fechaExistente, horaExistente, servicioExistente] = cita;
        if (!fechaExistente || !horaExistente) return false;
        const inicioExistente = new Date(`${fechaExistente}T${horaExistente}:00`);
        const duracionExistente = (servicioExistente || '').toLowerCase() === 'cita' ? 60 : 30;
        const finExistente = new Date(inicioExistente.getTime() + duracionExistente * 60000);
        return fechaHoraSolicitada < finExistente && fechaHoraFinSolicitada > inicioExistente;
    });
    
    if (hayConflicto) {
        // Lógica para sugerir horarios
        const horariosDisponibles = [];
        const inicioJornada = new Date(`${fecha}T09:00:00`);
        const finJornada = new Date(`${fecha}T18:00:00`);
        let tiempoPrueba = new Date(inicioJornada);

        while (tiempoPrueba < finJornada) {
            const finTiempoPrueba = new Date(tiempoPrueba.getTime() + duracionMinutos * 60000);
            if (finTiempoPrueba > finJornada) break;

            const slotDisponible = !citasExistentes.some(cita => {
                const [, , , , , , fechaExistente, horaExistente, servicioExistente] = cita;
                if (fechaExistente !== fecha || !horaExistente) return false;
                const inicioExistente = new Date(`${fechaExistente}T${horaExistente}:00`);
                const duracionExistente = (servicioExistente || '').toLowerCase() === 'cita' ? 60 : 30;
                const finExistente = new Date(inicioExistente.getTime() + duracionExistente * 60000);
                return tiempoPrueba < finExistente && finTiempoPrueba > inicioExistente;
            });

            if (slotDisponible) {
                horariosDisponibles.push(tiempoPrueba.toTimeString().substring(0, 5));
            }
            tiempoPrueba.setMinutes(tiempoPrueba.getMinutes() + 30);
        }

        return responder(res, 409, "Conflicto de Horario", {
            mensaje: `El horario de ${hora} no está disponible.`,
            sugerencias: horariosDisponibles
        });
    }

    // Si no hay conflicto, proceder a agendar
    const idCita = `APT-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
    const nuevaFila = [idCita, nombre, telefono || '', industria || '', solicitudes || '', empleados || '', fecha, hora, servicio, notas || ''];
    const exito = await agregarFila(nuevaFila);

    if (exito) {
        const raw = {
          appointmentDetails: { nombre, telefono: telefono || '', industria: industria || '', solicitudes: solicitudes || null, empleados: empleados || null, fecha, hora, servicio },
          status: "pendiente",
          idCita
        };
        const markdown = `| Campo | Detalle |\n|:------|:--------|\n| Nombre | ${nombre} |\n| Teléfono | ${telefono || 'N/A'} |\n| Industria | ${industria || 'N/A'} |\n| Fecha | ${fecha} |\n| Hora | ${hora} |\n| ID Cita | ${idCita} |\n`;
        const desc = `🌟 ¡Hola ${nombre}! Su **cita ha sido registrada exitosamente**.\n\n📅 Detalles:\n• 📌 Industria: ${industria || 'N/A'}\n• 🗓️ Fecha: ${fecha} a las ${hora} hrs\n• ✅ ID: **${idCita}**`;
        
        // Esta es la única respuesta que no usa el helper porque su estructura es muy específica y ya es correcta.
        return res.status(201).json({ raw, markdown, type: "markdown", desc });
    } else {
        // Este error ahora es manejado por el catch block al usar `throw new Error`.
        throw new Error('No se pudo guardar la cita en la hoja de cálculo. Intente de nuevo.');
    }

  } catch (error) {
    console.error('Error en el endpoint de agendar cita:', error);
    responder(res, 500, "Error Interno del Servidor", {
        mensaje: error.message || 'Ocurrió un error inesperado en el servidor.'
    });
  }
});

// --- Manejo de errores y 404 ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  responder(res, 500, "Error Interno Grave", {
      mensaje: "Ocurrió un error inesperado en el servidor."
  });
});

app.use('*', (req, res) => {
  responder(res, 404, "Endpoint no Encontrado", {
      mensaje: `La ruta ${req.method} ${req.originalUrl} no existe en esta API.`
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de citas corriendo en el puerto ${PORT}`);
});

module.exports = app;