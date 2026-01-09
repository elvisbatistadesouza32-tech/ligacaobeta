
import React, { useState, useEffect, useCallback } from 'react';
import { User, Lead, CallRecord, Sale } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { Logo } from './components/Logo';
import { Loader2, RefreshCw } from 'lucide-react';
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
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(tableName === 'calls' || tableName === 'sales' ? 'created_at' : 'createdAt', { ascending: false })
      .limit(5000); // Limite razoável para performance inicial
    return data || [];
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

      if (dbUsers) setUsers(dbUsers);
      if (dbLeads) setLeads(dbLeads);
      if (dbCalls) setCalls(dbCalls);
      if (dbSales) setSales(dbSales);

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

  // REALTIME SUBSCRIPTION
  useEffect(() => {
    syncData();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, (payload) => {
        if (payload.eventType === 'INSERT') setCalls(prev => [payload.new as CallRecord, ...prev]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
        if (payload.eventType === 'INSERT') setSales(prev => [payload.new as Sale, ...prev]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'INSERT') setLeads(prev => [payload.new as Lead, ...prev]);
        if (payload.eventType === 'UPDATE') setLeads(prev => prev.map(l => l.id === payload.new.id ? (payload.new as Lead) : l));
        if (payload.eventType === 'DELETE') setLeads(prev => prev.filter(l => l.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [syncData]);

  const handleRegisterSale = async (saleData: Omit<Sale, 'id' | 'created_at'>) => {
    const newSale = { ...saleData, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    await supabase.from('sales').insert([newSale]);
    // O realtime cuidará do estado
  };

  const handleLogCall = async (call: CallRecord) => {
    await Promise.all([
      supabase.from('calls').insert([call]),
      supabase.from('leads').update({ status: 'CALLED' }).eq('id', call.leadId)
    ]);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    const { data: user } = await supabase.from('users').select('*').eq('email', email.toLowerCase().trim()).eq('password', password).single();
    if (user) {
      setCurrentUser(user);
      localStorage.setItem(STORAGE_KEYS.SESSION, user.id);
    } else {
      setError('E-MAIL OU SENHA INCORRETOS.');
    }
    setIsLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const newUser = { id: crypto.randomUUID(), nome, email: email.toLowerCase().trim(), password, tipo: 'vendedor', online: true };
    await supabase.from('users').insert([newUser]);
    setSuccess('CADASTRO REALIZADO!');
    setTimeout(() => { setIsRegistering(false); syncData(); }, 1500);
    setIsLoading(false);
  };

  const handleImportLeads = async (newLeads: Lead[], target: 'none' | 'online' | string) => {
    const sellersOnline = users.filter(u => u.tipo === 'vendedor' && u.online);
    const leadsWithData = newLeads.map((l, idx) => ({
      ...l,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      assignedTo: target === 'online' 
        ? (sellersOnline[idx % (sellersOnline.length || 1)]?.id || null)
        : (target === 'none' ? null : target)
    }));
    await supabase.from('leads').insert(leadsWithData);
  };

  const handleTransferLeads = async (leadIds: string[], userId: string | null) => {
    await supabase.from('leads').update({ assignedTo: userId }).in('id', leadIds);
  };

  const handleDeleteLeads = async (leadIds: string[]) => {
    if (!confirm(`Excluir ${leadIds.length} lead(s)?`)) return;
    await supabase.from('leads').delete().in('id', leadIds);
  };

  const handleToggleUser = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    await supabase.from('users').update({ online: !user.online }).eq('id', id);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, online: !u.online } : u));
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Remover usuário?")) return;
    await supabase.from('users').delete().eq('id', id);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  if (isLoading && !isRegistering && !email) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-sky-500 w-12 h-12" />
      <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">Conectando Portal...</span>
    </div>
  );

  if (!currentUser) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white p-14 rounded-[3.5rem] shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-300">
        <Logo size={90} />
        <h1 className="text-3xl font-black text-center mt-6 mb-10 italic uppercase tracking-tighter flex gap-2">
          <span className="text-red-600">LIGAÇÕES</span>
          <span className="text-sky-600">PORTAL</span>
        </h1>
        {error && <p className="text-red-600 text-[11px] font-black uppercase mb-6 bg-red-50 w-full py-4 rounded-3xl text-center border-2 border-red-100">{error}</p>}
        {success && <p className="text-emerald-600 text-[11px] font-black uppercase mb-6 bg-emerald-50 w-full py-4 rounded-3xl text-center border-2 border-emerald-100">{success}</p>}

        {isRegistering ? (
          <form onSubmit={handleRegister} className="space-y-4 w-full">
            <input type="text" placeholder="NOME" value={nome} onChange={e => setNome(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center uppercase" required />
            <input type="email" placeholder="EMAIL" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center" required />
            <input type="password" placeholder="SENHA" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center" required />
            <button disabled={isLoading} className="w-full bg-sky-600 text-white py-6 rounded-3xl font-black uppercase italic">Cadastrar</button>
            <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest pt-2">Voltar</button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4 w-full">
            <input type="email" placeholder="E-MAIL" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center" required />
            <input type="password" placeholder="SENHA" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center" required />
            <button disabled={isLoading} className="w-full bg-red-600 text-white py-6 rounded-3xl font-black uppercase italic shadow-xl shadow-red-100">ENTRAR</button>
            <button type="button" onClick={() => setIsRegistering(true)} className="w-full py-5 border-2 border-gray-100 text-gray-500 rounded-3xl font-black uppercase text-[10px] tracking-widest">Novo Vendedor</button>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <Layout user={currentUser} onLogout={() => { localStorage.removeItem(STORAGE_KEYS.SESSION); setCurrentUser(null); }}>
      {currentUser.tipo === 'adm' ? (
        <AdminView 
          users={users} leads={leads} calls={calls} sales={sales}
          onImportLeads={handleImportLeads} onToggleUserStatus={handleToggleUser} onDeleteUser={handleDeleteUser}
          onTransferLeads={handleTransferLeads} onDeleteLeads={handleDeleteLeads}
        />
      ) : (
        <SellerView 
          user={currentUser} leads={leads} calls={calls} sales={sales}
          onLogCall={handleLogCall} onRegisterSale={handleRegisterSale}
        />
      )}
    </Layout>
  );
};

export default App;
