
import React, { useState, useEffect, useCallback } from 'react';
import { User, Lead, CallRecord, Sale, CallStatus } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { Logo } from './components/Logo';
import { Loader2 } from 'lucide-react';
import { supabase } from './supabase';

const STORAGE_KEYS = {
  SESSION: 'lp_session_db'
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAllData = useCallback(async () => {
    try {
      const [u, l, c, s] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('leads').select('*').order('createdAt', { ascending: false }),
        supabase.from('calls').select('*').order('timestamp', { ascending: false }),
        supabase.from('sales').select('*').order('created_at', { ascending: false })
      ]);

      if (u.data) setUsers(u.data);
      if (l.data) setLeads(l.data);
      if (c.data) setCalls(c.data);
      if (s.data) setSales(s.data);

      const storedId = localStorage.getItem(STORAGE_KEYS.SESSION);
      if (storedId && u.data) {
        const found = u.data.find(usr => usr.id === storedId);
        if (found) setCurrentUser(found);
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();

    const channel = supabase
      .channel('db-changes-main')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCalls(prev => {
            if (prev.some(c => c.id === payload.new.id)) return prev;
            return [payload.new as CallRecord, ...prev];
          });
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSales(prev => {
            if (prev.some(s => s.id === payload.new.id)) return prev;
            return [payload.new as Sale, ...prev];
          });
        }
        if (payload.eventType === 'UPDATE') setSales(prev => prev.map(s => s.id === payload.new.id ? (payload.new as Sale) : s));
        if (payload.eventType === 'DELETE') setSales(prev => prev.filter(s => s.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setLeads(prev => prev.map(l => l.id === payload.new.id ? (payload.new as Lead) : l));
        }
        if (payload.eventType === 'INSERT') setLeads(prev => [payload.new as Lead, ...prev]);
        if (payload.eventType === 'DELETE') setLeads(prev => prev.filter(l => l.id !== payload.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
        if (payload.eventType === 'UPDATE') setUsers(prev => prev.map(u => u.id === payload.new.id ? (payload.new as User) : u));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchAllData]);

  const handleRegisterSale = async (saleData: Omit<Sale, 'id' | 'created_at'>) => {
    const newSale = { ...saleData, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    setSales(prev => [newSale as Sale, ...prev]); // Instant UI
    await supabase.from('sales').insert([newSale]);
  };

  const handleUpdateSale = async (id: string, amount: number) => {
    setSales(prev => prev.map(s => s.id === id ? { ...s, amount } : s));
    await supabase.from('sales').update({ amount }).eq('id', id);
  };

  const handleDeleteSale = async (id: string) => {
    if (!confirm("Excluir registro de venda definitivamente?")) return;
    setSales(prev => prev.filter(s => s.id !== id));
    await supabase.from('sales').delete().eq('id', id);
  };

  const handleLogCall = async (call: CallRecord) => {
    // ATUALIZAÇÃO OTIMISTA: Remove o lead da fila e adiciona ao histórico instantaneamente
    setLeads(prev => prev.map(l => l.id === call.leadId ? { ...l, status: 'CALLED' } : l));
    setCalls(prev => [call, ...prev]);

    await Promise.all([
      supabase.from('calls').insert([call]),
      supabase.from('leads').update({ status: 'CALLED' }).eq('id', call.leadId)
    ]);
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

  const handleClearSellerLeads = async (userId: string) => {
    const sellerName = users.find(u => u.id === userId)?.nome;
    if (!confirm(`Deseja ZERAR e EXCLUIR todos os leads pendentes de ${sellerName}?`)) return;
    setLeads(prev => prev.filter(l => !(l.assignedTo === userId && l.status === 'PENDING')));
    await supabase.from('leads').delete().eq('assignedTo', userId).eq('status', 'PENDING');
  };

  const handleTransferLeads = async (leadIds: string[], userId: string | null) => {
    setLeads(prev => prev.map(l => leadIds.includes(l.id) ? { ...l, assignedTo: userId } : l));
    await supabase.from('leads').update({ assignedTo: userId }).in('id', leadIds);
  };

  const handleDeleteLeads = async (leadIds: string[]) => {
    if (!confirm(`Excluir ${leadIds.length} lead(s)?`)) return;
    setLeads(prev => prev.filter(l => !leadIds.includes(l.id)));
    await supabase.from('leads').delete().in('id', leadIds);
  };

  const handleToggleUser = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    setUsers(prev => prev.map(u => u.id === id ? { ...u, online: !u.online } : u));
    await supabase.from('users').update({ online: !user.online }).eq('id', id);
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
    setTimeout(() => { setIsRegistering(false); fetchAllData(); }, 1500);
    setIsLoading(false);
  };

  if (isLoading && !email && !currentUser) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-sky-500 w-12 h-12" />
      <span className="text-white/40 text-[10px] font-black uppercase tracking-[0.3em]">Carregando Sistema...</span>
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
          onImportLeads={handleImportLeads} onToggleUserStatus={handleToggleUser} onDeleteUser={() => {}}
          onTransferLeads={handleTransferLeads} onDeleteLeads={handleDeleteLeads}
          onClearSellerLeads={handleClearSellerLeads}
          onUpdateSale={handleUpdateSale}
          onDeleteSale={handleDeleteSale}
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
