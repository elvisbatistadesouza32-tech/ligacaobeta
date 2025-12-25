
import React from 'react';
import { User } from '../types';
import { LogOut } from 'lucide-react';
import { Logo } from './Logo';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50/50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={48} />
            <h1 className="text-2xl font-black tracking-tighter italic flex gap-1 sm:gap-2 select-none">
              <span className="text-red-600">LIGAÇÕES</span>
              <span className="text-sky-600">PORTAL</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black uppercase text-gray-900 leading-none">{user.nome}</p>
              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-widest">{user.tipo === 'adm' ? 'Administrador' : 'Vendedor'}</span>
            </div>
            <button 
              onClick={onLogout} 
              className="p-3 bg-red-50/50 hover:bg-red-50 text-red-500 rounded-2xl transition-all border border-red-100/50 hover:border-red-200"
              title="Sair do sistema"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
        {children}
      </main>
      <footer className="py-8 text-center text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
        &copy; 2024 LIGAÇÕES PORTAL • GESTÃO COMERCIAL DE ALTA PERFORMANCE
      </footer>
    </div>
  );
};
