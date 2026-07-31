'use client';

import React, { useState, useEffect } from 'react';
import { Evento, Localidad } from '@/types';
import {
  ArrowLeft,
  Search,
  Globe,
  Clipboard,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Settings,
  DollarSign,
  Armchair,
  Database,
  HelpCircle,
  X
} from 'lucide-react';

interface LocalitiesViewProps {
  evento: Evento;
  onBack: () => void;
  onSaveLocalities: (rowId: string, localidades: Localidad[]) => Promise<void>;
}

export default function LocalitiesView({ evento, onBack, onSaveLocalities }: LocalitiesViewProps) {
  const [htmlContent, setHtmlContent] = useState('');
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPastePanel, setShowPastePanel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Obtener el dominio del evento
  let domain = 'https://dashboard.qrboletos.com';
  try {
    if (evento.urlBase) {
      const url = new URL(evento.urlBase);
      domain = url.origin;
    }
  } catch (e) {
    console.error('Error parseando el dominio:', e);
  }

  // URL del listado de localidades
  const localitiesUrl = `${evento.urlBase}/sections/list.aspx`;

  // Cargar localidades si ya existen en la base de datos
  useEffect(() => {
    if (evento.localidades && evento.localidades.length > 0) {
      setLocalidades(evento.localidades);
      setShowPastePanel(false);
      setSuccess(`Cargadas ${evento.localidades.length} localidades de la base de datos.`);
    } else {
      setLocalidades([]);
      setShowPastePanel(true);
      setSuccess(null);
    }
    setError(null);
  }, [evento]);

  // Convertir URL relativa a absoluta
  const makeAbsoluteUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${domain}${cleanUrl}`;
  };

  // Guardar localidades extraídas
  const saveExtractedLocalities = async (extracted: Localidad[]) => {
    if (!evento.id) return;
    setIsSaving(true);
    try {
      await onSaveLocalities(evento.id, extracted);
      setSuccess(`¡Se guardaron ${extracted.length} localidades en la base de datos!`);
      setShowPastePanel(false); // Ocultar panel de pegado tras guardar
    } catch (err: any) {
      setError(`Se procesaron las localidades pero falló el autoguardado: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Petición al endpoint backend de extracción por HTML pegado
  const handleManualExtract = async () => {
    if (!htmlContent.trim()) {
      setError('Por favor, pega el código HTML primero.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/extract-localidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ htmlContent: htmlContent.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ocurrió un error al extraer las localidades.');
      }

      setLocalidades(data.localidades);
      setHtmlContent(''); // Limpiar textarea

      // Guardar automáticamente en Sheets / Local Storage
      await saveExtractedLocalities(data.localidades);

    } catch (err: any) {
      setError(err.message || 'Error al procesar el código HTML.');
    } finally {
      setIsLoading(false);
    }
  };

  // Activa el panel de pegado y abre el enlace de secciones en otra pestaña
  const handleActivateUpdate = () => {
    window.open(localitiesUrl, '_blank');
    setShowPastePanel(true);
    setSuccess(null);
    setError(null);
  };

  // Filtrar localidades por búsqueda
  const filteredLocalidades = localidades.filter((loc) =>
    loc.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
      {/* Cabecera del panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-all hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2 flex-wrap">
              {evento.nombre}
              {localidades.length > 0 && !showPastePanel && (
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5 shadow-sm">
                  <Database className="w-3 h-3" />
                  Persistido ({localidades.length})
                </span>
              )}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón para actualizar localidades si ya existen en la base de datos */}
          {localidades.length > 0 && !showPastePanel && (
            <button
              onClick={handleActivateUpdate}
              className="bg-amber-600/10 hover:bg-amber-600 text-amber-400 hover:text-slate-950 border border-amber-500/20 hover:border-amber-500 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualizar Localidades
            </button>
          )}

          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-950 px-3 py-2 rounded-full border border-slate-800 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            {domain.replace('https://', '')}
          </span>
        </div>
      </div>

      {/* Vista A: Panel de pegado manual (Si no hay localidades o se seleccionó Actualizar) */}
      {showPastePanel && (
        <div className="space-y-4">
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5">
            <div className="flex items-start gap-3 mb-4">
              <Clipboard className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-200">Código HTML de la Página de Localidades</h3>
                <p className="text-xs text-slate-400">
                  Pega el código fuente HTML de la página de secciones de QRBoletos.
                </p>
              </div>
            </div>

            <textarea
              className="w-full h-44 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono placeholder:text-slate-600"
              placeholder="Haz clic derecho -> Inspeccionar en el contenedor de localidades, o pulsa Ctrl+U, copia el código HTML completo de la página de secciones de QRBoletos y pégalo aquí..."
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleManualExtract}
                  disabled={isLoading || isSaving || !htmlContent.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-md hover:shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                      Procesando HTML...
                    </>
                  ) : isSaving ? (
                    <>
                      <RefreshCw className="w-4.5 h-4.5 animate-spin text-emerald-300" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Clipboard className="w-4.5 h-4.5" />
                      Procesar Código HTML
                    </>
                  )}
                </button>

                {/* Permitir cancelar y volver al listado si ya existen localidades guardadas */}
                {localidades.length > 0 && (
                  <button
                    onClick={() => {
                      setShowPastePanel(false);
                      setError(null);
                    }}
                    className="border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white font-semibold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                )}
              </div>

              {/* Enlace alternativo para abrir la URL manualmente */}
              <a
                href={localitiesUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1 font-medium transition-colors"
              >
                Abrir configuración de secciones en QRBoletos
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Ayuda de copiado */}
            <p className="text-[11px] text-slate-500 mt-4 flex items-start gap-1.5 border-t border-slate-900 pt-3">
              <HelpCircle className="w-4 h-4 shrink-0 text-slate-600 mt-0.5" />
              <span>
                <strong>¿Cómo copiar el código?</strong> En la pestaña de QRBoletos que se abrió, haz clic derecho en cualquier parte y selecciona <strong>&quot;Ver código fuente de la página&quot;</strong> (o presiona <code>Ctrl + U</code>). Copia todo el contenido (<code>Ctrl + A</code> y luego <code>Ctrl + C</code>) y pégalo en el cuadro de arriba.
              </span>
            </p>
          </div>

          {/* Feedback visual de errores */}
          {error && (
            <div className="bg-red-500/5 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">Error al Procesar HTML</span>
                <p className="text-xs text-red-300/90">{error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vista B: Listado de Localidades (Si hay localidades guardadas y no se está actualizando) */}
      {!showPastePanel && localidades.length > 0 && (
        <div className="space-y-4 mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Armchair className="text-emerald-500 w-5 h-5" />
              Localidades Encontradas ({filteredLocalidades.length})
            </h3>
            
            {/* Buscador de localidades */}
            <div className="relative w-full md:w-64">
              <Search className="w-4.5 h-4.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar localidad..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Listado de tarjetas de localidad - Altamente accesibles */}
          <div className="grid grid-cols-1 gap-3">
            {filteredLocalidades.map((loc, idx) => {
              // Obtener los links específicos
              const configLink = loc.links?.find(l => l.label === 'Configuración')?.url || loc.url;
              const pricesLink = loc.links?.find(l => l.label === 'Precios')?.url;
              const seatsLink = loc.links?.find(l => l.label === 'Acomodación')?.url;

              return (
                <div
                  key={idx}
                  className="bg-slate-950 border border-slate-800/80 rounded-xl p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700/60 transition-all group"
                >
                  {/* Nombre de la Localidad */}
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 group-hover:scale-110 transition-transform"></div>
                    <span className="font-extrabold text-sm text-slate-100 group-hover:text-emerald-400 transition-colors uppercase tracking-wide">
                      {loc.nombre}
                    </span>
                  </div>

                  {/* Botones de acción - Grandes y altamente accesibles */}
                  <div className="grid grid-cols-3 sm:flex items-center gap-2">
                    {/* Botón de Configuración */}
                    <a
                      href={makeAbsoluteUrl(configLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-slate-900 border border-slate-800 hover:border-pink-500/40 text-slate-300 hover:text-pink-400 rounded-xl py-2 px-3.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Configuración</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>

                    {/* Botón de Precios */}
                    {pricesLink && (
                      <a
                        href={makeAbsoluteUrl(pricesLink)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-400 rounded-xl py-2 px-3.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                        <span>Precios</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    )}

                    {/* Botón de Acomodación */}
                    {seatsLink && (
                      <a
                        href={makeAbsoluteUrl(seatsLink)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 text-slate-300 hover:text-blue-400 rounded-xl py-2 px-3.5 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
                      >
                        <Armchair className="w-3.5 h-3.5 text-blue-400" />
                        <span>Acomodación</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
