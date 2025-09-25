// require('dotenv').config(); 
// const express = require('express');
// const cors = require('cors');
// const helmet = require('helmet');
// const rateLimit = require('express-rate-limit');
// const { google } = require("googleapis");
// const nodemailer = require('nodemailer'); // Importamos Nodemailer
// require('dotenv').config();

// const app = express();
// app.set('trust proxy', 1);
// const PORT = process.env.PORT || 3000;

// // --- Configuración de Nodemailer ---
// // Creamos un "transporter" que se encargará de enviar los correos.
// // Usaremos Gmail como ejemplo. ¡Asegúrate de configurar esto en tu .env!

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER || 'tuemail@gmail.com',
//     pass: process.env.EMAIL_PASS || 'tu_contraseña_de_aplicacion'
//   }
// });
// transporter.verify((error, success) => {
//   if (error) {
//     console.log('❌ Error conectando con Gmail:', error);
//   } else {
//     console.log('✅ Conexión con Gmail establecida correctamente');
//   }
// });


// // --- Configuración de Google Sheets ---
// const GOOGLE_SHEETS_CREDENTIALS = {
//     "type": "service_account",
//     "project_id": process.env.GOOGLE_PROJECT_ID,
//     "private_key_id": process.env.GOOGLE_PRIVATE_KEY_ID,
//     "private_key": process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
//     "client_email": process.env.GOOGLE_CLIENT_EMAIL,
//     "client_id": process.env.GOOGLE_CLIENT_ID,
//     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
//     "token_uri": "https://oauth2.googleapis.com/token",
//     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
//     "client_x509_cert_url": process.env.GOOGLE_CLIENT_X509_CERT_URL,
//     "universe_domain": "googleapis.com"
// };

// const SHEET_ID_CITAS = process.env.SHEET_ID_CITAS;
// const SHEET_NAME_CITAS = process.env.SHEET_NAME_CITAS || 'Citas';

// const auth = new google.auth.GoogleAuth({
//     credentials: GOOGLE_SHEETS_CREDENTIALS,
//     scopes: ["https://www.googleapis.com/auth/spreadsheets"],
// });

// // --- HELPER MODIFICADO: Enviar Correo a un Destinatario Fijo ---
// /**
//  * Envía un correo electrónico de notificación de nueva cita a un destinatario predefinido.
//  * @param {object} datosCita - Objeto con los detalles de la cita.
//  */
// async function enviarCorreoConfirmacion(datosCita) {
//     const recipientEmail = process.env.RECIPIENT_EMAIL;
//     if (!recipientEmail) {
//         console.warn(`ADVERTENCIA: La variable de entorno RECIPIENT_EMAIL no está definida. El correo no será enviado.`);
//         return;
//     }

//     // Contenido del correo en HTML para un formato más atractivo
//     const mailOptions = {
//         from: process.env.EMAIL_USER,
//         to: recipientEmail, // El destinatario ahora es fijo
//         subject: `Nueva Cita Agendada: ${datosCita.nombre} - ${datosCita.servicio}`,
//         text:"Hola"
//     };

//     try {
//         await transporter.sendMail(mailOptions);
//         console.log(`Correo de notificación para la cita ${datosCita.idCita} enviado a ${recipientEmail}.`);
//     } catch (error) {
//         console.error('Error al enviar el correo de notificación:', error);
//     }
// }


// // --- Helper para respuestas estandarizadas ---
// const responder = (res, statusCode, title, rawData) => {
//     let message = rawData.mensaje || 'Operación completada.';
//     if (rawData.sugerencias && rawData.sugerencias.length > 0) {
//         message = `${message}\n\n**Horas alternativas sugeridas:**\n${rawData.sugerencias.join(', ')}`;
//     } else if (rawData.sugerencias) {
//         message = `${message}\n\nNo se encontraron otras horas disponibles en esta fecha.`;
//     }

