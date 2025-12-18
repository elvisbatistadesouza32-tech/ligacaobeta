
import { User, Lead } from './types';

// Updated INITIAL_USERS to use the new property names from the User interface
export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    nome: 'Admin Principal',
    email: 'admin@callmaster.com',
    tipo: 'adm',
    online: true,
    avatar: 'https://picsum.photos/seed/admin/100'
  },
  {
    id: 'u2',
    nome: 'João Vendedor',
    email: 'joao@callmaster.com',
    tipo: 'vendedor',
    online: true,
    avatar: 'https://picsum.photos/seed/joao/100'
  },
  {
    id: 'u3',
    nome: 'Maria Vendas',
    email: 'maria@callmaster.com',
    tipo: 'vendedor',
    online: false,
    avatar: 'https://picsum.photos/seed/maria/100'
  }
];

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'l1',
    name: 'Carlos Oliveira',
    phone: '11999887766',
    // Fix: Property name changed from 'contest' to 'concurso' to match Lead interface
    concurso: 'Mega Sena',
    assignedTo: 'u2',
    status: 'PENDING',
    createdAt: new Date().toISOString()
  },
  {
    id: 'l2',
    name: 'Ana Souza',
    phone: '21988776655',
    // Fix: Property name changed from 'contest' to 'concurso' to match Lead interface
    concurso: 'Lotofácil',
    assignedTo: 'u2',
    status: 'PENDING',
    createdAt: new Date().toISOString()
  }
];
