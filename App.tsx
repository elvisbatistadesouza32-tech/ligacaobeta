
import React, { useState, useEffect } from 'react';
import { User, Lead, CallRecord, UserRole, UserStatus } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { ShieldCheck, LogIn, Loader2, Mail, Lock, UserPlus, ArrowRight, AlertCircle, Database, CheckCircle2, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from './supabase';

// CONFIGURAÇÃO DE ACESSO MESTRE
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

      // 1. Carregar Usuários
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

      // 2. Carregar Leads
      const { data: leadData, error: leadError } = await supabase.from('leads').select('*');
      if (leadError) {
        if (leadError.message.toLowerCase().includes("schema cache") || leadError.message.toLowerCase().includes("does not exist")) {
          foundMissing.push('leads');
        }
      } else if (leadData) {
        const sortedLeads = leadData.sort((a: any, b: any) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });

        setLeads(sortedLeads.map((l: any) => ({
          id: l.id,
          nome: l.nome,
          telefone: l.telefone,
          concurso: l.concurso,
          assignedTo: l.assigned_to,
          status: l.status || 'PENDING',
          createdAt: l.created_at || new Date().toISOString()
        })));
      }

      // 3. Carregar Chamadas
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
          recordingUrl: c.recording_url
        })));
      }

      setMissingTables(foundMissing);

    } catch (err: any) {
      setDbError("Falha na conexão.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const userSub = supabase.channel('users_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, () => fetchData()).subscribe();
    const leadsSub = supabase.channel('leads_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData()).subscribe();
    return () => { 
      supabase.removeChannel(userSub);
      supabase.removeChannel(leadsSub);
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

  const handleLogCall = (call: CallRecord) => {
    supabase.from('calls').insert([{ lead_id: call.leadId, seller_id: call.sellerId, status: call.status, duration_seconds: call.durationSeconds, recording_url: call.recordingUrl }]).then(({ error }) => {
      supabase.from('leads').update({ status: 'CALLED' }).eq('id', call.leadId).then(fetchData);
    });
  };

  const handleDistributeLeads = async () => {
    // 1. Vendedores ONLINE
    const activeSellers = users.filter(u => u.online && u.tipo === 'vendedor');
    if (activeSellers.length === 0) {
      alert("ERRO: Nenhum vendedor está ONLINE no momento. Use a aba 'Equipe' para ligar os vendedores.");
      return;
    }

    // 2. Leads que não tem ninguém atribuído (independentemente do status escrito)
    const { data: unassignedLeads, error: leadErr } = await supabase
      .from('leads')
      .select('id')
      .is('assigned_to', null);

    if (leadErr) { alert("Erro ao buscar leads: " + leadErr.message); return; }
    if (!unassignedLeads || unassignedLeads.length === 0) { alert("Não há leads aguardando distribuição."); return; }

    // 3. Distribuir Round-Robin
    let count = 0;
    for (let i = 0; i < unassignedLeads.length; i++) {
      const sellerId = activeSellers[i % activeSellers.length].id;
      const { error: updErr } = await supabase.from('leads').update({ assigned_to: sellerId }).eq('id', unassignedLeads[i].id);
      if (!updErr) count++;
    }

    await fetchData();
    alert(`Sucesso! ${count} leads foram distribuídos entre ${activeSellers.length} vendedores.`);
  };

  const handleImportLeads = async (newLeads: Lead[]) => {
    const leadsToInsert = newLeads.map(({ nome, telefone, concurso }) => ({ nome, telefone, concurso }));
    const { error } = await supabase.from('leads').insert(leadsToInsert);
    if (error) { alert("Erro ao salvar leads: " + error.message); } else {
      setTimeout(async () => { await fetchData(); alert(`Importação concluída!`); }, 500);
    }
  };

  const copySqlToClipboard = () => {
    const sql = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE IF NOT EXISTS usuarios ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, email TEXT UNIQUE, tipo TEXT DEFAULT 'vendedor', online BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS leads ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, telefone TEXT, concurso TEXT, status TEXT DEFAULT 'PENDING', assigned_to UUID REFERENCES usuarios(id), created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS calls ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), lead_id UUID REFERENCES leads(id) ON DELETE CASCADE, seller_id UUID REFERENCES usuarios(id) ON DELETE SET NULL, status TEXT NOT NULL, duration_seconds INTEGER DEFAULT 0, timestamp TIMESTAMPTZ DEFAULT NOW(), recording_url TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
alter publication supabase_realtime add table usuarios, leads, calls;
NOTIFY pgrst, 'reload schema';`;
    navigator.clipboard.writeText(sql.trim());
    alert("SQL Copiado!");
  };

  if (isLoading) return <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white font-black italic uppercase tracking-tighter">Carregando... <Loader2 className="ml-2 animate-spin" /></div>;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-indigo-600 p-10 text-white text-center">
            <h1 className="text-3xl font-black italic tracking-tighter">CallMaster <span className="text-indigo-200">PRO</span></h1>
            <p className="text-[10px] mt-1 opacity-70 font-black uppercase tracking-[0.2em]">Painel de Gestão de Leads</p>
          </div>
          <form onSubmit={handleAuth} className="p-10 space-y-6">
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black border border-red-100 uppercase tracking-wider">{error}</div>}
            {successMsg && <div className="bg-green-50 text-green-700 p-4 rounded-2xl text-[10px] font-black border border-green-100 uppercase tracking-wider">{successMsg}</div>}
            {missingTables.length > 0 && (
              <div className="bg-orange-50 border-2 border-orange-100 p-5 rounded-3xl">
                <p className="text-[10px] font-black text-orange-600 uppercase mb-3 flex items-center gap-2"><AlertCircle className="w-4" /> Banco de Dados Pendente</p>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={copySqlToClipboard} className="w-full bg-orange-600 text-white py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"><Copy className="w-3" /> Copiar Código SQL</button>
                  <button type="button" onClick={fetchData} className="w-full bg-white border border-orange-200 text-orange-600 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"><RefreshCw className="w-3" /> Sincronizar Agora</button>
                </div>
              </div>
            )}
            {isRegistering && (
              <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nome Completo</label><input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-600 transition-all font-bold" placeholder="Ex: João Silva" /></div>
            )}
            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">E-mail de Acesso</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-600 transition-all font-bold" placeholder="seu@email.com" /></div>
            <div className="space-y-1"><label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Senha</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-600 transition-all font-bold" placeholder="••••••••" /></div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl shadow-indigo-100 uppercase tracking-tighter text-sm">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <>{isRegistering ? 'Criar Minha Conta' : 'Entrar no Sistema'} <ArrowRight className="w-5" /></>}
            </button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:underline">{isRegistering ? 'Voltar para Login' : 'Não tem conta? Registre-se aqui'}</button>
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
