import { google } from 'googleapis';
import { Evento } from '../types';

// Rango para la consulta y escritura en Sheets
const SHEET_NAME = 'Eventos';
const RANGE = `${SHEET_NAME}!A:H`;

/**
 * Retorna true si las credenciales de Google Sheets están configuradas.
 */
export function isSheetsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_SHEET_ID
  );
}

/**
 * Obtiene la instancia autenticada de Google Sheets.
 */
function getSheetsInstance() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Reemplazar saltos de línea literales en la clave privada si existen
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1');

  if (!email || !privateKey) {
    throw new Error('Google Sheets API credentials are not properly set up in environment variables.');
  }

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Inicializa la hoja de cálculo con las cabeceras si está vacía.
 */
async function initializeSheet(sheets: any, spreadsheetId: string) {
  try {
    // Intentar leer las primeras filas para verificar si hay datos
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:H1`,
    });

    if (!response.data.values || response.data.values.length === 0) {
      // Si está vacía, escribimos los encabezados
      const headers = [
        'Nombre del evento',
        'Fecha',
        'Promoter ID',
        'Event ID',
        'Show ID',
        'URL base',
        'Fecha de creación',
        'Favorito',
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A1:H1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });
      console.log('Hoja inicializada con encabezados.');
    }
  } catch (error: any) {
    // Si la hoja 'Eventos' no existe, Google Sheets dará un error. 
    // En ese caso, intentamos crear la hoja primero si tenemos permisos, o creamos en la hoja por defecto (Sheet1/Hoja1)
    console.error('Error al inicializar la hoja:', error.message);
    
    try {
      // Intentar agregar una hoja llamada 'Eventos'
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: SHEET_NAME,
                },
              },
            },
          ],
        },
      });
      // Volver a escribir los encabezados
      const headers = [
        'Nombre del evento',
        'Fecha',
        'Promoter ID',
        'Event ID',
        'Show ID',
        'URL base',
        'Fecha de creación',
        'Favorito',
      ];
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A1:H1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });
    } catch (sheetCreateError: any) {
      console.error('No se pudo crear la pestaña "Eventos". Usando pestaña por defecto.', sheetCreateError.message);
    }
  }
}

/**
 * Obtiene todos los eventos guardados en la hoja de Google Sheets.
 */
export async function fetchEventosFromSheets(): Promise<Evento[]> {
  if (!isSheetsConfigured()) {
    throw new Error('Google Sheets no está configurado.');
  }

  const sheets = getSheetsInstance();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  // Inicializar hoja por si acaso
  await initializeSheet(sheets, spreadsheetId);

  // Leer todas las filas. Intentar primero con la pestaña 'Eventos', si falla, leer todo el documento
  let response;
  try {
    response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: RANGE,
    });
  } catch (error) {
    // Fallback por si la pestaña 'Eventos' tiene problemas de acceso directos, leer rango genérico A:H
    response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:H',
    });
  }

  const rows = response.data.values;
  if (!rows || rows.length <= 1) {
    return []; // Solo cabeceras o vacío
  }

  // Las cabeceras están en la fila 0:
  // [Nombre del evento, Fecha, Promoter ID, Event ID, Show ID, URL base, Fecha de creación, Favorito]
  const eventos: Evento[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    // Mapear columnas a objeto Evento. Guardamos el índice de la fila + 1 (1-based index para actualizar en Sheets)
    eventos.push({
      id: (i + 1).toString(), // Fila de Google Sheets
      nombre: row[0] || 'Evento sin nombre',
      fecha: row[1] || '',
      promoterId: row[2] || '',
      eventId: row[3] || '',
      showId: row[4] || '',
      urlBase: row[5] || '',
      fechaCreacion: row[6] || '',
      favorito: row[7] === 'SI',
    });
  }

  return eventos;
}

/**
 * Agrega un nuevo evento en Google Sheets.
 */
export async function addEventoToSheets(evento: Omit<Evento, 'id'>): Promise<Evento> {
  if (!isSheetsConfigured()) {
    throw new Error('Google Sheets no está configurado.');
  }

  const sheets = getSheetsInstance();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  await initializeSheet(sheets, spreadsheetId);

  const rowValues = [
    evento.nombre,
    evento.fecha,
    evento.promoterId,
    evento.eventId,
    evento.showId,
    evento.urlBase,
    evento.fechaCreacion,
    evento.favorito ? 'SI' : 'NO',
  ];

  // Buscamos con pestaña específica, si falla intentamos con rango genérico
  let appendRange = RANGE;
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: appendRange,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowValues],
      },
    });
  } catch (error) {
    appendRange = 'A:H';
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: appendRange,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowValues],
      },
    });
  }

  // Volvemos a consultar para obtener la lista actualizada con los IDs de fila correctos
  const eventos = await fetchEventosFromSheets();
  const creado = eventos.find(
    (e) =>
      e.promoterId === evento.promoterId &&
      e.eventId === evento.eventId &&
      e.showId === evento.showId
  );

  return creado || { ...evento, id: (eventos.length + 1).toString() };
}

/**
 * Actualiza el estado de Favorito en Google Sheets para una fila específica.
 */
export async function updateEventoFavoritoInSheets(rowId: string, favorito: boolean): Promise<boolean> {
  if (!isSheetsConfigured()) {
    throw new Error('Google Sheets no está configurado.');
  }

  const sheets = getSheetsInstance();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  const cellRange = `${SHEET_NAME}!H${rowId}`;
  
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: cellRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[favorito ? 'SI' : 'NO']],
      },
    });
    return true;
  } catch (error: any) {
    // Reintentar con celda sin el nombre de la pestaña por si acaso
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `H${rowId}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[favorito ? 'SI' : 'NO']],
        },
      });
      return true;
    } catch (innerError) {
      console.error('Error actualizando favorito en Sheets:', error.message);
      return false;
    }
  }
}

/**
 * Elimina un evento de la hoja. 
 * En Google Sheets, borrar una fila requiere usar batchUpdate para eliminar físicamente la fila,
 * o limpiar el contenido de las celdas. Para evitar descuadrar los IDs de fila de los demás elementos 
 * si se borran filas intermedias, podemos simplemente limpiar el contenido de esa fila,
 * o reconstruir la lista. En este helper, limpiaremos el rango de la fila para mantener los IDs estables.
 */
export async function deleteEventoInSheets(rowId: string): Promise<boolean> {
  if (!isSheetsConfigured()) {
    throw new Error('Google Sheets no está configurado.');
  }

  const sheets = getSheetsInstance();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;
  const rowRange = `${SHEET_NAME}!A${rowId}:H${rowId}`;

  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: rowRange,
    });
    return true;
  } catch (error: any) {
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `A${rowId}:H${rowId}`,
      });
      return true;
    } catch (innerError) {
      console.error('Error eliminando evento en Sheets:', error.message);
      return false;
    }
  }
}
