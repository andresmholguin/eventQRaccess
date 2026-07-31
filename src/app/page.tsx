'use client';

import React, { useState, useEffect } from 'react';
import AddEventForm from '@/components/AddEventForm';
import EventCard from '@/components/EventCard';
import LocalitiesView from '@/components/LocalitiesView';
import { Evento, Localidad } from '@/types';
import {
  Layers,
  Database,
  Search,
  Star,
  LayoutGrid,
  Info,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Plus,
  X
} from 'lucide-react';

export default function Home() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [isSheetsMode, setIsSheetsMode] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Cargar eventos iniciales al cargar la página
  useEffect(() => {
    fetchEventos();
  }, []);

  const fetchEventos = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/events');
      const data = await res.json();

      if (data.success) {
        setIsSheetsMode(data.isSheets);
        
        if (data.isSheets) {
          // Filtrar elementos vacíos (en caso de filas borradas/limpias)
          const validEvents = data.events.filter((e: Evento) => e.promoterId && e.eventId);
          setEventos(validEvents);
        } else {
          // Fallback a Local Storage
          const localData = localStorage.getItem('qrboletos_local_events');
          if (localData) {
            setEventos(JSON.parse(localData));
          } else {
            // Datos demo si está vacío en LocalStorage para no dejar el panel en blanco al primer inicio
            const demoEvents: Evento[] = [
              {
                id: 'local-demo-1',
                nombre: 'Evento Demo - Rock Fest',
                fecha: '12 Dic 2026',
                promoterId: 'rockprom',
                eventId: 'rockfest2026',
                showId: 'principal',
                urlBase: 'https://dashboard.qrboletos.com/promoters/rockprom/events/rockfest2026/shows/principal',
                fechaCreacion: new Date().toISOString().split('T')[0],
                favorito: true
              }
            ];
            localStorage.setItem('qrboletos_local_events', JSON.stringify(demoEvents));
            setEventos(demoEvents);
          }
        }
      } else {
        throw new Error(data.error || 'Error al obtener eventos.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('No se pudo establecer conexión con el backend de base de datos. Se usará Local Storage temporalmente.');
      setIsSheetsMode(false);
      // Cargar local storage
      const localData = localStorage.getItem('qrboletos_local_events');
      if (localData) {
        setEventos(JSON.parse(localData));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Agregar evento
  const handleAddEvent = async (nuevo: Omit<Evento, 'id' | 'fechaCreacion'>) => {
    if (isSheetsMode) {
      // Guardar en Google Sheets vía API
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nuevo),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar en Google Sheets.');
      }
      // Volver a consultar la hoja de cálculo
      await fetchEventos();
    } else {
      // Guardar localmente
      const nuevoEvento: Evento = {
        ...nuevo,
        id: `local-${Date.now()}`,
        fechaCreacion: new Date().toISOString().split('T')[0],
      };
      const actualizados = [nuevoEvento, ...eventos];
      setEventos(actualizados);
      localStorage.setItem('qrboletos_local_events', JSON.stringify(actualizados));
    }
  };

  // Alternar favorito
  const handleToggleFavorite = async (id: string, currentStatus: boolean) => {
    const nuevoEstado = !currentStatus;

    if (isSheetsMode) {
      // Modificar en Google Sheets
      const res = await fetch('/api/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, favorito: nuevoEstado }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert('Error al actualizar favorito en Google Sheets.');
        return;
      }
      // Actualizar estado local
      setEventos(
        eventos.map((e) => (e.id === id ? { ...e, favorito: nuevoEstado } : e))
      );
    } else {
      // Modificar localmente
      const actualizados = eventos.map((e) =>
        e.id === id ? { ...e, favorito: nuevoEstado } : e
      );
      setEventos(actualizados);
      localStorage.setItem('qrboletos_local_events', JSON.stringify(actualizados));
    }
  };

  // Eliminar evento
  const handleDeleteEvent = async (id: string) => {
    if (isSheetsMode) {
      // Eliminar de Google Sheets
      const res = await fetch(`/api/events?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert('Error al eliminar evento en Google Sheets.');
        return;
      }
      // Actualizar estado local
      setEventos(eventos.filter((e) => e.id !== id));
    } else {
      // Eliminar localmente
      const actualizados = eventos.filter((e) => e.id !== id);
      setEventos(actualizados);
      localStorage.setItem('qrboletos_local_events', JSON.stringify(actualizados));
    }
  };

  // Guardar/Actualizar localidades de un evento
  const handleSaveLocalities = async (id: string, localidades: Localidad[]) => {
    if (isSheetsMode) {
      const res = await fetch('/api/events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, localidades }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al guardar localidades en Google Sheets.');
      }
    }

    // Actualizar estado local (para ambos modos)
    const actualizados = eventos.map((e) =>
      e.id === id ? { ...e, localidades } : e
    );
    setEventos(actualizados);

    if (!isSheetsMode) {
      localStorage.setItem('qrboletos_local_events', JSON.stringify(actualizados));
    }

    // Sincronizar el evento seleccionado para reflejar que está guardado
    if (selectedEvento && selectedEvento.id === id) {
      setSelectedEvento({ ...selectedEvento, localidades });
    }
  };

  // Filtros de búsqueda
  const filteredEvents = eventos.filter((e) =>
    e.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.promoterId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.eventId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const favoritos = filteredEvents.filter((e) => e.favorito);
  const regulares = filteredEvents.filter((e) => !e.favorito);

  return (
    <main className="min-h-screen bg-[#030712] text-slate-100 font-sans selection:bg-emerald-500/20">
      {/* Navbar Superior */}
      <nav className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-500 p-2 rounded-xl text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wide text-slate-100 uppercase block">
                QRBoletos
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wider -mt-1 block">
                Dashboard Helper
              </span>
            </div>
          </div>

          {/* Estado de Persistencia */}
          <div className="flex items-center gap-2">
            {isSheetsMode === null ? (
              <span className="w-2.5 h-2.5 bg-slate-700 animate-pulse rounded-full"></span>
            ) : isSheetsMode ? (
              <div className="bg-emerald-500/5 text-emerald-400 border border-emerald-500/20 rounded-full px-3.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 shadow-md">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Google Sheets</span>
              </div>
            ) : (
              <div
                className="bg-amber-500/5 text-amber-400 border border-amber-500/20 rounded-full px-3.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 shadow-md"
                title="Las variables de entorno de Google Sheets no están configuradas en .env.local"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                <span>Almacenamiento Local (Fallback)</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Contenido Principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedEvento ? (
          // Vista detallada de Localidades (Scraper)
          <LocalitiesView
            evento={selectedEvento}
            onBack={() => setSelectedEvento(null)}
            onSaveLocalities={handleSaveLocalities}
          />
        ) : (
          // Dashboard principal
          <div className="space-y-8">
            {/* Cabecera / Bienvenida */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
              <div className="relative z-10 space-y-2">
                <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-50 to-slate-200">
                  Panel de Gestión QRBoletos
                </h1>
                <p className="text-slate-400 text-sm max-w-xl">
                  Accede rápidamente a resúmenes de ventas, etapas, localidades y configuraciones específicas de cualquier evento sin necesidad de navegar manualmente.
                </p>
              </div>

              {/* Botón a Google Sheets */}
              {isSheetsMode && (
                <a
                  href="https://docs.google.com/spreadsheets/d/1saVyrEYq8ITiSESR4Z13vJufjVvuKVmm9vjAsUFq3jg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative z-10 cursor-pointer bg-slate-900 border border-slate-800 hover:border-emerald-500/30 text-xs font-semibold px-4.5 py-3 rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 self-start md:self-auto shadow-md"
                >
                  <Database className="w-4.5 h-4.5 text-emerald-500" />
                  Abrir Google Sheet
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {errorMsg && (
              <div className="bg-amber-500/5 border border-amber-500/20 text-amber-400 p-4 rounded-2xl text-xs flex items-center gap-2">
                <Info className="w-5 h-5 shrink-0 text-amber-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Contenedor de la lista de eventos */}
            <div className="space-y-6">
              {/* Cabecera de la lista + Buscador y Botón */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                  <LayoutGrid className="w-5 h-5 text-emerald-500" />
                  Eventos Guardados ({eventos.length})
                </h2>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                  {/* Buscador */}
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4.5 h-4.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por nombre, promoter o evento..."
                      className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {/* Botón Nuevo Evento */}
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 px-4.5 rounded-xl transition-all shadow-md hover:shadow-emerald-500/10 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 w-full sm:w-auto shrink-0"
                  >
                    <Plus className="w-4.5 h-4.5" />
                    Nuevo Evento
                  </button>
                </div>
              </div>

              {isLoading ? (
                // Skeletal Loading
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-64 bg-slate-900/50 border border-slate-800 animate-pulse rounded-2xl"></div>
                  ))}
                </div>
              ) : eventos.length === 0 ? (
                // Estado Vacío
                <div className="bg-slate-900/30 border border-slate-900 rounded-3xl p-16 text-center max-w-xl mx-auto">
                  <div className="bg-slate-950 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-slate-600 border border-slate-900 mb-4 shadow-inner">
                    <LayoutGrid className="w-7 h-7" />
                  </div>
                  <h3 className="text-slate-300 font-semibold mb-1 text-sm">No hay eventos agregados</h3>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto mb-4">
                    Comienza agregando un evento haciendo clic en el botón "+ Nuevo Evento" de arriba.
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs py-2.5 px-5 rounded-xl transition-all shadow-md cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Evento
                  </button>
                </div>
              ) : (
                // Mostrar Listado
                <div className="space-y-8">
                  {/* Sección Favoritos */}
                  {favoritos.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5" fill="currentColor" />
                        Favoritos ({favoritos.length})
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {favoritos.map((evento) => (
                          <EventCard
                            key={evento.id}
                            evento={evento}
                            onToggleFavorite={handleToggleFavorite}
                            onDeleteEvent={handleDeleteEvent}
                            onOpenLocalities={setSelectedEvento}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Todos los Eventos */}
                  <div className="space-y-3">
                    {favoritos.length > 0 && (
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Todos los Eventos ({regulares.length})
                      </div>
                    )}
                    {regulares.length === 0 && favoritos.length > 0 ? (
                      <p className="text-slate-600 text-xs italic">No hay más eventos</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {regulares.map((evento) => (
                          <EventCard
                            key={evento.id}
                            evento={evento}
                            onToggleFavorite={handleToggleFavorite}
                            onDeleteEvent={handleDeleteEvent}
                            onOpenLocalities={setSelectedEvento}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal para Agregar Evento */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in transition-all">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header del Modal */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Plus className="text-emerald-500 w-4.5 h-4.5" />
                Agregar Nuevo Evento
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-white bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Contenido / Formulario */}
            <div className="p-6 overflow-y-auto">
              <AddEventForm
                onAddEvent={async (nuevo) => {
                  await handleAddEvent(nuevo);
                  setIsAddModalOpen(false); // Cerrar tras agregar
                }}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
