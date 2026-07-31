'use client';

import React from 'react';
import { Evento } from '@/types';
import { buildModuleUrl } from '@/services/urlParser';
import {
  TrendingUp,
  BarChart2,
  Layers,
  Calendar,
  MapPin,
  Settings,
  FileText,
  Trash2,
  Star,
  ExternalLink,
  Eye,
  Activity
} from 'lucide-react';

interface EventCardProps {
  evento: Evento;
  onToggleFavorite: (id: string, currentStatus: boolean) => void;
  onDeleteEvent: (id: string) => void;
  onOpenLocalities: (evento: Evento) => void;
}

// Configuración de los módulos rápidos
const MODULES = [
  {
    name: 'Resumen Ventas',
    path: 'reports/sales/summary.aspx',
    icon: TrendingUp,
    color: 'hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/30',
  },
  {
    name: 'Ventas por Localidad',
    path: 'reports/sales/bysection.aspx',
    icon: BarChart2,
    color: 'hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/30',
  },
  {
    name: 'Ventas por Etapa',
    path: 'reports/sales/byphase.aspx',
    icon: Layers,
    color: 'hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30',
  },
  {
    name: 'Etapas',
    path: 'phases/list.aspx',
    icon: Calendar,
    color: 'hover:bg-teal-500/10 hover:text-teal-400 hover:border-teal-500/30',
  },
  {
    name: 'Configuración Evento',
    path: 'setup.aspx',
    icon: Settings,
    color: 'hover:bg-pink-500/10 hover:text-pink-400 hover:border-pink-500/30',
  },
  {
    name: 'Informes',
    path: 'reports/',
    icon: FileText,
    color: 'hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/30',
  },
];

export default function EventCard({
  evento,
  onToggleFavorite,
  onDeleteEvent,
  onOpenLocalities,
}: EventCardProps) {
  // Extraer el dominio de la URL base
  let domain = 'https://dashboard.qrboletos.com';
  try {
    if (evento.urlBase) {
      const url = new URL(evento.urlBase);
      domain = url.origin;
    }
  } catch (e) {
    console.error('Error parseando urlBase:', e);
  }

  const handleFavoriteClick = () => {
    if (evento.id) {
      onToggleFavorite(evento.id, evento.favorito);
    }
  };

  const handleDeleteClick = () => {
    if (evento.id && confirm(`¿Estás seguro de que deseas eliminar "${evento.nombre}"?`)) {
      onDeleteEvent(evento.id);
    }
  };

  const handleOpenLocalities = () => {
    if (!evento.localidades || evento.localidades.length === 0) {
      const url = buildModuleUrl(domain, evento.promoterId, evento.eventId, evento.showId, 'sections/list.aspx');
      window.open(url, '_blank');
    }
    onOpenLocalities(evento);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg hover:shadow-xl hover:border-slate-700/80 transition-all group flex flex-col justify-between">
      {/* Cabecera de la Tarjeta */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
              {evento.fecha || 'Sin Fecha'}
            </span>
            <h3 className="text-base font-bold text-slate-100 mt-1.5 group-hover:text-emerald-400 transition-colors line-clamp-1">
              {evento.nombre}
            </h3>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleFavoriteClick}
              className={`p-1.5 rounded-lg border transition-all ${
                evento.favorito
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  : 'text-slate-500 border-slate-800 hover:text-amber-500 hover:bg-amber-500/5 hover:border-amber-500/20'
              }`}
              title={evento.favorito ? 'Quitar de favoritos' : 'Marcar como favorito'}
            >
              <Star className="w-4 h-4" fill={evento.favorito ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={handleDeleteClick}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/20 transition-all"
              title="Eliminar evento"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Detalles de Identificadores */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950/60 rounded-xl p-2.5 mb-4 border border-slate-950 text-[11px] font-mono text-slate-400">
          <div>
            <span className="block text-[9px] text-slate-600 font-sans uppercase font-medium">Promoter</span>
            <span className="font-bold text-slate-300 block truncate" title={evento.promoterId}>
              {evento.promoterId.length > 10 ? `${evento.promoterId.substring(0, 8)}...` : evento.promoterId}
            </span>
          </div>
          <div>
            <span className="block text-[9px] text-slate-600 font-sans uppercase font-medium">Event</span>
            <span className="font-bold text-slate-300 block truncate" title={evento.eventId}>
              {evento.eventId.length > 10 ? `${evento.eventId.substring(0, 8)}...` : evento.eventId}
            </span>
          </div>
          <div>
            <span className="block text-[9px] text-slate-600 font-sans uppercase font-medium">Show</span>
            <span className="font-bold text-slate-300 block truncate" title={evento.showId}>
              {evento.showId.length > 10 ? `${evento.showId.substring(0, 8)}...` : evento.showId}
            </span>
          </div>
        </div>

        {/* Módulo de Localidades (Destacado y requerido con comportamiento especial de scraping) */}
        <div className="mb-4">
          <div className="flex gap-2">
            {/* Abrir Localidades dentro del panel (Nuestra app) */}
            <button
              onClick={handleOpenLocalities}
              className="flex-1 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 hover:border-emerald-500 rounded-xl py-2.5 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              Ver Localidades (Panel)
            </button>

            {/* Abrir Localidades directamente en QRBoletos */}
            <a
              href={buildModuleUrl(domain, evento.promoterId, evento.eventId, evento.showId, 'sections/list.aspx')}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl p-2.5 flex items-center justify-center transition-all cursor-pointer"
              title="Abrir configuración de localidades externa"
            >
              <ExternalLink className="w-4.5 h-4.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Grid de Accesos Rápidos */}
      <div>
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Enlaces de QRBoletos
        </div>
        <div className="grid grid-cols-2 gap-2">
          {MODULES.map((mod) => {
            const url = buildModuleUrl(domain, evento.promoterId, evento.eventId, evento.showId, mod.path);
            const Icon = mod.icon;

            return (
              <a
                key={mod.name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 bg-slate-950 border border-slate-950/60 rounded-xl p-2.5 text-xs font-medium text-slate-300 transition-all ${mod.color} cursor-pointer`}
              >
                <Icon className="w-4.5 h-4.5 shrink-0 text-slate-500 group-hover:text-inherit" />
                <span className="truncate">{mod.name}</span>
              </a>
            );
          })}
        </div>

        {/* Fecha de Creación en la esquina inferior */}
        <div className="text-[9px] text-slate-600 text-right mt-3 font-mono">
          Añadido el {evento.fechaCreacion}
        </div>
      </div>
    </div>
  );
}
