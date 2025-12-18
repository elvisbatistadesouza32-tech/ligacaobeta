
import React, { useState, useEffect } from 'react';
import { User, Lead, CallRecord, UserRole, UserStatus } from './types';
import { INITIAL_USERS, INITIAL_LEADS } from './constants';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { ShieldCheck, User as UserIcon, LogIn } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [calls, setCalls] = useState<CallRecord[]>([]);

  // Simple Login logic for demo
  const handleLogin = (role: UserRole) => {
    const user = users.find(u => u.role === role);
    if (user) setCurrentUser(user);
  };

  const handleLogout = () => setCurrentUser(null);

  const handleLogCall = (call: CallRecord) => {
    setCalls(prev => [...prev, call]);
    setLeads(prev => prev.map(l => l.id === call.leadId ? { ...l, status: 'CALLED' } : l));
  };

  const handleImportLeads = (newLeads: Lead[]) => {
    setLeads(prev => [...prev, ...newLeads]);
  };

  const handleDistributeLeads = () => {
    const onlineSellers = users.filter(u => u.status === UserStatus.ONLINE && u.role === UserRole.SELLER);
    if (onlineSellers.length === 0) {
      alert("Nenhum vendedor online para receber leads!");
      return;
    }

    const pendingLeads = leads.filter(l => !l.assignedTo);
    const updatedLeads = [...leads];

    pendingLeads.forEach((lead, index) => {
      const seller = onlineSellers[index % onlineSellers.length];
      const leadIndex = updatedLeads.findIndex(l => l.id === lead.id);
      if (leadIndex !== -1) {
        updatedLeads[leadIndex].assignedTo = seller.id;
      }
    });

    setLeads(updatedLeads);
    alert(`${pendingLeads.length} leads distribuídos entre ${onlineSellers.length} vendedores.`);
  };

  const toggleUserStatus = (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === UserStatus.ONLINE ? UserStatus.OFFLINE : UserStatus.ONLINE } : u));
  };

  const promoteUser = (userId: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: UserRole.ADMIN } : u));
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-indigo-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-8">
          <div className="text-center">
            <div className="bg-indigo-100 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-10 h-10 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900">CallMaster Pro</h1>
            <p className="text-gray-500 mt-2">Selecione o acesso para demonstração</p>
          </div>

          <div className="grid gap-4">
            <button 
              onClick={() => handleLogin(UserRole.ADMIN)}
              className="group flex items-center justify-between w-full p-4 bg-gray-50 border-2 border-transparent hover:border-indigo-600 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-3 rounded-xl text-white">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800">Administrador</p>
                  <p className="text-sm text-gray-500">Gestão e Dashboards</p>
                </div>
              </div>
              <LogIn className="w-5 h-5 text-gray-300 group-hover:text-indigo-600" />
            </button>

            <button 
              onClick={() => handleLogin(UserRole.SELLER)}
              className="group flex items-center justify-between w-full p-4 bg-gray-50 border-2 border-transparent hover:border-indigo-600 rounded-2xl transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="bg-green-600 p-3 rounded-xl text-white">
                  <UserIcon className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800">Vendedor</p>
                  <p className="text-sm text-gray-500">Operacional de Leads</p>
                </div>
              </div>
              <LogIn className="w-5 h-5 text-gray-300 group-hover:text-indigo-600" />
            </button>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-400">Ambiente de Demonstração - v1.0.0</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser} onLogout={handleLogout}>
      {currentUser.role === UserRole.ADMIN ? (
        <AdminView 
          users={users} 
          leads={leads} 
          calls={calls}
          onImportLeads={handleImportLeads}
          onDistributeLeads={handleDistributeLeads}
          onToggleUserStatus={toggleUserStatus}
          onPromoteUser={promoteUser}
        />
      ) : (
        <SellerView 
          user={currentUser} 
          leads={leads} 
          onLogCall={handleLogCall}
        />
      )}
    </Layout>
  );
};

export default App;
