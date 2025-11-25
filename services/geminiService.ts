import { GoogleGenAI, Type } from "@google/genai";
import { Destination, OptimizationResult } from '../types';

const getAiClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const optimizeRoute = async (
  currentLocation: { lat: number; lng: number } | null,
  destinations: Destination[]
): Promise<OptimizationResult> => {
  if (destinations.length <= 1) {
    return {
      sortedIds: destinations.map(d => d.id),
      reasoning: "Apenas um destino, nenhuma otimização necessária."
    };
  }

  const ai = getAiClient();
  const model = "gemini-2.5-flash";

  // Prepare the data for the prompt
  const locationsList = destinations.map(d => ({
    id: d.id,
    address: `${d.address.logradouro}, ${d.address.localidade}, ${d.address.uf}`,
    coordinates: d.address.lat && d.address.lng ? `${d.address.lat},${d.address.lng}` : "Unknown"
  }));

  const startPoint = currentLocation 
    ? `Latitude: ${currentLocation.lat}, Longitude: ${currentLocation.lng}` 
    : "Ponto desconhecido, assumir posição central relativa aos pontos";

  const prompt = `
    Atue como um especialista em logística e rotas de entrega no Brasil.
    Minha localização inicial (ponto de partida fixo) é: ${startPoint}.
    
    Tenho os seguintes destinos para visitar:
    ${JSON.stringify(locationsList, null, 2)}
    
    Por favor, reordene estes destinos para criar a rota de direção mais eficiente (Problema do Caixeiro Viajante - TSP), começando OBRIGATORIAMENTE da minha localização atual.
    
    Retorne os IDs dos destinos na ordem exata em que devem ser visitados.
    Forneça também uma explicação muito breve em Português sobre a estratégia da rota escolhida.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sortedIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "A lista de IDs de destino na ordem otimizada."
            },
            reasoning: {
              type: Type.STRING,
              description: "Breve explicação da estratégia da rota em Português."
            }
          },
          required: ["sortedIds", "reasoning"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Sem resposta da IA");
    
    return JSON.parse(text) as OptimizationResult;

  } catch (error) {
    console.error("Falha na otimização Gemini:", error);
    // Fallback: return original order
    return {
      sortedIds: destinations.map(d => d.id),
      reasoning: "Falha na otimização automática. Usando ordem de inserção."
    };
  }
};