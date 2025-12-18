
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { 
  Users, PhoneIncoming, Upload, Database, 
  Play, Clock, ArrowRightLeft, Power, PowerOff, TrendingUp, CheckCircle, XCircle, AlertTriangle, Calendar, Mic2, Loader2, X, ListChecks
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
}

export const AdminView: React.FC<AdminViewProps> = ({ 
  users, leads, calls, onImportLeads, onDistributeLeads, onToggleUserStatus, onPromoteUser
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'history' | 'leads'>('stats');
  const [viewMode, setViewMode] = useState<'geral' | 'individual'>('geral');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [playingCall, setPlayingCall] = useState<CallRecord | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Filtro de vendedores
  const sellers = useMemo(() => users.filter(u => u.tipo === 'vendedor'), [users]);

  // Estatísticas calculadas por vendedor
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

  // Filtro de chamadas para a timeline
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

    return {
      total: activeCalls.length,
      duration,
      leads: activeLeadsCount
    };
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

        const rawData = data.slice(1).filter(row => row.length > 0 && row[0]);
        
        if (rawData.length === 0) {
          setNotification({ message: "Planilha vazia ou formato inválido.", type: 'error' });
          setIsImporting(false);
          return;
        }

        const newLeads = rawData.map((row, i) => ({
          id: `imp-${Date.now()}-${i}`,
          nome: String(row[0] || '').trim(),
          concurso: String(row[1] || 'Base Geral').trim(),
          telefone: String(row[2] || '').replace(/\D/g, ''),
          status: 'PENDING'
        })).filter(l => l.nome && l.telefone.length >= 8);

        await onImportLeads(newLeads as any);
        setNotification({ 
          message: `Importação Concluída: ${newLeads.length} leads adicionados com sucesso!`, 
          type: 'success' 
        });
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        setNotification({ message: "Erro crítico ao processar XLSX.", type: 'error' });
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {/* Notificação Toast */}
      {notification && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[200] px-10 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-10 duration-300 border-2 ${notification.type === 'success' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-red-600 border-red-400 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          <span className="font-black uppercase text-xs tracking-tighter italic">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Principais */}
      <div className="flex bg-white p-2 rounded-[2.5rem] shadow-sm border overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><TrendingUp className="w-4" /> Dashboard</button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Users className="w-4" /> Equipe</button>
        <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Database className="w-4" /> Leads</button>
        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><PhoneIncoming className="w-4" /> Logs</button>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Seletor de Visão e Vendedor */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white px-10 py-6 rounded-[3rem] border-2 border-gray-100">
            <div className="flex bg-gray-100 p-1.5 rounded-2xl">
              <button 
                onClick={() => setViewMode('geral')} 
                className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${viewMode === 'geral' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
              >
                Geral
              </button>
              <button 
                onClick={() => setViewMode('individual')} 
                className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase transition-all ${viewMode === 'individual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-700'}`}
              >
                Individual
              </button>
            </div>

            {viewMode === 'individual' && (
              <select 
                value={selectedSellerId} 
                onChange={(e) => setSelectedSellerId(e.target.value)}
                className="bg-indigo-50 border-2 border-indigo-100 text-indigo-900 font-black text-[10px] uppercase py-3 px-8 rounded-2xl outline-none focus:ring-4 ring-indigo-200/50 appearance-none cursor-pointer"
              >
                <option value="">Selecionar Vendedor...</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            )}
          </div>

          {/* Cards de Métricas */}
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
              <div className="px-12 py-10 border-b flex justify-between items-center">
                <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900 italic">Ranking de Performance</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-[11px] uppercase text-gray-400 tracking-widest font-black">
                    <tr>
                      <th className="px-12 py-8 text-left">Vendedor</th>
                      <th className="px-12 py-8 text-center">Ligações</th>
                      <th className="px-12 py-8 text-center">Efetivas</th>
                      <th className="px-12 py-8 text-center text-orange-600">Leads Pendentes</th>
                      <th className="px-12 py-8 text-right">Produtividade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sellerPerformance.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-indigo-50/20 transition-all cursor-default group">
                        <td className="px-12 py-8">
                          <div className="flex items-center gap-5">
                            <span className="text-sm font-black text-gray-300 w-6 italic">#{idx + 1}</span>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
                              <img src={s.avatar} className="w-full h-full object-cover" />
                            </div>
                            <span className="font-black text-sm uppercase tracking-tighter text-gray-800">{s.nome}</span>
                          </div>
                        </td>
                        <td className="px-12 py-8 text-center font-black text-gray-900">{s.totalCalls}</td>
                        <td className="px-12 py-8 text-center font-black text-green-600">{s.answered}</td>
                        <td className="px-12 py-8 text-center">
                          <span className={`px-4 py-1.5 rounded-full font-black text-xs ${s.pendingLeads > 10 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                            {s.pendingLeads}
                          </span>
                        </td>
                        <td className="px-12 py-8 text-right font-mono font-black text-indigo-600 italic text-sm">{formatDuration(s.duration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
              {/* Timeline de Chamadas */}
              <div className="xl:col-span-3 bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
                <div className="px-12 py-10 border-b flex justify-between items-center bg-gray-50/30">
                  <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900 italic">Cronologia do Dia</h3>
                  <Calendar className="w-6 h-6 text-indigo-200" />
                </div>
                <div className="overflow-x-auto max-h-[600px] scrollbar-hide">
                  <table className="w-full">
                    <thead className="bg-white text-[10px] uppercase text-gray-400 tracking-widest font-black sticky top-0 z-10 border-b shadow-sm">
                      <tr>
                        <th className="px-12 py-6 text-left">Horário</th>
                        <th className="px-12 py-6 text-left">Status</th>
                        <th className="px-12 py-6 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {timelineCalls.length > 0 ? (
                        timelineCalls.map(c => (
                          <tr key={c.id} className={`hover:bg-indigo-50/30 transition-all ${playingCall?.id === c.id ? 'bg-indigo-50' : ''}`}>
                            <td className="px-12 py-8">
                              <p className="font-black text-sm text-gray-900 uppercase">
                                {new Date(c.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </p>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                {new Date(c.timestamp).toLocaleDateString('pt-BR')}
                              </p>
                            </td>
                            <td className="px-12 py-8">
                              <div className="flex items-center gap-3">
                                {c.status === CallStatus.ANSWERED ? (
                                  <span className="bg-green-100 text-green-700 px-5 py-2 rounded-full font-black text-[10px] uppercase border border-green-200 shadow-sm">Atendida ({formatDuration(c.durationSeconds)})</span>
                                ) : (
                                  <span className="bg-red-100 text-red-700 px-5 py-2 rounded-full font-black text-[10px] uppercase border border-red-200 shadow-sm">Sem Resposta</span>
                                )}
                              </div>
                            </td>
                            <td className="px-12 py-8 text-right">
                              <button 
                                onClick={() => setPlayingCall(c)}
                                className={`p-4 rounded-2xl transition-all shadow-lg ${playingCall?.id === c.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-indigo-600 hover:bg-indigo-100'}`}
                              >
                                <Play className="w-5 h-5 fill-current" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={3} className="p-32 text-center text-gray-400 font-black uppercase text-xs italic">Selecione um vendedor ou realize chamadas para ver os dados.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sidebar do Player de Áudio */}
              <div className="bg-indigo-950 rounded-[3.5rem] p-12 text-white shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center min-h-[500px]">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/20 to-transparent pointer-events-none" />
                
                {playingCall ? (
                  <div className="relative z-10 w-full space-y-10 animate-in zoom-in-95 duration-500">
                    <div className="w-28 h-28 bg-indigo-600 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl ring-4 ring-indigo-500/30 animate-pulse">
                      <Mic2 className="w-12 h-12" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-3xl font-black italic uppercase tracking-tighter leading-none">Playback de Monitoria</h4>
                      <p className="text-[11px] font-black text-indigo-400 uppercase tracking-widest">ID: {playingCall.id.slice(0, 8)}</p>
                    </div>
                    <div className="bg-white/5 p-8 rounded-[3rem] border border-white/10 space-y-6 shadow-inner">
                       <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 w-[60%] animate-pulse" />
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-indigo-300">
                          <span>00:15</span>
                          <span>{formatDuration(playingCall.durationSeconds)}</span>
                       </div>
                       <div className="flex justify-center gap-6">
                         <button className="p-6 bg-white text-indigo-950 rounded-full shadow-2xl hover:scale-110 active:scale-90 transition-all">
                            <Play className="w-8 h-8 fill-current" />
                         </button>
                       </div>
                    </div>
                    <p className="text-[10px] font-black text-indigo-500 uppercase italic">Monitorando canal criptografado</p>
                  </div>
                ) : (
                  <div className="relative z-10 opacity-30 flex flex-col items-center gap-6">
                    <div className="w-20 h-20 border-4 border-dashed border-white/20 rounded-[2.5rem] flex items-center justify-center">
                      <Play className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-black uppercase tracking-widest italic leading-relaxed">Central de Escuta<br/><span className="text-[10px]">Aguardando seleção...</span></p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Outras Tabs (Users, History, Leads) */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm animate-in slide-in-from-bottom-5 duration-500">
          <div className="p-12 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="font-black text-3xl uppercase tracking-tighter text-indigo-950 italic">Controle de Operadores</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-400 tracking-widest font-black">
                <tr><th className="px-12 py-8 text-left">Membro</th><th className="px-12 py-8 text-left">Nível</th><th className="px-12 py-8 text-left">Status</th><th className="px-12 py-8 text-right">Ação</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-all">
                    <td className="px-12 py-8 flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                        <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.nome}&background=6366f1&color=fff`} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-black text-lg uppercase tracking-tighter leading-none">{u.nome}</p>
                        <p className="text-[11px] font-bold text-gray-400 mt-1">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-12 py-8">
                      <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase border ${u.tipo === 'adm' ? 'bg-purple-50 border-purple-200 text-purple-600' : 'bg-blue-50 border-blue-200 text-blue-600'}`}>
                        {u.tipo === 'adm' ? 'Admin Master' : 'Vendedor'}
                      </span>
                    </td>
                    <td className="px-12 py-8">
                      {u.online ? (
                        <div className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase">
                          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping" /> Em Operação
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-gray-300 uppercase italic">Offline</span>
                      )}
                    </td>
                    <td className="px-12 py-8 text-right">
                      <button onClick={() => onToggleUserStatus(u.id)} className={`p-5 rounded-3xl transition-all shadow-xl ${u.online ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        {u.online ? <PowerOff className="w-6 h-6" /> : <Power className="w-6 h-6" />}
                      </button>
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
                 <p className="font-black text-lg uppercase italic tracking-tighter text-indigo-950">Injetando Leads no Sistema...</p>
               </div>
             )}
             <div className="w-28 h-28 bg-indigo-50 rounded-[3rem] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xl ring-8 ring-white">
                <Upload className="w-12 h-12" />
             </div>
             <div className="space-y-4">
               <h3 className="font-black text-3xl uppercase tracking-tighter italic text-indigo-950">Alimentar Base</h3>
               <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Arraste aqui sua planilha XLSX / XLS</p>
               <div className="flex justify-center gap-3 pt-4">
                 <span className="bg-gray-100 text-[10px] font-black text-gray-400 px-4 py-2 rounded-full uppercase">Nome</span>
                 <span className="bg-gray-100 text-[10px] font-black text-gray-400 px-4 py-2 rounded-full uppercase">Concurso</span>
                 <span className="bg-gray-100 text-[10px] font-black text-gray-400 px-4 py-2 rounded-full uppercase">Fone</span>
               </div>
             </div>
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
          </div>

          <div 
            className="bg-indigo-600 p-16 rounded-[4rem] text-white flex flex-col items-center text-center gap-8 hover:bg-indigo-700 transition-all shadow-[0_30px_60px_-15px_rgba(79,70,229,0.3)] group cursor-pointer" 
            onClick={onDistributeLeads}
          >
             <div className="w-28 h-28 bg-white/10 rounded-[3rem] flex items-center justify-center group-hover:scale-110 transition-all shadow-2xl ring-8 ring-white/10">
                <ArrowRightLeft className="w-12 h-12" />
             </div>
             <div className="space-y-4">
               <h3 className="font-black text-3xl uppercase tracking-tighter italic">Disparar Fluxo</h3>
               <p className="text-xs font-black text-indigo-200 uppercase tracking-[0.3em]">Distribuir leads livres para vendedores online</p>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm animate-in slide-in-from-bottom-5 duration-500">
          <div className="p-12 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="font-black text-3xl uppercase tracking-tighter text-indigo-950 italic">Histórico Universal</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-400 tracking-widest font-black">
                <tr><th className="px-12 py-8">Operador</th><th className="px-12 py-8">Lead</th><th className="px-12 py-8">Resultado</th><th className="px-12 py-8 text-right">Duração</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calls.length > 0 ? (
                  [...calls].reverse().map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-all group">
                      <td className="px-12 py-8">
                        <p className="font-black text-base text-gray-900 uppercase tracking-tighter">{users.find(u => u.id === c.sellerId)?.nome || 'Sistema'}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{new Date(c.timestamp).toLocaleString('pt-BR')}</p>
                      </td>
                      <td className="px-12 py-8">
                        <div className="flex items-center gap-3">
                          <ListChecks className="w-4 h-4 text-indigo-300" />
                          <span className="font-bold text-gray-600 text-sm">{leads.find(l => l.id === c.leadId)?.nome || 'Desconhecido'}</span>
                        </div>
                      </td>
                      <td className="px-12 py-8">
                        <span className={`text-[10px] font-black px-5 py-2 rounded-full uppercase border shadow-sm ${c.status === CallStatus.ANSWERED ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                          {c.status === CallStatus.ANSWERED ? 'CONCLUÍDO' : 'FALHOU'}
                        </span>
                      </td>
                      <td className="px-12 py-8 text-right font-mono font-black text-indigo-600 italic text-base">
                        {formatDuration(c.durationSeconds)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="p-40 text-center text-gray-400 font-black uppercase text-sm italic tracking-widest">Aguardando telemetria de chamadas...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
