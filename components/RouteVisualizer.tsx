import React, { useEffect, useRef, useState } from 'react';
import { Destination, RouteStatus } from '../types';

// Declare Leaflet global type since we are loading it via CDN
declare const L: any;

interface RouteVisualizerProps {
  destinations: Destination[];
  currentLocation: { lat: number; lng: number } | null;
  onPointClick: (dest: Destination) => void;
}

const RouteVisualizer: React.FC<RouteVisualizerProps> = ({ destinations, currentLocation, onPointClick }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null); // Separate layer for route lines
  const baseLayerRef = useRef<any>(null);
  const trafficLayerRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Map Controls State
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [showTraffic, setShowTraffic] = useState(false);

  // Initialize map only once on mount
  useEffect(() => {
    // Se o container não existe, aborta
    if (!mapContainerRef.current) return;

    // Se o mapa já existe, não recria (evita erro "Map is already initialized")
    if (mapInstanceRef.current) return;

    // Centro do Brasil
    const defaultLat = -14.2350;
    const defaultLng = -51.9253;
    const defaultZoom = 4;
    
    // Limites aproximados da América do Sul para evitar que o usuário se perca no oceano
    const southWest = L.latLng(-60, -90);
    const northEast = L.latLng(15, -30);
    const bounds = L.latLngBounds(southWest, northEast);

    try {
        const map = L.map(mapContainerRef.current, {
            zoomControl: false,
            minZoom: 3,
            maxBounds: bounds,
            maxBoundsViscosity: 1.0 // Impede arrastar para fora totalmente
        }).setView([defaultLat, defaultLng], defaultZoom);

        // Initial Base Layer (OSM) - Clean Style
        baseLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        // Traffic Layer Init
        trafficLayerRef.current = L.tileLayer('https://mt0.google.com/vt?lyrs=h@159000000,traffic|seconds_into_week:-1&style=3&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            opacity: 0.8,
            pane: 'overlayPane', 
            zIndex: 10
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Create groups
        routeLayerRef.current = L.layerGroup().addTo(map); // Routes at bottom
        layerGroupRef.current = L.layerGroup().addTo(map); // Markers on top
        
        mapInstanceRef.current = map;
        setIsMapReady(true);

        // Fix Crítico: Forçar atualização do tamanho do mapa após renderização
        // Isso resolve o problema de "mapa cinza" ou incompleto
        setTimeout(() => {
            map.invalidateSize();
        }, 200);

    } catch (error) {
        console.error("Erro ao inicializar o mapa:", error);
    }

    // Cleanup function
    return () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
            setIsMapReady(false);
        }
    };
  }, []);

  // Handle Map Type Switching
  useEffect(() => {
    if (!mapInstanceRef.current || !baseLayerRef.current) return;

    try {
        mapInstanceRef.current.removeLayer(baseLayerRef.current);

        if (mapType === 'standard') {
            baseLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors',
                maxZoom: 19
            });
        } else {
            baseLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Esri',
                maxZoom: 19
            });
        }

        mapInstanceRef.current.addLayer(baseLayerRef.current);
        baseLayerRef.current.bringToBack();
    } catch (e) {
        console.warn("Erro ao trocar camada:", e);
    }
  }, [mapType, isMapReady]);

  // Handle Traffic Layer
  useEffect(() => {
    if (!mapInstanceRef.current || !trafficLayerRef.current) return;
    try {
        if (showTraffic) {
            mapInstanceRef.current.addLayer(trafficLayerRef.current);
        } else {
            mapInstanceRef.current.removeLayer(trafficLayerRef.current);
        }
    } catch (e) {
        console.warn("Erro ao alternar tráfego:", e);
    }
  }, [showTraffic, isMapReady]);

  // Handle updates to markers and route lines
  useEffect(() => {
    if (!isMapReady || !mapInstanceRef.current || !layerGroupRef.current || !routeLayerRef.current) return;

    layerGroupRef.current.clearLayers();
    routeLayerRef.current.clearLayers();

    const points: Array<{lat: number, lng: number}> = [];

    // 1. Add Current Location Marker
    if (currentLocation && currentLocation.lat && currentLocation.lng) {
        const startIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `
                <div style="background-color: #2563eb; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.5); display: flex; align-items: center; justify-content: center; position: relative;">
                    <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const marker = L.marker([currentLocation.lat, currentLocation.lng], { icon: startIcon, zIndexOffset: 1000 })
            .bindPopup("<b>Início</b><br>Sua Localização Atual");
        
        layerGroupRef.current.addLayer(marker);
        points.push({ lat: currentLocation.lat, lng: currentLocation.lng });
    }

    // 2. Add Destinations Markers and Route Geometry
    destinations.forEach((dest, index) => {
        // Only map if coordinates exist and are valid numbers
        if (dest.address.lat != null && dest.address.lng != null && !isNaN(dest.address.lat)) {
            const isCompleted = dest.status === RouteStatus.COMPLETED;
            const color = isCompleted ? '#22c55e' : '#ef4444';
            const zIndex = isCompleted ? 500 : 800;
            
            // Marker
            const destIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `
                    <div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50% 50% 50% 0; border: 3px solid white; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
                        <div style="transform: rotate(45deg); color: white; font-weight: bold; font-family: sans-serif; font-size: 14px;">${isCompleted ? '✓' : index + 1}</div>
                    </div>
                `,
                iconSize: [32, 42],
                iconAnchor: [16, 42]
            });

            const marker = L.marker([dest.address.lat, dest.address.lng], { icon: destIcon, zIndexOffset: zIndex });
            marker.on('click', () => onPointClick(dest));
            marker.bindTooltip(`<b>${index + 1}. ${dest.address.logradouro}</b>`, { offset: [0, -40], direction: "top", className: "bg-white border shadow-md rounded px-2" });
            
            layerGroupRef.current.addLayer(marker);
            points.push({ lat: dest.address.lat, lng: dest.address.lng });

            // Route Geometry (Line between points)
            if (dest.geometry) {
                const pathColor = isCompleted ? '#22c55e' : (mapType === 'satellite' ? '#60a5fa' : '#3b82f6');
                const dashArray = isCompleted ? undefined : '10, 10';
                
                const routeLine = L.geoJSON(dest.geometry, {
                    style: {
                        color: pathColor,
                        weight: 5,
                        opacity: 0.8,
                        dashArray: dashArray,
                        lineCap: 'round'
                    }
                });
                routeLayerRef.current.addLayer(routeLine);
            }
        }
    });

    // 3. Fallback: Draw straight lines if no geometry available yet
    const hasAnyGeometry = destinations.some(d => !!d.geometry);
    if (!hasAnyGeometry && points.length > 1) {
        const latlngs = points.map(p => [p.lat, p.lng]);
        const polyline = L.polyline(latlngs, { 
            color: '#94a3b8', 
            weight: 3, 
            opacity: 0.5, 
            dashArray: '5, 10' 
        });
        routeLayerRef.current.addLayer(polyline);
    }

    // Fit Bounds Logic
    // Only fit bounds if we have points AND (it's the first load OR we just added points)
    if (points.length > 0) {
        const latlngs = points.map(p => [p.lat, p.lng]);
        const bounds = L.latLngBounds(latlngs);
        // Padding garante que os marcadores não fiquem colados na borda
        mapInstanceRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
    }

  }, [isMapReady, destinations, currentLocation, onPointClick, mapType, showTraffic]);

  const handleCenterOnMe = () => {
      if (currentLocation && mapInstanceRef.current) {
          mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 16);
      }
  };

  const hasData = destinations.length > 0 || !!currentLocation;

  return (
    <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative group">
        
        {/* Status Badge */}
        <div className="absolute top-4 left-4 z-[400] bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold text-slate-600 border border-slate-200 shadow-sm flex items-center gap-2 pointer-events-none">
            <span className={`w-2 h-2 rounded-full ${hasData ? 'bg-green-500 animate-pulse' : 'bg-slate-400'}`}></span>
            {hasData ? 'Mapa Ativo' : 'Aguardando Dados'}
        </div>

        {/* Map Controls */}
        <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
            <div className="bg-white rounded-lg shadow-md border border-slate-200 p-1 flex">
                <button onClick={() => setMapType('standard')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${mapType === 'standard' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Mapa</button>
                <button onClick={() => setMapType('satellite')} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${mapType === 'satellite' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>Satélite</button>
            </div>
            
            <button onClick={() => setShowTraffic(!showTraffic)} className={`bg-white rounded-lg shadow-md border border-slate-200 p-2 flex items-center justify-center gap-2 transition-all ${showTraffic ? 'text-green-600 border-green-200 bg-green-50' : 'text-slate-600 hover:bg-slate-50'}`} title="Alternar Trânsito">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                </svg>
                <span className="text-xs font-bold">{showTraffic ? 'Trânsito ON' : 'Trânsito'}</span>
            </button>

            {/* Center on Me Button */}
            {currentLocation && (
                <button onClick={handleCenterOnMe} className="bg-white text-slate-700 hover:text-blue-600 rounded-lg shadow-md border border-slate-200 p-2 flex items-center justify-center transition-colors" title="Onde Estou">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                </button>
            )}
        </div>

        <div ref={mapContainerRef} className="w-full h-[500px] bg-slate-50 z-0" />

        {!hasData && (
             <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-[2px] z-[500] flex flex-col items-center justify-center text-slate-500">
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 flex flex-col items-center max-w-sm text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                        </svg>
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg mb-1">Mapa do Brasil</h3>
                    <p className="text-sm text-slate-500">Adicione CEPs para traçar sua rota no território nacional.</p>
                </div>
             </div>
        )}
    </div>
  );
};

export default RouteVisualizer;