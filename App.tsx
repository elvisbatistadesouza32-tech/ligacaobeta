
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

  // Busca de dados PRESERVANDO OS IDs ORIGINAIS (UUID)
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
          id: u.id, // MANTÉM RAW UUID
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
          assignedTo: l.assigned_to || null, // MANTÉM RAW UUID
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

  // Realtime listener
  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'usuarios' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const restoreSession = useCallback(async (isFirstLoad = false) => {
    if (isFirstLoad) setIsInitialLoading(true);
    try {
      const masterSession = localStorage.getItem('cm_master_session');
      if (masterSession === 'active') {
        setCurrentUser({ id: '00000000-0000-0000-0000-000000000000', nome: 'Admin Gestor', email: MASTER_ADMIN_EMAIL, tipo: 'adm', online: true });
        await fetchData();
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const userEmail = session.user.email?.toLowerCase().trim();
        const { data: profile } = await supabase.from('usuarios').select('*').eq('email', userEmail).maybeSingle();

        if (profile) {
          setCurrentUser({
            id: profile.id, // USA O ID DO BANCO
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
    }
  };

  const handleImportLeads = async (newLeads: Lead[], distributionMode: string) => {
    const activeSellers = users.filter(u => u.tipo === 'vendedor');
    const leadsToInsert = newLeads.map((l, i) => {
      let assignedTo: any = null;
      if (distributionMode === 'balanced' && activeSellers.length > 0) {
        assignedTo = activeSellers[i % activeSellers.length].id;
      } else if (distributionMode !== 'none' && distributionMode.length > 5) {
        assignedTo = distributionMode;
      }
      return {
        nome: l.nome,
        concurso: l.concurso || 'Geral',
        telefone: l.telefone.replace(/\D/g, ''),
        status: 'PENDING',
        assigned_to: assignedTo || null
      };
    });
    const { error } = await supabase.from('leads').insert(leadsToInsert);
    if (error) throw error;
  };

  const handleDistributeLeads = async () => {
    // Tenta primeiro os online
    let targetSellers = users.filter(u => u.tipo === 'vendedor' && u.online);
    
    // Se não houver ninguém online, pega todos os vendedores cadastrados
    if (targetSellers.length === 0) {
      targetSellers = users.filter(u => u.tipo === 'vendedor');
    }

    if (targetSellers.length === 0) {
      return alert("Nenhum vendedor cadastrado no sistema para receber leads.");
    }
    
    const { data: unassigned } = await supabase
      .from('leads')
      .select('id')
      .is('assigned_to', null)
      .eq('status', 'PENDING');
    
    if (!unassigned || unassigned.length === 0) return alert("Fila Geral Vazia.");
    
    setIsSyncing(true);
    try {
      const updates = unassigned.map((lead, i) => {
        const seller = targetSellers[i % targetSellers.length];
        return supabase.from('leads').update({ assigned_to: seller.id }).eq('id', lead.id);
      });
      await Promise.all(updates);
      const msg = users.some(u => u.tipo === 'vendedor' && u.online) 
        ? `${unassigned.length} leads distribuídos entre os vendedores online!`
        : `${unassigned.length} leads distribuídos entre todos os vendedores (ninguém estava online).`;
      alert(msg);
    } catch (err) {
      alert("Erro na distribuição.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    await supabase.from('usuarios').update({ online: !user.online }).eq('id', userId);
  };

  const handlePromoteUser = async (userId: string) => {
    await supabase.from('usuarios').update({ tipo: 'adm' }).eq('id', userId);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Excluir usuário?")) return;
    await supabase.from('usuarios').delete().eq('id', userId);
  };

  const handleTransferLeads = async (fromUserId: string, toUserId: string) => {
    if (!toUserId) return;
    const { error } = await supabase.from('leads').update({ assigned_to: toUserId }).eq('assigned_to', fromUserId).eq('status', 'PENDING');
    if (!error) alert("Fila transferida!");
  };

  if (isInitialLoading) return (
    <div className="min-h-screen bg-indigo-950 flex flex-col items-center justify-center text-white font-sans">
      <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mb-4" />
      <p className="font-black uppercase italic tracking-widest text-[10px]">Verificando Credenciais...</p>
    </div>
  );

  if (!currentUser) return (
    <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-6 text-white font-sans">
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
      }} className="w-full max-w-md bg-white text-gray-900 p-10 rounded-[3rem