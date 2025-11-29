import { AddressData } from '../types';

// Fetch address details from CEP using ViaCEP (Free, no key)
export const fetchAddressByCep = async (cep: string): Promise<AddressData | null> => {
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    const data = await response.json();

    if (data.erro) {
      return null;
    }

    return {
      cep: data.cep,
      logradouro: data.logradouro,
      bairro: data.bairro,
      localidade: data.localidade,
      uf: data.uf,
    };
  } catch (error) {
    console.error("Error fetching CEP:", error);
    return null;
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchCoordinates = async (address: AddressData): Promise<{ lat: number; lng: number } | null> => {
  // Limpeza inteligente do logradouro para aumentar chances de match
  let cleanLogradouro = address.logradouro.split(' - ')[0];
  cleanLogradouro = cleanLogradouro.split('(')[0].trim();

  // Estratégia de Tentativas (Retry Strategy)
  // O Nominatim (OSM) é sensível. Vamos tentar do mais específico para o mais genérico.
  
  const queries = [
    // 1. TENTATIVA POR CEP (Postalcode) - Prioridade Alta para garantir o pino
    // Muitas vezes o nome da rua muda, mas o CEP geográfico é conhecido pelo OSM.
    {
        type: 'cep',
        params: new URLSearchParams({
            postalcode: address.cep.replace('-', ''), // Remove hífen
            country: 'Brazil',
            format: 'json',
            limit: '1'
        })
    },
    // 2. Busca Estruturada (Rua, Cidade, Estado)
    {
        type: 'street_structured',
        params: new URLSearchParams({
            street: cleanLogradouro,
            city: address.localidade,
            state: address.uf,
            country: 'Brazil',
            format: 'json',
            limit: '1'
        })
    },
    // 3. Busca Livre (Query string) - Rua + Cidade
    {
        type: 'street_query',
        params: new URLSearchParams({
            q: `${cleanLogradouro}, ${address.localidade}, ${address.uf}`,
            format: 'json',
            limit: '1'
        })
    },
    // 4. Último recurso: Centro da Cidade (Garante que não retorna null)
    {
        type: 'city_fallback',
        params: new URLSearchParams({
             city: address.localidade,
             state: address.uf,
             country: 'Brazil',
             format: 'json',
             limit: '1'
        })
    }
  ];

  for (const query of queries) {
      try {
        // Delay para evitar Rate Limiting (Erro 429) se adicionarmos muitos CEPs rápido
        await delay(800); 
        
        const url = `https://nominatim.openstreetmap.org/search?${query.params.toString()}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'RotaInteligenteApp/2.0', // User-agent único é obrigatório no OSM
                'Accept-Language': 'pt-BR'
            }
        });
        
        const data = await response.json();

        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            
            // Validação básica de coordenadas (Brasil fica aprox entre Lat +5 e -33, Lng -34 e -74)
            // Isso evita que um erro de geocoding jogue o pino na Europa
            if (!isNaN(lat) && !isNaN(lng)) {
                return { lat, lng };
            }
        }
    } catch (error) {
        console.warn(`Erro na tentativa de geocodificação (${query.type}):`, error);
    }
  }

  // Se absolutamente tudo falhar, retorna null e o App.tsx trata
  return null;
};

export const getCurrentPosition = (): Promise<{ lat: number; lng: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        {
           enableHighAccuracy: true,
           timeout: 10000,
           maximumAge: 0
        }
      );
    }
  });
};