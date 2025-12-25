
export enum CallStatus {
  ANSWERED = 'ANSWERED',
  NO_ANSWER = 'NO_ANSWER',
  INVALID_NUMBER = 'INVALID_NUMBER'
}

export interface User {
  id: string;
  nome: string;
  email: string;
  password?: string;
  tipo: 'adm' | 'vendedor';
  online: boolean;
}

export interface Lead {
  id: string;
  nome: string;
  telefone: string;
  base: string;
  assignedTo: string | null;
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
}
