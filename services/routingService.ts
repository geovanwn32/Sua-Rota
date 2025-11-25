import { Destination } from '../types';

interface RouteLeg {
  distance: number; // metros
  duration: number; // segundos
  summary: string;
}

interface OSRMResponse {
  code: string;
  routes: {
    legs: {
      distance: number;
      duration: number;
      summary: string;
      annotation: any;
    }[];
    distance: number;
    duration: number;
    geometry: any; // Full geometry if requested, but we map legs via index match usually
  }[];
}

// OSRM Public Demo API
const OSRM_API_URL = 'https://router.project-osrm.org/route/v1/driving';

export const fetchRouteDetails = async (
  startLocation: { lat: number; lng: number },
  destinations: Destination[]
): Promise<Destination[]> => {
  if (!destinations.length) return destinations;

  try {
    // Construir string de coordenadas: lng,lat;lng,lat...
    const coords = [
      `${startLocation.lng},${startLocation.lat}`, // Ponto de partida
      ...destinations.map(d => {
        return `${d.address.lng || 0},${d.address.lat || 0}`;
      })
    ].join(';');

    // Request full geometry (geojson) e overview=full para desenhar no mapa
    const response = await fetch(`${OSRM_API_URL}/${coords}?overview=full&geometries=geojson`);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      console.warn("OSRM Routing failed:", data);
      return destinations;
    }

    // O OSRM retorna "legs" (pernas) entre os waypoints.
    // Se temos Start + 3 Destinos, teremos 3 legs.
    // Leg 0: Start -> Dest 1
    // Leg 1: Dest 1 -> Dest 2
    // Leg 2: Dest 2 -> Dest 3
    
    // NOTA IMPORTANTE: A API do OSRM retorna a geometria completa na raiz 'routes[0].geometry'
    // Mas para colorir segmento por segmento, precisaríamos quebrar essa geometria.
    // Para simplificar e garantir precisão, vamos fazer chamadas individuais ou processar a geometria complexa.
    // No entanto, para esta implementação robusta, vamos usar a geometria da rota inteira mas segmentá-la visualmente
    // ou, melhor ainda, vamos fazer o match simples: OSRM retorna legs sem geometria individual detalhada no modo padrão,
    // apenas duration/distance. Para obter geometria por perna, precisamos reconstruir ou usar steps.
    
    // SOLUÇÃO ROBUSTA: Vamos assumir a geometria global para visualização geral,
    // mas para ser perfeito visualmente (cada linha colorida diferentemente),
    // precisaríamos de lógica complexa de fatiamento de GeoJSON.
    
    // ALTERNATIVA DE IMPLEMENTAÇÃO RÁPIDA E EFICAZ:
    // Faremos chamadas par-a-par para pegar a geometria exata de cada segmento.
    // Isso garante que se o usuario mudar a ordem, a geometria se ajusta perfeitamente.
    // Embora gere mais requests, para < 10 pontos é aceitável e visualmente superior.
    
    const updatedDestinations: Destination[] = [];
    let currentOrigin = startLocation;

    for (let i = 0; i < destinations.length; i++) {
        const dest = destinations[i];
        
        // Pega rota apenas deste segmento: Origem Atual -> Destino Atual
        const segmentUrl = `${OSRM_API_URL}/${currentOrigin.lng},${currentOrigin.lat};${dest.address.lng},${dest.address.lat}?overview=full&geometries=geojson`;
        
        const segmentRes = await fetch(segmentUrl);
        const segmentData = await segmentRes.json();

        if (segmentData.code === 'Ok' && segmentData.routes.length > 0) {
            const route = segmentData.routes[0];
            updatedDestinations.push({
                ...dest,
                travelDistance: route.distance,
                travelDuration: route.duration,
                geometry: route.geometry // GeoJSON LineString
            });
            // Atualiza origem para o próximo loop
            if (dest.address.lat && dest.address.lng) {
                 currentOrigin = { lat: dest.address.lat, lng: dest.address.lng };
            }
        } else {
            updatedDestinations.push(dest);
        }
        
        // Pequeno delay para não ser bloqueado pela API demo
        await new Promise(r => setTimeout(r, 150)); 
    }

    return updatedDestinations;

  } catch (error) {
    console.error("Erro ao calcular detalhes da rota:", error);
    return destinations;
  }
};

export const formatDuration = (seconds?: number): string => {
  if (seconds === undefined) return '--';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}min`;
};

export const formatDistance = (meters?: number): string => {
  if (meters === undefined) return '--';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};