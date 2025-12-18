
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
        console.error("Leads error:", leadError);
        if (leadError.message.toLowerCase().includes("assigned_to")) {
           foundMissing.push('coluna assigned_to');
        } else if (leadError.message.toLowerCase().includes("does not exist")) {
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
          recording_url: c.recording_url
        })));
      }

      setMissingTables([...new Set(foundMissing)]);

    } catch (err: any) {
      setDbError("Erro na sincronização.");
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
    // 1. Vendedores ONLINE (Deve ser 'vendedor' e estar 'online')
    const activeSellers = users.filter(u => u.online && u.tipo === 'vendedor');
    
    if (activeSellers.length === 0) {
      alert("ERRO: Nenhum vendedor está ONLINE. Vá na aba 'Equipe' e clique em 'Ligar Agora' para os vendedores disponíveis.");
      return;
    }

    // 2. Buscar IDs de leads sem vendedor atribuído
    const { data: unassignedLeads, error: leadErr } = await supabase
      .from('leads')
      .select('id')
      .is('assigned_to', null);

    if (leadErr) { 
       if (leadErr.message.toLowerCase().includes("assigned_to")) {
         alert("ERRO DE BANCO: A coluna 'assigned_to' não existe na tabela 'leads'. Por favor, execute o comando SQL de reparo no botão laranja.");
       } else {
         alert("Erro ao buscar leads: " + leadErr.message);
       }
       return; 
    }
    
    if (!unassignedLeads || unassignedLeads.length === 0) { 
      alert("Não há leads pendentes de distribuição na base."); 
      return; 
    }

    // 3. Distribuição Round-Robin
    let count = 0;
    for (let i = 0; i < unassignedLeads.length; i++) {
      const sellerId = activeSellers[i % activeSellers.length].id;
      const { error: updErr } = await supabase
        .from('leads')
        .update({ assigned_to: sellerId })
        .eq('id', unassignedLeads[i].id);
      
      if (!updErr) count++;
    }

    await fetchData();
    alert(`Distribuição Concluída: ${count} leads distribuídos para ${activeSellers.length} vendedores ativos.`);
  };

  const handleImportLeads = async (newLeads: Lead[]) => {
    const leadsToInsert = newLeads.map(({ nome, telefone, concurso }) => ({ nome, telefone, concurso }));
    const { error } = await supabase.from('leads').insert(leadsToInsert);
    if (error) { 
      alert("Erro ao importar: " + error.message); 
    } else {
      setTimeout(async () => { 
        await fetchData(); 
        alert(`Sucesso! ${newLeads.length} leads importados. Clique agora no botão azul '2. Distribuir Leads' para enviar para a equipe.`); 
      }, 500);
    }
  };

  const copySqlToClipboard = () => {
    const sql = `
-- COMANDO DE REPARO COMPLETO (Copie tudo)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS usuarios ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, email TEXT UNIQUE, tipo TEXT DEFAULT 'vendedor', online BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW());

CREATE TABLE IF NOT EXISTS leads ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), nome TEXT, telefone TEXT, concurso TEXT, status TEXT DEFAULT 'PENDING', created_at TIMESTAMPTZ DEFAULT NOW());

-- CORREÇÃO DA COLUNA MISSING
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='assigned_to') THEN
    ALTER TABLE leads ADD COLUMN assigned_to UUID REFERENCES usuarios(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS calls ( id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), lead_id UUID REFERENCES leads(id) ON DELETE CASCADE, seller_id UUID REFERENCES usuarios(id) ON DELETE SET NULL, status TEXT NOT NULL, duration_seconds INTEGER DEFAULT 0, timestamp TIMESTAMPTZ DEFAULT NOW(), recording_url TEXT);

alter publication supabase_realtime add table usuarios, leads, calls;
NOTIFY pgrst, 'reload schema';
    `.trim();
    navigator.clipboard.writeText(sql);
    alert("Código SQL de REPARO copiado! Cole no SQL Editor do Supabase e clique em RUN.");
  };

  if (isLoading) return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white space-y-4">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-400" />
      <p className="font-black italic uppercase tracking-widest text-sm">CallMaster Pro está iniciando...</p>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-700">
          <div className="bg-indigo-600 p-12 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <h1 className="text-4xl font-black italic tracking-tighter mb-2">CallMaster <span className="text-indigo-200">PRO</span></h1>
            <div className="h-1 w-12 bg-white/30 mx-auto rounded-full"></div>
            <p className="text-[10px] mt-4 opacity-70 font-black uppercase tracking-[0.3em]">Gestão de Atendimento 2.0</p>
          </div>
          <form onSubmit={handleAuth} className="p-12 space-y-6">
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-[10px] font-black border border-red-100 uppercase tracking-widest text-center">{error}</div>}
            {successMsg && <div className="bg-green-50 text-green-700 p-4 rounded-2xl text-[10px] font-black border border-green-100 uppercase tracking-widest text-center">{successMsg}</div>}
            
            {missingTables.length > 0 && (
              <div className="bg-orange-50 border-2 border-orange-100 p-6 rounded-[2rem] animate-pulse">
                <p className="text-[10px] font-black text-orange-700 uppercase mb-4 flex items-center gap-2"><AlertCircle className="w-5" /> REPARO DE BANCO NECESSÁRIO</p>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={copySqlToClipboard} className="w-full bg-orange-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-orange-100"><Copy className="w-4" /> Copiar SQL de Reparo</button>
                  <button type="button" onClick={fetchData} className="w-full bg-white border-2 border-orange-200 text-orange-600 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center justify-center gap-2 active:scale-95 transition-all"><RefreshCw className="w-4" /> Verificar Correção</button>
                </div>
              </div>
            )}

            {!isRegistering ? (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Acesso Administrativo</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-bold text-sm" placeholder="seu@email.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Senha Segura</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-bold text-sm" placeholder="••••••••" />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nome do Vendedor</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-bold text-sm" placeholder="Ex: Lucas Mendes" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">E-mail de Trabalho</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-bold text-sm" placeholder="vendedor@empresa.com" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Crie uma Senha</label>
                  <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-bold text-sm" placeholder="Mínimo 6 caracteres" />
                </div>
              </>
            )}

            <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black flex items-center justify-center gap-4 active:scale-95 transition-all shadow-2xl shadow-indigo-200 uppercase tracking-tighter text-sm">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <>{isRegistering ? 'Efetuar Cadastro' : 'Entrar no Dashboard'} <ArrowRight className="w-5" /></>}
            </button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-indigo-600 font-black text-[10px] uppercase tracking-[0.2em] hover:opacity-70 transition-opacity">{isRegistering ? '← Voltar para Login' : 'Não possui conta? Registre Vendedor'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout user={currentUser} onLogout={handleLogout}>
      {missingTables.length > 0 && (
        <div className="mb-8 bg-orange-50 border-2 border-orange-200 p-8 rounded-[3rem] flex flex-col lg:flex-row items-center gap-6 shadow-sm border-dashed">
          <div className="bg-orange-600 p-5 rounded-[2rem] text-white shadow-xl shadow-orange-100 animate-bounce"><AlertCircle className="w-8 h-8" /></div>
          <div className="flex-1 text-center lg:text-left">
            <h3 className="font-black uppercase text-lg tracking-tighter text-orange-900">Correção de Banco Necessária</h3>
            <p className="text-xs font-bold text-orange-700 opacity-80 uppercase tracking-wider">A coluna de atribuição de leads não foi encontrada no seu Supabase.</p>
          </div>
          <div className="flex gap-3 w-full lg:w-auto">
            <button onClick={copySqlToClipboard} className="flex-1 lg:flex-none bg-orange-600 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-orange-700 transition-all shadow-lg active:scale-95"><Copy className="w-4" /> Copiar SQL</button>
            <button onClick={fetchData} className="flex-1 lg:flex-none bg-white border-2 border-orange-200 text-orange-600 px-8 py-4 rounded-2xl text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-orange-50 transition-all active:scale-95"><RefreshCw className="w-4" /> Recarregar</button>
          </div>
        </div>
      )}
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
