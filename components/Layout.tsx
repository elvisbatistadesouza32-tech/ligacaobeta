
import React, { useState } from 'react';
import { User } from '../types';
import { LogOut, RefreshCw } from 'lucide-react';
import { Logo } from './Logo';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!user) return null;

  const handleUpdate = () => {
    setIsRefreshing(true);
    // Pequeno delay para feedback visual da animação antes do reload
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

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
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black uppercase text-gray-900 leading-none">{user.nome}</p>
              <span className="text-[10px] font-bold text-sky-600 uppercase tracking-widest">{user.tipo === 'adm' ? 'Administrador' : 'Vendedor'}</span>
            </div>
            
            {/* Botão Atualizar App */}
            <button 
              onClick={handleUpdate}
              disabled={isRefreshing}
              className={`p-3 bg-sky-50/50 hover:bg-sky-50 text-sky-600 rounded-2xl transition-all border border-sky-100/50 hover:border-sky-200 flex items-center gap-2 group active:scale-95 ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Atualizar Aplicativo"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-sky-400' : 'group-hover:rotate-180 transition-transform duration-700'}`} />
              <span className="hidden md:inline text-[10px] font-black uppercase tracking-widest">Atualizar</span>
            </button>

            {/* Botão Sair */}
            <button 
              onClick={onLogout} 
              className="p-3 bg-red-50/50 hover:bg-red-50 text-red-500 rounded-2xl transition-all border border-red-100/50 hover:border-red-200 active:scale-95"
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
      <footer className="py-10 text-center flex flex-col gap-2 opacity-80">
        <div className="text-gray-400 text-[10px] font-bold uppercase tracking-[0.2em]">
          &copy; 2025 LIGAÇÕES PORTAL • GESTÃO COMERCIAL DE ALTA PERFORMANCE
        </div>
        <div className="text-gray-400/60 text-[9px] font-medium tracking-widest">
          Desenvolvido por Elvis Souza
        </div>
      </footer>
    </div>
  );
};
