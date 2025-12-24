
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
          id: u.id, // MANTÉM O ID ORIGINAL (UUID COM HIFENS)
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
          assignedTo: l.assigned_to, // MANTÉM O VALOR BRUTO DO BANCO
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

  const restoreSession = useCallback(async (isFirstLoad = false) => {
    if (isFirstLoad) setIsInitialLoading(true);
    try {
      const masterSession = localStorage.getItem('cm_master_session');
      if (masterSession === 'active') {
        setCurrentUser({ id: 'master-admin', nome: 'Admin Gestor', email: MASTER_ADMIN_EMAIL, tipo: 'adm', online: true });
        await fetchData();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const userEmail = session.user.email?.toLowerCase().trim();
        const { data: profile } = await supabase.from('usuarios').select('*').eq('email', userEmail).maybeSingle();

        if (profile) {
          setCurrentUser({
            id: profile.id, // ID ORIGINAL DA TABELA USUARIOS
            nome: profile.nome || 'Operador',
            email: profile.email || '',
            tipo: String(profile.tipo || 'vendedor').toLowerCase().includes('adm') ? 'adm' : 'vendedor',
            online: true
          });
          await supabase.from('usuarios').update({ online: true }).eq('id', profile.id);
        } else {
          await supabase.auth.signOut();
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
      await fetchData();
    }
  };

  const handleImportLeads = async (newLeads: Lead[], distributionMode: string) => {
    const activeSellers = users.filter(u => u.tipo === 'vendedor' && u.id !== 'master-admin');
    const leadsToInsert = newLeads.map((l, i) => {
      let assignedTo: any = null;
      if (distributionMode === 'balanced' && activeSellers.length > 0) {
        assignedTo = activeSellers[i % activeSellers.length].id;
      } else if (distributionMode !== 'none') {
        assignedTo = distributionMode;
      }
      return {
        nome: l.nome,
        concurso: l.concurso || 'Geral',
        telefone: l.telefone.replace(/\D/g, ''),
        status: 'PENDING',
        assigned_to: assignedTo
      };
    });
    const { error } = await supabase.from('leads').insert(leadsToInsert);
    if (error) throw error;
    await fetchData();
  };

  const handleDistributeLeads = async () => {
    const activeSellers = users.filter(u => u.tipo === 'vendedor' && u.id !== 'master-admin');
    if (activeSellers.length === 0) return alert("Nenhum vendedor disponível.");
    const { data: unassigned } = await supabase.from('leads').select('id').is('assigned_to', null).eq('status', 'PENDING');
    if (!unassigned || unassigned.length === 0) return alert("Fila Geral está vazia.");
    
    const updates = unassigned.map((lead, i) => {
      const seller = activeSellers[i % activeSellers.length];
      return supabase.from('leads').update({ assigned_to: seller.id }).eq('id', lead.id);
    });
    await Promise.all(updates);
    await fetchData();
    alert("Leads distribuídos!");
  };

  const handleToggleUserStatus = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    const { error } = await supabase.from('usuarios').update({ online: !user.online }).eq('id', userId);
    if (!error) await fetchData();
  };

  const handlePromoteUser = async (userId: string) => {
    const { error } = await supabase.from('usuarios').update({ tipo: 'adm' }).eq('id', userId);
    if (!error) await fetchData();
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Excluir este usuário?")) return;
    const { error } = await supabase.from('usuarios').delete().eq('id', userId);
    if (!error) await fetchData();
  };

  const handleTransferLeads = async (fromUserId: string, toUserId: string) => {
    if (!toUserId) return;
    const { error } = await supabase.from('leads').update({ assigned_to: toUserId }).eq('assigned_to', fromUserId).eq('status', 'PENDING');
    if (!error) {
      await fetchData();
      alert("Fila transferida!");
    }
  };

  if (isInitialLoading) return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white font-sans">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mb-4" />
      <p className="font-black uppercase italic tracking-widest text-[10px]">Auditando Identidades...</p>
    </div>
  );

  if (!currentUser) return (
    <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-6">
      <form onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
          await restoreSession(false);
        } catch (err: any) { setError(err.message); }
        finally { setIsSubmitting(false); }
      }} className="w-full max-w-md bg-white p-10 rounded-[3rem] shadow-2xl">
        <h1 className="text-2xl font-black text-center mb-8 uppercase italic tracking-tighter">CallMaster <span className="text-indigo-600">Pro</span></h1>
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[10px] font-black uppercase mb-4 text-center border-2 border-red-100">{error}</div>}
        <div className="space-y-4">
          <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold outline-none focus:border-indigo-600" />
          <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold outline-none focus:border-indigo-600" />
        </div>
        <button disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all mt-6 shadow-xl shadow-indigo-200">
          {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : 'Entrar no Sistema'}
        </button>
      </form>
    </div>
  );

  return (
    <Layout user={currentUser} onLogout={async () => { await supabase.auth.signOut(); localStorage.removeItem('cm_master_session'); setCurrentUser(null); }}>
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
