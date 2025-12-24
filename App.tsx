
import React, { useState, useEffect, useCallback } from 'react';
import { User, Lead, CallRecord, CallStatus } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { supabase } from './supabase';

const MASTER_ADMIN_EMAIL = "admin@callmaster.com";
const ADMIN_MASTER_PASSWORD = "gestor_master_2024";

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
  const [successMsg, setSuccessMsg] = useState('');
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
          nome: u.nome,
          email: u.email,
          tipo: u.tipo,
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
          assignedTo: l.assigned_to || null,
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
          // Busca o perfil do usuário pelo ID do Auth para garantir correspondência exata
          const { data: profile } = await supabase.from('usuarios').select('*').eq('id', session.user.id).maybeSingle();
          
          if (profile) {
            setCurrentUser({
              id: profile.id,
              nome: profile.nome,
              email: profile.email,
              tipo: profile.tipo as 'adm' | 'vendedor',
              online: true
            });
            await supabase.from('usuarios').update({ online: true }).eq('id', profile.id);
          } else {
            // Caso o perfil não exista (erro de sincronização prévio), tenta buscar por e-mail e corrigir o ID
            const { data: legacyProfile } = await supabase.from('usuarios').select('*').eq('email', userEmail).maybeSingle();
            if (legacyProfile) {
              await supabase.from('usuarios').update({ id: session.user.id, online: true }).eq('email', userEmail);
              restoreSession(false); // Reinicia para pegar o ID correto
              return;
            }
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
    const channel = supabase.channel('schema-db-changes').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData()).subscribe();
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
        // 1. Cria o usuário no Auth
        const { data: authData, error: signUpError } = await supabase.auth.signUp({ email: lowerEmail, password });
        if (signUpError) throw signUpError;
        
        if (authData.user) {
          // 2. Cria o perfil na tabela usuarios usando o MESMO ID do Auth
          const { error: profileError } = await supabase.from('usuarios').insert([{ 
            id: authData.user.id, 
            nome: name, 
            email: lowerEmail, 
            tipo: 'vendedor', 
            online: false 
          }]);
          if (profileError) throw profileError;
        }
        
        setSuccessMsg("Conta criada com sucesso!");
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

  const handleLogout = async () => {
    localStorage.removeItem('cm_master_session');
    if (currentUser && currentUser.id !== 'master-admin') {
      await supabase.from('usuarios').update({ online: false }).eq('id', currentUser.id);
    }
    await supabase.auth.signOut();
    setCurrentUser(null);
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
    // Apenas vendedores com UUID (IDs longos)
    const allSellers = users.filter(u => u.tipo === 'vendedor' && u.id.length > 20);
    if (allSellers.length === 0) return alert("Cadastre vendedores para receber leads.");
    
    setIsSyncing(true);
    // Busca leads pendentes e sem dono
    const { data: leadsToFix, error: fetchError } = await supabase
      .from('leads')
      .select('id')
      .or('assigned_to.is.null,assigned_to.eq.""')
      .eq('status', 'PENDING');
    
    if (fetchError) {
       setIsSyncing(false);
       return alert("Erro ao buscar leads: " + fetchError.message);
    }

    if (!leadsToFix || leadsToFix.length === 0) {
      setIsSyncing(false);
      return alert("Não há leads novos na Fila Geral.");
    }

    let successCount = 0;
    // Processamento em lote (simulado via loop com verificação individual)
    const updates = leadsToFix.map((lead, i) => {
      const sellerId = allSellers[i % allSellers.length].id;
      return supabase.from('leads').update({ assigned_to: sellerId }).eq('id', lead.id);
    });

    const results = await Promise.all(updates);
    successCount = results.filter(r => !r.error).length;

    await fetchData();
    alert(`${successCount} leads entregues. Os vendedores já podem ver em suas telas.`);
    setIsSyncing(false);
  };

  const handleImportLeads = async (newLeads: Lead[], distributionMode: 'none' | 'balanced' | string) => {
    const allSellers = users.filter(u => u.tipo === 'vendedor' && u.id.length > 20);
    const leadsToInsert = newLeads.map((l, i) => {
      let assignedTo: string | null = null;
      if (distributionMode === 'balanced' && allSellers.length > 0) {
        assignedTo = allSellers[i % allSellers.length].id;
      } else if (distributionMode !== 'none' && distributionMode !== 'balanced' && distributionMode.length > 20) {
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

    const { error: insertError } = await supabase.from('leads').insert(leadsToInsert);
    if (insertError) throw new Error("Erro ao importar: " + insertError.message);
    await fetchData();
  };

  const handleTransferLeads = async (fromUserId: string, toUserId: string) => {
    if (toUserId.length < 20) return alert("Selecione um vendedor válido.");
    const { error } = await supabase.from('leads').update({ assigned_to: toUserId }).eq('assigned_to', fromUserId).eq('status', 'PENDING');
    if (error) alert("Erro: " + error.message);
    else { await fetchData(); alert("Fila transferida!"); }
  };

  if (isInitialLoading) return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white">
      <Loader2 className="w-10 h-10 animate-spin text-indigo-400 mb-4" />
      <p className="font-black uppercase italic text-[10px] tracking-[0.3em]">Carregando CallMaster...</p>
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
            {isRegistering && (
              <input type="text" placeholder="Nome do Operador" required value={name} onChange={e => setName(e.target.value)} className="w-full p-5 bg-gray-50 border-2 rounded-2xl outline-none focus:border-indigo-600 font-bold" />
            )}
            <input type="email" placeholder="E-mail Corporativo" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 rounded-2xl outline-none focus:border-indigo-600 font-bold" />
            <input type="password" placeholder="Senha de Acesso" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 rounded-2xl outline-none focus:border-indigo-600 font-bold" />
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl active:scale-95">
            {isSubmitting ? <Loader2 className="animate-spin mx-auto" /> : (isRegistering ? 'Criar Cadastro' : 'Acessar Painel')}
          </button>
          <button type="button" onClick={() => {setIsRegistering(!isRegistering); setError('');}} className="w-full text-indigo-600 font-black text-[10px] uppercase tracking-widest">{isRegistering ? '← Voltar para Login' : 'Novo Operador? Cadastrar-se'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <Layout user={currentUser} onLogout={handleLogout}>
      <div className="fixed top-20 right-8 z-[60]">
         <button onClick={() => fetchData()} disabled={isSyncing} className={`p-4 bg-white shadow-xl rounded-full text-indigo-600 border border-indigo-100 ${isSyncing ? 'animate-spin opacity-50' : 'hover:scale-110 active:scale-90'} transition-all`}>
           <RefreshCw className="w-5 h-5" />
         </button>
      </div>

      {currentUser.tipo === 'adm' ? (
        <AdminView 
          users={users} leads={leads} calls={calls} 
          onImportLeads={handleImportLeads} 
          onDistributeLeads={handleDistributeLeads} 
          onToggleUserStatus={async (id) => {
            const u = users.find(u => u.id === id);
            if (u) { await supabase.from('usuarios').update({ online: !u.online }).eq('id', id); await fetchData(); }
          }} 
          onPromoteUser={async (id) => { await supabase.from('usuarios').update({ tipo: 'adm' }).eq('id', id); await fetchData(); }} 
          onDeleteUser={async (id) => { if(confirm("Atenção: Esta ação é irreversível. Remover usuário?")){ await supabase.from('usuarios').delete().eq('id', id); await fetchData(); } }}
          onTransferLeads={handleTransferLeads}
        />
      ) : (
        <SellerView user={currentUser} leads={leads} onLogCall={handleLogCall} />
      )}
    </Layout>
  );
};

export default App;
