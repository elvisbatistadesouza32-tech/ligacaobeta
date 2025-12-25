
import React, { useState, useEffect, useCallback } from 'react';
import { User, Lead, CallRecord } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from './supabase';

const MASTER_ADMIN_EMAIL = "admin@callmaster.com";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const [userData, leadData, callData] = await Promise.all([
        supabase.from('usuarios').select('*').order('nome'),
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('calls').select('*').order('timestamp', { ascending: false })
      ]);

      if (userData.data) {
        setUsers(userData.data.map((u: any) => ({
          id: u.id,
          nome: u.nome || 'Operador',
          email: u.email || '',
          tipo: String(u.tipo || 'vendedor').toLowerCase().includes('adm') ? 'adm' : 'vendedor',
          online: !!u.online,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nome || 'User')}&background=random`
        })));
      }

      if (leadData.data) {
        setLeads(leadData.data.map((l: any) => ({
          id: l.id,
          nome: l.nome,
          telefone: l.telefone,
          concurso: l.concurso,
          // Correção 1: Normalização agressiva de strings vazias para null
          assignedTo: (l.assigned_to === "" || l.assigned_to === null || l.assigned_to === undefined) ? null : String(l.assigned_to),
          status: l.status || 'PENDING',
          createdAt: l.created_at
        })));
      }

      if (callData.data) {
        setCalls(callData.data.map((c: any) => ({
          id: c.id,
          leadId: c.lead_id,
          sellerId: c.seller_id,
          status: c.status,
          durationSeconds: c.duration_seconds,
          timestamp: c.timestamp
        })));
      }
    } catch (err: any) {
      console.error("Erro na sincronização:", err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const restoreSession = useCallback(async (isFirstLoad = false) => {
    if (isFirstLoad) setIsInitialLoading(true);
    try {
      const masterSession = localStorage.getItem('cm_master_session');
      if (masterSession === 'active') {
        setCurrentUser({ id: '00000000-0000-0000-0000-000000000000', nome: 'Admin Gestor', email: MASTER_ADMIN_EMAIL, tipo: 'adm', online: true });
        await fetchData();
        return;
      }

      // FIX: Handle cross-version Supabase session retrieval (v1 session() vs v2 getSession())
      const auth = supabase.auth as any;
      const sessionResult = auth.getSession ? await auth.getSession() : { data: { session: auth.session() } };
      const session = sessionResult?.data?.session || (sessionResult as any);

      if (session?.user) {
        const userEmail = session.user.email?.toLowerCase().trim();
        const { data: profile } = await supabase.from('usuarios').select('*').eq('email', userEmail).maybeSingle();

        if (profile) {
          setCurrentUser({
            id: profile.id,
            nome: profile.nome || 'Operador',
            email: profile.email || '',
            tipo: String(profile.tipo || 'vendedor').toLowerCase().includes('adm') ? 'adm' : 'vendedor',
            online: true
          });
          await supabase.from('usuarios').update({ online: true }).eq('id', profile.id);
        } else {
          // FIX: Call signOut using type bypass to resolve environment-specific property errors
          await (supabase.auth as any).signOut();
          setCurrentUser(null);
        }
        await fetchData();
      }
    } catch (err) {
      console.error("Erro na restauração:", err);
    } finally {
      if (isFirstLoad) setIsInitialLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    restoreSession(true);
  }, [restoreSession]);

  const handleLogCall = async (call: CallRecord) => {
    const { error: callError } = await supabase.from('calls').insert([{ 
      lead_id: call.leadId, 
      seller_id: call.sellerId, 
      status: call.status, 
      duration_seconds: call.durationSeconds 
    }]);
    if (!callError) {
      await supabase.from('leads').update({ status: 'CALLED' }).eq('id', call.leadId);
    }
  };

  const handleImportLeads = async (newLeads: Lead[], distributionMode: string) => {
    const allSellers = users.filter(u => u.tipo === 'vendedor');
    const leadsToInsert = newLeads.map((l, i) => {
      let assignedTo: any = null;
      if (distributionMode === 'balanced' && allSellers.length > 0) {
        assignedTo = allSellers[i % allSellers.length].id;
      } else if (distributionMode !== 'none' && distributionMode.length > 5) {
        assignedTo = distributionMode;
      }
      return {
        nome: l.nome,
        concurso: l.concurso || 'Geral',
        telefone: l.telefone.replace(/\D/g, ''),
        status: 'PENDING',
        assigned_to: assignedTo || null
      };
    });
    const { error } = await supabase.from('leads').insert(leadsToInsert);
    if (error) throw error;
  };

  // Correção 2: Distribuição Robusta com tratamento de lote e strings vazias
  const handleDistributeLeads = async () => {
    let targetSellers = users.filter(u => u.tipo === 'vendedor' && u.online);
    if (targetSellers.length === 0) {
      targetSellers = users.filter(u => u.tipo === 'vendedor');
    }

    if (targetSellers.length === 0) {
      return alert("Não há vendedores cadastrados no sistema para receber leads.");
    }
    
    // Busca leads que estão realmente sem dono (null ou string vazia)
    const { data: unassigned, error: fetchError } = await supabase
      .from('leads')
      .select('id')
      .or('assigned_to.is.null,assigned_to.eq.""')
      .eq('status', 'PENDING');
    
    if (fetchError || !unassigned || unassigned.length === 0) {
      return alert("Não foram encontrados leads pendentes na Fila Geral.");
    }
    
    setIsSyncing(true);
    try {
      // Processamento sequencial em pequenos lotes para evitar erros de conexão
      const batchSize = 20;
      for (let i = 0; i < unassigned.length; i += batchSize) {
        const batch = unassigned.slice(i, i + batchSize);
        await Promise.all(batch.map((lead, index) => {
          const sellerIndex = (i + index) % targetSellers.length;
          const seller = targetSellers[sellerIndex];
          return supabase.from('leads')
            .update({ assigned_to: seller.id })
            .eq('id', lead.id);
        }));
      }
      
      alert(`${unassigned.length} leads foram distribuídos com sucesso!`);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro durante a distribuição. Alguns leads podem não ter sido atribuídos.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    await supabase.from('usuarios').update({ online: !user.online }).eq('id', userId);
  };

  const handlePromoteUser = async (userId: string) => {
    await supabase.from('usuarios').update({ tipo: 'adm' }).eq('id', userId);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Excluir usuário permanentemente?")) return;
    await supabase.from('usuarios').delete().eq('id', userId);
  };

  const handleTransferLeads = async (fromUserId: string, toUserId: string) => {
    if (!toUserId) return;
    const { error } = await supabase.from('leads')
      .update({ assigned_to: toUserId })
      .eq('assigned_to', fromUserId)
      .eq('status', 'PENDING');
    
    if (!error) {
      alert("Fila transferida!");
      await fetchData();
    }
  };

  if (isInitialLoading) return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white font-sans">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mb-4" />
      <p className="font-black uppercase italic tracking-widest text-[10px]">Verificando Credenciais...</p>
    </div>
  );

  if (!currentUser) return (
    <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-6 text-white font-sans">
      <form onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
          // FIX: Provide compatibility for v1 (signIn) and v2 (signInWithPassword) Supabase auth methods
          const auth = supabase.auth as any;
          const { error: signInError } = auth.signInWithPassword 
            ? await auth.signInWithPassword({ email, password }) 
            : await auth.signIn({ email, password });
            
          if (signInError) throw signInError;
          await restoreSession(false);
        } catch (err: any) { setError(err.message); }
        finally { setIsSubmitting(false); }
      }} className="w-full max-w-md bg-white text-gray-900 p-10 rounded-[3rem] shadow-2xl">
        <h1 className="text-2xl font-black text-center mb-8 uppercase italic tracking-tighter">CallMaster <span className="text-indigo-600">Pro</span></h1>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[10px] font-black uppercase mb-4 text-center border-2 border-red-100">{error}</div>}
        <div className="space-y-4">
          <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold outline-none focus:border-indigo-600" />
          <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold outline-none focus:border-indigo-600" />
        </div>
        <button disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all mt-6 shadow-xl shadow-indigo-100">
          {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Entrar Agora'}
        </button>
      </form>
    </div>
  );

  return (
    <Layout user={currentUser} onLogout={async () => { 
      // FIX: Call signOut using type bypass to resolve environment-specific property errors
      await (supabase.auth as any).signOut(); 
      localStorage.removeItem('cm_master_session'); 
      setCurrentUser(null); 
    }}>
      <div className="fixed top-20 right-8 z-[60]">
        <button onClick={fetchData} disabled={isSyncing} className={`p-4 bg-white shadow-xl rounded-full text-indigo-600 hover:bg-indigo-50 transition-all border-2 border-indigo-100 ${isSyncing ? 'animate-spin' : ''}`}>
          <RefreshCw className="w-6 h-6" />
        </button>
      </div>

      {currentUser.tipo === 'adm' ? (
        <AdminView 
          users={users} 
          leads={leads} 
          calls={calls}
          onImportLeads={handleImportLeads}
          onDistributeLeads={handleDistributeLeads}
          onToggleUserStatus={handleToggleUserStatus}
          onPromoteUser={handlePromoteUser}
          onDeleteUser={handleDeleteUser}
          onTransferLeads={handleTransferLeads}
        />
      ) : (
        <SellerView user={currentUser} leads={leads} onLogCall={handleLogCall} />
      )}
    </Layout>
  );
};

export default App;
