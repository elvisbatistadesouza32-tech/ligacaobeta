
import { User, UserRole, UserStatus, Lead } from './types';

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: 'Admin Principal',
    email: 'admin@callmaster.com',
    role: UserRole.ADMIN,
    status: UserStatus.ONLINE,
    avatar: 'https://picsum.photos/seed/admin/100'
  },
  {
    id: 'u2',
    name: 'João Vendedor',
    email: 'joao@callmaster.com',
    role: UserRole.SELLER,
    status: UserStatus.ONLINE,
    avatar: 'https://picsum.photos/seed/joao/100'
  },
  {
    id: 'u3',
    name: 'Maria Vendas',
    email: 'maria@callmaster.com',
    role: UserRole.SELLER,
    status: UserStatus.OFFLINE,
    avatar: 'https://picsum.photos/seed/maria/100'
  }
];

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'l1',
    name: 'Carlos Oliveira',
    phone: '11999887766',
    contest: 'Mega Sena',
    assignedTo: 'u2',
    status: 'PENDING',
    createdAt: new Date().toISOString()
  },
  {
    id: 'l2',
    name: 'Ana Souza',
    phone: '21988776655',
    contest: 'Lotofácil',
    assignedTo: 'u2',
    status: 'PENDING',
    createdAt: new Date().toISOString()
  }
];
