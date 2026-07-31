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
    // Buscamos títulos de tarjeta, encabezados, o texto destacado
    let nombre = card.find('.card-title, h4, h5, h6, strong, .title').first().text().trim();
    
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
      // Extraer ID si está en el href (ej. sectionId=123 o similar)
      let id: string | undefined;
      const idMatch = primaryHref.match(/(?:id|sectionid|sectionId|secId)=([^&]+)/i);
      if (idMatch) {
        id = idMatch[1];
      }

      localidades.push({
        nombre,
        url: primaryHref,
        id,
        links: allLinks,
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
  const idMatch = href.match(/(?:id|sectionid|sectionId|secId)=([^&]+)/i);
  if (idMatch) {
    id = idMatch[1];
  }
  list.push({
    nombre,
    url: href,
    id,
  });
}
