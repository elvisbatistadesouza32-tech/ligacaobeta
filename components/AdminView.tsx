
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { 
  Users, PhoneIncoming, Upload, Database, 
  Play, Clock, ArrowRightLeft, Power, PowerOff, TrendingUp, CheckCircle, XCircle, AlertTriangle, Calendar, Mic2, Loader2, X, ListChecks, Trash2, ShieldCheck, UserPlus, MoveRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface AdminViewProps {
  users: User[];
  leads: Lead[];
  calls: CallRecord[];
  onImportLeads: (leads: Lead[]) => void;
  onDistributeLeads: () => void;
  onToggleUserStatus: (userId: string) => void;
  onPromoteUser: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
  onTransferLeads: (fromUserId: string, toUserId: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ 
  users, leads, calls, onImportLeads, onDistributeLeads, onToggleUserStatus, onPromoteUser, onDeleteUser, onTransferLeads
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'history' | 'leads'>('stats');
  const [viewMode, setViewMode] = useState<'geral' | 'individual'>('geral');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [playingCall, setPlayingCall] = useState<CallRecord | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [transferModal, setTransferModal] = useState<{ fromId: string; fromName: string } | null>(null);
  const [targetSellerId, setTargetSellerId] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const sellers = useMemo(() => users.filter(u => u.tipo === 'vendedor'), [users]);

  const sellerPerformance = useMemo(() => {
    return sellers.map(seller => {
      const sellerCalls = calls.filter(c => c.sellerId === seller.id);
      const answered = sellerCalls.filter(c => c.status === CallStatus.ANSWERED).length;
      const duration = sellerCalls.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
      const pendingLeads = leads.filter(l => l.assignedTo === seller.id && l.status === 'PENDING').length;
      
      return {
        ...seller,
        totalCalls: sellerCalls.length,
        answered,
        duration,
        pendingLeads
      };
    }).sort((a, b) => b.totalCalls - a.totalCalls);
  }, [sellers, calls, leads]);

  const timelineCalls = useMemo(() => {
    let filtered = [...calls];
    if (viewMode === 'individual' && selectedSellerId) {
      filtered = filtered.filter(c => c.sellerId === selectedSellerId);
    }
    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [calls, viewMode, selectedSellerId]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const currentStats = useMemo(() => {
    const activeCalls = viewMode === 'individual' && selectedSellerId 
      ? calls.filter(c => c.sellerId === selectedSellerId)
      : calls;
    const activeLeadsCount = viewMode === 'individual' && selectedSellerId
      ? leads.filter(l => l.assignedTo === selectedSellerId && l.status === 'PENDING').length
      : leads.filter(l => !l.assignedTo).length;
    const duration = activeCalls.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
    return { total: activeCalls.length, duration, leads: activeLeadsCount };
  }, [calls, leads, viewMode, selectedSellerId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // Processa todas as linhas, mesmo as com colunas vazias
        const rawData = data.slice(1).filter(row => row.length > 0 && (row[0] || row[2]));
        
        if (rawData.length === 0) {
          setNotification({ message: "Planilha sem dados válidos.", type: 'error' });
          setIsImporting(false);
          return;
        }

        const newLeads = rawData.map((row, i) => {
          const nome = String(row[0] || `Lead ${i+1}`).trim();
          const concurso = String(row[1] || 'Geral').trim();
          const fone = String(row[2] || '').replace(/\D/g, '');
          
          if (fone.length >= 8) {
            return {
              id: `imp-${Date.now()}-${i}`,
              nome,
              concurso,
              telefone: fone,
              status: 'PENDING'
            };
          }
          return null;
        }).filter(Boolean);

        if (newLeads.length === 0) {
          setNotification({ message: "Nenhum telefone válido encontrado na planilha.", type: 'error' });
        } else {
          onImportLeads(newLeads as any);
          setNotification({ 
            message: `Importados ${newLeads.length} de ${rawData.length} leads processados.`, 
            type: 'success' 
          });
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        setNotification({ message: "Erro crítico ao processar XLSX.", type: 'error' });
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const executeTransfer = () => {
    if (!transferModal || !targetSellerId) return;
    onTransferLeads(transferModal.fromId, targetSellerId);
    setTransferModal(null);
    setTargetSellerId('');
    setNotification({ message: "Fila de leads transferida!", type: 'success' });
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Toast */}
      {notification && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[200] px-10 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-10 duration-300 border-2 ${notification.type === 'success' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-red-600 border-red-400 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          <span className="font-black uppercase text-xs tracking-tighter italic">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-all"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Modal de Transferência */}
      {transferModal && (
        <div className="fixed inset-0 z-[210] bg-indigo-950/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white rounded-[4rem] w-full max-w-md p-12 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic mb-2 text-center">Transferir Fila</h3>
            <p className="text-gray-400 text-center text-xs font-bold uppercase mb-8">Passar leads de: {transferModal.fromName}</p>
            
            <div className="space-y-6">
              <select 
                value={targetSellerId} 
                onChange={(e) => setTargetSellerId(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 p-6 rounded-3xl font-bold text-sm outline-none focus:border-indigo-600"
              >
                <option value="">Escolha o novo vendedor...</option>
                {sellers.filter(s => s.id !== transferModal.fromId).map(s => (
                  <option key={s.id} value={s.id}>{s.nome} ({s.online ? 'Online' : 'Offline'})</option>
                ))}
              </select>

              <div className="flex gap-4">
                <button onClick={() => setTransferModal(null)} className="flex-1 py-5 rounded-2xl font-black uppercase text-[10px] border-2 border-gray-100 text-gray-400">Voltar</button>
                <button onClick={executeTransfer} disabled={!targetSellerId} className="flex-1 py-5 rounded-2xl font-black uppercase text-[10px] bg-indigo-600 text-white shadow-lg disabled:opacity-50">Transferir Agora</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Menu Tabs */}
      <div className="flex bg-white p-2 rounded-[2.5rem] shadow-sm border overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><TrendingUp className="w-4" /> Dashboard</button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Users className="w-4" /> Equipe</button>
        <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Database className="w-4" /> Leads</button>
        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><PhoneIncoming className="w-4" /> Logs</button>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white px-10 py-6 rounded-[3rem] border-2 border-gray-100">
            <div className="flex bg-gray-100 p-1.5 rounded-2xl">
              <button onClick={() => setViewMode('geral')} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${viewMode === 'geral' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>Geral</button>
              <button onClick={() => setViewMode('individual')} className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${viewMode === 'individual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}>Individual</button>
            </div>
            {viewMode === 'individual' && (
              <select value={selectedSellerId} onChange={(e) => setSelectedSellerId(e.target.value)} className="bg-indigo-50 border-2 border-indigo-100 text-indigo-900 font-black text-[10px] uppercase py-3 px-8 rounded-2xl outline-none">
                <option value="">Selecionar Vendedor...</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
             <div className="bg-white p-10 rounded-[3rem] border-2 border-gray-100 shadow-sm">
                <p className="text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] mb-2">Chamadas</p>
                <p className="text-5xl font-black text-gray-900 tracking-tighter">{currentStats.total}</p>
             </div>
             <div className="bg-white p-10 rounded-[3rem] border-2 border-gray-100 shadow-sm">
                <p className="text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] mb-2">Tempo em Linha</p>
                <p className="text-5xl font-black text-indigo-600 tracking-tighter">{formatDuration(currentStats.duration)}</p>
             </div>
             <div className="bg-white p-10 rounded-[3rem] border-2 border-gray-100 shadow-sm">
                <p className="text-gray-400 text-[11px] font-black uppercase tracking-[0.2em] mb-2">{viewMode === 'individual' ? 'Fila Individual' : 'Leads Livres'}</p>
                <p className="text-5xl font-black text-orange-500 tracking-tighter">{currentStats.leads}</p>
             </div>
          </div>

          {viewMode === 'geral' ? (
            <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
              <div className="px-12 py-10 border-b bg-gray-50/30">
                <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900 italic">Desempenho da Equipe</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white text-[11px] uppercase text-gray-400 tracking-widest font-black">
                    <tr>
                      <th className="px-12 py-8 text-left">Vendedor</th>
                      <th className="px-12 py-8 text-center">Ligações</th>
                      <th className="px-12 py-8 text-center text-orange-600">Leads Pendentes</th>
                      <th className="px-12 py-8 text-right">Controle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sellerPerformance.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-indigo-50/10 transition-all">
                        <td className="px-12 py-8">
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-gray-300">#{idx + 1}</span>
                            <span className="font-black text-sm uppercase tracking-tighter text-gray-800">{s.nome}</span>
                          </div>
                        </td>
                        <td className="px-12 py-8 text-center font-black text-gray-900">{s.totalCalls}</td>
                        <td className="px-12 py-8 text-center">
                          <span className={`px-4 py-1.5 rounded-full font-black text-[10px] ${s.pendingLeads > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                            {s.pendingLeads} PENDENTES
                          </span>
                        </td>
                        <td className="px-12 py-8 text-right">
                          {s.pendingLeads > 0 && (
                            <button 
                              onClick={() => setTransferModal({ fromId: s.id, fromName: s.nome })}
                              className="bg-gray-100 hover:bg-indigo-600 hover:text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase transition-all flex items-center gap-2 ml-auto"
                            >
                              <MoveRight className="w-3.5 h-3.5" /> Transferir Leads
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              <div className="xl:col-span-3 bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
                <div className="px-12 py-10 border-b flex justify-between items-center bg-gray-50/30">
                  <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900 italic">Histórico de Hoje</h3>
                </div>
                <div className="overflow-x-auto max-h-[500px] scrollbar-hide">
                  <table className="w-full">
                    <thead className="bg-white text-[10px] uppercase text-gray-400 tracking-widest font-black sticky top-0 border-b">
                      <tr><th className="px-12 py-6 text-left">Hora</th><th className="px-12 py-6 text-left">Status</th><th className="px-12 py-8 text-right">Ouvir</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {timelineCalls.map(c => (
                        <tr key={c.id} className="hover:bg-indigo-50/20">
                          <td className="px-12 py-8">
                            <p className="font-black text-sm text-gray-800">{new Date(c.timestamp).toLocaleTimeString('pt-BR')}</p>
                          </td>
                          <td className="px-12 py-8">
                            <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase border ${c.status === CallStatus.ANSWERED ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>{c.status}</span>
                          </td>
                          <td className="px-12 py-8 text-right">
                            <button onClick={() => setPlayingCall(c)} className="p-4 bg-gray-100 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all"><Play className="w-4 h-4 fill-current" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-indigo-950 rounded-[3.5rem] p-10 text-white flex flex-col items-center justify-center text-center">
                {playingCall ? (
                  <div className="space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl animate-pulse"><Mic2 /></div>
                    <h4 className="font-black italic uppercase tracking-tighter text-sm">Monitoria Ativa</h4>
                    <button className="w-16 h-16 bg-white text-indigo-950 rounded-full flex items-center justify-center mx-auto shadow-xl hover:scale-110 active:scale-95 transition-all"><Play fill="currentColor" /></button>
                  </div>
                ) : (
                  <p className="text-xs font-black uppercase opacity-30 italic">Nenhum áudio selecionado</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm animate-in slide-in-from-bottom-5 duration-500">
          <div className="p-12 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="font-black text-3xl uppercase tracking-tighter text-indigo-950 italic">Controle de Operadores</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-400 tracking-widest font-black">
                <tr><th className="px-12 py-8 text-left">Nome</th><th className="px-12 py-8 text-left">Função</th><th className="px-12 py-8 text-right">Gerenciar</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-all">
                    <td className="px-12 py-8 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                        <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.nome}&background=6366f1&color=fff`} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-black text-sm uppercase tracking-tighter">{u.nome}</p>
                        <p className="text-[10px] font-bold text-gray-400">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-12 py-8">
                      <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase border ${u.tipo === 'adm' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                        {u.tipo === 'adm' ? 'Admin' : 'Vendedor'}
                      </span>
                    </td>
                    <td className="px-12 py-8 text-right flex items-center justify-end gap-3">
                      <button onClick={() => onToggleUserStatus(u.id)} className={`p-4 rounded-2xl transition-all ${u.online ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-300'}`} title="Marcar Online/Offline">
                        <Power className="w-5 h-5" />
                      </button>
                      {u.tipo !== 'adm' && (
                        <button onClick={() => onPromoteUser(u.id)} className="p-4 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white rounded-2xl transition-all" title="Tornar Admin">
                          <ShieldCheck className="w-5 h-5" />
                        </button>
                      )}
                      {u.id !== 'master-admin' && (
                        <button onClick={() => onDeleteUser(u.id)} className="p-4 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-2xl transition-all" title="Excluir Definitivamente">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-5 duration-500">
          <div 
            className="bg-white p-16 rounded-[4rem] border-2 border-dashed border-gray-200 hover:border-indigo-600 hover:bg-indigo-50/10 flex flex-col items-center text-center gap-8 transition-all group cursor-pointer relative" 
            onClick={() => !isImporting && fileInputRef.current?.click()}
          >
             {isImporting && (
               <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-50 flex flex-col items-center justify-center rounded-[4rem]">
                 <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-6" />
                 <p className="font-black text-lg uppercase italic tracking-tighter text-indigo-950">Injetando Leads...</p>
               </div>
             )}
             <div className="w-28 h-28 bg-indigo-50 rounded-[3rem] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xl ring-8 ring-white">
                <Upload className="w-12 h-12" />
             </div>
             <div className="space-y-4">
               <h3 className="font-black text-3xl uppercase tracking-tighter italic text-indigo-950">Alimentar Base</h3>
               <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Clique aqui para subir sua planilha</p>
             </div>
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
          </div>

          <div className="bg-indigo-600 p-16 rounded-[4rem] text-white flex flex-col items-center text-center gap-8 hover:bg-indigo-700 transition-all shadow-2xl group cursor-pointer" onClick={onDistributeLeads}>
             <div className="w-28 h-28 bg-white/10 rounded-[3rem] flex items-center justify-center group-hover:scale-110 transition-all shadow-2xl ring-8 ring-white/10">
                <ArrowRightLeft className="w-12 h-12" />
             </div>
             <div className="space-y-4">
               <h3 className="font-black text-3xl uppercase tracking-tighter italic">Distribuir Leads</h3>
               <p className="text-xs font-black text-indigo-200 uppercase tracking-[0.3em]">Repartir entre vendedores online</p>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="p-12 border-b bg-gray-50/50">
            <h3 className="font-black text-3xl uppercase tracking-tighter text-indigo-950 italic">Log Universal</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-400 tracking-widest font-black">
                <tr><th className="px-12 py-8">Vendedor</th><th className="px-12 py-8 text-center">Status</th><th className="px-12 py-8 text-right">Data/Hora</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calls.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-12 py-8">
                      <p className="font-black text-sm uppercase">{users.find(u => u.id === c.sellerId)?.nome || 'Sistema'}</p>
                    </td>
                    <td className="px-12 py-8 text-center">
                      <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase border ${c.status === CallStatus.ANSWERED ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{c.status}</span>
                    </td>
                    <td className="px-12 py-8 text-right font-mono text-[10px] font-bold text-gray-400">{new Date(c.timestamp).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
