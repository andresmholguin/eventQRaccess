const { google } = require('googleapis');

// Usamos las variables cargadas directamente por Node.js via --env-file
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const spreadsheetId = process.env.GOOGLE_SHEET_ID;

console.log('--- Diagnóstico de Google Sheets ---');
console.log('Service Account Email:', email);
console.log('Spreadsheet ID:', spreadsheetId);
console.log('Private Key configurada:', !!privateKey);

if (!email || !privateKey || !spreadsheetId) {
  console.error('ERROR: Faltan variables de entorno. Ejecuta el script con --env-file=.env.local');
  process.exit(1);
}

const cleanPrivateKey = privateKey.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1');

async function testConnection() {
  try {
    const auth = new google.auth.JWT({
      email,
      key: cleanPrivateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log('\nIntentando leer la hoja...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A1:H1',
    });

    console.log('¡CONEXIÓN EXITOSA!');
    console.log('Valores leídos en la primera fila:', response.data.values);
  } catch (error) {
    console.error('\n¡ERROR DE CONEXIÓN!');
    console.error('Código de error:', error.code);
    console.error('Mensaje de error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    if (error.message.includes('caller does not have permission')) {
      console.log('\nSugerencia: Asegúrate de haber compartido el documento de Google Sheets con el correo de la cuenta de servicio y haberle asignado permisos de Editor.');
    }
  }
}

testConnection();
