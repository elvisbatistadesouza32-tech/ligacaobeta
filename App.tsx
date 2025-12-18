
import React, { useState, useEffect } from 'react';
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

  const fetchData = async () => {
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
          // Fixed property name to match CallRecord interface
          recordingUrl: c.recording_url
        })));
      }

      setMissingTables([...new Set(foundMissing)]);
    } catch (err: any) {
      console.error("Erro ao sincronizar:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const userSub = supabase.channel('users_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => fetchData()).subscribe();
    const leadsSub = supabase.channel('leads_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData()).subscribe();
    const callsSub = supabase.channel('calls_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'calls' }, () => fetchData()).subscribe();
    
    return () => { 
      supabase.removeChannel(userSub);
      supabase.removeChannel(leadsSub);
      supabase.removeChannel(callsSub);
    };
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const lowerEmail = email.toLowerCase().trim();
      if (lowerEmail === MASTER_ADMIN_EMAIL && password === ADMIN_MASTER_PASSWORD) {
        setCurrentUser({ id: 'master-admin', nome: 'Admin Gestor', email: MASTER_ADMIN_EMAIL, tipo: 'adm', online: true });
        return;
      }
      if (isRegistering) {
        const { error: authError } = await supabase.auth.signUp({ email: lowerEmail, password: password });
        if (authError) throw authError;
        await supabase.from('usuarios').insert([{ nome: name, email: lowerEmail, tipo: 'vendedor', online: false }]);
        setSuccessMsg("Conta criada! Já pode entrar.");
        setIsRegistering(false);
        fetchData();
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: lowerEmail, password: password });
        if (loginError) throw loginError;
        const user = users.find(u => u.email.toLowerCase() === lowerEmail);
        if (!user) throw new Error("Usuário não cadastrado no banco.");
        setCurrentUser(user);
        await supabase.from('usuarios').update({ online: true }).eq('id', user.id);
      }
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
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
      // Fixed: Property access call.recording_url to call.recordingUrl
      recording_url: call.recordingUrl 
    }]);

    if (!callError) {
      await supabase.from('leads').update({ status: 'CALLED' }).eq('id', call.leadId);
      fetchData();
    } else {
      alert("Erro ao registrar: " + callError.message);
    }
  };

  const handleDistributeLeads = async () => {
    const activeSellers = users.filter(u => u.online && u.tipo === 'vendedor');
    if (activeSellers.length === 0) {
      alert("Atenção: Ative ao menos um vendedor (Online) antes de distribuir.");
      return;
    }

    const { data: unassignedLeads } = await supabase.from('leads').select('id').is('assigned_to', null);
    if (!unassignedLeads || unassignedLeads.length === 0) { 
      alert("Sem leads livres na fila."); 
      return; 
    }

    for (let i = 0; i < unassignedLeads.length; i++) {
      const sellerId = activeSellers[i % activeSellers.length].id;
      await supabase.from('leads').update({ assigned_to: sellerId }).eq('id', unassignedLeads[i].id);
    }

    fetchData();
    alert("Leads distribuídos com sucesso!");
  };

  const handleImportLeads = async (newLeads: Lead[]) => {
    const leadsToInsert = newLeads.map(({ nome, telefone, concurso }) => ({ nome, telefone, concurso, status: 'PENDING' }));
    const { error } = await supabase.from('leads').insert(leadsToInsert);
    if (error) alert("Erro na importação: " + error.message);
    else fetchData();
  };

  const copySqlToClipboard = () => {
    const sql = `-- REPARO DE BANCO CALLMASTER\nCREATE EXTENSION IF NOT EXISTS "uuid-ossp";\nCREATE TABLE IF NOT EXISTS usuarios (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, email TEXT UNIQUE, tipo TEXT DEFAULT 'vendedor', online BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW());\nCREATE TABLE IF NOT EXISTS leads (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, telefone TEXT, concurso TEXT, status TEXT DEFAULT 'PENDING', created_at TIMESTAMPTZ DEFAULT NOW());\nDO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='assigned_to') THEN ALTER TABLE leads ADD COLUMN assigned_to UUID REFERENCES usuarios(id) ON DELETE SET NULL; END IF; END $$;\nCREATE TABLE IF NOT EXISTS calls (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), lead_id UUID REFERENCES leads(id) ON DELETE CASCADE, seller_id UUID REFERENCES usuarios(id) ON DELETE SET NULL, status TEXT NOT NULL, duration_seconds INTEGER DEFAULT 0, timestamp TIMESTAMPTZ DEFAULT NOW(), recording_url TEXT);\nDROP PUBLICATION IF EXISTS supabase_realtime;\nCREATE PUBLICATION supabase_realtime FOR ALL TABLES;\nNOTIFY pgrst, 'reload schema';`;
    navigator.clipboard.writeText(sql);
    alert("Código SQL de reparo copiado! Execute no Supabase.");
  };

  if (isLoading) return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white p-10 text-center">
      <Loader2 className="w-16 h-16 animate-spin text-indigo-400 mb-6" />
      <h2 className="font-black italic uppercase text-xl tracking-tighter">Sincronizando CallMaster Pro...</h2>
      <p className="text-indigo-300 text-xs font-bold mt-2 uppercase tracking-widest opacity-60">Carregando ambiente seguro</p>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[3.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-700">
          <div className="bg-indigo-600 p-16 text-white text-center relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
            <h1 className="text-5xl font-black italic tracking-tighter">CallMaster <span className="text-indigo-200">PRO</span></h1>
            <p className="text-[10px] mt-6 opacity-70 font-black uppercase tracking-[0.4em]">Plataforma de Alta Performance</p>
          </div>
          <form onSubmit={handleAuth} className="p-12 space-y-8">
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-3xl text-[10px] font-black uppercase text-center border-2 border-red-100">{error}</div>}
            {successMsg && <div className="bg-green-50 text-green-700 p-4 rounded-3xl text-[10px] font-black uppercase text-center border-2 border-green-100">{successMsg}</div>}
            
            {missingTables.length > 0 && (
              <div className="bg-orange-50 border-2 border-orange-100 p-6 rounded-[2.5rem] space-y-4">
                <p className="text-[10px] font-black text-orange-700 uppercase flex items-center gap-2 justify-center"><AlertCircle className="w-4" /> REPARO DE BANCO PENDENTE</p>
                <button type="button" onClick={copySqlToClipboard} className="w-full bg-orange-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-orange-700 transition-all"><Copy className="w-4" /> Copiar SQL</button>
              </div>
            )}

            <div className="space-y-4">
              {isRegistering && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Nome Completo</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-6 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-indigo-600 focus:bg-white font-bold" placeholder="EX: LUCAS MENDES" />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">E-mail</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-6 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-indigo-600 focus:bg-white font-bold" placeholder="USUARIO@EMAIL.COM" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">Senha</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-6 bg-gray-50 border-2 border-gray-100 rounded-3xl outline-none focus:border-indigo-600 focus:bg-white font-bold" placeholder="••••••••" />
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-7 rounded-[2.5rem] font-black flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl shadow-indigo-100 uppercase text-sm tracking-tighter">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <>{isRegistering ? 'Criar Conta Agora' : 'Acessar Plataforma'} <ArrowRight className="w-5" /></>}
            </button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em]">{isRegistering ? '← Já tenho conta' : 'Ainda não sou cadastrado'}</button>
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
          onToggleUserStatus={id => {
            const u = users.find(u => u.id === id);
            if (u) supabase.from('usuarios').update({ online: !u.online }).eq('id', id).then(fetchData);
          }} 
          onPromoteUser={id => supabase.from('usuarios').update({ tipo: 'adm' }).eq('id', id).then(fetchData)} 
        />
      ) : (
        <SellerView user={currentUser} leads={leads} onLogCall={handleLogCall} />
      )}
    </Layout>
  );
};

export default App;
