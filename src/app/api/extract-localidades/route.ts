import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { Localidad } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, cookie, htmlContent } = body;

    // Caso A: El usuario ya nos proporcionó el HTML directamente (Pegado Manual)
    if (htmlContent) {
      const localidades = parseLocalidadesHtml(htmlContent);
      return NextResponse.json({
        success: true,
        localidades,
        source: 'manual',
      });
    }

    // Caso B: El usuario quiere que hagamos fetch automático
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Se requiere una "url" o "htmlContent".' },
        { status: 400 }
      );
    }

    try {
      const headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      };

      if (cookie) {
        headers['Cookie'] = cookie;
      }

      // Realizar la petición HTTP
      const response = await fetch(url, {
        headers,
        cache: 'no-store',
      });

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: `Error al obtener la página: ${response.status} ${response.statusText}`,
          requiresCookie: true,
        });
      }

      const html = await response.text();

      // Verificar si nos redirigió a una página de Login de QRBoletos
      if (html.includes('login') || html.includes('Login') || html.includes('txtUsuario') || html.includes('txtPassword')) {
        return NextResponse.json({
          success: false,
          error: 'Redirección a pantalla de inicio de sesión detectada. Se requiere una cookie de sesión activa.',
          requiresCookie: true,
        });
      }

      const localidades = parseLocalidadesHtml(html);

      if (localidades.length === 0) {
        return NextResponse.json({
          success: true,
          localidades: [],
          warning: 'No se encontraron localidades. El HTML podría estar incompleto o requerir inicio de sesión.',
          htmlPreview: html.substring(0, 1000), // Para depurar
        });
      }

      return NextResponse.json({
        success: true,
        localidades,
        source: 'fetch',
      });
    } catch (fetchError: any) {
      console.error('Error fetching URL:', fetchError);
      return NextResponse.json({
        success: false,
        error: `Error de conexión: ${fetchError.message || fetchError}`,
        requiresCookie: true,
      });
    }
  } catch (error: any) {
    console.error('Error en /api/extract-localidades:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno al procesar HTML' },
      { status: 500 }
    );
  }
}

/**
 * Parsea el HTML de la página de Localidades para extraer la información requerida.
 */
function parseLocalidadesHtml(html: string): Localidad[] {
  const localidades: Localidad[] = [];
  const $ = cheerio.load(html);

  // Intentamos buscar en el contenedor específico #sections-box
  let cards = $('#sections-box div.card');

  // Fallback 1: Si no está dentro de #sections-box pero hay tarjetas card
  if (cards.length === 0) {
    cards = $('div.card');
  }

  // Fallback 2: Si no hay div.card, busquemos cualquier elemento que parezca una tarjeta de localidad
  if (cards.length === 0) {
    // Buscar elementos con clases comunes
    cards = $('.card, .panel, .section-item');
  }

  cards.each((_, el) => {
    const card = $(el);

    // 1. Extraer nombre de la localidad
    let nombre = '';
    
    // Buscar si hay una tabla con celda "Localidad" dentro de la tarjeta (prioridad)
    const tdLabel = card.find('td').filter((_, tdEl) => $(tdEl).text().toLowerCase().includes('localidad'));
    if (tdLabel.length > 0) {
      nombre = tdLabel.next('td').text().trim();
    }
    
    // Fallbacks si no se encuentra en la tabla
    if (!nombre) {
      nombre = card.find('.card-title, h4, h5, h6, strong, .title').first().text().trim();
    }
    
    if (!nombre) {
      // Intentamos extraer el primer párrafo o texto directo antes de los botones
      const cardClone = card.clone();
      cardClone.find('a, button, script, style, input, form').remove();
      nombre = cardClone.text().replace(/\s+/g, ' ').trim();
    }

    // 2. Extraer todos los links de la tarjeta
    const allLinks: { label: string; url: string }[] = [];
    let primaryHref = '';
    const links = card.find('a[href]');
    
    links.each((_, linkEl) => {
      const link = $(linkEl);
      const urlText = link.attr('href') || '';
      const label = link.text().replace(/\s+/g, ' ').trim() || 'Ver';
      
      if (urlText) {
        // Asegurar que no esté duplicado
        if (!allLinks.some(l => l.url === urlText)) {
          allLinks.push({ label, url: urlText });
        }
        
        // Priorizar como enlace principal uno que parezca de configuración
        const lowerLabel = label.toLowerCase();
        const lowerUrl = urlText.toLowerCase();
        if (!primaryHref && (
          lowerLabel.includes('config') || 
          lowerLabel.includes('edit') || 
          lowerLabel.includes('setup') ||
          lowerUrl.includes('config') ||
          lowerUrl.includes('edit') ||
          lowerUrl.includes('setup')
        )) {
          primaryHref = urlText;
        }
      }
    });

    // Si no se asignó enlace principal, tomar el primero
    if (!primaryHref && allLinks.length > 0) {
      primaryHref = allLinks[0].url;
    }

    // Limpiar el nombre de textos irrelevantes
    if (nombre) {
      nombre = nombre
        .replace(/\r?\n|\r/g, ' ') // Eliminar saltos de línea
        .replace(/\s+/g, ' ')      // Reducir espacios múltiples
        .trim();
    }

    if (nombre && primaryHref) {
      // Extraer ID de la sección (preferir path parameter, de lo contrario query param)
      let id: string | undefined;
      const pathIdMatch = primaryHref.match(/\/sections\/([^\/]+)/);
      const queryIdMatch = primaryHref.match(/(?:id|sectionid|sectionId|secId)=([^&]+)/i);
      
      if (pathIdMatch && pathIdMatch[1] !== 'settings.aspx' && pathIdMatch[1] !== 'list.aspx') {
        id = pathIdMatch[1];
      } else if (queryIdMatch) {
        id = queryIdMatch[1];
      }

      const derivedLinks = generateLocalityLinks(primaryHref);

      localidades.push({
        nombre,
        url: primaryHref,
        id,
        links: derivedLinks,
      });
    }
  });

  // Fallback 3: Si todo lo anterior falla pero hay una tabla de secciones/localidades
  if (localidades.length === 0) {
    $('table tr').each((_, trEl) => {
      const cells = $(trEl).find('td');
      if (cells.length >= 2) {
        const nombreText = cells.first().text().trim();
        const hrefText = cells.find('a[href]').first().attr('href') || '';
        if (nombreText && hrefText) {
          localitiesFallback(nombreText, hrefText, localidades);
        }
      }
    });
  }

  return localidades;
}

