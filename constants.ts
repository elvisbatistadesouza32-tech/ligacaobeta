
import { User, Lead } from './types';

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    nome: 'Admin Principal',
    email: 'admin@callmaster.com',
    tipo: 'adm',
    online: true,
    avatar: 'https://picsum.photos/seed/admin/100'
  }
];

export const INITIAL_LEADS: Lead[] = [
  {
    id: 'l1',
    nome: 'Carlos Oliveira',
    phone: '11999887766',
    concurso: 'Mega Sena',
    status: 'PENDING',
    createdAt: new Date().toISOString()
  }
];
