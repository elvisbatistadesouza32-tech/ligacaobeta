
export enum UserRole {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER'
}

export enum UserStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE'
}

export enum CallStatus {
  ANSWERED = 'ANSWERED',
  NO_ANSWER = 'NO_ANSWER',
  INVALID_NUMBER = 'INVALID_NUMBER'
}

export interface User {
  id: string;
  nome: string; // Alterado de 'name' para 'nome'
  email: string;
  tipo: 'adm' | 'vendedor'; // Alterado de 'role' para 'tipo'
  online: boolean; // Alterado de 'status' para 'online'
  avatar?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  contest?: string;
  assignedTo?: string; // User ID
  status: 'PENDING' | 'CALLED';
  createdAt: string;
}

export interface CallRecord {
  id: string;
  leadId: string;
  sellerId: string;
  status: CallStatus;
  durationSeconds: number;
  timestamp: string;
  recordingUrl?: string;
}
