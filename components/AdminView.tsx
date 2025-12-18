
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { 
  Users, PhoneIncoming, Upload, Database, 
  Play, Clock, ArrowRightLeft, Power, PowerOff, TrendingUp, CheckCircle, XCircle, AlertTriangle, Calendar, Mic2, Loader2, X
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
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Filtro de vendedores
  const sellers = useMemo(() => users.filter(u => u.tipo === 'vendedor'), [users]);

  // Estatísticas calculadas por vendedor
  const sellerStats = useMemo(() => {
    return sellers.map(seller => {
      const sellerCalls = calls.filter(c => c.sellerId === seller.id);
      const answered = sellerCalls.filter(c => c.status === CallStatus.ANSWERED).length;
      const duration = sellerCalls.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
      return {
        ...seller,
        totalCalls: sellerCalls.length,
        answered,
        duration,
      };
    }).sort((a, b) => b.totalCalls - a.totalCalls);
  }, [sellers, calls]);

  // Filtro de chamadas baseado no modo de visualização
  const filteredCalls = useMemo(() => {
    if (viewMode === 'individual' && selectedSellerId) {
      return calls
        .filter(c => c.sellerId === selectedSellerId)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return calls.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [calls, viewMode, selectedSellerId]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const totalDurationSeconds = filteredCalls.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
  const unassignedLeadsCount = leads.filter(l => !l.assignedTo).length;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // Filtra linhas vazias e cabeçalho (data[0])
        const rawLeads = data.slice(1).filter(row => row.length > 0 && row[0]);
        
        if (rawLeads.length === 0) {
          setNotification({ message: "A planilha parece estar vazia ou sem dados válidos.", type: 'error' });
          setIsImporting(false);
          return;
        }

        const newLeads = rawLeads.map((row, i) => ({
          id: `imp-${Date.now()}-${i}`,
          nome: String(row[0] || '').trim(),
          concurso: String(row[1] || 'Geral').trim(),
          telefone: String(row[2] || '').replace(/\D/g, ''), // Limpa caracteres não numéricos
          status: 'PENDING'
        })).filter(l => l.nome && l.telefone);

        await onImportLeads(newLeads as any);
        setNotification({ 
          message: `Sucesso! ${newLeads.length} leads foram importados para o banco de dados.`, 
          type: 'success' 
        });
        
        // Limpa o input
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error(err);
        setNotification({ message: "Erro ao processar o arquivo. Verifique o formato.", type: 'error' });
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      setNotification({ message: "Falha na leitura do arquivo.", type: 'error' });
      setIsImporting(false);
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] px-8 py-5 rounded-[2rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom-10 duration-300 ${notification.type === 'success' ? 'bg-indigo-600 text-white' : 'bg-red-600 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          <span className="font-black uppercase text-xs tracking-tight italic">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Menu Principal */}
      <div className="flex bg-white p-2 rounded-[2.5rem] shadow-sm border overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><TrendingUp className="w-4" /> Painel de Controle</button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Users className="w-4" /> Gestão de Equipe</button>
        <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Database className="w-4" /> Banco de Leads</button>
        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><PhoneIncoming className="w-4" /> Log de Sistema</button>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Submenu de Visão */}
          <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-10 py-6 rounded-[3rem] border-2 border-gray-100 gap-4">
            <div className="flex bg-gray-100 p-1 rounded-2xl w-fit">
              <button 
                onClick={() => setViewMode('geral')} 
                className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${viewMode === 'geral' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Visão Geral
              </button>
              <button 
                onClick={() => setViewMode('individual')} 
                className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase transition-all ${viewMode === 'individual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Visão Individual
              </button>
            </div>

            {viewMode === 'individual' && (
              <select 
                value={selectedSellerId} 
                onChange={(e) => setSelectedSellerId(e.target.value)}
                className="bg-indigo-50 border-2 border-indigo-100 text-indigo-900 font-black text-[10px] uppercase py-2.5 px-6 rounded-2xl outline-none focus:ring-4 ring-indigo-200/50"
              >
                <option value="">Selecione o Vendedor para análise</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            )}
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm group">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Chamadas Efetuadas</p>
                <p className="text-5xl font-black text-gray-900 mt-2 tracking-tighter">{filteredCalls.length}</p>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm group">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Tempo Total em Linha</p>
                <p className="text-5xl font-black text-indigo-600 mt-2 tracking-tighter">{formatDuration(totalDurationSeconds)}</p>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm group">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Leads Disponíveis</p>
                <p className="text-5xl font-black text-orange-500 mt-2 tracking-tighter">{unassignedLeadsCount}</p>
             </div>
          </div>

          {/* Seção Principal: Ranking ou Detalhes Individuais */}
          {viewMode === 'geral' ? (
            <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
              <div className="px-10 py-8 border-b bg-gray-50/50">
                <h3 className="font-black text-xl uppercase tracking-tighter text-indigo-900 italic">Desempenho da Operação</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50/30 text-[10px] uppercase text-gray-400 tracking-widest font-black">
                    <tr>
                      <th className="px-10 py-6 text-left">Vendedor</th>
                      <th className="px-10 py-6 text-center">Volume Total</th>
                      <th className="px-10 py-6 text-center">Contatos Efetivos</th>
                      <th className="px-10 py-6 text-right">Produtividade (Tempo)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sellerStats.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors group">
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-gray-300 w-4">{idx + 1}.</span>
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                              <img src={s.avatar} className="w-full h-full object-cover" />
                            </div>
                            <span className="font-black text-sm uppercase tracking-tighter text-gray-700">{s.nome}</span>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-center font-black text-gray-900">{s.totalCalls}</td>
                        <td className="px-10 py-6 text-center font-black text-green-600">{s.answered}</td>
                        <td className="px-10 py-6 text-right font-mono font-black text-indigo-600 italic text-xs">{formatDuration(s.duration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Timeline de Chamadas do Vendedor */}
              <div className="xl:col-span-2 bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
                <div className="px-10 py-8 border-b bg-indigo-50/30 flex justify-between items-center">
                  <h3 className="font-black text-xl uppercase tracking-tighter text-indigo-900 italic">Atividades do Dia</h3>
                  <Calendar className="w-5 h-5 text-indigo-300" />
                </div>
                <div className="overflow-x-auto max-h-[600px] scrollbar-hide">
                  <table className="w-full">
                    <thead className="bg-gray-50/50 text-[10px] uppercase text-gray-400 tracking-widest font-black sticky top-0 z-10">
                      <tr>
                        <th className="px-10 py-6 text-left">Dia / Horário</th>
                        <th className="px-10 py-6 text-left">Resultado</th>
                        <th className="px-10 py-6 text-right">Duração</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredCalls.length > 0 ? (
                        filteredCalls.map(c => (
                          <tr key={c.id} className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${playingId === c.id ? 'bg-indigo-50/50' : ''}`} onClick={() => setPlayingId(c.id)}>
                            <td className="px-10 py-6">
                              <p className="font-black text-xs uppercase tracking-tighter text-gray-800">
                                {new Date(c.timestamp).toLocaleDateString('pt-BR')}
                              </p>
                              <p className="text-[10px] font-bold text-indigo-600 uppercase">
                                {new Date(c.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </td>
                            <td className="px-10 py-6">
                              <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase border ${c.status === CallStatus.ANSWERED ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                                {c.status === CallStatus.ANSWERED ? 'Contato Efetivado' : 'Sem Resposta'}
                              </span>
                            </td>
                            <td className="px-10 py-6 text-right font-mono text-xs font-black text-gray-400 italic">
                              {formatDuration(c.durationSeconds)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={3} className="p-20 text-center font-black text-gray-300 uppercase text-xs">Nenhuma atividade registrada para este vendedor.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sidebar de Gravação */}
              <div className="bg-indigo-900 rounded-[3.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                
                {playingId ? (
                  <div className="relative z-10 space-y-8 w-full animate-in zoom-in-95 duration-300">
                    <div className="w-24 h-24 bg-indigo-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl animate-pulse">
                      <Mic2 className="w-12 h-12 text-white" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black italic uppercase tracking-tighter">Gravação da Chamada</h4>
                      <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mt-2">ID: {playingId.slice(-6)}</p>
                    </div>
                    <div className="bg-white/10 p-6 rounded-[2.5rem] border border-white/5 space-y-4">
                       <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 w-1/3 animate-progress" />
                       </div>
                       <div className="flex justify-between items-center text-[10px] font-black uppercase text-indigo-200">
                          <span>00:45</span>
                          <span>{formatDuration(filteredCalls.find(c => c.id === playingId)?.durationSeconds || 0)}</span>
                       </div>
                       <button className="bg-white text-indigo-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-xl hover:scale-110 active:scale-90 transition-all">
                          <Play className="w-6 h-6 fill-indigo-900" />
                       </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10 space-y-6 opacity-40">
                    <div className="w-20 h-20 border-4 border-dashed border-white/20 rounded-[2rem] flex items-center justify-center mx-auto">
                      <Play className="w-8 h-8" />
                    </div>
                    <p className="text-xs font-black uppercase tracking-widest leading-relaxed">Selecione uma chamada<br/>para ouvir a gravação</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs de Gestão */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-10 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900 italic">Gestão de Colaboradores</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-widest font-black">
                <tr><th className="px-10 py-6 text-left">Membro</th><th className="px-10 py-6 text-left">Nível</th><th className="px-10 py-6 text-left">Status</th><th className="px-10 py-6 text-right">Operação</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-10 py-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                        <img src={u.avatar || `https://ui-avatars.com/api/?name=${u.nome}&background=6366f1&color=fff`} className="w-full h-full object-cover" />
                      </div>
                      <div><p className="font-black text-sm uppercase tracking-tighter">{u.nome}</p><p className="text-[10px] font-bold text-gray-400">{u.email}</p></div>
                    </td>
                    <td className="px-10 py-6">
                      <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase border ${u.tipo === 'adm' ? 'bg-purple-50 border-purple-100 text-purple-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                        {u.tipo === 'adm' ? 'Administrador' : 'Vendedor'}
                      </span>
                    </td>
                    <td className="px-10 py-6">
                      {u.online ? (
                        <span className="inline-flex items-center gap-2 text-[10px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Operando</span>
                      ) : (
                        <span className="text-[10px] font-black text-gray-300 uppercase px-3 py-1 border rounded-full">Indisponível</span>
                      )}
                    </td>
                    <td className="px-10 py-6 text-right">
                      <button onClick={() => onToggleUserStatus(u.id)} className={`p-4 rounded-2xl transition-all shadow-lg ${u.online ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                        {u.online ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-10 border-b flex justify-between items-center bg-gray-50/50">
            <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900 italic">Logs de Sistema</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-widest font-black">
                <tr><th className="px-10 py-6">Operador</th><th className="px-10 py-6">Registro Temporal</th><th className="px-10 py-6">Resultado</th><th className="px-10 py-6 text-right">Duração</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calls.length > 0 ? (
                  [...calls].reverse().map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-10 py-6">
                        <p className="font-black text-sm text-gray-900 uppercase tracking-tighter">{users.find(u => u.id === c.sellerId)?.nome || 'Sistema'}</p>
                      </td>
                      <td className="px-10 py-6">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(c.timestamp).toLocaleString('pt-BR')}</p>
                      </td>
                      <td className="px-10 py-6">
                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase border ${c.status === CallStatus.ANSWERED ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                          {c.status === CallStatus.ANSWERED ? 'CONCLUÍDO' : 'FALHA'}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right font-mono text-xs font-black text-indigo-600 italic">
                        {formatDuration(c.durationSeconds)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="p-20 text-center text-gray-400 font-bold uppercase text-xs">Aguardando novos registros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-14 rounded-[3.5rem] border-2 border-dashed border-gray-200 hover:border-indigo-600 flex flex-col items-center text-center gap-8 transition-all group cursor-pointer relative" onClick={() => !isImporting && fileInputRef.current?.click()}>
             {isImporting && (
               <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center rounded-[3.5rem]">
                 <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                 <p className="font-black text-xs uppercase italic tracking-widest text-indigo-900">Processando planilha...</p>
               </div>
             )}
             <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner"><Upload className="w-10 h-10" /></div>
             <div>
               <h3 className="font-black text-2xl uppercase tracking-tighter italic">Alimentar Base</h3>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-3">Clique ou arraste seu arquivo .XLSX</p>
               <div className="mt-6 flex flex-col items-center gap-1">
                 <p className="text-[9px] font-bold text-indigo-300 uppercase">Coluna A: Nome</p>
                 <p className="text-[9px] font-bold text-indigo-300 uppercase">Coluna B: Concurso</p>
                 <p className="text-[9px] font-bold text-indigo-300 uppercase">Coluna C: Telefone</p>
               </div>
             </div>
             <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
          </div>
          <div className="bg-indigo-600 p-14 rounded-[3.5rem] text-white flex flex-col items-center text-center gap-8 hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 group cursor-pointer" onClick={onDistributeLeads}>
             <div className="w-24 h-24 bg-white/10 rounded-[2.5rem] flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg"><ArrowRightLeft className="w-10 h-10" /></div>
             <div>
               <h3 className="font-black text-2xl uppercase tracking-tighter italic">Distribuir Fila</h3>
               <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mt-3">Entregar leads para vendedores online</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
