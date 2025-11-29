export interface Coordinate {
    lat: number;
    lng: number;
  }
  
  export enum RouteStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    SKIPPED = 'SKIPPED'
  }
  
  export interface AddressData {
    cep: string;
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
    lat?: number;
    lng?: number;
  }
  
  export interface ProofOfDelivery {
    receiverName: string;
    timestamp: number;
    photoUrl?: string; // Base64 or URL
  }

  export interface TimeWindow {
    start: string; // "09:00"
    end: string;   // "18:00"
  }

  export interface Destination {
    id: string;
    cep: string;
    address: AddressData;
    status: RouteStatus;
    order: number;
    notes?: string;
    travelDistance?: number; // metros
    travelDuration?: number; // segundos
    geometry?: any;
    
    // Novos Campos Enterprise
    vehicleId?: string; // "Veículo 1", "Moto A"
    timeWindow?: TimeWindow;
    proofOfDelivery?: ProofOfDelivery;
  }
  
  export interface OptimizedRouteAssignment {
    vehicleId: string;
    stopIds: string[]; // Ordered IDs for this vehicle
  }

  export interface OptimizationResult {
    assignments: OptimizedRouteAssignment[];
    reasoning: string;
  }

  export interface User {
    id: string;
    name: string;
    email: string;
    picture?: string;
    password?: string;
  }