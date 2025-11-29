import React from 'react';
import { Destination, RouteStatus } from '../types';
import { formatDistance, formatDuration } from '../services/routingService';

interface AddressCardProps {
  destination: Destination;
  index: number;
  onRemove: (id: string) => void;
  onClick: () => void;
}

const AddressCard: React.FC<AddressCardProps> = ({ destination, index, onRemove, onClick }) => {
  const isCompleted = destination.status === RouteStatus.COMPLETED;

  return (
    <div className="flex flex-col relative">
        {/* Connection Line with Time/Distance */}
        {destination.travelDuration !== undefined && (
            <div className="pl-8 pb-2 flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                 <div className="w-0.5 h-3 bg-slate-300"></div>
                 <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                    </svg>
                    {formatDuration(destination.travelDuration)}
                 </span>
                 <span>•</span>
                 <span>{formatDistance(destination.travelDistance)}</span>
            </div>
        )}

        <div 
            className={`group flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 
            ${isCompleted 
                ? 'bg-slate-50 border-slate-200 opacity-75' 
                : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md cursor-pointer'}`}
            onClick={onClick}
        >
        <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm shadow-sm
            ${isCompleted ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
            {isCompleted ? '✓' : index + 1}
        </div>
        
        <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
                <h3 className={`font-medium truncate ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                    {destination.address.logradouro}
                </h3>
            </div>
            
            <p className="text-sm text-slate-500 truncate">
                {destination.address.bairro}, {destination.address.localidade}
            </p>

            {/* Badges e Informações Extras */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
                
                {/* Badge de Veículo */}
                {destination.vehicleId && (
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                        {destination.vehicleId}
                    </span>
                )}

                {/* Badge de Janela de Tempo */}
                {destination.timeWindow && (
                    <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-slate-400">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                        </svg>
                        {destination.timeWindow.start} - {destination.timeWindow.end}
                    </span>
                )}
                
                {/* Notas */}
                {destination.notes && destination.notes.trim() !== '' && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 max-w-full">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                        </svg>
                        <span className="truncate max-w-[100px]">{destination.notes}</span>
                    </div>
                )}
            </div>
        </div>

        <button 
            onClick={(e) => {
                e.stopPropagation();
                onRemove(destination.id);
            }}
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all p-2 absolute right-2 top-2"
            title="Remover destino"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
        </button>
        </div>
    </div>
  );
};

export default AddressCard;