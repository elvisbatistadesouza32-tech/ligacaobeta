
import React, { useState, useEffect } from 'react';
import { User, Lead, CallRecord, UserRole, UserStatus } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { ShieldCheck, LogIn, Loader2, Mail, Lock, UserPlus, ArrowRight, AlertCircle, Database, CheckCircle2, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from './supabase';

const MASTER_ADMIN_EMAIL = "admin@callmaster.com";
const ADMIN_MASTER_PASSWORD = "gestor_master_2024";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
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
      setDbError(null);
      const foundMissing: string[] = [];

      // 1. Usuários
      const { data: userData, error: userError } = await supabase.from('usuarios').select('id, nome, email, tipo, online');
      if (userError) {
        if (userError.message.toLowerCase().includes("schema cache") || userError.message.toLowerCase().includes("does not exist")) {
          foundMissing.push('usuarios');
        }
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
        if (leadError.message.toLowerCase().includes("assigned_to")) {
           foundMissing.push('assigned_to (Coluna)');
        } else if (leadError.message.toLowerCase().includes("does not exist")) {
           foundMissing.push('leads (Tabela)');
        }
      } else if (leadData) {
        setLeads(leadData.map((l: any) => ({
          id: l.id,
          nome: l.nome,
          telefone: l.telefone,
          concurso: l.concurso,
          assignedTo: l.assigned_to,
          status: l.status || 'PENDING',
          createdAt: l.created_at || new Date().toISOString()
        })));
      }

      // 3. Chamadas
      const { data: callData, error: callError } = await supabase.from('calls').select('*');
      if (callError) {
        if (callError.message.toLowerCase().includes("schema cache") || callError.message.toLowerCase().includes("does not exist")) {
          foundMissing.push('calls');
        }
      } else if (callData) {
        setCalls(callData.map((c: any) => ({
          id: c.id,
          leadId: c.lead_id,
          sellerId: c.seller_id,
          status: c.status,
          durationSeconds: c.duration_seconds,
          timestamp: c.timestamp,
          recording_url: c.recording_url
        })));
      }

      setMissingTables([...new Set(foundMissing)]);
    } catch (err: any) {
      setDbError("Erro de sincronização.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Sincronização em tempo real de todas as tabelas críticas
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
        setCurrentUser({ id: 'master-admin', nome: 'Administrador Mestre', email: MASTER_ADMIN_EMAIL, tipo: 'adm', online: true, avatar: `https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff` });
        return;
      }
      if (isRegistering) {
        const { error: authError } = await supabase.auth.signUp({ email: lowerEmail, password: password });
        if (authError) throw authError;
        await supabase.from('usuarios').insert([{ nome: name, email: lowerEmail, tipo: 'vendedor', online: false }]);
        setSuccessMsg("Vendedor cadastrado com sucesso!");
        setIsRegistering(false);
        fetchData();
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email: lowerEmail, password: password });
        if (loginError) throw loginError;
        const user = users.find(u => u.email.toLowerCase() === lowerEmail);
        if (!user) throw new Error("Usuário não encontrado.");
        setCurrentUser(user);
        await supabase.from('usuarios').update({ online: true }).eq('email', lowerEmail);
      }
    } catch (err: any) { setError(err.message); } finally { setIsSubmitting(false); }
  };

  const handleLogout = async () => {
    if (currentUser && currentUser.id !== 'master-admin') {
      await supabase.from('usuarios').update({ online: false }).eq('email', currentUser.email);
    }
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const handleLogCall = async (call: CallRecord) => {
    // 1. Salva a chamada
    const { error: callError } = await supabase.from('calls').insert([{ 
      lead_id: call.leadId, 
      seller_id: call.sellerId, 
      status: call.status, 
      duration_seconds: call.durationSeconds, 
      recording_url: call.recordingUrl 
    }]);

    if (!callError) {
      // 2. Atualiza o status do lead para CALLED para que saia da mesa do vendedor
      await supabase.from('leads').update({ status: 'CALLED' }).eq('id', call.leadId);
      // 3. Atualiza os dados locais
      fetchData();
    } else {
      alert("Erro ao salvar histórico: " + callError.message);
    }
  };

  const handleDistributeLeads = async () => {
    const activeSellers = users.filter(u => u.online && u.tipo === 'vendedor');
    if (activeSellers.length === 0) {
      alert("ERRO: Nenhum vendedor está ONLINE.");
      return;
    }

    const { data: unassignedLeads, error: leadErr } = await supabase
      .from('leads')
      .select('id')
      .is('assigned_to', null);

    if (leadErr) { 
      alert("Erro de banco: " + leadErr.message);
      return; 
    }
    
    if (!unassignedLeads || unassignedLeads.length === 0) { 
      alert("Não há leads aguardando distribuição."); 
      return; 
    }

    let count = 0;
    for (let i = 0; i < unassignedLeads.length; i++) {
      const sellerId = activeSellers[i % activeSellers.length].id;
      const { error: updErr } = await supabase.from('leads').update({ assigned_to: sellerId }).eq('id', unassignedLeads[i].id);
      if (!updErr) count++;
    }

    fetchData();
    alert(`${count} leads distribuídos!`);
  };

  const handleImportLeads = async (newLeads: Lead[]) => {
    const leadsToInsert = newLeads.map(({ nome, telefone, concurso }) => ({ nome, telefone, concurso }));
    const { error } = await supabase.from('leads').insert(leadsToInsert);
    if (error) { 
      alert("Erro: " + error.message); 
    } else {
      fetchData();
    }
  };

  const copySqlToClipboard = () => {
    const sql = `-- 🛠️ SCRIPT DE REPARO DEFINITIVO
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS usuarios (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, email TEXT UNIQUE, tipo TEXT DEFAULT 'vendedor', online BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS leads (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, telefone TEXT, concurso TEXT, status TEXT DEFAULT 'PENDING', created_at TIMESTAMPTZ DEFAULT NOW());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='assigned_to') THEN ALTER TABLE leads ADD COLUMN assigned_to UUID REFERENCES usuarios(id) ON DELETE SET NULL; END IF; END $$;
CREATE TABLE IF NOT EXISTS calls (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), lead_id UUID REFERENCES leads(id) ON DELETE CASCADE, seller_id UUID REFERENCES usuarios(id) ON DELETE SET NULL, status TEXT NOT NULL, duration_seconds INTEGER DEFAULT 0, timestamp TIMESTAMPTZ DEFAULT NOW(), recording_url TEXT);
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR ALL TABLES;
NOTIFY pgrst, 'reload schema';`.trim();
    navigator.clipboard.writeText(sql);
    alert("SQL Copiado!");
  };

  if (isLoading) return <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white"><Loader2 className="w-12 h-12 animate-spin text-indigo-400" /><p className="mt-4 font-black">Carregando dados...</p></div>;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden">
          <div className="bg-indigo-600 p-12 text-white text-center">
            <h1 className="text-4xl font-black italic">CallMaster <span className="text-indigo-200">PRO</span></h1>
          </div>
          <form onSubmit={handleAuth} className="p-12 space-y-6">
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black uppercase text-center">{error}</div>}
            
            {missingTables.length > 0 && (
              <button type="button" onClick={copySqlToClipboard} className="w-full bg-orange-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2"><AlertCircle className="w-4" /> Reparo de Banco Necessário</button>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white font-bold" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Senha</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white font-bold" />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black flex items-center justify-center gap-4 active:scale-95 transition-all shadow-xl shadow-indigo-200 uppercase text-sm">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <>Entrar <ArrowRight className="w-5" /></>}
            </button>
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
