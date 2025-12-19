
import React, { useState, useEffect, useCallback } from 'react';
import { User, Lead, CallRecord, CallStatus } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { Loader2, ArrowRight, AlertCircle, Copy } from 'lucide-react';
import { supabase } from './supabase';

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
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data: userData } = await supabase.from('usuarios').select('*');
      if (userData) {
        setUsers(userData.map((u: any) => ({
          id: u.id,
          nome: u.nome,
          email: u.email,
          tipo: u.tipo,
          online: !!u.online,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nome || 'User')}&background=random`
        })));
      }

      const { data: leadData } = await supabase.from('leads').select('*');
      if (leadData) {
        setLeads(leadData.map((l: any) => ({
          id: l.id,
          nome: l.nome,
          telefone: l.telefone,
          concurso: l.concurso,
          assignedTo: l.assigned_to,
          status: l.status || 'PENDING',
          createdAt: l.created_at
        })));
      }

      const { data: callData } = await supabase.from('calls').select('*');
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
    } catch (err: any) {
      console.error("Erro ao sincronizar dados:", err);
    }
  }, []);

  const restoreSession = useCallback(async () => {
    setIsLoading(true);
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
        setIsLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      await fetchData();

      if (session?.user) {
        const userEmail = session.user.email?.toLowerCase();
        
        if (userEmail === MASTER_ADMIN_EMAIL.toLowerCase()) {
          setCurrentUser({ 
            id: 'master-admin', 
            nome: 'Admin Gestor', 
            email: MASTER_ADMIN_EMAIL, 
            tipo: 'adm', 
            online: true,
            avatar: `https://ui-avatars.com/api/?name=Admin+Gestor&background=6366f1&color=fff`
          });
        } else {
          const { data: profile } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', userEmail)
            .maybeSingle();

          if (profile) {
            setCurrentUser({
              id: profile.id,
              nome: profile.nome,
              email: profile.email,
              tipo: profile.tipo as 'adm' | 'vendedor',
              online: true,
              avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.nome)}&background=random`
            });
            await supabase.from('usuarios').update({ online: true }).eq('id', profile.id);
          }
        }
      }
    } catch (err) {
      console.error("Erro na restauração:", err);
    } finally {
      setIsLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    restoreSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('cm_master_session');
        setCurrentUser(null);
      }
      if (event === 'SIGNED_IN' && session) restoreSession();
    });
    return () => subscription.unsubscribe();
  }, [restoreSession]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const lowerEmail = email.toLowerCase().trim();

    try {
      if (lowerEmail === MASTER_ADMIN_EMAIL.toLowerCase() && password === ADMIN_MASTER_PASSWORD) {
        await supabase.auth.signInWithPassword({ email: lowerEmail, password }).catch(() => null);
        localStorage.setItem('cm_master_session', 'active');
        setCurrentUser({ 
          id: 'master-admin', 
          nome: 'Admin Gestor', 
          email: MASTER_ADMIN_EMAIL, 
          tipo: 'adm', 
          online: true,
          avatar: `https://ui-avatars.com/api/?name=Admin+Gestor&background=6366f1&color=fff`
        });
        setIsSubmitting(false);
        fetchData();
        return; 
      }

      if (isRegistering) {
        const { error: signUpError } = await supabase.auth.signUp({ email: lowerEmail, password });
        if (signUpError) throw signUpError;
        
        await supabase.from('usuarios').insert([{ nome: name, email: lowerEmail, tipo: 'vendedor', online: false }]);
        setSuccessMsg("Conta criada! Já pode entrar.");
        setIsRegistering(false);
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: lowerEmail, password });
        if (loginError) throw loginError;

        const { data: profile } = await supabase.from('usuarios').select('*').eq('email', lowerEmail).single();
        if (!profile) throw new Error("Usuário autenticado mas sem perfil no banco.");
        
        setCurrentUser({
          id: profile.id,
          nome: profile.nome,
          email: profile.email,
          tipo: profile.tipo as 'adm' | 'vendedor',
          online: true,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.nome)}&background=random`
        });
        await supabase.from('usuarios').update({ online: true }).eq('id', profile.id);
      }
    } catch (err: any) {
      setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message);
    } finally {
      setIsSubmitting(false);
      fetchData();
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
      duration_seconds: call.durationSeconds, 
      recording_url: call.recordingUrl 
    }]);

    if (!callError) {
      await supabase.from('leads').update({ status: 'CALLED' }).eq('id', call.leadId);
      fetchData();
    }
  };

  const handleDistributeLeads = async () => {
    const activeSellers = users.filter(u => u.online && u.tipo === 'vendedor');
    if (activeSellers.length === 0) return alert("Ative vendedores online primeiro.");

    const { data: freeLeads } = await supabase.from('leads').select('id').is('assigned_to', null).eq('status', 'PENDING');
    if (!freeLeads || freeLeads.length === 0) return alert("Fila vazia.");

    const updates = freeLeads.map((lead, i) => {
      const sellerId = activeSellers[i % activeSellers.length].id;
      return supabase.from('leads').update({ assigned_to: sellerId }).eq('id', lead.id);
    });

    await Promise.all(updates);
    fetchData();
    alert("Distribuição concluída!");
  };

  const handleImportLeads = async (newLeads: Lead[], distributionMode: 'none' | 'balanced' | string) => {
    const activeSellers = users.filter(u => u.online && u.tipo === 'vendedor');
    
    const leadsToInsert = newLeads.map((l, i) => {
      let assignedTo = null;
      
      if (distributionMode === 'balanced' && activeSellers.length > 0) {
        assignedTo = activeSellers[i % activeSellers.length].id;
      } else if (distributionMode !== 'none' && distributionMode !== 'balanced') {
        assignedTo = distributionMode;
      }

      return {
        nome: l.nome,
        concurso: l.concurso,
        telefone: l.telefone.replace(/\D/g, ''),
        status: 'PENDING',
        assigned_to: assignedTo
      };
    });

    const { error } = await supabase.from('leads').insert(leadsToInsert);
    if (error) throw error;
    
    fetchData();
  };

  const handleTransferLeads = async (fromUserId: string, toUserId: string) => {
    const { error } = await supabase.from('leads').update({ assigned_to: toUserId }).eq('assigned_to', fromUserId).eq('status', 'PENDING');
    if (error) alert(error.message);
    else { fetchData(); alert("Fila transferida!"); }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white text-center">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mb-4" />
      <p className="font-black uppercase tracking-tighter">Sincronizando Sessão...</p>
    </div>
  );

  if (!currentUser) return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[4rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-indigo-600 p-12 text-white text-center">
          <h1 className="text-4xl font-black italic tracking-tighter">CallMaster <span className="text-indigo-200">PRO</span></h1>
        </div>
        <form onSubmit={handleAuth} className="p-10 space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-3xl text-[10px] font-black uppercase text-center border-2 border-red-100">{error}</div>}
          {successMsg && <div className="bg-green-50 text-green-700 p-4 rounded-3xl text-[10px] font-black uppercase text-center border-2 border-green-100">{successMsg}</div>}
          <div className="space-y-4">
            {isRegistering && (
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-5">Nome</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-indigo-600 font-bold" />
              </div>
            )}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-5">E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-indigo-600 font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-5">Senha</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-indigo-600 font-bold" />
            </div>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-black flex items-center justify-center gap-4 active:scale-95 transition-all shadow-xl uppercase text-sm tracking-tighter hover:bg-indigo-700">
            {isSubmitting ? <Loader2 className="animate-spin" /> : <>{isRegistering ? 'Cadastrar' : 'Entrar na Operação'} <ArrowRight className="w-5" /></>}
          </button>
          <button type="button" onClick={() => {setIsRegistering(!isRegistering); setError('');}} className="w-full text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">{isRegistering ? '← Voltar para o Login' : 'Ainda não sou cadastrado'}</button>
        </form>
      </div>
    </div>
  );

  return (
    <Layout user={currentUser} onLogout={handleLogout}>
      {currentUser.tipo === 'adm' ? (
        <AdminView 
          users={users} leads={leads} calls={calls} 
          onImportLeads={handleImportLeads} 
          onDistributeLeads={handleDistributeLeads} 
          onToggleUserStatus={async (id) => {
            const u = users.find(u => u.id === id);
            if (u) { await supabase.from('usuarios').update({ online: !u.online }).eq('id', id); fetchData(); }
          }} 
          onPromoteUser={async (id) => { await supabase.from('usuarios').update({ tipo: 'adm' }).eq('id', id); fetchData(); }} 
          onDeleteUser={async (id) => { if(confirm("Deletar?")){ await supabase.from('usuarios').delete().eq('id', id); fetchData(); } }}
          onTransferLeads={handleTransferLeads}
        />
      ) : (
        <SellerView user={currentUser} leads={leads} onLogCall={handleLogCall} />
      )}
    </Layout>
  );
};

export default App;
