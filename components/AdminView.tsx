
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { 
  Users, PhoneIncoming, Upload, Database, 
  Play, Clock, ArrowRightLeft, Power, PowerOff, TrendingUp, CheckCircle, XCircle, AlertTriangle, Calendar, Mic2, Loader2, X, ListChecks, Trash2, ShieldCheck, UserPlus, MoveRight, UserCheck, LayoutGrid, BarChart3, Activity, Info, FileSpreadsheet, List, Search, Filter
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import * as XLSX from 'xlsx';

interface AdminViewProps {
  users: User[];
  leads: Lead[];
  calls: CallRecord[];
  onImportLeads: (leads: Lead[], distributionMode: 'none' | 'balanced' | string) => Promise<void>;
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
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isImporting, setIsImporting] = useState(false);
  const [pendingLeads, setPendingLeads] = useState<Lead[] | null>(null);
  const [importDistributionMode, setImportDistributionMode] = useState<'none' | 'balanced' | string>('none');
  
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
  
  // Filtro de Leads para a aba de Leads
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesSearch = l.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            l.telefone.includes(searchTerm);
      return matchesSearch;
    });
  }, [leads, searchTerm]);

  const generalQueueLeadsCount = useMemo(() => leads.filter(l => !l.assignedTo && l.status === 'PENDING').length, [leads]);

  const sellerPerformance = useMemo(() => {
    return sellers.map(seller => {
      const sellerCalls = calls.filter(c => c.sellerId === seller.id);
      const answered = sellerCalls.filter(c => c.status === CallStatus.ANSWERED).length;
      const duration = sellerCalls.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
      const sellerLeads = leads.filter(l => l.assignedTo === seller.id && l.status === 'PENDING').length;
      
      return {
        ...seller,
        totalCalls: sellerCalls.length,
        answered,
        duration,
        pendingLeads: sellerLeads
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

  const dailyChartData = useMemo(() => {
    const groups: Record<string, any> = {};
    const filteredCalls = viewMode === 'individual' && selectedSellerId ? calls.filter(c => c.sellerId === selectedSellerId) : calls;
    filteredCalls.forEach(call => {
      const date = new Date(call.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!groups[date]) groups[date] = { date, atendidas: 0, naoAtendidas: 0, invalidos: 0 };
      if (call.status === CallStatus.ANSWERED) groups[date].atendidas++;
      else if (call.status === CallStatus.NO_ANSWER) groups[date].naoAtendidas++;
      else if (call.status === CallStatus.INVALID_NUMBER) groups[date].invalidos++;
    });
    return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
  }, [calls, viewMode, selectedSellerId]);

  const currentStats = useMemo(() => {
    const activeCalls = viewMode === 'individual' && selectedSellerId ? calls.filter(c => c.sellerId === selectedSellerId) : calls;
    const total = activeCalls.length;
    const answered = activeCalls.filter(c => c.status === CallStatus.ANSWERED).length;
    const noAnswer = activeCalls.filter(c => c.status === CallStatus.NO_ANSWER).length;
    const invalid = activeCalls.filter(c => c.status === CallStatus.INVALID_NUMBER).length;
    const calcPct = (val: number) => total > 0 ? Math.round((val / total) * 100) : 0;
    return { total, answeredPct: calcPct(answered), noAnswerPct: calcPct(noAnswer), invalidPct: calcPct(invalid) };
  }, [calls, viewMode, selectedSellerId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const dataArray = evt.target?.result;
        const workbook = XLSX.read(dataArray, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        const parsedLeads = jsonData.slice(1).map((row, idx) => {
          const fone = String(row[2] || '').replace(/\D/g, '');
          if (fone.length >= 8) return { id: `temp-${idx}`, nome: String(row[0] || 'Lead').trim(), concurso: String(row[1] || 'Geral').trim(), telefone: fone, status: 'PENDING' };
          return null;
        }).filter(Boolean) as Lead[];
        if (parsedLeads.length === 0) setNotification({ message: "Nenhum lead válido encontrado.", type: 'error' });
        else setPendingLeads(parsedLeads);
      } catch (err) {
        setNotification({ message: "Erro no arquivo.", type: 'error' });
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = async () => {
    if (!pendingLeads) return;
    setIsImporting(true);
    try {
      await onImportLeads(pendingLeads, importDistributionMode);
      setNotification({ message: `${pendingLeads.length} leads importados com sucesso!`, type: 'success' });
      setPendingLeads(null);
      setActiveTab('leads');
    } catch (err: any) { setNotification({ message: err.message, type: 'error' }); }
    finally { setIsImporting(false); }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {notification && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[200] px-10 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-10 duration-300 border-2 ${notification.type === 'success' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-red-600 border-red-400 text-white'}`}>
          <span className="font-black uppercase text-xs italic">{notification.message}</span>
        </div>
      )}

      {pendingLeads && (
        <div className="fixed inset-0 z-[220] bg-indigo-950/95 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl p-10 shadow-2xl animate-in zoom-in-95 duration-300">
             <h3 className="text-2xl font-black text-gray-900 uppercase italic mb-6">Importar {pendingLeads.length} Leads</h3>
             <div className="space-y-6 mb-8">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Para onde enviar?</p>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setImportDistributionMode('none')} className={`p-6 rounded-3xl border-2 transition-all font-black text-[10px] uppercase ${importDistributionMode === 'none' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100'}`}>Fila Geral</button>
                  <button onClick={() => setImportDistributionMode('balanced')} className={`p-6 rounded-3xl border-2 transition-all font-black text-[10px] uppercase ${importDistributionMode === 'balanced' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100'}`}>Equilibrado</button>
                </div>
                <select value={importDistributionMode.length > 10 ? importDistributionMode : ''} onChange={(e) => setImportDistributionMode(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold outline-none focus:border-indigo-600 text-xs">
                  <option value="">Ou selecione um vendedor específico...</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setPendingLeads(null)} className="py-6 rounded-3xl font-black uppercase text-xs border-2 border-gray-100">Cancelar</button>
                <button onClick={confirmImport} className="py-6 rounded-3xl bg-indigo-600 text-white font-black uppercase text-xs">Confirmar</button>
             </div>
          </div>
        </div>
      )}

      {transferModal && (
        <div className="fixed inset-0 z-[210] bg-indigo-950/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white rounded-[4rem] w-full max-md p-12 shadow-2xl">
            <h3 className="text-2xl font-black uppercase italic mb-8 text-center">Transferir Fila de {transferModal.fromName}</h3>
            <select value={targetSellerId} onChange={(e) => setTargetSellerId(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 p-6 rounded-3xl font-bold mb-6">
              <option value="">Escolha o novo vendedor...</option>
              {sellers.filter(s => s.id !== transferModal.fromId).map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            <div className="flex gap-4">
              <button onClick={() => setTransferModal(null)} className="flex-1 py-5 rounded-2xl border-2 font-black uppercase text-[10px]">Voltar</button>
              <button onClick={() => { onTransferLeads(transferModal.fromId, targetSellerId); setTransferModal(null); }} className="flex-1 py-5 rounded-2xl bg-indigo-600 text-white font-black uppercase text-[10px]">Transferir</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex bg-white p-2 rounded-[2.5rem] shadow-sm border overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><TrendingUp className="w-4" /> Dashboard</button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Users className="w-4" /> Equipe</button>
        <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Database className="w-4" /> Gestão de Leads</button>
        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><PhoneIncoming className="w-4" /> Logs</button>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 shadow-sm">
                <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Total Ligações</p>
                <p className="text-4xl font-black text-gray-900">{currentStats.total}</p>
             </div>
             <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 shadow-sm">
                <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Fila Geral (Livre)</p>
                <p className="text-4xl font-black text-indigo-600">{generalQueueLeadsCount}</p>
             </div>
             <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 shadow-sm">
                <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Efetividade (%)</p>
                <p className="text-4xl font-black text-green-600">{currentStats.answeredPct}%</p>
             </div>
             <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 shadow-sm">
                <p className="text-gray-400 text-[10px] font-black uppercase mb-1">Vendedores Online</p>
                <p className="text-4xl font-black text-amber-500">{users.filter(u => u.online && u.tipo === 'vendedor').length}</p>
             </div>
          </div>

          <div className="bg-white p-10 rounded-[4rem] border-2 border-gray-100">
             <h3 className="font-black text-xl uppercase italic mb-8">Performance por Vendedor</h3>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase text-gray-400">
                    <tr><th className="pb-6">Nome</th><th className="pb-6 text-center">Ligações</th><th className="pb-6 text-center">Pendente</th><th className="pb-6 text-right">Ação</th></tr>
                  </thead>
                  <tbody>
                    {sellerPerformance.map(s => (
                      <tr key={s.id} className="border-t border-gray-50">
                        <td className="py-6 font-black uppercase text-xs">{s.nome}</td>
                        <td className="py-6 text-center font-bold">{s.totalCalls}</td>
                        <td className="py-6 text-center"><span className="bg-orange-50 text-orange-600 px-4 py-1 rounded-full font-black text-[9px]">{s.pendingLeads} LEADS</span></td>
                        <td className="py-6 text-right"><button onClick={() => setTransferModal({fromId: s.id, fromName: s.nome})} className="text-indigo-600 font-black text-[9px] uppercase">Transferir</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-10 rounded-[3rem] border-2 border-dashed border-gray-200 flex flex-col items-center text-center gap-6 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all"><Upload className="w-10 h-10" /></div>
              <h3 className="font-black text-xl uppercase italic">Importar Planilha</h3>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx" className="hidden" />
            </div>
            <div className="bg-indigo-600 p-10 rounded-[3rem] text-white flex flex-col items-center text-center gap-6 group cursor-pointer" onClick={onDistributeLeads}>
              <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center group-hover:scale-110 transition-all"><ArrowRightLeft className="w-10 h-10" /></div>
              <h3 className="font-black text-xl uppercase italic">Distribuir Fila Geral</h3>
            </div>
          </div>

          <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden">
            <div className="p-10 border-b flex flex-col sm:flex-row justify-between items-center gap-6">
              <h3 className="font-black text-2xl uppercase italic">Leads no Sistema</h3>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Buscar por nome ou fone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-gray-50 rounded-2xl font-bold text-xs outline-none focus:ring-2 ring-indigo-600/20" />
              </div>
            </div>
            <div className="overflow-x-auto max-h-[500px] scrollbar-hide">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400 sticky top-0 z-10">
                  <tr><th className="px-10 py-6">Lead</th><th className="px-10 py-6">Atribuído a</th><th className="px-10 py-6 text-center">Status</th><th className="px-10 py-6 text-right">Data</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLeads.map(l => (
                    <tr key={l.id} className="hover:bg-indigo-50/10">
                      <td className="px-10 py-6">
                        <p className="font-black uppercase text-xs">{l.nome}</p>
                        <p className="text-[10px] font-bold text-gray-400">{l.telefone}</p>
                      </td>
                      <td className="px-10 py-6">
                        {l.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                            <span className="font-black uppercase text-[10px]">{users.find(u => u.id === l.assignedTo)?.nome || 'Vendedor'}</span>
                          </div>
                        ) : (
                          <span className="bg-gray-100 text-gray-400 px-3 py-1 rounded-full font-black text-[9px] uppercase">Fila Geral</span>
                        )}
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full font-black text-[9px] uppercase ${l.status === 'PENDING' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>{l.status === 'PENDING' ? 'Pendente' : 'Chamado'}</span>
                      </td>
                      <td className="px-10 py-6 text-right font-mono text-[10px] text-gray-400">{new Date(l.createdAt || '').toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
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

      {activeTab === 'history' && (
        <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="p-12 border-b bg-gray-50/50">
            <h3 className="font-black text-3xl uppercase tracking-tighter text-indigo-950 italic">Log Geral de Chamadas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[11px] uppercase text-gray-400 tracking-widest font-black">
                <tr>
                  <th className="px-12 py-8">Vendedor</th>
                  <th className="px-12 py-8 text-center">Status</th>
                  <th className="px-12 py-8 text-center">Duração</th>
                  <th className="px-12 py-8 text-right">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calls.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-12 py-8">
                      <p className="font-black text-sm uppercase">{users.find(u => u.id === c.sellerId)?.nome || 'Sistema'}</p>
                    </td>
                    <td className="px-12 py-8 text-center">
                      <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase border ${c.status === CallStatus.ANSWERED ? 'bg-green-50 text-green-700 border-green-200' : c.status === CallStatus.NO_ANSWER ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>{c.status}</span>
                    </td>
                    <td className="px-12 py-8 text-center">
                      <span className="font-mono text-[10px] font-bold text-indigo-600">{formatDuration(c.durationSeconds)}</span>
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
