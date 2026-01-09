
import React, { useState, useEffect, useCallback } from 'react';
import { User, Lead, CallRecord, Sale } from './types';
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
  SALES: 'lp_sales_db',
  SESSION: 'lp_session_db'
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAllFromTable = async (tableName: string) => {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, from + step - 1)
        .order(tableName === 'calls' || tableName === 'sales' ? 'created_at' : 'createdAt', { ascending: false });

      if (error) break;
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < step) hasMore = false;
        else from += step;
      } else {
        hasMore = false;
      }
      if (from > 50000) break; 
    }
    return allData;
  };

  const syncData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data: dbUsers } = await supabase.from('users').select('*');
      const [dbLeads, dbCalls, dbSales] = await Promise.all([
        fetchAllFromTable('leads'),
        fetchAllFromTable('calls'),
        fetchAllFromTable('sales')
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
      if (dbSales) {
        setSales(dbSales);
        localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(dbSales));
      }

      const storedSession = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (storedSession && dbUsers) {
        const sessionUser = dbUsers.find((u: User) => u.id === storedSession);
        if (sessionUser) setCurrentUser(sessionUser);
      }
    } catch (err) {
      console.error('Erro sincronização:', err);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const handleRegisterSale = async (saleData: Omit<Sale, 'id' | 'created_at'>) => {
    const newSale = {
      ...saleData,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    
    try {
      await supabase.from('sales').insert([newSale]);
      setSales(prev => [newSale, ...prev]);
    } catch (err) {
      console.error('Erro ao registrar venda:', err);
      throw err;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { data: user } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('password', password)
        .single();

      if (user) {
        setCurrentUser(user);
        localStorage.setItem(STORAGE_KEYS.SESSION, user.id);
      } else {
        setError('E-MAIL OU SENHA INCORRETOS.');
      }
    } catch (err) {
      setError('ERRO DE CONEXÃO.');
    } finally { setIsLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const newUser = {
        id: crypto.randomUUID(),
        nome,
        email: email.toLowerCase().trim(),
        password,
        tipo: 'vendedor',
        online: true
      };
      await supabase.from('users').insert([newUser]);
      setSuccess('CADASTRO REALIZADO!');
      setTimeout(() => { setIsRegistering(false); syncData(); }, 2000);
    } catch (err) { setError('ERRO AO CADASTRAR.'); }
    finally { setIsLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    setCurrentUser(null);
  };

  const handleLogCall = async (call: CallRecord) => {
    setLeads(prev => prev.map(l => l.id === call.leadId ? { ...l, status: 'CALLED' as const } : l));
    setCalls(prev => [call, ...prev]);
    try {
      await Promise.all([
        supabase.from('calls').insert([call]),
        supabase.from('leads').update({ status: 'CALLED' }).eq('id', call.leadId)
      ]);
    } catch (err) { console.error('Erro call:', err); }
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
      setLeads(prev => [...leadsWithData, ...prev]);
    } catch (err) { console.error('Erro import:', err); }
  };

  const handleTransferLeads = async (leadIds: string[], userId: string | null) => {
    setIsSyncing(true);
    try {
      await supabase.from('leads').update({ assignedTo: userId }).in('id', leadIds);
      setLeads(prev => prev.map(l => leadIds.includes(l.id) ? { ...l, assignedTo: userId } : l));
    } finally { setIsSyncing(false); }
  };

  const handleDeleteLeads = async (leadIds: string[]) => {
    if (!confirm(`Excluir ${leadIds.length} lead(s)?`)) return;
    setIsSyncing(true);
    try {
      await supabase.from('leads').delete().in('id', leadIds);
      setLeads(prev => prev.filter(l => !leadIds.includes(l.id)));
    } finally { setIsSyncing(false); }
  };

  const handleToggleUser = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    const newStatus = !user.online;
    await supabase.from('users').update({ online: newStatus }).eq('id', id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, online: newStatus } : u));
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Remover usuário?")) return;
    await supabase.from('users').delete().eq('id', id);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  if (isLoading && !isRegistering && !email) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-sky-500 w-12 h-12" />
      <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">Carregando Sistema...</span>
    </div>
  );

  if (!currentUser) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white p-10 sm:p-14 rounded-[3.5rem] shadow-2xl flex flex-col items-center border border-white/10 relative overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 via-sky-600 to-red-600"></div>
        <Logo size={90} />
        <h1 className="text-3xl font-black text-center mt-6 mb-10 italic uppercase tracking-tighter flex gap-2">
          <span className="text-red-600">LIGAÇÕES</span>
          <span className="text-sky-600">PORTAL</span>
        </h1>
        {error && <p className="text-red-600 text-[11px] font-black uppercase mb-6 bg-red-50 w-full py-4 rounded-3xl text-center border-2 border-red-100">{error}</p>}
        {success && <p className="text-emerald-600 text-[11px] font-black uppercase mb-6 bg-emerald-50 w-full py-4 rounded-3xl text-center border-2 border-emerald-100">{success}</p>}

        {isRegistering ? (
          <form onSubmit={handleRegister} className="space-y-4 w-full">
            <input type="text" placeholder="Nome Completo" value={nome} onChange={e => setNome(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center" required />
            <input type="email" placeholder="seu@portal.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center" required />
            <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center" required />
            <button disabled={isLoading} className="w-full bg-sky-600 text-white py-6 rounded-3xl font-black uppercase italic shadow-xl shadow-sky-100 hover:bg-sky-700 transition-all">Finalizar Cadastro</button>
            <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2">Voltar para o Login</button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4 w-full">
            <input type="email" placeholder="seu@portal.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center" required />
            <input type="password" placeholder="Sua Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center" required />
            <button disabled={isLoading} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase italic shadow-xl shadow-red-100 hover:bg-red-700 transition-all">LOGIN</button>
            <button type="button" onClick={() => setIsRegistering(true)} className="w-full py-5 border-2 border-gray-100 text-gray-500 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-gray-50 transition-all">Cadastrar Vendedor</button>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <Layout user={currentUser} onLogout={handleLogout}>
      <div className="fixed bottom-8 right-8 z-[60] flex flex-col gap-4">
        <button 
          onClick={syncData} 
          disabled={isSyncing}
          className={`p-5 bg-white shadow-2xl rounded-full text-sky-600 border-2 border-sky-50 hover:border-sky-200 transition-all ${isSyncing ? 'animate-spin' : ''}`}
        >
          <RefreshCw className="w-6 h-6" />
        </button>
      </div>
      {currentUser.tipo === 'adm' ? (
        <AdminView 
          users={users} 
          leads={leads} 
          calls={calls} 
          sales={sales}
          onImportLeads={handleImportLeads} 
          onToggleUserStatus={handleToggleUser} 
          onDeleteUser={handleDeleteUser}
          onTransferLeads={handleTransferLeads}
          onDeleteLeads={handleDeleteLeads}
        />
      ) : (
        <SellerView 
          user={currentUser} 
          leads={leads} 
          calls={calls} 
          sales={sales}
          onLogCall={handleLogCall} 
          onRegisterSale={handleRegisterSale}
        />
      )}
    </Layout>
  );
};

export default App;
