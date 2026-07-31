/**
 * Convierte una fecha en formato YYYY-MM-DD (u otros formatos legados)
 * a una cadena legible uniformemente, por ejemplo: "31 JULIO 2026"
 */
export function formatDateString(dateStr: string): string {
  if (!dateStr) return 'Sin Fecha';
  
  // Limpiar espacios y pasar a mayúsculas
  const trimmed = dateStr.trim().toUpperCase();
  
  const months = [
    'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
    'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
  ];

  // Caso 1: Si ya viene en formato "DD MES YYYY" (ej: "31 JULIO 2026"), lo dejamos igual
  const parts = trimmed.split(' ');
  if (parts.length === 3 && months.includes(parts[1])) {
    return trimmed;
  }

  // Caso 2: Si viene en formato YYYY-MM-DD (ej: "2026-07-31")
  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateMatch) {
    const year = dateMatch[1];
    const monthIndex = parseInt(dateMatch[2], 10) - 1;
    const dayIndex = parseInt(dateMatch[3], 10);
    
    const monthName = months[monthIndex] || dateMatch[2];
    return `${dayIndex.toString().padStart(2, '0')} ${monthName} ${year}`;
  }

  // Caso 3: Si viene en formato DD/MM/YYYY (ej: "31/07/2026")
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const monthIndex = parseInt(slashMatch[2], 10) - 1;
    const year = slashMatch[3];
    
    const monthName = months[monthIndex] || slashMatch[2];
    return `${day} ${monthName} ${year}`;
  }

  return trimmed;
}

/**
 * Convierte una cadena de fecha (sea YYYY-MM-DD o formato español)
 * a un valor numérico de tiempo para poder ordenar cronológicamente.
 */
export function getEventTimestamp(dateStr: string): number {
  if (!dateStr) return Infinity; // Fechas vacías al final
  
  const trimmed = dateStr.trim().toUpperCase();
  
  // Caso YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // Usar split para evitar desfases de zona horaria local al instanciar el Date
    const parts = trimmed.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).getTime();
  }
  
  // Caso DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const parts = trimmed.split('/');
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])).getTime();
  }

  // Caso DD MES YYYY (ej: "31 JULIO 2026")
  const monthsMap: Record<string, number> = {
    'ENERO': 0, 'FEBRERO': 1, 'MARZO': 2, 'ABRIL': 3,
    'MAYO': 4, 'JUNIO': 5, 'JULIO': 6, 'AGOSTO': 7,
    'SEPTIEMBRE': 8, 'OCTUBRE': 9, 'NOVIEMBRE': 10, 'DICIEMBRE': 11
  };
  
  const parts = trimmed.split(' ');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = monthsMap[parts[1]];
    const year = parseInt(parts[2], 10);
    
    if (month !== undefined) {
      return new Date(year, month, day).getTime();
    }
  }

  // Fallback si no coincide con nada
  const timestamp = Date.parse(dateStr);
  return isNaN(timestamp) ? Infinity : timestamp;
}
