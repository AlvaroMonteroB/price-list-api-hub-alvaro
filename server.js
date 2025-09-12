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
        nombre,
        telefono,
        industria,
        solicitudes,
        empleados,
        fecha,
        hora,
        servicio,
        notas
    } = req.body;

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

    for (const cita of citasExistentes) {
        // Asumiendo que ahora la fecha está en la columna G (índice 6) y la hora en H (índice 7)
        const fechaExistente = cita[6];
        const horaExistente = cita[7];
        const servicioExistente = cita[8];

        if (!fechaExistente || !horaExistente || !servicioExistente) continue;

        const duracionExistente = servicioExistente.toLowerCase() === 'cita' ? 60 : 30;
        const inicioExistente = new Date(`${fechaExistente}T${horaExistente}:00`);
        const finExistente = new Date(inicioExistente.getTime() + duracionExistente * 60000);

        if (fechaHoraSolicitada < finExistente && fechaHoraFinSolicitada > inicioExistente) {
            hayConflicto = true;
            break;
        }
    }
    
    if (!hayConflicto) {
        // 1. Generar ID único para la cita
        const idCita = `APT-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;

        const nuevaFila = [
            idCita,
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
            // 2. Construir el objeto de respuesta en el formato solicitado
            const raw = {
              appointmentDetails: {
                nombre: nombre,
                telefono: telefono || '',
                industria: industria || '',
                solicitudes: solicitudes || null,
                empleados: empleados || null,
                fecha: fecha,
                hora: hora,
                servicio: servicio
              },
              status: "pendiente",
              idCita: idCita
            };

            const markdown = `| Campo | Detalle |\n|:------|:--------|\n| Nombre | ${nombre} |\n| Teléfono | ${telefono || 'N/A'} |\n| Industria | ${industria || 'N/A'} |\n| Solicitudes semanales | ${solicitudes || 'N/A'} |\n| Empleados | ${empleados || 'N/A'} |\n| Fecha | ${fecha} |\n| Hora | ${hora} |\n| Servicio | ${servicio} |\n| Estado | Pendiente |\n| ID Cita | ${idCita} |\n`;
            
            const desc = `🌟 ¡Hola ${nombre}! Su **cita ha sido registrada exitosamente**.\n\n📅 Detalles de su cita:\n• 📌 Industria: ${industria || 'N/A'}\n• 🛠️ Solicitudes promedio por semana: ${solicitudes || 'N/A'}\n• 👥 Número de empleados: ${empleados || 'N/A'}\n• 🗓️ Fecha de la cita: ${fecha} a las ${hora} hrs\n• 📞 Tipo de servicio: ${servicio}\n\n✅ Su ID de reserva es **${idCita}**. Nuestro equipo se pondrá en contacto con usted para confirmar los detalles. ¡Gracias por confiar en nosotros!`;

            return res.status(201).json({
                raw,
                markdown,
                type: "markdown",
                desc
            });
        } else {
             return res.status(500).json({
                estado: 'error_guardado',
                mensaje: 'No se pudo guardar la cita en la hoja de cálculo. Intente de nuevo.'
            });
        }
    } else {
        const horariosDisponibles = [];
        const inicioJornada = new Date(`${fecha}T09:00:00`);
        const finJornada = new Date(`${fecha}T18:00:00`);
        let tiempoPrueba = new Date(inicioJornada);

        while (tiempoPrueba < finJornada) {
            const finTiempoPrueba = new Date(tiempoPrueba.getTime() + duracionMinutos * 60000);
            if (finTiempoPrueba > finJornada) break;

            let slotDisponible = true;
            for (const cita of citasExistentes) {
                const fechaExistente = cita[6];
                if (fechaExistente !== fecha) continue;
                
                const horaExistente = cita[7];
                const servicioExistente = cita[8];
                if (!horaExistente || !servicioExistente) continue;

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
    error: 'Endpoint no encontrado'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de citas corriendo en el puerto ${PORT}`);
});

module.exports = app;