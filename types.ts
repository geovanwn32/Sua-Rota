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
  
  export interface Destination {
    id: string;
    cep: string;
    address: AddressData;
    status: RouteStatus;
    order: number; // For optimized sorting
    notes?: string;
    travelDistance?: number; // em metros (driving distance)
    travelDuration?: number; // em segundos (driving time)
    geometry?: any; // GeoJSON geometry for the route leg to this destination
  }
  
  export interface OptimizationResult {
    sortedIds: string[];
    reasoning: string;
  }

  export interface User {
    id: string;
    name: string;
    email: string;
    picture?: string;
    password?: string; // In a real app, this would be hashed. Storing raw for local demo.
  }