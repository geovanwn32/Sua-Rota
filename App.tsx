import React, { useState, useEffect, useRef } from 'react';
import { fetchAddressByCep, fetchCoordinates, getCurrentPosition } from './services/geoService';
import { optimizeRoute } from './services/geminiService';
import { fetchRouteDetails, formatDistance, formatDuration } from './services/routingService';
import { authService } from './services/authService';
import { Destination, RouteStatus, AddressData, User, TimeWindow } from './types';
import RouteVisualizer from './components/RouteVisualizer';
import AddressCard from './components/AddressCard';
import Modal from './components/Modal';
import LoginScreen from './components/LoginScreen';

const App: React.FC = () => {
  // User State
  const [user, setUser] = useState<User | null>(null);

  const [cepInput, setCepInput] = useState('');
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>(''); // Status visual do progresso
  const [optimizing, setOptimizing] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);

  // Enterprise Features State
  const [numberOfVehicles, setNumberOfVehicles] = useState(1);

  // Estados para métricas totais
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  const isDataLoadedRef = useRef(false);

  // Localização Inicial
  useEffect(() => {
    if (user) {
        getCurrentPosition()
        .then(pos => setCurrentLocation(pos))
        .catch(err => console.warn("Acesso à localização negado ou indisponível", err));
    }
  }, [user]);

  // Recalcular totais sempre que os destinos mudarem
  useEffect(() => {
    const dist = destinations.reduce((acc, curr) => acc + (curr.travelDistance || 0), 0);
    const time = destinations.reduce((acc, curr) => acc + (curr.travelDuration || 0), 0);
    setTotalDistance(dist);
    setTotalTime(time);
  }, [destinations]);

  // Persistence
  useEffect(() => {
    if (user && isDataLoadedRef.current) {
        authService.saveUserData(user.id, destinations);
    }
  }, [destinations, user]);

  const handleLogin = (userData: User) => {
    setUser(userData);
    const savedDestinations = authService.loadUserData(userData.id);
    setDestinations(savedDestinations);
    isDataLoadedRef.current = true;
  };

  const handleLogout = () => {
    setUser(null);
    setDestinations([]);
    setCepInput('');
    setAiReasoning(null);
    isDataLoadedRef.current = false;
  };

  const handleAddCep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cepInput.trim()) return;

    setLoading(true);
    setProgressStatus('Analisando lista de CEPs...');

    const rawInputs = cepInput.split(/[\n,;]+/);
    const validCeps: string[] = [];

    // Validar formato
    for (const raw of rawInputs) {
        const clean = raw.replace(/\D/g, '');
        if (clean.length === 8) validCeps.push(clean);
    }

    if (validCeps.length === 0) {
        alert("Nenhum CEP válido encontrado (8 dígitos).");
        setLoading(false);
        setProgressStatus('');
        return;
    }

    // Processar um por um para feedback visual imediato e evitar bloqueio da API
    let successCount = 0;
    
    // Limpar input imediatamente para UX
    setCepInput('');

    for (let i = 0; i < validCeps.length; i++) {
        const cep = validCeps[i];
        setProgressStatus(`Buscando CEP ${cep} (${i + 1}/${validCeps.length})...`);
        
        const address = await fetchAddressByCep(cep);
        
        if (address) {
            setProgressStatus(`Geolocalizando ${address.logradouro}...`);
            const coords = await fetchCoordinates(address);
            
            if (coords) {
                const addressWithCoords: AddressData = { ...address, lat: coords.lat, lng: coords.lng };
                
                const newDest: Destination = {
                    id: crypto.randomUUID(),
                    cep: address.cep,
                    address: addressWithCoords,
                    status: RouteStatus.PENDING,
                    order: destinations.length + successCount, // Mantém ordem relativa ao que já existe
                    notes: '',
                    vehicleId: numberOfVehicles > 1 ? 'Pendente' : 'Veículo 1'
                };

                // ATUALIZAÇÃO INCREMENTAL: Adiciona ao estado imediatamente
                setDestinations(prev => {
                    const updated = [...prev, newDest];
                    return updated;
                });
                
                // Se for o primeiro adicionado e único, seleciona ele
                if (validCeps.length === 1) setSelectedDestination(newDest);
                
                successCount++;
            } else {
                console.warn(`Coordenadas não encontradas para CEP ${cep}`);
            }
        }
    }

    setLoading(false);
    setProgressStatus('');

    if (successCount === 0) {
        alert("Não foi possível localizar os endereços no mapa. Verifique os CEPs.");
    }
  };

  const handleOptimize = async () => {
    if (destinations.length === 0) return;
    setOptimizing(true);
    
    const pendingDestinations = destinations.filter(d => d.status !== RouteStatus.COMPLETED);
    const completedDestinations = destinations.filter(d => d.status === RouteStatus.COMPLETED);

    // 1. Otimizar Ordem e Atribuição de Veículos via IA
    const result = await optimizeRoute(currentLocation, pendingDestinations, numberOfVehicles);
    
    // Processar resultado: Achatamos as atribuições em uma lista única ordenada, mas marcamos o vehicleId
    let newOrderedList: Destination[] = [];
    
    result.assignments.forEach(assignment => {
        const vehicleDestinations = assignment.stopIds
            .map(id => pendingDestinations.find(d => d.id === id))
            .filter((d): d is Destination => !!d)
            .map(d => ({ ...d, vehicleId: assignment.vehicleId })); // Atualiza o ID do veículo
        
        newOrderedList = [...newOrderedList, ...vehicleDestinations];
    });

    // Se a IA falhar em retornar todos os IDs (raro), adicionamos os que faltaram no final
    const processedIds = new Set(newOrderedList.map(d => d.id));
    const missingDestinations = pendingDestinations.filter(d => !processedIds.has(d.id));
    newOrderedList = [...newOrderedList, ...missingDestinations];

    // 2. Calcular rotas reais e geometria (OSRM)
    if (currentLocation && newOrderedList.length > 0) {
        newOrderedList = await fetchRouteDetails(currentLocation, newOrderedList);
    }

    setDestinations([...completedDestinations, ...newOrderedList]);
    setAiReasoning(result.reasoning);
    setOptimizing(false);
  };

  const markAsCompleted = (id: string, proof: { receiverName: string, photo: File | null }) => {
    // Simular upload de foto (converter para URL local)
    const photoUrl = proof.photo ? URL.createObjectURL(proof.photo) : undefined;

    setDestinations(prev => prev.map(d => 
        d.id === id ? { 
            ...d, 
            status: RouteStatus.COMPLETED,
            proofOfDelivery: {
                receiverName: proof.receiverName,
                timestamp: Date.now(),
                photoUrl: photoUrl
            }
        } : d
    ));
    setSelectedDestination(null);
  };

  const removeDestination = (id: string) => {
    setDestinations(prev => prev.filter(d => d.id !== id));
    if (selectedDestination?.id === id) setSelectedDestination(null);
  };

  // Funções de Atualização
  const handleUpdateNotes = (id: string, notes: string) => {
    setDestinations(prev => prev.map(d => d.id === id ? { ...d, notes: notes } : d));
    if (selectedDestination?.id === id) setSelectedDestination(prev => prev ? { ...prev, notes } : null);
  };

  const handleUpdateTimeWindow = (id: string, window: TimeWindow) => {
    setDestinations(prev => prev.map(d => d.id === id ? { ...d, timeWindow: window } : d));
    if (selectedDestination?.id === id) setSelectedDestination(prev => prev ? { ...prev, timeWindow: window } : null);
  };

  // Nova Função: Duplicar Destino
  const handleDuplicateDestination = (dest: Destination) => {
    const newDest: Destination = {
        ...dest,
        id: crypto.randomUUID(), // Novo ID
        status: RouteStatus.PENDING, // Reseta status
        proofOfDelivery: undefined, // Remove comprovante anterior
        order: destinations.length + 1,
        notes: dest.notes ? `${dest.notes} (Cópia)` : ''
    };
    
    setDestinations(prev => [...prev, newDest]);
  };

  // Utilitários de Toolbar
  const handleClearAll = () => {
      if (confirm("Apagar tudo?")) {
          setDestinations([]);
          setSelectedDestination(null);
          setAiReasoning(null);
      }
  };

  const handleExportCSV = () => {
    if (destinations.length === 0) return;
    
    const headers = ["Ordem", "Veículo", "Status", "Endereço", "Bairro", "Cidade", "CEP", "Janela Inicio", "Janela Fim", "Recebedor", "Hora Entrega", "Notas"];
    const rows = destinations.map((d, i) => [
        i + 1,
        d.vehicleId || '-',
        d.status,
        `"${d.address.logradouro}"`,
        d.address.bairro,
        d.address.localidade,
        d.cep,
        d.timeWindow?.start || '',
        d.timeWindow?.end || '',
        d.proofOfDelivery?.receiverName || '',
        d.proofOfDelivery?.timestamp ? new Date(d.proofOfDelivery.timestamp).toLocaleTimeString() : '',
        `"${d.notes || ''}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + 
        [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `rota_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans">
      
      {/* Sidebar */}
      <div className="w-full md:w-96 bg-white border-r border-slate-200 flex flex-col h-screen overflow-hidden z-20 shadow-xl">
        <div className="p-6 bg-slate-900 text-white">
          <div className="flex justify-between items-start">
             <h1 className="text-xl font-bold flex items-center gap-2">RotaInteligente</h1>
             <button onClick={handleLogout} className="text-slate-400 hover:text-white"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
          </div>
          
          <div className="flex items-center gap-3 mt-4 p-2 bg-slate-800/50 rounded-lg">
             <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold">
                {user.name.charAt(0)}
             </div>
             <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-[10px] text-slate-400">Plano Enterprise</p>
             </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="bg-slate-800 p-2 rounded-lg">
                  <p className="text-slate-400 text-[10px] font-bold">DISTÂNCIA</p>
                  <p className="font-mono text-sm">{formatDistance(totalDistance)}</p>
              </div>
              <div className="bg-slate-800 p-2 rounded-lg">
                  <p className="text-slate-400 text-[10px] font-bold">TEMPO</p>
                  <p className="font-mono text-sm">{formatDuration(totalTime)}</p>
              </div>
          </div>
        </div>

        {/* Input CEP */}
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <form onSubmit={handleAddCep} className="relative">
            <textarea
              value={cepInput}
              onChange={(e) => setCepInput(e.target.value)}
              placeholder="Cole múltiplos CEPs aqui..."
              rows={2}
              className="w-full p-2 pr-10 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button type="submit" disabled={loading} className="absolute right-2 bottom-2 p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {loading ? <span className="animate-spin block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> : <span>+</span>}
            </button>
          </form>
          {loading && <p className="text-xs text-blue-600 mt-2 font-medium animate-pulse">{progressStatus}</p>}
        </div>

        {/* Configurações de Rota (Frota) */}
        <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold uppercase">Veículos:</span>
                <select 
                    value={numberOfVehicles} 
                    onChange={(e) => setNumberOfVehicles(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded px-1 py-0.5"
                >
                    <option value={1}>1 Moto</option>
                    <option value={2}>2 Motos</option>
                    <option value={3}>3 Motos</option>
                    <option value={5}>Frota (5+)</option>
                </select>
            </div>
            <button onClick={handleExportCSV} className="text-blue-600 hover:underline font-semibold" title="Baixar Excel">Exportar CSV</button>
            <button onClick={handleClearAll} className="text-red-600 hover:underline font-semibold">Limpar</button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          {destinations.length === 0 ? (
            <div className="text-center py-10 text-slate-400">Lista vazia.</div>
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

        {/* Action Button */}
        <div className="p-4 bg-white border-t border-slate-200 shadow-lg">
            <button 
                onClick={handleOptimize}
                disabled={optimizing || destinations.length < 2}
                className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50"
            >
                {optimizing ? 'Otimizando Frota...' : 'Calcular Rotas'}
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-slate-100 p-4 md:p-8 overflow-y-auto relative">
        {aiReasoning && (
            <div className="mb-4 bg-white border-l-4 border-indigo-500 p-4 rounded shadow-sm">
                <h3 className="font-bold text-indigo-700 text-sm mb-1">Estratégia Logística (IA)</h3>
                <p className="text-slate-600 text-sm">{aiReasoning}</p>
            </div>
        )}

        <RouteVisualizer 
            destinations={destinations} 
            currentLocation={currentLocation}
            onPointClick={(dest) => setSelectedDestination(dest)}
        />
      </div>

      <Modal
        isOpen={!!selectedDestination}
        onClose={() => setSelectedDestination(null)}
        title="Detalhes da Parada"
        destination={selectedDestination}
        onUpdateNotes={handleUpdateNotes}
        onUpdateTimeWindow={handleUpdateTimeWindow}
        onComplete={markAsCompleted}
        onDuplicate={handleDuplicateDestination}
      />
    </div>
  );
};

export default App;