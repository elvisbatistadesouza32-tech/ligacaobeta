
export enum CallStatus {
  ANSWERED = 'ANSWERED',
  NO_ANSWER = 'NO_ANSWER',
  INVALID_NUMBER = 'INVALID_NUMBER'
}

export type SaleChannel = 'call' | 'whatsapp';

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

export interface Sale {
  id: string;
  seller_id: string;
  customer_name: string;
  amount: number;
  canal: SaleChannel;
  created_at: string;
}
