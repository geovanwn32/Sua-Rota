import React, { useState, useEffect } from 'react';
import { Destination, RouteStatus, TimeWindow } from '../types';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  destination: Destination | null;
  onUpdateNotes: (id: string, notes: string) => void;
  onUpdateTimeWindow: (id: string, window: TimeWindow) => void;
  onComplete: (id: string, proof: { receiverName: string, photo: File | null }) => void;
  onDuplicate: (destination: Destination) => void;
}

const Modal: React.FC<ModalProps> = ({ 
    isOpen, onClose, title, destination, 
    onUpdateNotes, onUpdateTimeWindow, onComplete, onDuplicate 
}) => {
  const [showProofFlow, setShowProofFlow] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  
  // Local state for time windows inputs
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timeWindowError, setTimeWindowError] = useState<string | null>(null);

  useEffect(() => {
    if (destination) {
        setStartTime(destination.timeWindow?.start || '');
        setEndTime(destination.timeWindow?.end || '');
        setShowProofFlow(false);
        setReceiverName('');
        setPhoto(null);
        setTimeWindowError(null);
    }
  }, [destination, isOpen]);

  if (!isOpen || !destination) return null;

  const handleSaveTimeWindow = () => {
    setTimeWindowError(null); // Resetar erro anterior

    if (startTime && endTime) {
        // Validação: Hora final deve ser maior que a inicial
        if (startTime >= endTime) {
            setTimeWindowError("O horário final deve ser posterior ao inicial.");
            return;
        }
        onUpdateTimeWindow(destination.id, { start: startTime, end: endTime });
    } else if ((startTime && !endTime) || (!startTime && endTime)) {
        // Opcional: Avisar se apenas um campo foi preenchido
        // Por enquanto, só salva se ambos estiverem ok ou ambos vazios (implícito na UI)
    }
  };

  const handleFinishDelivery = () => {
    if (!receiverName.trim()) {
        alert("Por favor, informe o nome de quem recebeu.");
        return;
    }
    onComplete(destination.id, { receiverName, photo });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors rounded-full p-1 hover:bg-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
            
            {/* Address Info */}
            {!showProofFlow && (
                <>
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                             <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                                destination.status === RouteStatus.COMPLETED 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                                {destination.status === RouteStatus.COMPLETED ? 'Concluído' : 'Pendente'}
                            </span>
                            {destination.vehicleId && (
                                <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded font-semibold border border-purple-200">
                                    {destination.vehicleId}
                                </span>
                            )}
                        </div>
                        <p className="text-xl text-slate-900 font-bold leading-tight">{destination.address.logradouro}</p>
                        <p className="text-slate-600 mt-1">{destination.address.bairro}, {destination.address.localidade} - {destination.address.uf}</p>
                        <p className="text-slate-500 font-mono text-xs mt-1 bg-slate-100 inline-block px-2 py-0.5 rounded">CEP: {destination.cep}</p>
                    </div>

                    {/* Time Window Inputs */}
                    <div className={`p-3 rounded-lg border transition-colors ${timeWindowError ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                        <label className={`block text-xs font-bold mb-2 uppercase ${timeWindowError ? 'text-red-500' : 'text-slate-500'}`}>Janela de Entrega (Horário)</label>
                        <div className="flex gap-2">
                            <input 
                                type="time" 
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                onBlur={handleSaveTimeWindow}
                                className={`flex-1 p-2 border rounded-md text-sm outline-none focus:ring-2 ${timeWindowError ? 'border-red-300 focus:ring-red-200 text-red-700' : 'border-slate-300 focus:ring-blue-500'}`}
                            />
                            <span className="self-center text-slate-400">-</span>
                            <input 
                                type="time" 
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                onBlur={handleSaveTimeWindow}
                                className={`flex-1 p-2 border rounded-md text-sm outline-none focus:ring-2 ${timeWindowError ? 'border-red-300 focus:ring-red-200 text-red-700' : 'border-slate-300 focus:ring-blue-500'}`}
                            />
                        </div>
                        {timeWindowError && (
                            <div className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1 animate-in slide-in-from-top-1">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {timeWindowError}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Notas / Observações</label>
                        <textarea
                            value={destination.notes || ''}
                            onChange={(e) => onUpdateNotes(destination.id, e.target.value)}
                            className="w-full text-sm p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-white transition-colors"
                            rows={3}
                            placeholder="Instruções de entrega..."
                        />
                    </div>
                </>
            )}

            {/* Proof of Delivery Flow */}
            {showProofFlow && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 animate-in slide-in-from-right duration-300">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Comprovante de Entrega
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Nome do Recebedor *</label>
                            <input 
                                type="text"
                                value={receiverName}
                                onChange={(e) => setReceiverName(e.target.value)}
                                className="w-full p-2 border border-slate-300 rounded-lg"
                                placeholder="Quem recebeu?"
                                autoFocus
                            />
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Foto do Pacote (Opcional)</label>
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-slate-50">
                                {photo ? (
                                    <div className="relative w-full h-full">
                                        <img src={URL.createObjectURL(photo)} className="w-full h-full object-cover rounded-lg opacity-80" alt="Preview" />
                                        <span className="absolute inset-0 flex items-center justify-center text-white font-bold bg-black/30 rounded-lg">Alterar</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                        <p className="text-xs text-slate-500">Toque para capturar</p>
                                    </div>
                                )}
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files && setPhoto(e.target.files[0])} />
                            </label>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <button 
                                onClick={() => setShowProofFlow(false)}
                                className="flex-1 py-2 text-slate-600 border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-100"
                            >
                                Voltar
                            </button>
                            <button 
                                onClick={handleFinishDelivery}
                                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 shadow-md"
                            >
                                Confirmar Entrega
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Footer Actions */}
        {!showProofFlow && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
                 <div className="flex gap-3">
                    <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${destination.address.logradouro}, ${destination.address.localidade}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-white border border-slate-300 text-slate-700 py-2.5 rounded-lg font-bold text-center hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Navegar
                    </a>
                    
                    {/* Botão solicitado: Adicionar/Duplicar Rota */}
                    <button
                        onClick={() => {
                            onDuplicate(destination);
                            onClose();
                        }}
                        className="flex-1 bg-blue-50 border border-blue-200 text-blue-700 py-2.5 rounded-lg font-bold hover:bg-blue-100 transition-colors flex items-center justify-center gap-2 text-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Duplicar Parada
                    </button>
                 </div>

                {destination.status !== RouteStatus.COMPLETED ? (
                    <button
                        onClick={() => setShowProofFlow(true)}
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-100 flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Finalizar Entrega
                    </button>
                ) : (
                    <div className="w-full bg-slate-100 text-slate-500 py-2 rounded-lg text-center text-sm font-medium border border-slate-200">
                        Entrega Concluída às {destination.proofOfDelivery?.timestamp ? new Date(destination.proofOfDelivery.timestamp).toLocaleTimeString() : '--:--'}
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default Modal;