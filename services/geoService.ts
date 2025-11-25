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
  // Limpeza inteligente do logradouro:
  // ViaCEP retorna coisas como: "Rua Exemplo - de 1000 a 2000 - lado ímpar"
  // O Nominatim se confunde com isso. Queremos apenas "Rua Exemplo".
  // Usamos ' - ' (espaço hífen espaço) como separador seguro para não quebrar nomes de ruas compostos (ex: X-Men).
  let cleanLogradouro = address.logradouro.split(' - ')[0];
  
  // Remover parênteses se houver (ex: "Rua X (Antiga Rua Y)")
  cleanLogradouro = cleanLogradouro.split('(')[0].trim();

  // Lista de estratégias de busca (Waterfall / Cascata)
  // Prioridade: Precisão alta -> Precisão média
  const queries = [
    // 1. Busca Estruturada (Rua, Cidade, Estado) - Alta precisão
    // Essa é a melhor forma pois evita falsos positivos em outras cidades
    {
        params: new URLSearchParams({
            street: cleanLogradouro,
            city: address.localidade,
            state: address.uf,
            country: 'Brazil',
            format: 'json',
            limit: '1'
        })
    },
    // 2. Busca por CEP (Postalcode) - Alta precisão para localização aproximada da rua/quadra
    // O OpenStreetMap (Nominatim) tem uma boa base de CEPs.
    {
        params: new URLSearchParams({
            postalcode: address.cep,
            country: 'Brazil',
            format: 'json',
            limit: '1'
        })
    },
    // 3. Busca Livre (Query string) - Rua + Cidade + UF
    // Fallback padrão caso a busca estruturada falhe por grafia
    {
        params: new URLSearchParams({
            q: `${cleanLogradouro}, ${address.localidade}, ${address.uf}, Brazil`,
            format: 'json',
            limit: '1'
        })
    },
    // 4. Busca por Bairro (Último recurso para garantir que o alfinete apareça na cidade certa)
    {
        params: new URLSearchParams({
             q: `${address.bairro}, ${address.localidade}, ${address.uf}, Brazil`,
             format: 'json',
             limit: '1'
        })
    }
  ];

  for (const query of queries) {
      try {
        await delay(1000); // Respeitar limite de taxa (Rate Limit) do Nominatim para não ser bloqueado
        
        const url = `https://nominatim.openstreetmap.org/search?${query.params.toString()}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'RotaInteligenteApp/1.0',
                'Accept-Language': 'pt-BR'
            }
        });
        
        const data = await response.json();

        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon),
            };
        }
    } catch (error) {
        console.warn("Erro na tentativa de geocodificação:", error);
    }
  }

  // Se todas as tentativas falharem
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
           enableHighAccuracy: true
        }
      );
    }
  });
};