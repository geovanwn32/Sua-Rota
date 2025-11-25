import React, { useState, useEffect } from 'react';
import { fetchAddressByCep, fetchCoordinates, getCurrentPosition } from './services/geoService';
import { optimizeRoute } from './services/geminiService';
import { fetchRouteDetails, formatDistance, formatDuration } from './services/routingService';
import { Destination, RouteStatus, AddressData } from './types';
import RouteVisualizer from './components/RouteVisualizer';
import AddressCard from './components/AddressCard';
import Modal from './components/Modal';

const App: React.FC = () => {
  const [cepInput, setCepInput] = useState('');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);

  // Estados para métricas totais
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  // Localização Inicial
  useEffect(() => {
    getCurrentPosition()
      .then(pos => setCurrentLocation(pos))
      .catch(err => console.warn("Acesso à localização negado ou indisponível", err));
  }, []);

  // Recalcular totais sempre que os destinos mudarem
  useEffect(() => {
    const dist = destinations.reduce((acc, curr) => acc + (curr.travelDistance || 0), 0);
    const time = destinations.reduce((acc, curr) => acc + (curr.travelDuration || 0), 0);
    setTotalDistance(dist);
    setTotalTime(time);
  }, [destinations]);

  const handleAddCep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cepInput.length < 8) return;

    setLoading(true);
    const address = await fetchAddressByCep(cepInput);
    
    if (address) {
      // Buscar coordenadas para visualização no mapa
      const coords = await fetchCoordinates(address);
      
      // Se não achou coordenadas, usa 0,0 temporariamente ou avisa, mas o geoService robusto deve achar algo
      const addressWithCoords: AddressData = {
          ...address,
          lat: coords?.lat,
          lng: coords?.lng
      };

      const newDest: Destination = {
        id: crypto.randomUUID(),
        cep: address.cep,
        address: addressWithCoords,
        status: RouteStatus.PENDING,
        order: destinations.length,
        notes: '' 
      };

      // Adicionar à lista
      setDestinations(prev => [...prev, newDest]);
      
      // Popup imediato para validar localização visualmente
      setSelectedDestination(newDest);
      setCepInput('');
    } else {
      alert("CEP não encontrado.");
    }
    setLoading(false);
  };

  const handleOptimize = async () => {
    if (destinations.length === 0) return;
    setOptimizing(true);
    
    const pendingDestinations = destinations.filter(d => d.status !== RouteStatus.COMPLETED);
    const completedDestinations = destinations.filter(d => d.status === RouteStatus.COMPLETED);

    // 1. Otimizar Ordem via IA
    const result = await optimizeRoute(currentLocation, pendingDestinations);
    
    let reorderedPending = result.sortedIds
        .map(id => pendingDestinations.find(d => d.id === id))
        .filter((d): d is Destination => !!d);

    // 2. Calcular rotas reais e GEOMETRIA via OSRM
    if (currentLocation && reorderedPending.length > 0) {
        reorderedPending = await fetchRouteDetails(currentLocation, reorderedPending);
    }

    setDestinations([...completedDestinations, ...reorderedPending]);
    setAiReasoning(result.reasoning);
    setOptimizing(false);
  };

  const markAsCompleted = (id: string) => {
    setDestinations(prev => prev.map(d => 
        d.id === id ? { ...d, status: RouteStatus.COMPLETED } : d
    ));
    setSelectedDestination(null);
  };

  const removeDestination = (id: string) => {
    setDestinations(prev => prev.filter(d => d.id !== id));
    if (selectedDestination?.id === id) setSelectedDestination(null);
  };

  const handleUpdateNotes = (id: string, notes: string) => {
    setDestinations(prev => prev.map(d => 
        d.id === id ? { ...d, notes: notes } : d
    ));
    if (selectedDestination && selectedDestination.id === id) {
        setSelectedDestination({ ...selectedDestination, notes });
    }
  };

  // Funções da Barra de Ferramentas
  const handleClearAll = () => {
      if (destinations.length === 0) return;
      if (window.confirm("Tem certeza que deseja apagar todos os destinos?")) {
          setDestinations([]);
          setSelectedDestination(null);
          setAiReasoning(null);
      }
  };

  const handleInvertRoute = () => {
      const pending = destinations.filter(d => d.status !== RouteStatus.COMPLETED);
      const completed = destinations.filter(d => d.status === RouteStatus.COMPLETED);
      if (pending.length < 2) return;
      
      setDestinations([...completed, ...pending.reverse()]);
  };

  const handleCopyText = () => {
      if (destinations.length === 0) return;
      const lines = destinations.map((d, i) => `${i + 1}. ${d.address.logradouro}, ${d.address.localidade} (${d.cep})`);
      const text = `Rota Planejada:\n\n${lines.join('\n')}`;
      navigator.clipboard.writeText(text);
      alert("Lista copiada para a área de transferência!");
  };

  const handleShareRoute = () => {
    if (destinations.length === 0) return;

    let message = `🚚 *Rota de Entrega - ${new Date().toLocaleDateString('pt-BR')}*\n`;
    message += `Distância Total: ${formatDistance(totalDistance)} | Tempo: ${formatDuration(totalTime)}\n\n`;

    destinations.forEach((dest, i) => {
        const statusIcon = dest.status === RouteStatus.COMPLETED ? '✅' : '📍';
        message += `${statusIcon} *${i + 1}. ${dest.address.logradouro}*\n`;
        message += `${dest.address.bairro} - ${dest.cep}\n`;
        if (dest.notes) message += `📝 Nota: ${dest.notes}\n`;
        message += `🗺️ https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${dest.address.logradouro},${dest.address.localidade}`)}\n\n`;
    });

    message += `_Gerado por RotaInteligente AI_`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans">
      
      {/* Barra Lateral / Controles */}
      <div className="w-full md:w-96 bg-white border-r border-slate-200 flex flex-col h-screen overflow-hidden z-20 shadow-xl">
        <div className="p-6 bg-slate-900 text-white">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 text-blue-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            Rota Inteligente
          </h1>
          <p className="text-slate-400 text-xs mt-1">Planejador Logístico via Gemini AI</p>
          
          {(totalDistance > 0 || totalTime > 0) && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="bg-slate-800 p-2 rounded-lg">
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Distância Total</p>
                      <p className="text-white font-mono text-sm">{formatDistance(totalDistance)}</p>
                  </div>
                  <div className="bg-slate-800 p-2 rounded-lg">
                      <p className="text-slate-400 text-[10px] uppercase font-bold">Tempo Estimado</p>
                      <p className="text-white font-mono text-sm">{formatDuration(totalTime)}</p>
                  </div>
              </div>
          )}
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
            Adicionar Novo Ponto (CEP)
          </label>
          <form onSubmit={handleAddCep} className="relative">
            <input
              type="text"
              value={cepInput}
              onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, '');
                  if (val.length > 5) val = val.slice(0, 5) + '-' + val.slice(5, 8);
                  setCepInput(val);
              }}
              placeholder="Digite o CEP (00000-000)"
              maxLength={9}
              className="w-full pl-4 pr-12 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
            />
            <button 
                type="submit" 
                disabled={loading || cepInput.length < 9}
                className="absolute right-2 top-2 p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                title="Buscar CEP"
            >
                {loading ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                )}
            </button>
          </form>
          {currentLocation ? (
             <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.625a19.055 19.055 0 002.273 1.765c.311.193.571.337.757.433l.281.14.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" clipRule="evenodd" />
                </svg>
                Sua localização detectada
             </div>
          ) : (
             <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                Aguardando sinal GPS...
             </div>
          )}
        </div>

        {/* Barra de Ferramentas / Ações Rápidas */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex justify-between items-center gap-2">
            <button onClick={handleInvertRoute} disabled={destinations.length < 2} className="p-2 hover:bg-white rounded text-slate-600 hover:text-blue-600 transition-colors disabled:opacity-50" title="Inverter Rota Pendente">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5" />
                </svg>
            </button>
            <div className="h-4 w-px bg-slate-300"></div>
            <button onClick={handleCopyText} disabled={destinations.length === 0} className="p-2 hover:bg-white rounded text-slate-600 hover:text-blue-600 transition-colors disabled:opacity-50" title="Copiar Lista Texto">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.554.1-.766m6.75 0a48.667 48.667 0 00-7.5 0" />
                </svg>
            </button>
            <div className="h-4 w-px bg-slate-300"></div>
            <button onClick={handleClearAll} disabled={destinations.length === 0} className="p-2 hover:bg-white rounded text-slate-600 hover:text-red-600 transition-colors disabled:opacity-50" title="Limpar Tudo">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-bold text-slate-700 uppercase">Lista de Paradas</h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{destinations.length}</span>
          </div>
          
          {destinations.length === 0 ? (
            <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                <p>Nenhum endereço na rota.</p>
                <p className="text-sm mt-2">Adicione múltiplos CEPs para começar.</p>
            </div>
          ) : (
            destinations.map((dest, index) => (
              <AddressCard 
                key={dest.id} 
                destination={dest} 
                index={index} 
                onRemove={removeDestination}
                onClick={() => setSelectedDestination(dest)}
              />
            ))
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] space-y-3">
            <button 
                onClick={handleOptimize}
                disabled={optimizing || destinations.length < 2}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white py-3.5 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
                {optimizing ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Otimizando...
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                             <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Calcular Melhor Rota
                    </>
                )}
            </button>
            
            <button
                onClick={handleShareRoute}
                disabled={destinations.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-green-100 text-green-700 hover:bg-green-200 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" />
                </svg>
                Compartilhar Rota (WhatsApp)
            </button>
        </div>
      </div>

      {/* Conteúdo Principal / Visualizador */}
      <div className="flex-1 bg-slate-100 p-4 md:p-8 overflow-y-auto">
        
        {/* Caixa de Insights da IA */}
        {aiReasoning && (
            <div className="mb-6 bg-white border-l-4 border-indigo-500 p-5 rounded-r-xl shadow-sm flex items-start gap-4">
                <div className="bg-indigo-100 p-2 rounded-lg shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-indigo-600">
                        <path d="M3.375 3C2.339 3 1.5 3.84 1.5 4.875v.75c0 1.036.84 1.875 1.875 1.875h17.25c1.035 0 1.875-.84 1.875-1.875v-.75C22.5 3.839 21.66 3 20.625 3H3.375z" />
                        <path fillRule="evenodd" d="M3.087 9l.54 9.176A3 3 0 006.62 21h10.757a3 3 0 002.995-2.824L20.913 9H3.087zm6.163 3.75A.75.75 0 0110 12h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                    </svg>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-lg">Estratégia da Rota</h3>
                    <p className="text-slate-600 mt-1 leading-relaxed">{aiReasoning}</p>
                </div>
            </div>
        )}

        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            Visualização no Mapa
        </h2>
        
        <RouteVisualizer 
            destinations={destinations} 
            currentLocation={currentLocation}
            onPointClick={(dest) => setSelectedDestination(dest)}
        />
        
        {/* Legenda Simples */}
        <div className="flex flex-wrap gap-4 mt-6 text-sm text-slate-600 bg-white p-3 rounded-lg shadow-sm inline-flex">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-600 border border-white shadow-sm"></div>
                <span className="font-medium">Início (Você)</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-blue-500 rounded-full border border-white shadow-sm"></div>
                <span className="font-medium">Caminho Pendente</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-8 h-1 bg-green-500 rounded-full border border-white shadow-sm"></div>
                <span className="font-medium">Caminho Realizado</span>
            </div>
        </div>
      </div>

      {/* Modal / Pop-up de Localização e Ação */}
      <Modal
        isOpen={!!selectedDestination}
        onClose={() => setSelectedDestination(null)}
        title="Detalhes da Parada"
      >
        {selectedDestination && (
            <div className="space-y-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                            selectedDestination.status === RouteStatus.COMPLETED 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                            {selectedDestination.status === RouteStatus.COMPLETED ? 'Entrega Realizada' : 'Pendente'}
                        </span>
                        
                        {selectedDestination.travelDuration && (
                            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                                </svg>
                                +{formatDuration(selectedDestination.travelDuration)}
                            </span>
                        )}
                    </div>
                    <p className="text-xl text-slate-900 font-bold leading-tight">{selectedDestination.address.logradouro}</p>
                    <p className="text-slate-600 mt-1">{selectedDestination.address.bairro}, {selectedDestination.address.localidade} - {selectedDestination.address.uf}</p>
                    <p className="text-slate-500 font-mono text-sm mt-1 bg-slate-100 inline-block px-2 py-0.5 rounded">CEP: {selectedDestination.cep}</p>
                    
                    {/* Campo de Notas Editável */}
                    <div className="mt-4">
                        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Notas / Observações</label>
                        <textarea
                            value={selectedDestination.notes || ''}
                            onChange={(e) => handleUpdateNotes(selectedDestination.id, e.target.value)}
                            className="w-full text-sm p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none bg-slate-50 focus:bg-white transition-colors"
                            rows={3}
                            placeholder="Ex: Campainha quebrada, deixar com vizinho..."
                        />
                    </div>
                </div>

                {/* Mapa Embedado - Pop-up de Localização Exata */}
                <div className="h-64 bg-slate-100 rounded-xl overflow-hidden relative border border-slate-200 shadow-inner group">
                    <iframe
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        style={{ border: 0 }}
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(`${selectedDestination.address.logradouro}, ${selectedDestination.address.localidade}, ${selectedDestination.address.uf}`)}&output=embed`}
                        allowFullScreen
                        title="Mapa de localização"
                    ></iframe>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4 pointer-events-none">
                        <p className="text-white text-xs font-medium">Visualização via Google Maps</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${selectedDestination.address.logradouro}, ${selectedDestination.address.localidade}, ${selectedDestination.address.uf}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-white border border-slate-300 text-slate-700 py-3 rounded-lg font-bold text-center hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        Navegar (GPS)
                    </a>
                    
                    {/* Botão de Finalizar Rota no Destino */}
                    {selectedDestination.status !== RouteStatus.COMPLETED ? (
                        <button
                            onClick={() => markAsCompleted(selectedDestination.id)}
                            className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Finalizar Entrega
                        </button>
                    ) : (
                        <button
                            disabled
                            className="flex-1 bg-slate-100 text-slate-400 border border-slate-200 py-3 rounded-lg font-medium cursor-default flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                            Já Finalizado
                        </button>
                    )}
                </div>
            </div>
        )}
      </Modal>
    </div>
  );
};

export default App;