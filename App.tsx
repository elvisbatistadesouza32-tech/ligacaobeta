
import React, { useState, useEffect } from 'react';
import { User, Lead, CallRecord, UserRole, UserStatus } from './types';
import { Layout } from './components/Layout';
import { SellerView } from './components/SellerView';
import { AdminView } from './components/AdminView';
import { ShieldCheck, LogIn, Loader2, Mail, Lock, UserPlus, ArrowRight, AlertCircle, Database, CheckCircle2 } from 'lucide-react';
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
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const { data: userData, error: userError } = await supabase.from('usuarios').select('id, nome, email, tipo, online');
      const { data: leadData } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      const { data: callData } = await supabase.from('calls').select('*');

      if (userError) {
        setDbError(`Erro na conexão com o banco de dados.`);
      } else {
        setDbError(null);
      }

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
      
      if (leadData) {
        setLeads(leadData.map((l: any) => ({
          id: l.id,
          nome: l.nome,
          telefone: l.telefone, // Coluna telefone
          concurso: l.concurso,
          assignedTo: l.assigned_to,
          status: l.status,
          createdAt: l.created_at
        })));
      }

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
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
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
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const lowerEmail = email.toLowerCase().trim();

      if (lowerEmail === MASTER_ADMIN_EMAIL && password === ADMIN_MASTER_PASSWORD) {
        const userInDb = users.find(u => u.email.toLowerCase() === lowerEmail);
        setCurrentUser({
          id: userInDb?.id || 'master-admin',
          nome: userInDb?.nome || 'Administrador Mestre',
          email: MASTER_ADMIN_EMAIL,
          tipo: 'adm',
          online: true,
          avatar: `https://ui-avatars.com/api/?name=Admin&background=6366f1&color=fff`
        });
        return;
      }

      if (isRegistering) {
        const userExists = users.some(u => u.email.toLowerCase() === lowerEmail);
        if (userExists) throw new Error("Este e-mail já está cadastrado.");

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
        if (!user) throw new Error("Usuário não encontrado na base de dados.");

        setCurrentUser(user);
        await supabase.from('usuarios').update({ online: true }).eq('email', lowerEmail);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (currentUser && currentUser.id !== 'master-admin') {
      await supabase.from('usuarios').update({ online: false }).eq('email', currentUser.email);
    }
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const handleLogCall = (call: CallRecord) => {
    supabase.from('calls').insert([{
      lead_id: call.leadId,
      seller_id: call.sellerId,
      status: call.status,
      duration_seconds: call.durationSeconds,
      recording_url: call.recordingUrl
    }]).then(() => {
      supabase.from('leads').update({ status: 'CALLED' }).eq('id', call.leadId).then(fetchData);
    });
  };

  const handleDistributeLeads = async () => {
    const { data: activeSellers } = await supabase.from('usuarios').select('id').eq('online', true).eq('tipo', 'vendedor');
    const { data: unassignedLeads } = await supabase.from('leads').select('id').is('assigned_to', null).eq('status', 'PENDING');

    if (!activeSellers || activeSellers.length === 0) return;
    if (!unassignedLeads || unassignedLeads.length === 0) return;

    for (let i = 0; i < unassignedLeads.length; i++) {
      const sellerId = activeSellers[i % activeSellers.length].id;
      await supabase.from('leads').update({ assigned_to: sellerId }).eq('id', unassignedLeads[i].id);
    }
    
    await fetchData();
  };

  const handleImportLeads = async (newLeads: Lead[]) => {
    const leadsToInsert = newLeads.map(l => ({ 
      nome: l.nome,
      telefone: l.telefone, // Coluna telefone
      concurso: l.concurso, 
      status: 'PENDING' 
    }));

    const { error } = await supabase.from('leads').insert(leadsToInsert);
    
    if (error) {
      alert("Erro ao salvar leads no banco: " + error.message + "\n\nIMPORTANTE: Verifique se as colunas 'nome', 'telefone' e 'concurso' existem na sua tabela 'leads'.");
    } else {
      await handleDistributeLeads();
      alert(`Importação bem-sucedida! ${leadsToInsert.length} leads importados.`);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-indigo-950 flex items-center justify-center text-white font-black italic">CALLMASTER PRO <Loader2 className="ml-2 animate-spin" /></div>;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
          <div className="bg-indigo-600 p-8 text-white text-center">
            <h1 className="text-2xl font-black italic">CallMaster <span className="text-indigo-200">PRO</span></h1>
            <p className="text-xs mt-1 opacity-70">Controle e Gestão de Vendas</p>
          </div>

          <form onSubmit={handleAuth} className="p-8 space-y-5">
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold border border-red-100">{error}</div>}
            {successMsg && <div className="bg-green-50 text-green-700 p-4 rounded-2xl text-xs font-bold border border-green-100">{successMsg}</div>}
            {isRegistering && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Nome</label>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl outline-none" />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">E-mail</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Senha</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-4 bg-gray-50 border rounded-2xl outline-none" />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <>{isRegistering ? 'Cadastrar' : 'Entrar'} <ArrowRight className="w-4" /></>}
            </button>
            <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="w-full text-indigo-600 font-bold text-xs">{isRegistering ? 'Já tenho conta' : 'Criar conta de vendedor'}</button>
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
          onToggleUserStatus={id => supabase.from('usuarios').update({ online: !users.find(u=>u.id===id)?.online }).eq('id',id).then(fetchData)} 
          onPromoteUser={id => supabase.from('usuarios').update({ tipo: 'adm' }).eq('id',id).then(fetchData)} 
        />
      ) : (
        <SellerView user={currentUser} leads={leads} onLogCall={handleLogCall} />
      )}
    </Layout>
  );
};

export default App;
