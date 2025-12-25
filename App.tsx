
import React, { useState, useEffect, useCallback } from 'react';
import { User, Lead, CallRecord } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { Logo } from './components/Logo';
import { Loader2, RefreshCw, UserPlus, ArrowLeft } from 'lucide-react';
import { supabase } from './supabase';

const STORAGE_KEYS = {
  USERS: 'lp_users_db',
  LEADS: 'lp_leads_db',
  CALLS: 'lp_calls_db',
  SESSION: 'lp_session_db'
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [
        { data: dbUsers },
        { data: dbLeads },
        { data: dbCalls }
      ] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('leads').select('*').order('createdAt', { ascending: false }),
        supabase.from('calls').select('*').order('timestamp', { ascending: false })
      ]);

      if (dbUsers) {
        setUsers(dbUsers);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(dbUsers));
      }
      if (dbLeads) {
        setLeads(dbLeads);
        localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(dbLeads));
      }
      if (dbCalls) {
        setCalls(dbCalls);
        localStorage.setItem(STORAGE_KEYS.CALLS, JSON.stringify(dbCalls));
      }

      const storedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (storedSession && dbUsers) {
        const sessionUser = dbUsers.find((u: User) => u.id === storedSession);
        if (sessionUser) setCurrentUser(sessionUser);
      }
    } catch (err) {
      console.error('Erro ao sincronizar com Supabase:', err);
      const cachedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (cachedUsers) setUsers(JSON.parse(cachedUsers));
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    syncData();
  }, [syncData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const { data: user, error: loginError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('password', password)
        .single();

      if (user) {
        setCurrentUser(user);
        localStorage.setItem(STORAGE_KEYS.SESSION, user.id);
        setError('');
      } else {
        setError('E-MAIL OU SENHA INCORRETOS.');
      }
    } catch (err) {
      setError('ERRO DE CONEXÃO COM O SERVIDOR.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .maybeSingle();

      if (existing) {
        setError('ESTE E-MAIL JÁ ESTÁ CADASTRADO.');
        setIsLoading(false);
        return;
      }

      const newUser = {
        id: crypto.randomUUID(),
        nome,
        email: email.toLowerCase().trim(),
        password,
        tipo: 'vendedor',
        online: true
      };

      const { error: regError } = await supabase.from('users').insert([newUser]);

      if (regError) throw regError;

      setSuccess('CADASTRO REALIZADO COM SUCESSO!');
      setTimeout(() => {
        setSuccess('');
        setIsRegistering(false);
        setPassword('');
        syncData();
      }, 2000);
      
    } catch (err) {
      setError('ERRO AO REALIZAR CADASTRO.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setCurrentUser(null);
  };

  const handleLogCall = async (call: CallRecord) => {
    try {
      await supabase.from('calls').insert([call]);
      await supabase.from('leads').update({ status: 'CALLED' }).eq('id', call.leadId);

      const newCalls = [call, ...calls];
      const newLeads = leads.map(l => l.id === call.leadId ? { ...l, status: 'CALLED' as const } : l);
      setCalls(newCalls);
      setLeads(newLeads);
      
      localStorage.setItem(STORAGE_KEYS.CALLS, JSON.stringify(newCalls));
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(newLeads));
    } catch (err) {
      console.error('Erro ao registrar chamada no Supabase:', err);
    }
  };

  const handleImportLeads = async (newLeads: Lead[], target: 'none' | 'online' | string) => {
    const leadsWithData = newLeads.map((l, idx) => ({
      ...l,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      assignedTo: target === 'online' 
        ? users.filter(u => u.tipo === 'vendedor' && u.online)[idx % (users.filter(u => u.tipo === 'vendedor' && u.online).length || 1)]?.id || null
        : (target === 'none' ? null : target)
    }));

    try {
      await supabase.from('leads').insert(leadsWithData);
      const updated = [...leadsWithData, ...leads];
      setLeads(updated);
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(updated));
    } catch (err) {
      console.error('Erro ao importar leads para o Supabase:', err);
    }
  };

  const handleTransferLeads = async (leadIds: string[], userId: string | null) => {
    setIsSyncing(true);
    try {
      await supabase
        .from('leads')
        .update({ assignedTo: userId })
        .in('id', leadIds);

      const updatedLeads = leads.map(l => 
        leadIds.includes(l.id) ? { ...l, assignedTo: userId } : l
      );
      setLeads(updatedLeads);
      localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(updatedLeads));
    } catch (err) {
      console.error('Erro ao transferir leads:', err);
      alert("Erro ao realizar transferência.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleUser = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    const newStatus = !user.online;
    try {
      await supabase.from('users').update({ online: newStatus }).eq('id', id);
      const updated = users.map(u => u.id === id ? { ...u, online: newStatus } : u);
      setUsers(updated);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
    } catch (err) {
      console.error('Erro ao atualizar status do usuário no Supabase:', err);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Remover este usuário definitivamente?")) return;
    try {
      await supabase.from('users').delete().eq('id', id);
      const updated = users.filter(u => u.id !== id);
      setUsers(updated);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
    } catch (err) {
      console.error('Erro ao excluir usuário no Supabase:', err);
    }
  };

  if (isLoading && !isRegistering && !email) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-sky-500 w-12 h-12" />
      <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">Sincronizando com Banco...</span>
    </div>
  );

  if (!currentUser) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 selection:bg-red-200">
      <div className="w-full max-w-sm bg-white p-10 sm:p-14 rounded-[3.5rem] shadow-2xl flex flex-col items-center border border-white/10 relative overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-sky-600 to-red-600"></div>
        <Logo size={90} />
        <h1 className="text-3xl font-black text-center mt-6 mb-10 italic uppercase tracking-tighter flex gap-2">
          <span className="text-red-600">LIGAÇÕES</span>
          <span className="text-sky-600">PORTAL</span>
        </h1>
        
        {error && (
          <div className="w-full animate-in zoom-in-95 duration-200">
            <p className="text-red-600 text-[11px] font-black uppercase mb-6 bg-red-50 w-full py-4 rounded-3xl text-center border-2 border-red-100">
              {error}
            </p>
          </div>
        )}

        {success && (
          <div className="w-full animate-in zoom-in-95 duration-200">
            <p className="text-emerald-600 text-[11px] font-black uppercase mb-6 bg-emerald-50 w-full py-4 rounded-3xl text-center border-2 border-emerald-100">
              {success}
            </p>
          </div>
        )}

        {isRegistering ? (
          <form onSubmit={handleRegister} className="space-y-4 w-full animate-in slide-in-from-right-4 duration-300">
             <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-5">Nome Completo</label>
              <input 
                type="text" 
                placeholder="Ex: João Silva" 
                value={nome} 
                onChange={e => setNome(e.target.value)} 
                className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-sky-600 focus:bg-white font-bold transition-all text-center placeholder:text-gray-300" 
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-5">E-mail Corporativo</label>
              <input 
                type="email" 
                placeholder="seu@portal.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-sky-600 focus:bg-white font-bold transition-all text-center placeholder:text-gray-300" 
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-5">Criar Senha</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-sky-600 focus:bg-white font-bold transition-all text-center placeholder:text-gray-300" 
                required 
              />
            </div>
            <button disabled={isLoading} className="w-full bg-sky-600 text-white py-6 rounded-3xl font-black uppercase italic shadow-xl shadow-sky-100 hover:bg-sky-700 hover:shadow-2xl transition-all active:scale-95 mt-4 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <><UserPlus className="w-5 h-5" /> Finalizar Cadastro</>}
            </button>
            <button 
              type="button"
              onClick={() => { setIsRegistering(false); setError(''); }}
              className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2 pt-2 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" /> Voltar para o Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4 w-full animate-in slide-in-from-left-4 duration-300">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-5">E-mail Corporativo</label>
              <input 
                type="email" 
                placeholder="seu@portal.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-sky-600 focus:bg-white font-bold transition-all text-center placeholder:text-gray-300" 
                required 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase ml-5">Senha de Acesso</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-sky-600 focus:bg-white font-bold transition-all text-center placeholder:text-gray-300" 
                required 
              />
            </div>
            <button disabled={isLoading} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase italic shadow-xl shadow-red-100 hover:bg-red-700 hover:shadow-2xl transition-all active:scale-95 mt-4 flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : 'LOGIN'}
            </button>
            <button 
              type="button"
              onClick={() => { setIsRegistering(true); setError(''); }}
              className="w-full py-5 border-2 border-gray-100 text-gray-500 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> Cadastrar Vendedor
            </button>
          </form>
        )}
        
        <p className="mt-8 text-[9px] font-bold text-gray-400 uppercase tracking-widest text-center opacity-60">
          Infraestrutura Supabase • V.9.0-AUTH
        </p>
      </div>
    </div>
  );

  return (
    <Layout user={currentUser} onLogout={handleLogout}>
      <div className="fixed bottom-8 right-8 z-[60]">
        <button 
          onClick={syncData} 
          className={`group p-5 bg-white shadow-2xl rounded-full text-sky-600 border-2 border-sky-50 hover:border-sky-200 hover:scale-110 active:scale-90 transition-all ${isSyncing ? 'animate-spin' : ''}`}
          title="Sincronizar Cloud"
        >
          <RefreshCw className={`w-6 h-6 transition-transform ${isSyncing ? '' : 'group-hover:rotate-180 duration-500'}`} />
        </button>
      </div>
      {currentUser.tipo === 'adm' ? (
        <AdminView 
          users={users} 
          leads={leads} 
          calls={calls} 
          onImportLeads={handleImportLeads} 
          onToggleUserStatus={handleToggleUser} 
          onDeleteUser={handleDeleteUser}
          onTransferLeads={handleTransferLeads}
        />
      ) : (
        <SellerView user={currentUser} leads={leads} calls={calls} onLogCall={handleLogCall} />
      )}
    </Layout>
  );
};

export default App;
