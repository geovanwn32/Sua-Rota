import { GoogleGenAI, Type } from "@google/genai";
import { Destination, OptimizationResult } from '../types';

const getAiClient = () => {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const optimizeRoute = async (
  currentLocation: { lat: number; lng: number } | null,
  destinations: Destination[],
  numberOfVehicles: number = 1
): Promise<OptimizationResult> => {
  if (destinations.length === 0) {
    return { assignments: [], reasoning: "" };
  }

  const ai = getAiClient();
  const model = "gemini-2.5-flash";

  // Prepare data with constraints
  const locationsList = destinations.map(d => ({
    id: d.id,
    address: `${d.address.logradouro}, ${d.address.bairro}`,
    coords: d.address.lat ? `${d.address.lat},${d.address.lng}` : "Unknown",
    timeWindow: d.timeWindow ? `${d.timeWindow.start} - ${d.timeWindow.end}` : "Qualquer horário"
  }));

  const startPoint = currentLocation 
    ? `Lat: ${currentLocation.lat}, Lng: ${currentLocation.lng}` 
    : "Centro da cidade (assumido)";

  const prompt = `
    Atue como um sistema avançado de TMS (Transportation Management System).
    
    DADOS DO PROBLEMA:
    - Ponto de Partida (Depósito): ${startPoint}
    - Número de Veículos Disponíveis: ${numberOfVehicles}
    - Lista de Entregas:
    ${JSON.stringify(locationsList, null, 2)}
    
    OBJETIVO:
    Resolva o Problema de Roteamento de Veículos (VRP).
    1. Distribua as entregas entre os ${numberOfVehicles} veículos de forma equilibrada e eficiente.
    2. Minimize a distância total percorrida.
    3. RESPEITE AS JANELAS DE TEMPO (Time Windows) se especificadas.
    4. Ordene as paradas para cada veículo logicamente.
    
    SAÍDA JSON OBRIGATÓRIA:
    Retorne um objeto com 'assignments' (lista de veículos e seus IDs de parada ordenados) e 'reasoning' (explicação).
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
            assignments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  vehicleId: { type: Type.STRING, description: "Nome do veículo (ex: Veículo 1)" },
                  stopIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "IDs ordenados" }
                }
              }
            },
            reasoning: {
              type: Type.STRING,
              description: "Estratégia logística utilizada em Português."
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Sem resposta da IA");
    
    return JSON.parse(text) as OptimizationResult;

  } catch (error) {
    console.error("Falha na otimização Gemini:", error);
    // Fallback: Assign all to Vehicle 1
    return {
      assignments: [{
        vehicleId: "Veículo 1",
        stopIds: destinations.map(d => d.id)
      }],
      reasoning: "Falha na IA. Rota sequencial padrão gerada."
    };
  }
};