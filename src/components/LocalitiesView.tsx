'use client';

import React, { useState, useEffect } from 'react';
import { Evento, Localidad } from '@/types';
import {
  ArrowLeft,
  Search,
  Globe,
  Clipboard,
  Cpu,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  ExternalLink,
  Settings,
  DollarSign,
  Armchair,
  Database,
  CloudUpload
} from 'lucide-react';

interface LocalitiesViewProps {
  evento: Evento;
  onBack: () => void;
  onSaveLocalities: (rowId: string, localidades: Localidad[]) => Promise<void>;
}

export default function LocalitiesView({ evento, onBack, onSaveLocalities }: LocalitiesViewProps) {
  const [activeTab, setActiveTab] = useState<'auto' | 'manual'>('auto');
  const [cookie, setCookie] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [localidades, setLocalidades] = useState<Localidad[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  // Cargar cookie guardada en localStorage
  useEffect(() => {
    const savedCookie = localStorage.getItem('qrboletos_session_cookie');
    if (savedCookie) {
      setCookie(savedCookie);
    }
  }, []);

  // Cargar localidades si ya existen en la base de datos para este evento
  useEffect(() => {
    if (evento.localidades && evento.localidades.length > 0) {
      setLocalidades(evento.localidades);
      setSuccess(`Cargadas ${evento.localidades.length} localidades de la base de datos.`);
    } else {
      setLocalidades([]);
      setSuccess(null);
    }
    setError(null);
  }, [evento]);

  // Guardar cookie en localStorage
  const handleSaveCookie = (val: string) => {
    setCookie(val);
    localStorage.setItem('qrboletos_session_cookie', val);
  };

  // Convertir URL relativa a absoluta
  const makeAbsoluteUrl = (url: string): string => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${domain}${cleanUrl}`;
  };

  // Guardar localidades extraídas en Google Sheets o Local Storage
  const saveExtractedLocalities = async (extracted: Localidad[]) => {
    if (!evento.id) return;
    setIsSaving(true);
    try {
      await onSaveLocalities(evento.id, extracted);
      setSuccess(`¡Se guardaron ${extracted.length} localidades en la base de datos!`);
    } catch (err: any) {
      setError(`Se extrajeron las localidades pero falló el autoguardado: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Petición al endpoint backend de extracción
  const handleExtract = async (payload: { url?: string; cookie?: string; htmlContent?: string }) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/extract-localidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ocurrió un error al extraer las localidades.');
      }

      setLocalidades(data.localidades);
      
      if (payload.htmlContent) {
        setHtmlContent(''); // Limpiar textarea si es manual
      }

      // Autoguardar en la base de datos
      await saveExtractedLocalities(data.localidades);

    } catch (err: any) {
      setError(err.message || 'Error al procesar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoExtract = () => {
    handleExtract({
      url: localitiesUrl,
      cookie: cookie.trim() || undefined,
    });
  };

  const handleManualExtract = () => {
    if (!htmlContent.trim()) {
      setError('Por favor, pega el código HTML primero.');
      return;
    }
    handleExtract({
      htmlContent: htmlContent.trim(),
    });
  };

  // Filtrar localidades por búsqueda
  const filteredLocalidades = localidades.filter((loc) =>
    loc.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
      {/* Botón de retroceso e información del evento */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-all hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              {evento.nombre}
              {evento.localidades && evento.localidades.length > 0 && (
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  Persistido ({evento.localidades.length})
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{localitiesUrl}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-950 px-3 py-1.5 rounded-full border border-slate-800 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            {domain.replace('https://', '')}
          </span>
        </div>
      </div>

      {/* Tabs selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl w-full md:max-w-md border border-slate-800/80">
          <button
            onClick={() => setActiveTab('auto')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'auto'
                ? 'bg-slate-900 text-emerald-400 shadow-md border border-slate-800/50'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Extracción Automática
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-slate-900 text-emerald-400 shadow-md border border-slate-800/50'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Clipboard className="w-4 h-4" />
            Pegado Manual de HTML
          </button>
        </div>

        {/* Indicador de Autoguardado */}
        {localidades.length > 0 && (
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <CloudUpload className="w-4.5 h-4.5 text-emerald-500" />
            <span>Los cambios se guardan automáticamente en tu base de datos al extraer.</span>
          </div>
        )}
      </div>

      {/* Formulario de extracción según tab activa */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-5 mb-6">
        {activeTab === 'auto' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                Cookie de Sesión (Recomendada para saltar Login)
              </label>
              <input
                type="text"
                className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono placeholder:text-slate-600"
                placeholder="Ej: ASP.NET_SessionId=xxxxxxx;..."
                value={cookie}
                onChange={(e) => handleSaveCookie(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-2 flex items-start gap-1.5">
                <HelpCircle className="w-4 h-4 shrink-0 text-slate-600 mt-0.5" />
                <span>
                  <strong>¿Cómo obtenerla?</strong> Inicia sesión en <code>dashboard.qrboletos.com</code>, presiona F12 en tu navegador, ve a <strong>Aplicación &gt; Cookies</strong>, copia el valor de <code>ASP.NET_SessionId</code> y pégalo aquí. La app la recordará de forma segura en tu navegador.
                </span>
              </p>
            </div>

            <button
              onClick={handleAutoExtract}
              disabled={isLoading || isSaving}
              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-md hover:shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                  Extrayendo Localidades...
                </>
              ) : isSaving ? (
                <>
                  <RefreshCw className="w-4.5 h-4.5 animate-spin text-emerald-300" />
                  Guardando en base de datos...
                </>
              ) : (
                <>
                  <Cpu className="w-4.5 h-4.5" />
                  {localidades.length > 0 ? 'Actualizar Localidades Automáticamente' : 'Obtener Localidades Automáticamente'}
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">
                Código HTML de la Página de Localidades
              </label>
              <textarea
                className="w-full h-36 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all font-mono placeholder:text-slate-600"
                placeholder="Haz clic derecho -> Inspeccionar en el contenedor de localidades, o pulsa Ctrl+U, copia el código HTML completo de la página de secciones de QRBoletos y pégalo aquí..."
                value={htmlContent}
                onChange={(e) => setHtmlContent(e.target.value)}
              />
            </div>

            <button
              onClick={handleManualExtract}
              disabled={isLoading || isSaving || !htmlContent.trim()}
              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-md hover:shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                  Procesando HTML...
                </>
              ) : isSaving ? (
                <>
                  <RefreshCw className="w-4.5 h-4.5 animate-spin text-emerald-300" />
                  Guardando en base de datos...
                </>
              ) : (
                <>
                  <Clipboard className="w-4.5 h-4.5" />
                  {localidades.length > 0 ? 'Actualizar Código HTML' : 'Procesar Código HTML'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Feedback visual de carga, éxito y error */}
        {error && (
          <div className="mt-4 bg-red-500/5 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Error de Extracción</span>
              <p className="text-xs text-red-300/90">{error}</p>
              {activeTab === 'auto' && (
                <button
                  onClick={() => setActiveTab('manual')}
                  className="text-xs text-emerald-400 hover:underline block mt-1"
                >
                  Intentar pegando el HTML manualmente &rarr;
                </button>
              )}
            </div>
          </div>
        )}

        {success && (
          <div className="mt-4 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{success}</span>
          </div>
        )}
      </div>

      {/* Resultados de las Localidades extraídas */}
      {localidades.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Armchair className="text-emerald-500 w-5 h-5" />
              Listado de Localidades ({filteredLocalidades.length})
            </h3>
            
            {/* Buscador de localidades */}
            <div className="relative w-full md:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar localidad..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                      className="bg-slate-900 border border-slate-800 hover:border-pink-500/40 text-slate-300 hover:text-pink-400 rounded-xl py-2 px-3 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
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
                        className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-slate-300 hover:text-amber-400 rounded-xl py-2 px-3 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
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
                        className="bg-slate-900 border border-slate-800 hover:border-blue-500/40 text-slate-300 hover:text-blue-400 rounded-xl py-2 px-3 text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
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
