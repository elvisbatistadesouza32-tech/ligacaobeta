
import React from 'react';
import { User, UserRole, UserStatus } from '../types';
import { LogOut, Phone, Users, BarChart2, ShieldCheck, User as UserIcon } from 'lucide-react';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-indigo-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white p-1.5 rounded-lg shadow-inner">
              <Phone className="w-6 h-6 text-indigo-600" />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">CallMaster Pro</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
              <span className="text-sm font-medium">{user.name}</span>
              <div className="flex items-center gap-1.5">
                 <span className={`w-2 h-2 rounded-full ${user.status === UserStatus.ONLINE ? 'bg-green-400' : 'bg-gray-400'}`}></span>
                 <span className="text-[10px] uppercase opacity-80">{user.role}</span>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="p-2 hover:bg-indigo-500 rounded-full transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      <footer className="bg-white border-t py-4 text-center text-gray-500 text-xs mt-auto">
        &copy; 2024 CallMaster Pro - Gestão Comercial Inteligente
      </footer>
    </div>
  );
};
