
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Lead, CallRecord, UserRole, CallStatus } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { Loader2, ArrowRight, AlertCircle, RefreshCw, Copy } from 'lucide-react';
import { supabase } from './supabase';

const MASTER_ADMIN_EMAIL = "admin@callmaster.com";
const ADMIN_MASTER_PASSWORD = "gestor_master_2024";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [missingTables, setMissingTables] = useState<string[]>([]);
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const foundMissing: string[] = [];

      // 1. Usuários
      const { data: userData, error: userError } = await supabase.from('usuarios').select('*');
      if (userError) {
        if (userError.message.toLowerCase().includes("does not exist")) foundMissing.push('usuarios');
      } else if (userData) {
        setUsers(userData.map((u: any) => ({
          id: u.id,
          nome: u.nome,
          email: u.email,
          tipo: u.tipo,
          online: !!u.online,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(u.nome || 'User')}&background=random`
        })));
      }

      // 2. Leads
      const { data: leadData, error: leadError } = await supabase.from('leads').select('*');
      if (leadError) {
        if (leadError.message.toLowerCase().includes("assigned_to")) foundMissing.push('assigned_to (Coluna)');
        else if (leadError.message.toLowerCase().includes("does not exist")) foundMissing.push('leads (Tabela)');
      } else if (leadData) {
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

      // 3. Chamadas
      const { data: callData, error: callError } = await supabase.from('calls').select('*');
      if (callError) {
        if (callError.message.toLowerCase().includes("does not exist")) foundMissing.push('calls');
      } else if (callData) {
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

      setMissingTables([...new Set(foundMissing)]);
    } catch (err: any) {
      console.error("Erro ao sincronizar:", err);
    }
  }, []);

  // Efeito principal de persistência
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Sempre busca os dados do banco para garantir que as listas estejam prontas
        await fetchData();

        if (session?.user && isMounted) {
          const userEmail = session.user.email;
          if (userEmail === MASTER_ADMIN_EMAIL) {
            setCurrentUser({ id: 'master-admin', nome: 'Admin Gestor', email: MASTER_ADMIN_EMAIL, tipo: 'adm', online: true });
          } else {
            const { data: userProfile } = await supabase
              .from('usuarios')
              .select('*')
              .eq('email', userEmail)
              .maybeSingle();

            if (userProfile) {
              setCurrentUser({
                id: userProfile.id,
                nome: userProfile.nome,
                email: userProfile.email,
                tipo: userProfile.tipo,
                online: true,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.nome || 'User')}&background=random`
              });
              await supabase.from('usuarios').update({ online: true }).eq('id', userProfile.id);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao restaurar sessão:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    checkSession();

    // Listener para mudanças de estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      } else if (event === 'SIGNED_IN' && session) {
        // O checkSession acima já lida com a carga inicial, mas aqui garantimos novos logins
        if (!currentUser) checkSession();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchData]);

  // Realtime Subscriptions
  useEffect(() => {
    const userSub = supabase.channel('users_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => fetchData()).subscribe();
    const leadsSub = supabase.channel('leads_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData()).subscribe();
    const callsSub = supabase.channel('calls_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => fetchData()).subscribe();
    
    return () => { 
      supabase.removeChannel(userSub);
      supabase.removeChannel(leadsSub);
      supabase.removeChannel(callsSub);
    };
  }, [fetchData]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const lowerEmail = email.toLowerCase().trim();
      
      if (lowerEmail === MASTER_ADMIN_EMAIL && password === ADMIN_MASTER_PASSWORD) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: lowerEmail, password: password });
        // Se falhar o login auth mas for o master config, tentamos criar a sessão auth se não existir
        if (signInError) throw signInError;
        
        setCurrentUser({ id: 'master-admin', nome: 'Admin Gestor', email: MASTER_ADMIN_EMAIL, tipo: 'adm', online: true });
        return;
      }

      if (isRegistering) {
        const { data: authData, error: authError } = await supabase.auth.signUp({ email: lowerEmail, password: password });
        if (authError) throw authError;
        
        await supabase.from('usuarios').insert([{ nome: name, email: lowerEmail, tipo: 'vendedor', online: false }]);
        setSuccessMsg("Conta criada! Já pode entrar.");
        setIsRegistering(false);
        fetchData();
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: lowerEmail, password: password });
        if (loginError) throw loginError;

        const { data: userProfile, error: profileError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', lowerEmail)
          .single();

        if (profileError || !userProfile) throw new Error("Usuário não encontrado na base de dados.");
        
        setCurrentUser({
          id: userProfile.id,
          nome: userProfile.nome,
          email: userProfile.email,
          tipo: userProfile.tipo,
          online: true,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.nome)}&background=random`
        });
        await supabase.from('usuarios').update({ online: true }).eq('id', userProfile.id);
      }
    } catch (err: any) { 
      setError(err.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : err.message); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleLogout = async () => {
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
    } else {
      alert("Erro ao registrar chamada: " + callError.message);
    }
  };

  const handleDistributeLeads = async () => {
    const activeSellers = users.filter(u => u.online && u.tipo === 'vendedor');
    if (activeSellers.length === 0) {
      alert("Atenção: Ative ao menos um vendedor (Online) antes de distribuir.");
      return;
    }

    const { data: unassignedLeads } = await supabase.from('leads').select('id').is('assigned_to', null).eq('status', 'PENDING');
    if (!unassignedLeads || unassignedLeads.length === 0) { 
      alert("Sem leads livres na fila para distribuir."); 
      return; 
    }

    const updates = unassignedLeads.map((lead, i) => {
      const sellerId = activeSellers[i % activeSellers.length].id;
      return supabase.from('leads').update({ assigned_to: sellerId }).eq('id', lead.id);
    });

    await Promise.all(updates);
    fetchData();
    alert(`Sucesso! ${unassignedLeads.length} leads foram distribuídos.`);
  };

  const handleImportLeads = async (newLeads: Lead[]) => {
    const leadsToInsert = newLeads.map(({ nome, telefone, concurso }) => ({ 
      nome, 
      telefone: telefone.replace(/\D/g, ''), 
      concurso: concurso || 'Planilha', 
      status: 'PENDING' 
    }));
    
    const { error } = await supabase.from('leads').insert(leadsToInsert);
    if (error) {
      alert("Erro na importação: " + error.message);
    } else {
      await fetchData();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
    const { error } = await supabase.from('usuarios').delete().eq('id', userId);
    if (error) alert("Erro ao excluir usuário: " + error.message);
    else fetchData();
  };

  const handleTransferLeads = async (fromUserId: string, toUserId: string) => {
    if (!fromUserId || !toUserId) return;
    
    const { error } = await supabase.from('leads')
      .update({ assigned_to: toUserId })
      .eq('assigned_to', fromUserId)
      .eq('status', 'PENDING');
    
    if (error) {
      alert("Erro ao transferir leads: " + error.message);
    } else {
      await fetchData();
    }
  };

  const copySqlToClipboard = () => {
    const sql = `-- REPARO DE BANCO CALLMASTER\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE TABLE IF NOT EXISTS usuarios (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, email TEXT UNIQUE, tipo TEXT DEFAULT 'vendedor', online BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW());\nCREATE TABLE IF NOT EXISTS leads (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, telefone TEXT, concurso TEXT, status TEXT DEFAULT 'PENDING', created_at TIMESTAMPTZ DEFAULT NOW());\nDO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='assigned_to') THEN ALTER TABLE leads ADD COLUMN assigned_to UUID REFERENCES usuarios(id) ON DELETE SET NULL; END IF; END $$;\nCREATE TABLE IF NOT EXISTS calls (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), lead_id UUID REFERENCES leads(id) ON DELETE CASCADE, seller_id UUID REFERENCES usuarios(id) ON DELETE SET NULL, status TEXT NOT NULL, duration_seconds INTEGER DEFAULT 0, timestamp TIMESTAMPTZ DEFAULT NOW(), recording_url TEXT);\nDROP PUBLICATION IF EXISTS supabase_realtime;\nCREATE PUBLICATION supabase_realtime FOR ALL TABLES;\nNOTIFY pgrst, 'reload schema';`;
    navigator.clipboard.writeText(sql);
    alert("SQL de reparo copiado!");
  };

  if (isLoading) return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white p-10 text-center">
      <Loader2 className="w-20 h-20 animate-spin text-indigo-400 mb-6" />
      <h2 className="font-black italic uppercase text-2xl tracking-tighter">Sincronizando CallMaster...</h2>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[4rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-700">
          <div className="bg-indigo-600 p-16 text-white text-center">
            <h1 className="text-5xl font-black italic tracking-tighter">CallMaster <span className="text-indigo-200">PRO</span></h1>
          </div>
          <form onSubmit={handleAuth} className="p-12 space-y-8">
            {error && <div className="bg-red-50 text-red-600 p-5 rounded-3xl text-[10px] font-black uppercase text-center border-2 border-red-100">{error}</div>}
            {successMsg && <div className="bg-green-50 text-green-700 p-5 rounded-3xl text-[10px] font-black uppercase text-center border-2 border-green-100">{successMsg}</div>}
            
            <div className="space-y-5">
              {isRegistering && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-5">Nome</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-6 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-indigo-600 focus:bg-white font-bold" />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-5">E-mail</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-6 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-indigo-600 focus:bg-white font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-5">Senha</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-6 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-indigo-600 focus:bg-white font-bold" />
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-7 rounded-[2.5rem] font-black flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl shadow-indigo-100 uppercase text-sm tracking-tighter hover:bg-indigo-700">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <>{isRegistering ? 'Cadastrar' : 'Entrar'} <ArrowRight className="w-5" /></>}
            </button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">{isRegistering ? '← Já sou cadastrado' : 'Ainda não sou cadastrado'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser} onLogout={handleLogout}>
      {currentUser.tipo === 'adm' ? (
        <AdminView 
          users={users} 
          leads={leads} 
          calls={calls} 
          onImportLeads={handleImportLeads} 
          onDistributeLeads={handleDistributeLeads} 
          onToggleUserStatus={async (id) => {
            const u = users.find(u => u.id === id);
            if (u) {
              await supabase.from('usuarios').update({ online: !u.online }).eq('id', id);
              fetchData();
            }
          }} 
          onPromoteUser={async (id) => {
            await supabase.from('usuarios').update({ tipo: 'adm' }).eq('id', id);
            fetchData();
          }} 
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