//     const response = {
//         raw: {
//             status: statusCode >= 400 ? 'error' : 'exito',
//             ...rawData
//         },
//         markdown: `**${title}**\n\n${message}`,
//         type: "markdown",
//         desc: `**${title}**\n\n${message}`
//     };
//     res.status(statusCode).json(response);
// };


// // --- Helpers de Google Sheets ---
// async function obtenerCitas() {
//     try {
//         const client = await auth.getClient();
//         const sheets = google.sheets({ version: "v4", auth: client });
//         const response = await sheets.spreadsheets.values.get({
//             spreadsheetId: SHEET_ID_CITAS,
//             range: `${SHEET_NAME_CITAS}!A:J`, // Rango original de 10 columnas
//         });
//         const rows = response.data.values || [];
//         return rows.length > 1 ? rows.slice(1) : [];
//     } catch (error) {
//         console.error('Error al leer las citas de la hoja:', error);
//         throw new Error('No se pudieron obtener las citas.');
//     }
// }

// async function agregarFila(valores) {
//     try {
//         const client = await auth.getClient();
//         const sheets = google.sheets({ version: "v4", auth: client });
//         await sheets.spreadsheets.values.append({
//             spreadsheetId: SHEET_ID_CITAS,
//             range: `${SHEET_NAME_CITAS}!A:J`, // Rango original de 10 columnas
//             valueInputOption: "USER_ENTERED",
//             insertDataOption: "INSERT_ROWS",
//             requestBody: { values: [valores] },
//         });
//         return true;
//     } catch (error) {
//         console.error('Error al agregar la fila:', error);
//         throw new Error('No se pudo guardar la cita en la hoja de cálculo.');
//     }
// }

// // --- Middlewares ---
// app.use(helmet());
// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.'
// }));

// // --- Rutas de la API ---
// app.get('/', (req, res) => {
//     responder(res, 200, "API de Agendamiento de Citas", {
//         version: '1.4.0 (Nodemailer Fijo)',
//         endpoints: {
//             '/api/citas/agendar': 'POST - Crea una nueva cita y notifica por Correo Electrónico a un destinatario fijo.'
//         }
//     });
// });

// app.post('/api/citas/agendar', async (req, res) => {
//     try {
//         // Se elimina 'email' del destructuring
//         const { nombre, telefono, industria, solicitudes, empleados, fecha, hora, servicio, notas } = req.body;

//         if (!nombre || !fecha || !hora || !servicio) {
//             return responder(res, 400, "Error de Validación", {
//                 mensaje: 'Faltan campos requeridos: nombre, fecha, hora y servicio son obligatorios.'
//             });
//         }

//         const duracionMinutos = servicio.toLowerCase() === 'cita' ? 60 : 30;
//         const fechaHoraSolicitada = new Date(`${fecha}T${hora}:00`);
//         if (isNaN(fechaHoraSolicitada.getTime())) {
//             return responder(res, 400, "Error de Formato", {
//                 mensaje: 'El formato de fecha u hora es inválido.'
//             });
//         }
//         const fechaHoraFinSolicitada = new Date(fechaHoraSolicitada.getTime() + duracionMinutos * 60000);

//         const citasExistentes = await obtenerCitas();
//         const hayConflicto = citasExistentes.some(cita => {
//             // Índices ajustados a la estructura de 10 columnas
//             const [, , , , , , fechaExistente, horaExistente, servicioExistente] = cita;
//             if (!fechaExistente || !horaExistente) return false;
//             const inicioExistente = new Date(`${fechaExistente}T${horaExistente}:00`);
//             const duracionExistente = (servicioExistente || '').toLowerCase() === 'cita' ? 60 : 30;
//             const finExistente = new Date(inicioExistente.getTime() + duracionExistente * 60000);
//             return fechaHoraSolicitada < finExistente && fechaHoraFinSolicitada > inicioExistente;
//         });

