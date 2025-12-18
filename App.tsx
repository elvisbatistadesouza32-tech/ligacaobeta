
import React, { useState, useEffect } from 'react';
import { User, Lead, CallRecord, UserRole, UserStatus } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { ShieldCheck, LogIn, Loader2, Mail, Lock, UserPlus, ArrowRight, AlertCircle } from 'lucide-react';
import { supabase } from './supabase';

// CONFIGURAÇÃO DE ACESSO MESTRE
const MASTER_ADMIN_EMAIL = "admin@callmaster.com";
const ADMIN_MASTER_PASSWORD = "gestor_master_2024";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const { data: userData, error: userError } = await supabase.from('users').select('*');
      const { data: leadData } = await supabase.from('leads').select('*');
      const { data: callData } = await supabase.from('calls').select('*');

      if (userError) console.warn("Tabela 'users' pode não existir ainda. Execute o SQL no Supabase.");

      if (userData) {
        setUsers(userData.map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          password: u.password,
          role: u.role as UserRole,
          status: u.status as UserStatus,
          avatar: u.avatar
        })));
      }
      
      if (leadData) {
        setLeads(leadData.map((l: any) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          contest: l.contest,
          assignedTo: l.assigned_to,
          status: l.status,
          createdAt: l.created_at
        })));
      }

      if (callData) {
        setCalls(callData.map((c: any) => ({
          id: c.id,
          leadId: c.lead_id,
          sellerId: c.seller_id,
          status: c.status,
          durationSeconds: c.duration_seconds,
          timestamp: c.timestamp,
          recordingUrl: c.recording_url
        })));
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const userSub = supabase.channel('users_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchData()).subscribe();
    const leadSub = supabase.channel('leads_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData()).subscribe();
    const callSub = supabase.channel('calls_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => fetchData()).subscribe();
    return () => {
      supabase.removeChannel(userSub);
      supabase.removeChannel(leadSub);
      supabase.removeChannel(callSub);
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const lowerEmail = email.toLowerCase().trim();

      if (isRegistering) {
        const { error: regError } = await supabase.from('users').insert([{
          name,
          email: lowerEmail,
          password,
          role: UserRole.SELLER,
          status: UserStatus.OFFLINE,
          avatar: `https://picsum.photos/seed/${lowerEmail}/100`
        }]);

        if (regError) throw new Error("Erro ao cadastrar. Verifique se o e-mail já existe.");
        alert("Cadastro realizado! Faça login.");
        setIsRegistering(false);
      } else {
        // BYPASS PARA ADMIN MESTRE
        if (lowerEmail === MASTER_ADMIN_EMAIL && password === ADMIN_MASTER_PASSWORD) {
          const existingAdmin = users.find(u => u.email.toLowerCase() === lowerEmail);
          
          if (existingAdmin) {
            setCurrentUser(existingAdmin);
          } else {
            // Se o admin não existe no banco, cria um objeto temporário para permitir o acesso
            setCurrentUser({
              id: 'master-admin',
              name: 'Administrador Geral',
              email: MASTER_ADMIN_EMAIL,
              role: UserRole.ADMIN,
              status: UserStatus.ONLINE
            });
          }
          return;
        }

        // LOGIN NORMAL (Vendedores ou outros Admins no DB)
        const user = users.find(u => u.email.toLowerCase() === lowerEmail);

        if (!user) {
          throw new Error("Usuário não encontrado. Se você for ADM, use as credenciais mestre.");
        }

        if (user.password !== password) {
          throw new Error("Senha incorreta.");
        }

        setCurrentUser(user);
        if (user.role === UserRole.SELLER) {
          await supabase.from('users').update({ status: UserStatus.ONLINE }).eq('id', user.id);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (currentUser && currentUser.role === UserRole.SELLER && currentUser.id !== 'master-admin') {
      await supabase.from('users').update({ status: UserStatus.OFFLINE }).eq('id', currentUser.id);
    }
    setCurrentUser(null);
    setEmail('');
    setPassword('');
  };

  const handleLogCall = async (call: CallRecord) => {
    try {
      await supabase.from('calls').insert([{
        lead_id: call.leadId,
        seller_id: call.sellerId,
        status: call.status,
        duration_seconds: call.durationSeconds,
        recording_url: call.recordingUrl
      }]);
      await supabase.from('leads').update({ status: 'CALLED' }).eq('id', call.leadId);
      await fetchData();
    } catch (error) { console.error(error); }
  };

  const handleImportLeads = async (newLeads: Lead[]) => {
    try {
      const leadsToInsert = newLeads.map(l => ({ name: l.name, phone: l.phone, contest: l.contest, status: 'PENDING' }));
      await supabase.from('leads').insert(leadsToInsert);
      await fetchData();
    } catch (error) { console.error(error); }
  };

  const handleDistributeLeads = async () => {
    const onlineSellers = users.filter(u => u.status === UserStatus.ONLINE && u.role === UserRole.SELLER);
    if (onlineSellers.length === 0) return alert("Nenhum vendedor online no momento.");
    const unassignedLeads = leads.filter(l => !l.assignedTo && l.status === 'PENDING');
    if (unassignedLeads.length === 0) return alert("Não há leads pendentes para distribuir.");
    
    try {
      for (let i = 0; i < unassignedLeads.length; i++) {
        const lead = unassignedLeads[i];
        const seller = onlineSellers[i % onlineSellers.length];
        await supabase.from('leads').update({ assigned_to: seller.id }).eq('id', lead.id);
      }
      await fetchData();
      alert("Leads distribuídos com sucesso!");
    } catch (error) { console.error(error); }
  };

  const toggleUserStatus = async (userId: string) => {
    if (userId === 'master-admin') return;
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const newStatus = user.status === UserStatus.ONLINE ? UserStatus.OFFLINE : UserStatus.ONLINE;
    await supabase.from('users').update({ status: newStatus }).eq('id', userId);
    await fetchData();
  };

  const promoteUser = async (userId: string) => {
    if (userId === 'master-admin') return;
    await supabase.from('users').update({ role: UserRole.ADMIN }).eq('id', userId);
    await fetchData();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
        <p className="text-indigo-200 font-medium">Conectando ao CallMaster...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-indigo-600 p-8 text-white text-center relative overflow-hidden">
            <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
              <ShieldCheck className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter">CallMaster <span className="text-indigo-200">PRO</span></h1>
            <p className="text-indigo-100 mt-2 font-medium opacity-80">
              {isRegistering ? 'Cadastro de Vendedor' : 'Acesse seu painel'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="p-8 space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 text-sm font-semibold border border-red-100">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            {isRegistering && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Nome Completo</label>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input 
                    type="text" required value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ex: João Silva"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">E-mail Profissional</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="admin@callmaster.com"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-600 focus:bg-white rounded-2xl outline-none transition-all font-medium"
                />
              </div>
            </div>

            <button 
              type="submit" disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                <>
                  {isRegistering ? 'Criar Minha Conta' : 'Entrar Agora'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <div className="pt-2 text-center">
              <button 
                type="button" onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                className="text-indigo-600 font-bold hover:underline text-sm"
              >
                {isRegistering ? 'Já tem conta? Login' : 'Novo por aqui? Cadastre-se'}
              </button>
            </div>
          </form>
        </div>
        <div className="mt-8 flex flex-col items-center gap-2">
          <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-[0.2em]">Status do Sistema</p>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-indigo-200 text-[9px] font-medium">DATABASE ONLINE</span>
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
