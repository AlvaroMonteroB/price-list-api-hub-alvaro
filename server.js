const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { google } = require("googleapis");
const nodemailer = require('nodemailer'); // Importamos Nodemailer
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// --- Configuración de Nodemailer ---
// Creamos un "transporter" que se encargará de enviar los correos.
// Usaremos Gmail como ejemplo. ¡Asegúrate de configurar esto en tu .env!
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Tu correo de Gmail
        pass: process.env.EMAIL_PASS, // Tu contraseña de aplicación de Gmail
    },
});


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

// --- NUEVO HELPER: Enviar Correo de Confirmación con Nodemailer ---
/**
 * Envía un correo electrónico de confirmación de cita.
 * @param {object} datosCita - Objeto con los detalles de la cita.
 * @param {string} datosCita.email - Correo electrónico del destinatario.
 * @param {string} datosCita.nombre - Nombre del cliente.
 * @param {string} datosCita.fecha - Fecha de la cita.
 * @param {string} datosCita.hora - Hora de la cita.
 * @param {string} datosCita.servicio - Servicio agendado.
 * @param {string} datosCita.idCita - ID único de la cita.
 */
async function enviarCorreoConfirmacion(datosCita) {
    if (!datosCita.email) {
        console.warn(`ADVERTENCIA: No se proporcionó un email para la cita ${datosCita.idCita}. El correo no será enviado.`);
        return;
    }

    // Contenido del correo en HTML para un formato más atractivo
    const mailOptions = {
        from: `"Tu Sistema de Citas" <${process.env.EMAIL_USER}>`,
        to: datosCita.email,
        subject: `Confirmación de Cita: ${datosCita.servicio}`,
        html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>¡Hola ${datosCita.nombre}!</h2>
                <p>Tu cita ha sido registrada exitosamente.</p>
                <p>Aquí están los detalles:</p>
                <ul style="list-style-type: none; padding: 0;">
                    <li><strong>Servicio:</strong> ${datosCita.servicio}</li>
                    <li><strong>Fecha:</strong> ${datosCita.fecha}</li>
                    <li><strong>Hora:</strong> ${datosCita.hora}</li>
                    <li><strong>ID de Cita:</strong> ${datosCita.idCita}</li>
                </ul>
                <p>Si necesitas reagendar o cancelar, por favor contáctanos.</p>
                <p>¡Te esperamos!</p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Correo de confirmación para la cita ${datosCita.idCita} enviado a ${datosCita.email}.`);
    } catch (error) {
        console.error('Error al enviar el correo de confirmación:', error);
    }
}


// --- Helper para respuestas estandarizadas ---
const responder = (res, statusCode, title, rawData) => {
    let message = rawData.mensaje || 'Operación completada.';
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
            range: `${SHEET_NAME_CITAS}!A:K`, // Ampliamos el rango para incluir la columna de email
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
            range: `${SHEET_NAME_CITAS}!A:K`, // Ampliamos el rango
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
        version: '1.3.0 (Nodemailer)',
        endpoints: {
            '/api/citas/agendar': 'POST - Crea una nueva cita y notifica por Correo Electrónico.'
        }
    });
});

app.post('/api/citas/agendar', async (req, res) => {
    try {
        // Añadimos 'email' al destructuring
        const { nombre, email, telefono, industria, solicitudes, empleados, fecha, hora, servicio, notas } = req.body;

        if (!nombre || !fecha || !hora || !servicio || !email) {
            return responder(res, 400, "Error de Validación", {
                mensaje: 'Faltan campos requeridos: nombre, email, fecha, hora y servicio son obligatorios.'
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
            const [, , , , , , , fechaExistente, horaExistente, servicioExistente] = cita;
            if (!fechaExistente || !horaExistente) return false;
            const inicioExistente = new Date(`${fechaExistente}T${horaExistente}:00`);
            const duracionExistente = (servicioExistente || '').toLowerCase() === 'cita' ? 60 : 30;
            const finExistente = new Date(inicioExistente.getTime() + duracionExistente * 60000);
            return fechaHoraSolicitada < finExistente && fechaHoraFinSolicitada > inicioExistente;
        });

        if (hayConflicto) {
            // ... (la lógica de sugerencias de horario se mantiene igual)
            return responder(res, 409, "Conflicto de Horario", {
                mensaje: `El horario de ${hora} no está disponible.`,
                sugerencias: [] // Aquí iría tu lógica de sugerencias
            });
        }

        const idCita = `APT-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
        // Actualizamos la fila para incluir el email
        const nuevaFila = [idCita, nombre, email, telefono || '', industria || '', solicitudes || '', empleados || '', fecha, hora, servicio, notas || ''];
        const exito = await agregarFila(nuevaFila);

        if (exito) {
            const raw = {
                appointmentDetails: { nombre, email, telefono: telefono || '', industria: industria || '', solicitudes: solicitudes || null, empleados: empleados || null, fecha, hora, servicio },
                status: "pendiente",
                idCita
            };
            const markdown = `| Campo | Detalle |\n|:------|:--------|\n| Nombre | ${nombre} |\n| Email | ${email} |\n| Fecha | ${fecha} |\n| Hora | ${hora} |\n| ID Cita | ${idCita} |\n`;
            const desc = `🌟 ¡Hola ${nombre}! Su **cita ha sido registrada exitosamente**. Se ha enviado un correo de confirmación a ${email}.`;

            // --- CAMBIO: Llamamos a la función de enviar correo ---
            enviarCorreoConfirmacion({ nombre, email, fecha, hora, servicio, idCita })
                .catch(err => console.error("Fallo en la ejecución de enviarCorreoConfirmacion:", err));

            return res.status(201).json({ raw, markdown, type: "markdown", desc });
        } else {
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