//         if (hayConflicto) {
//             // ... (la lógica de sugerencias de horario se mantiene igual)
//             return responder(res, 409, "Conflicto de Horario", {
//                 mensaje: `El horario de ${hora} no está disponible.`,
//                 sugerencias: [] // Aquí iría tu lógica de sugerencias
//             });
//         }

//         const idCita = `APT-${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
//         // Fila vuelve a la estructura original de 10 columnas
//         const nuevaFila = [idCita, nombre, telefono || '', industria || '', solicitudes || '', empleados || '', fecha, hora, servicio, notas || ''];
//         const exito = await agregarFila(nuevaFila);

//         if (exito) {
//             const raw = {
//                 appointmentDetails: { nombre, telefono: telefono || '', industria: industria || '', solicitudes: solicitudes || null, empleados: empleados || null, fecha, hora, servicio },
//                 status: "pendiente",
//                 idCita
//             };
//             const markdown = `| Campo | Detalle |\n|:------|:--------|\n| Nombre | ${nombre} |\n| Teléfono | ${telefono || 'N/A'} |\n| Fecha | ${fecha} |\n| Hora | ${hora} |\n| ID Cita | ${idCita} |\n`;
//             const desc = `🌟 ¡Hola ${nombre}! Su **cita ha sido registrada exitosamente**. Se ha enviado una notificación.`;

//             // --- CAMBIO: Llamamos a la función de enviar correo con todos los datos ---
//             enviarCorreoConfirmacion({ nombre, telefono, industria, solicitudes, empleados, fecha, hora, servicio, notas, idCita })
//                 .catch(err => console.error("Fallo en la ejecución de enviarCorreoConfirmacion:", err));

//             return res.status(201).json({ raw, markdown, type: "markdown", desc });
//         } else {
//             throw new Error('No se pudo guardar la cita en la hoja de cálculo. Intente de nuevo.');
//         }

//     } catch (error) {
//         console.error('Error en el endpoint de agendar cita:', error);
//         responder(res, 500, "Error Interno del Servidor", {
//             mensaje: error.message || 'Ocurrió un error inesperado en el servidor.'
//         });
//     }
// });


// // --- Manejo de errores y 404 ---
// app.use((err, req, res, next) => {
//     console.error(err.stack);
//     responder(res, 500, "Error Interno Grave", {
//         mensaje: "Ocurrió un error inesperado en el servidor."
//     });
// });

// app.use('*', (req, res) => {
//     responder(res, 404, "Endpoint no Encontrado", {
//         mensaje: `La ruta ${req.method} ${req.originalUrl} no existe en esta API.`
//     });
// });


// // Iniciar servidor
// app.listen(PORT, () => {
//     console.log(`Servidor de citas corriendo en el puerto ${PORT}`);
// });

// module.exports = app;

require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar transporter de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'tuemail@gmail.com',
    pass: process.env.EMAIL_PASS || 'tu_contraseña_de_aplicacion'
  }
});

// Verificar conexión con Gmail
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Error conectando con Gmail:', error);
  } else {
    console.log('✅ Conexión con Gmail establecida correctamente');
  }
});

// Ruta principal
app.get('/', (req, res) => {
  res.json({ 
    message: 'Servidor de emails funcionando',
    endpoints: {
      sendBasic: 'POST /send-basic',
      sendHTML: 'POST /send-html',
      sendTemplate: 'POST /send-template',
      sendCustom: 'POST /send-custom'
    }
  });
});

// 1. Endpoint POST para email básico (texto plano)
app.post('/send-basic', async (req, res) => {
  try {
    const { to, subject, text } = req.body;

    if (!to || !subject || !text) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to", "subject" y "text" son requeridos'
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      text: text
    };

    const info = await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Email básico enviado correctamente',
      messageId: info.messageId,
      response: info.response
    });

  } catch (error) {
    console.error('Error al enviar email básico:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar el email',
      details: error.message
    });
  }
});

