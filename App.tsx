
import React, { useState, useEffect, useCallback } from 'react';
import { User, Lead, CallRecord } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from './supabase';

const MASTER_ADMIN_EMAIL = "admin@callmaster.com";
const ADMIN_MASTER_PASSWORD = "gestor_master_2024";

interface AuthenticatedAppProps {
  user: User;
  users: User[];
  leads: Lead[];
  calls: CallRecord[];
  isSyncing: boolean;
  onRefresh: () => void;
  onLogout: () => void;
  onImportLeads: (leads: Lead[], mode: string) => Promise<void>;
  onDistributeLeads: () => void;
  onLogCall: (call: CallRecord) => void;
  onToggleUserStatus: (id: string) => void;
  onPromoteUser: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onTransferLeads: (from: string, to: string) => void;
}

const AuthenticatedApp: React.FC<AuthenticatedAppProps> = ({ 
  user, users, leads, calls, isSyncing, onRefresh, onLogout, 
  onImportLeads, onDistributeLeads, onLogCall, onToggleUserStatus, 
  onPromoteUser, onDeleteUser, onTransferLeads 
}) => {
  return (
    <Layout user={user} onLogout={onLogout}>
      <div className="fixed top-20 right-8 z-[60]">
        <button onClick={onRefresh} disabled={isSyncing} className={`p-4 bg-white shadow-xl rounded-full text-indigo-600 border border-indigo-100 ${isSyncing ? 'animate-spin opacity-50' : 'hover:scale-110 active:scale-90'} transition-all`}>
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {user.tipo === 'adm' ? (
        <AdminView 
          users={users} leads={leads} calls={calls} 
          onImportLeads={onImportLeads} 
          onDistributeLeads={onDistributeLeads} 
          onToggleUserStatus={onToggleUserStatus} 
          onPromoteUser={onPromoteUser} 
          onDeleteUser={onDeleteUser}
          onTransferLeads={onTransferLeads}
        />
      ) : (
        <SellerView user={user} leads={leads} onLogCall={onLogCall} />
      )}
    </Layout>
  );
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
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
          id: String(u.id).trim().toLowerCase(),
          nome: u.nome || 'Operador',
          email: u.email || '',
          tipo: u.tipo === 'adm' ? 'adm' : 'vendedor',
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
          assignedTo: l.assigned_to ? String(l.assigned_to).trim().toLowerCase() : null,
          status: l.status || 'PENDING',
          createdAt: l.created_at
        })));
      }

      if (callData.data) {
        setCalls(callData.data.map((c: any) => ({
          id: c.id,
          leadId: c.lead_id,
          sellerId: String(c.seller_id).trim().toLowerCase(),
          status: c.status,
          durationSeconds: c.duration_seconds,
          timestamp: c.timestamp,
          recordingUrl: c.recording_url
        })));
      }
    } catch (err: any) {
      console.error("Erro na sincronização:", err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handleLogout = async () => {
    const userId = currentUser?.id;
    localStorage.removeItem('cm_master_session');
    
    if (userId && userId !== 'master-admin') {
      try {
        await supabase.from('usuarios').update({ online: false }).eq('id', userId);
      } catch (e) {}
    }
    
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const restoreSession = useCallback(async (isFirstLoad = false) => {
    if (isFirstLoad) setIsInitialLoading(true);
    try {
      const masterSession = localStorage.getItem('cm_master_session');
      if (masterSession === 'active') {
        setCurrentUser({ 
          id: 'master-admin', 
          nome: 'Admin Gestor', 
          email: MASTER_ADMIN_EMAIL, 
          tipo: 'adm', 
          online: true,
          avatar: `https://ui-avatars.com/api/?name=Admin+Gestor&background=6366f1&color=fff`
        });
        await fetchData();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const userEmail = session.user.email?.toLowerCase();
        if (userEmail === MASTER_ADMIN_EMAIL.toLowerCase()) {
          setCurrentUser({ id: 'master-admin', nome: 'Admin Gestor', email: MASTER_ADMIN_EMAIL, tipo: 'adm', online: true });
        } else {
          const { data: profile } = await supabase.from('usuarios').select('*').eq('id', session.user.id).maybeSingle();
          if (profile) {
            setCurrentUser({
              id: String(profile.id).trim().toLowerCase(),
              nome: profile.nome || 'Operador',
              email: profile.email || '',
              tipo: profile.tipo === 'adm' ? 'adm' : 'vendedor',
              online: true
            });
            await supabase.from('usuarios').update({ online: true }).eq('id', profile.id);
          } else {
            await handleLogout();
          }
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
    const channel = supabase.channel('db-global-sync').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
    return () => { channel.unsubscribe(); };
  }, [restoreSession, fetchData]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const lowerEmail = email.toLowerCase().trim();
      
      if (lowerEmail === MASTER_ADMIN_EMAIL.toLowerCase() && password === ADMIN_MASTER_PASSWORD) {
        localStorage.setItem('cm_master_session', 'active');
        await restoreSession(false);
        return; 
      }

      if (isRegistering) {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({ email: lowerEmail, password });
        if (signUpError) throw signUpError;
        if (authData.user) {
          await supabase.from('usuarios').insert([{ 
            id: authData.user.id, 
            nome: name, 
            email: lowerEmail, 
            tipo: 'vendedor', 
            online: false 
          }]);
        }
        alert("Conta criada! Por favor, faça login.");
        setIsRegistering(false);
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: lowerEmail, password });
        if (loginError) throw loginError;
        await restoreSession(false);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const handleDistributeLeads = async () => {
    // Filtra vendedores excluindo o master-admin da distribuição automática
    const activeSellers = users.filter(u => u.tipo === 'vendedor' && u.id !== 'master-admin');
    
    if (activeSellers.length === 0) {
      return alert("Erro: Nenhum vendedor cadastrado para receber leads.");
    }
    
    setIsSyncing(true);
    
    // IMPORTANTE: Em colunas UUID do Supabase, o valor não atribuído é NULL.
    // Comparar com string vazia "" causa erro de sintaxe UUID.
    const { data: leadsToDist, error: fetchErr } = await supabase
      .from('leads')
      .select('id')
      .is('assigned_to', null)
      .eq('status', 'PENDING');

    if (fetchErr) {
      setIsSyncing(false);
      console.error("Erro Supabase:", fetchErr);
      return alert("Erro ao buscar leads: " + fetchErr.message);
    }

    if (!leadsToDist || leadsToDist.length === 0) { 
      setIsSyncing(false); 
      return alert("Não há leads na Fila Geral para distribuir."); 
    }

    // Distribuição round-robin
    const updates = leadsToDist.map((lead, i) => {
      const targetSeller = activeSellers[i % activeSellers.length];
      return supabase
        .from('leads')
        .update({ assigned_to: targetSeller.id })
        .eq('id', lead.id);
    });
    
    try {
      await Promise.all(updates);
      await fetchData();
      alert(`Sucesso! ${leadsToDist.length} leads foram distribuídos entre ${activeSellers.length} vendedores.`);
    } catch (err: any) {
      alert("Erro durante a distribuição: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportLeads = async (newLeads: Lead[], distributionMode: string) => {
    const activeSellers = users.filter(u => u.tipo === 'vendedor' && u.id !== 'master-admin');
    
    const leadsToInsert = newLeads.map((l, i) => {
      let assignedTo: string | null = null;
      
      if (distributionMode === 'balanced' && activeSellers.length > 0) { 
        assignedTo = activeSellers[i % activeSellers.length].id; 
      }
      else if (distributionMode.length > 20) { 
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

  const handleTransferLeads = async (from: string, to: string) => {
    if (!to) return alert("Selecione um destino para a transferência.");
    const { error } = await supabase.from('leads').update({ assigned_to: to }).eq('assigned_to', from).eq('status', 'PENDING');
    if (error) alert(error.message); else await fetchData();
  };

  if (isInitialLoading) return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mb-4" />
      <p className="font-black uppercase italic tracking-widest text-[10px]">CallMaster Pro - Sincronizando...</p>
    </div>
  );

  if (!currentUser) return (
    <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden border-t-8 border-indigo-600">
        <div className="p-10 text-center">
          <h1 className="text-3xl font-black italic tracking-tighter uppercase text-indigo-950">CallMaster <span className="text-indigo-600">Pro</span></h1>
          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mt-2">Sistema de Gestão de Leads</p>
        </div>
        <form onSubmit={handleAuth} className="px-10 pb-12 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-5 rounded-2xl text-[10px] font-black uppercase text-center border-2 border-red-100">{error}</div>}
          <div className="space-y-4">
            {isRegistering && ( <input type="text" placeholder="Nome" required value={name} onChange={e => setName(e.target.value)} className="w-full p-5 bg-gray-50 border-2 rounded-2xl outline-none focus:border-indigo-600 font-bold" /> )}
            <input type="email" placeholder="E-mail" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 rounded-2xl outline-none focus:border-indigo-600 font-bold" />
            <input type="password" placeholder="Senha" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 rounded-2xl outline-none focus:border-indigo-600 font-bold" />
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl active:scale-95">
            {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : (isRegistering ? 'Criar Cadastro' : 'Acessar Painel')}
          </button>
          <button type="button" onClick={() => {setIsRegistering(!isRegistering); setError('');}} className="w-full text-indigo-600 font-black text-[10px] uppercase tracking-widest">{isRegistering ? '← Voltar' : 'Novo Operador?'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <AuthenticatedApp 
      key={currentUser.id}
      user={currentUser}
      users={users}
      leads={leads}
      calls={calls}
      isSyncing={isSyncing}
      onRefresh={fetchData}
      onLogout={handleLogout}
      onImportLeads={handleImportLeads}
      onDistributeLeads={handleDistributeLeads}
      onLogCall={handleLogCall}
      onToggleUserStatus={async (id) => { const u = users.find(x => x.id === id); if (u) { await supabase.from('usuarios').update({ online: !u.online }).eq('id', id); await fetchData(); } }}
      onPromoteUser={async (id) => { await supabase.from('usuarios').update({ tipo: 'adm' }).eq('id', id); await fetchData(); }}
      onDeleteUser={async (id) => { if(confirm("Excluir?")){ await supabase.from('usuarios').delete().eq('id', id); await fetchData(); } }}
      onTransferLeads={handleTransferLeads}
    />
  );
};

export default App;