function localitiesFallback(nombre: string, href: string, list: Localidad[]) {
  let id: string | undefined;
  const pathIdMatch = href.match(/\/sections\/([^\/]+)/);
  const queryIdMatch = href.match(/(?:id|sectionid|sectionId|secId)=([^&]+)/i);
  
  if (pathIdMatch && pathIdMatch[1] !== 'settings.aspx' && pathIdMatch[1] !== 'list.aspx') {
    id = pathIdMatch[1];
  } else if (queryIdMatch) {
    id = queryIdMatch[1];
  }

  const derivedLinks = generateLocalityLinks(href);

  list.push({
    nombre,
    url: href,
    id,
    links: derivedLinks,
  });
}

/**
 * Genera automáticamente los 3 enlaces requeridos para cada localidad:
 * 1. Configuración de localidad: .../sections/{ID}/settings.aspx
 * 2. Precios: .../sections/{ID}/prices/sales.aspx
 * 3. Acomodación: .../sections/{ID}/seats.aspx
 */
function generateLocalityLinks(primaryUrl: string): { label: string; url: string }[] {
  // Intentar extraer el segmento base que llega hasta /sections/{SECTION_ID}
  const pathMatch = primaryUrl.match(/^(.*\/sections\/[^\/]+)/);
  if (pathMatch) {
    const base = pathMatch[1];
    // Evitar duplicar si la URL base termina en settings.aspx u otros nombres de archivo
    if (!base.endsWith('/settings.aspx') && !base.endsWith('/list.aspx')) {
      return [
        { label: 'Configuración', url: `${base}/settings.aspx` },
        { label: 'Precios', url: `${base}/prices/sales.aspx` },
        { label: 'Acomodación', url: `${base}/seats.aspx` },
      ];
    }
  }

  // Fallback para query parameters si QRBoletos los usara en algún reporte (ej. sectionId=123)
  const idMatch = primaryUrl.match(/(?:id|sectionid|sectionId|secId)=([^&]+)/i);
  if (idMatch) {
    const id = idMatch[1];
    const baseMatch = primaryUrl.match(/^(.*)\/sections\//i);
    if (baseMatch) {
      const base = baseMatch[1];
      return [
        { label: 'Configuración', url: `${base}/sections/settings.aspx?id=${id}` },
        { label: 'Precios', url: `${base}/sections/prices/sales.aspx?id=${id}` },
        { label: 'Acomodación', url: `${base}/sections/seats.aspx?id=${id}` },
      ];
    }
  }

  // Si no se pudo parsear el ID, devolver el enlace original como "Configuración"
  return [{ label: 'Configuración', url: primaryUrl }];
}