// 2. Endpoint POST para email HTML
app.post('/send-html', async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" y "subject" son requeridos'
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      text: text || 'Este email contiene contenido HTML',
      html: html || `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px;">
            <h1 style="color: #333;">${subject}</h1>
            <p style="color: #666;">Este es un email con contenido HTML</p>
            <p style="color: #999; font-size: 12px;">Enviado el ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Email HTML enviado correctamente',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Error al enviar email HTML:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar el email HTML',
      details: error.message
    });
  }
});

// 3. Endpoint POST para email con template
app.post('/send-template', async (req, res) => {
  try {
    const { to, subject, nombre, mensaje, empresa } = req.body;

    if (!to || !subject || !nombre) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to", "subject" y "nombre" son requeridos'
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { 
                    font-family: 'Arial', sans-serif; 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    margin: 0; 
                    padding: 20px; 
                    min-height: 100vh;
                }
                .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: white; 
                    padding: 30px; 
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                }
                .header { 
                    background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
                    color: white; 
                    padding: 30px; 
                    text-align: center; 
                    border-radius: 10px 10px 0 0;
                    margin: -30px -30px 30px -30px;
                }
                .content { 
                    padding: 20px; 
                    line-height: 1.6;
                }
                .footer { 
                    text-align: center; 
                    padding: 20px; 
                    color: #666; 
                    font-size: 12px; 
                    border-top: 1px solid #eee;
                    margin-top: 30px;
                }
                .button {
                    display: inline-block;
                    background: #007bff;
                    color: white;
                    padding: 12px 25px;
                    text-decoration: none;
                    border-radius: 5px;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>${empresa || 'Notificación Importante'}</h1>
                    <p>${subject}</p>
                </div>
                <div class="content">
                    <h2>Hola ${nombre},</h2>
                    <p>${mensaje || 'Te estamos contactando desde nuestro sistema automatizado.'}</p>
                    
                    <p><strong>Información del envío:</strong></p>
                    <ul>
                        <li><strong>Fecha:</strong> ${new Date().toLocaleDateString()}</li>
                        <li><strong>Hora:</strong> ${new Date().toLocaleTimeString()}</li>
                        <li><strong>Destinatario:</strong> ${to}</li>
                    </ul>
                    
                    <center>
                        <a href="#" class="button">Acceder al Sistema</a>
                    </center>
                </div>
                <div class="footer">
                    <p>Este es un mensaje automático, por favor no responder directamente a este email.</p>
                    <p>© ${new Date().getFullYear()} ${empresa || 'Mi Empresa'}. Todos los derechos reservados.</p>
                </div>
            </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Email con template enviado correctamente',
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Error al enviar email con template:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar el email con template',
      details: error.message
    });
  }
});

// 4. Endpoint POST para email con datos dinámicos
app.post('/send-custom', async (req, res) => {
  try {
    const { from, to, subject, text, html, cc, bcc } = req.body;

    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        error: 'Los campos "to" y "subject" son requeridos'
      });
    }

    const mailOptions = {
      from: from || process.env.EMAIL_USER,
      to: to,
      subject: subject,
      text: text || '',
      html: html || '',
      cc: cc || '',
      bcc: bcc || ''
    };

    const info = await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: 'Email personalizado enviado correctamente',
      messageId: info.messageId,
      details: info
    });

  } catch (error) {
    console.error('Error al enviar email personalizado:', error);
    res.status(500).json({
      success: false,
      error: 'Error al enviar el email personalizado',
      details: error.message
    });
  }
});

// Manejo de errores para rutas no encontradas (CORREGIDO)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    availableEndpoints: {
      'GET /': 'Información del servidor',
      'POST /send-basic': 'Enviar email básico (texto)',
      'POST /send-html': 'Enviar email con HTML',
      'POST /send-template': 'Enviar email con template predefinido',
      'POST /send-custom': 'Enviar email completamente personalizado'
    }
  });
});

// Manejo de errores global
app.use((error, req, res, next) => {
  console.error('Error global:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    details: error.message
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📧 Email configurado: ${process.env.EMAIL_USER || 'Configurar variables de entorno'}`);
});