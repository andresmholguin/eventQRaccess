export interface Evento {
  id?: string; // Fila en Google Sheets o ID generado para local storage
  nombre: string;
  fecha: string;
  promoterId: string;
  eventId: string;
  showId: string;
  urlBase: string;
  fechaCreacion: string;
  favorito: boolean;
  localidades?: Localidad[];
}

export interface LocalidadLink {
  label: string;
  url: string;
}

export interface Localidad {
  nombre: string;
  url: string; // Enlace principal de configuración
  id?: string;
  links?: LocalidadLink[]; // Todos los enlaces encontrados dentro de la tarjeta
}

export interface ModuleConfig {
  name: string;
  path: string; // e.g. 'reports/sales/summary.aspx'
  category: 'Informes' | 'Configuración' | 'Ventas' | 'Acomodación';
  icon: string;
}
