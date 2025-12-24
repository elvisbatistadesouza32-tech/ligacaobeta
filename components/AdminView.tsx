
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { 
  Users, PhoneIncoming, Upload, Database, 
  Play, Clock, ArrowRightLeft, Power, PowerOff, TrendingUp, CheckCircle, XCircle, AlertTriangle, Calendar, Mic2, Loader2, X, ListChecks, Trash2, ShieldCheck, UserPlus, MoveRight, UserCheck, LayoutGrid, BarChart3, Activity, Info, FileSpreadsheet, List
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
  const onlineSellers = useMemo(() => sellers.filter(s => s.online), [sellers]);
  
  // Leads que ainda não foram atribuídos a ninguém
  const generalQueueLeads = useMemo(() => leads.filter(l => !l.assignedTo && l.status === 'PENDING').length, [leads]);

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

  const dailyChartData = useMemo(() => {
    const groups: Record<string, any> = {};
    const filteredCalls = viewMode === 'individual' && selectedSellerId 
      ? calls.filter(c => c.sellerId === selectedSellerId)
      : calls;

    filteredCalls.forEach(call => {
      const date = new Date(call.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!groups[date]) {
        groups[date] = { date, atendidas: 0, naoAtendidas: 0, invalidos: 0 };
      }
      if (call.status === CallStatus.ANSWERED) groups[date].atendidas++;
      else if (call.status === CallStatus.NO_ANSWER) groups[date].naoAtendidas++;
      else if (call.status === CallStatus.INVALID_NUMBER) groups[date].invalidos++;
    });

    return Object.values(groups).sort((a, b) => a.date.localeCompare(b.date));
  }, [calls, viewMode, selectedSellerId]);

  const currentStats = useMemo(() => {
    const activeCalls = viewMode === 'individual' && selectedSellerId 
      ? calls.filter(c => c.sellerId === selectedSellerId)
      : calls;
    
    const total = activeCalls.length;
    const answered = activeCalls.filter(c => c.status === CallStatus.ANSWERED).length;
    const noAnswer = activeCalls.filter(c => c.status === CallStatus.NO_ANSWER).length;
    const invalid = activeCalls.filter(c => c.status === CallStatus.INVALID_NUMBER).length;

    const calcPct = (val: number) => total > 0 ? Math.round((val / total) * 100) : 0;

    return { 
      total, 
      answeredPct: calcPct(answered),
      noAnswerPct: calcPct(noAnswer),
      invalidPct: calcPct(invalid)
    };
  }, [calls, viewMode, selectedSellerId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataArray = evt.target?.result;
        const workbook = XLSX.read(dataArray, { type: 'binary', cellText: true, cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // raw: false força a leitura do valor formatado como string, evitando notação científica
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as string[][];
        
        // Filtra linhas que tenham pelo menos nome ou telefone
        const rows = jsonData.slice(1).filter(row => row.length >= 3 && (row[0] || row[2]));
        
        if (rows.length === 0) {
          setNotification({ message: "Planilha sem dados válidos nas 3 primeiras colunas.", type: 'error' });
          setIsImporting(false);
          return;
        }

        const parsedLeads = rows.map((row, idx) => {
          const nome = String(row[0] || `Lead ${idx + 1}`).trim();
          const concurso = String(row[1] || 'Geral').trim();
          // Remove tudo que não é número do telefone
          const fone = String(row[2] || '').replace(/\D/g, '');
          
          if (fone.length >= 8) {
            return { id: `temp-${idx}`, nome, concurso, telefone: fone, status: 'PENDING' };
          }
          return null;
        }).filter(Boolean) as Lead[];

        if (parsedLeads.length === 0) {
          setNotification({ message: "Nenhum telefone válido (mín. 8 dígitos) na 3ª coluna.", type: 'error' });
        } else {
          setPendingLeads(parsedLeads);
        }
      } catch (err) {
        setNotification({ message: "Erro ao processar arquivo. Certifique-se de que é um .xlsx válido.", type: 'error' });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = async () => {
    if (!pendingLeads) return;
    setIsImporting(true);
    try {
      await onImportLeads(pendingLeads, importDistributionMode);
      setNotification({ message: `Sucesso! ${pendingLeads.length} leads importados para o banco.`, type: 'success' });
      setPendingLeads(null);
      setImportDistributionMode('none');
      // Redireciona para stats para ver os novos leads no contador "Fila Geral"
      setActiveTab('stats');
    } catch (err: any) { 
      setNotification({ message: `Erro: ${err.message}`, type: 'error' }); 
    } finally { setIsImporting(false); }
  };

  const executeTransfer = () => {
    if (!transferModal || !targetSellerId) return;
    onTransferLeads(transferModal.fromId, targetSellerId);
    setTransferModal(null);
    setTargetSellerId('');
    setNotification({ message: "Fila transferida!", type: 'success' });
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      {notification && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-[200] px-10 py-5 rounded-[2.5rem] shadow-2xl flex items-center gap-4 animate-in slide-in-from-top-10 duration-300 border-2 ${notification.type === 'success' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-red-600 border-red-400 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          <span className="font-black uppercase text-xs tracking-tighter italic">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-4 p-1 hover:bg-white/20 rounded-full transition-all"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Modal de Preview e Destino */}
      {pendingLeads && (
        <div className="fixed inset-0 z-[220] bg-indigo-950/95 backdrop-blur-2xl flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white rounded-[4rem] w-full max-w-2xl p-10 my-8 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden flex flex-col max-h-[90vh]">
            <div className="text-center space-y-2 mb-8">
              <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter italic">Confirmar Importação</h3>
              <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">{pendingLeads.length} contatos prontos para entrar no sistema</p>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 mb-8 space-y-6 scrollbar-hide">
              <div className="bg-gray-50 rounded-3xl p-6 border-2 border-gray-100">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-4 tracking-widest flex items-center gap-2"><List className="w-3 h-3"/> Amostra dos Dados:</p>
                <div className="space-y-2">
                  {pendingLeads.slice(0, 5).map((l, i) => (
                    <div key={i} className="flex justify-between items-center text-[11px] font-bold border-b border-gray-200 pb-2">
                      <span className="text-gray-800 uppercase">{l.nome}</span>
                      <span className="text-indigo-600 font-mono">{l.telefone}</span>
                    </div>
                  ))}
                  {pendingLeads.length > 5 && <p className="text-center text-[9px] text-gray-400 font-black mt-2">... e mais {pendingLeads.length - 5} contatos</p>}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-4">Onde deseja colocar esses leads?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => setImportDistributionMode('none')} className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all ${importDistributionMode === 'none' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-100 bg-white'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${importDistributionMode === 'none' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}><LayoutGrid className="w-5 h-5" /></div>
                    <div className="text-left leading-none"><p className="font-black text-xs uppercase tracking-tighter">Fila Geral</p><p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Disponível para todos</p></div>
                  </button>
                  <button onClick={() => setImportDistributionMode('balanced')} className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all ${importDistributionMode === 'balanced' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-100 bg-white'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${importDistributionMode === 'balanced' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-gray-50 text-gray-400'}`}><ArrowRightLeft className="w-5 h-5" /></div>
                    <div className="text-left leading-none"><p className="font-black text-xs uppercase tracking-tighter">Equilibrado</p><p className="text-[9px] font-bold text-gray-400 uppercase mt-1">Sellers Online</p></div>
                  </button>
                </div>
                
                <div className={`w-full p-6 rounded-[2.5rem] border-2 transition-all ${importDistributionMode !== 'none' && importDistributionMode !== 'balanced' ? 'border-indigo-600 bg-indigo-50/50' : 'border-gray-100 bg-white'}`}>
                   <div className="flex items-center gap-4 mb-3">
                      <UserCheck className="w-5 h-5 text-indigo-600" />
                      <p className="font-black text-[10px] uppercase tracking-widest text-gray-800">Atribuir a um Vendedor:</p>
                   </div>
                   <select value={importDistributionMode === 'none' || importDistributionMode === 'balanced' ? '' : importDistributionMode} onChange={(e) => setImportDistributionMode(e.target.value)} className="w-full bg-white border-2 border-gray-100 p-4 rounded-2xl font-black text-[11px] uppercase outline-none focus:border-indigo-600">
                    <option value="">Escolher da lista...</option>
                    {sellers.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.online ? 'ON' : 'OFF'})</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setPendingLeads(null)} className="py-6 rounded-3xl font-black uppercase text-xs border-2 border-gray-100 text-gray-400 hover:bg-gray-50 transition-all">Cancelar</button>
              <button onClick={confirmImport} disabled={isImporting} className="py-6 rounded-3xl bg-indigo-600 text-white font-black uppercase text-xs shadow-xl hover:bg-indigo-700 flex items-center justify-center gap-2">
                {isImporting ? <Loader2 className="animate-spin w-4 h-4" /> : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {transferModal && (
        <div className="fixed inset-0 z-[210] bg-indigo-950/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white rounded-[4rem] w-full max-md p-12 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic mb-2 text-center">Transferir Fila</h3>
            <p className="text-gray-400 text-center text-xs font-bold uppercase mb-8">Passar leads de: {transferModal.fromName}</p>
            <div className="space-y-6">
              <select value={targetSellerId} onChange={(e) => setTargetSellerId(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 p-6 rounded-3xl font-bold text-sm outline-none focus:border-indigo-600">
                <option value="">Escolha o novo vendedor...</option>
                {sellers.filter(s => s.id !== transferModal.fromId).map(s => <option key={s.id} value={s.id}>{s.nome} ({s.online ? 'Online' : 'Offline'})</option>)}
              </select>
              <div className="flex gap-4">
                <button onClick={() => setTransferModal(null)} className="flex-1 py-5 rounded-2xl font-black uppercase text-[10px] border-2 border-gray-100 text-gray-400">Voltar</button>
                <button onClick={executeTransfer} disabled={!targetSellerId} className="flex-1 py-5 rounded-2xl font-black uppercase text-[10px] bg-indigo-600 text-white shadow-lg">Transferir Agora</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
            {viewMode === 'geral' && (
              <div className="flex items-center gap-4">
                <div className="px-6 py-3 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3">
                  <Database className="w-4 h-4 text-orange-500" />
                  <span className="text-[10px] font-black uppercase text-orange-950 tracking-tighter">Fila Geral: <span className="text-sm font-black">{generalQueueLeads} Leads</span></span>
                </div>
                <button onClick={onDistributeLeads} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase transition-all shadow-lg active:scale-95 flex items-center gap-2">
                  <ArrowRightLeft className="w-3.5 h-3.5" /> Distribuir Agora
                </button>
              </div>
            )}
            {viewMode === 'individual' && (
              <select value={selectedSellerId} onChange={(e) => setSelectedSellerId(e.target.value)} className="bg-indigo-50 border-2 border-indigo-100 text-indigo-900 font-black text-[10px] uppercase py-3 px-8 rounded-2xl outline-none">
                <option value="">Selecionar Vendedor...</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><PhoneIncoming className="w-20 h-20" /></div>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Total Ligações</p>
                <p className="text-4xl font-black text-gray-900 tracking-tighter">{currentStats.total}</p>
             </div>
             <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 text-green-600"><CheckCircle className="w-20 h-20" /></div>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Atendidas (%)</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-green-600 tracking-tighter">{currentStats.answeredPct}%</p>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500" style={{ width: `${currentStats.answeredPct}%` }} />
                  </div>
                </div>
             </div>
             <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 text-red-600"><XCircle className="w-20 h-20" /></div>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Não Atendidas (%)</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-red-600 tracking-tighter">{currentStats.noAnswerPct}%</p>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500" style={{ width: `${currentStats.noAnswerPct}%` }} />
                  </div>
                </div>
             </div>
             <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 shadow-sm relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 text-orange-600"><AlertTriangle className="w-20 h-20" /></div>
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Inválidos (%)</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black text-orange-600 tracking-tighter">{currentStats.invalidPct}%</p>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500" style={{ width: `${currentStats.invalidPct}%` }} />
                  </div>
                </div>
             </div>
          </div>

          <div className="bg-white p-10 rounded-[4rem] border-2 border-gray-100 shadow-sm">
            <div className="flex items-center gap-4 mb-10">
              <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl"><BarChart3 className="w-6 h-6" /></div>
              <div>
                <h3 className="font-black text-xl uppercase tracking-tighter text-indigo-950 italic">Análise de Engajamento Diário</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Acompanhe a evolução da operação dia a dia</p>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChartData}>
                  <defs>
                    <linearGradient id="colorAtend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorNaoAtend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '20px' }}
                    labelStyle={{ fontWeight: 900, marginBottom: '8px', color: '#1e1b4b', fontSize: '12px', textTransform: 'uppercase' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase' }} />
                  <Area type="monotone" dataKey="atendidas" name="Atendidas" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorAtend)" />
                  <Area type="monotone" dataKey="naoAtendidas" name="Não Atendidas" stroke="#ef4444" strokeWidth={4} fillOpacity={1} fill="url(#colorNaoAtend)" />
                  <Area type="monotone" dataKey="invalidos" name="Inválidos" stroke="#f59e0b" strokeWidth={4} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {viewMode === 'geral' ? (
            <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
              <div className="px-12 py-10 border-b bg-gray-50/30 flex justify-between items-center">
                <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900 italic">Ranking de Performance</h3>
                <div className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase"><Activity className="w-3 h-3" /> Monitoramento em Tempo Real</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white text-[11px] uppercase text-gray-400 tracking-widest font-black">
                    <tr>
                      <th className="px-12 py-8 text-left">Operador</th>
                      <th className="px-12 py-8 text-center">Contatos</th>
                      <th className="px-12 py-8 text-center">Tempo Médio</th>
                      <th className="px-12 py-8 text-center text-orange-600">Fila Atual</th>
                      <th className="px-12 py-8 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sellerPerformance.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-indigo-50/10 transition-all">
                        <td className="px-12 py-8">
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-gray-300">#{idx + 1}</span>
                            <div className="flex flex-col">
                              <span className="font-black text-sm uppercase tracking-tighter text-gray-800">{s.nome}</span>
                              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{s.online ? '🟢 Online' : '⚪ Offline'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-12 py-8 text-center font-black text-gray-900">{s.totalCalls}</td>
                        <td className="px-12 py-8 text-center font-bold text-indigo-600 text-sm">{s.totalCalls > 0 ? formatDuration(Math.floor(s.duration / s.totalCalls)) : '--'}</td>
                        <td className="px-12 py-8 text-center">
                          <span className={`px-4 py-1.5 rounded-full font-black text-[10px] ${s.pendingLeads > 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                            {s.pendingLeads} LEADS
                          </span>
                        </td>
                        <td className="px-12 py-8 text-right">
                          <button onClick={() => setTransferModal({ fromId: s.id, fromName: s.nome })} className="bg-gray-100 hover:bg-indigo-600 hover:text-white px-5 py-2.5 rounded-xl font-black text-[9px] uppercase transition-all flex items-center gap-2 ml-auto shadow-sm">
                            <MoveRight className="w-3.5 h-3.5" /> Transferir
                          </button>
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
                  <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900 italic">Cronologia de Chamadas</h3>
                </div>
                <div className="overflow-x-auto max-h-[600px] scrollbar-hide">
                  <table className="w-full">
                    <thead className="bg-white text-[10px] uppercase text-gray-400 tracking-widest font-black sticky top-0 border-b z-10">
                      <tr>
                        <th className="px-12 py-6 text-left">Hora</th>
                        <th className="px-12 py-6 text-left">Status</th>
                        <th className="px-12 py-6 text-center">Duração</th>
                        <th className="px-12 py-8 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {timelineCalls.map(c => (
                        <tr key={c.id} className="hover:bg-indigo-50/20">
                          <td className="px-12 py-8">
                            <p className="font-black text-sm text-gray-800">{new Date(c.timestamp).toLocaleTimeString('pt-BR')}</p>
                            <p className="text-[9px] text-gray-400 font-bold">{new Date(c.timestamp).toLocaleDateString('pt-BR')}</p>
                          </td>
                          <td className="px-12 py-8">
                            <span className={`text-[9px] font-black px-4 py-1.5 rounded-full uppercase border ${c.status === CallStatus.ANSWERED ? 'bg-green-50 text-green-600 border-green-100' : c.status === CallStatus.NO_ANSWER ? 'bg-red-50 text-red-600 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>{c.status}</span>
                          </td>
                          <td className="px-12 py-8 text-center">
                            <span className="font-mono text-xs font-black text-indigo-950 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">{formatDuration(c.durationSeconds)}</span>
                          </td>
                          <td className="px-12 py-8 text-right">
                            <button onClick={() => setPlayingCall(c)} className="p-4 bg-gray-100 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all shadow-sm"><Play className="w-4 h-4 fill-current" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-indigo-950 rounded-[3.5rem] p-10 text-white flex flex-col items-center justify-center text-center shadow-2xl">
                {playingCall ? (
                  <div className="space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl animate-pulse ring-8 ring-white/5"><Mic2 className="w-10 h-10" /></div>
                    <div>
                      <h4 className="font-black italic uppercase tracking-tighter text-sm">Monitoria Ativa</h4>
                      <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest mt-2">{formatDuration(playingCall.durationSeconds)} de conversa</p>
                    </div>
                    <button className="w-20 h-20 bg-white text-indigo-950 rounded-full flex items-center justify-center mx-auto shadow-xl hover:scale-110 active:scale-95 transition-all"><Play fill="currentColor" className="w-8 h-8" /></button>
                  </div>
                ) : (
                  <div className="opacity-40 space-y-4">
                    <Clock className="w-16 h-16 mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase italic tracking-widest">Nenhuma monitoria selecionada</p>
                  </div>
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
        <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-500">
          {/* Instruções de Formatação */}
          <div className="bg-indigo-50 border-2 border-indigo-100 rounded-[3rem] p-10 flex flex-col md:flex-row items-center gap-8">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white shadow-xl flex-shrink-0">
              <FileSpreadsheet className="w-10 h-10" />
            </div>
            <div className="space-y-3">
              <h4 className="font-black text-lg uppercase italic tracking-tighter text-indigo-950">Formato Obrigatório da Planilha (.XLSX)</h4>
              <p className="text-xs text-indigo-900/70 font-bold uppercase leading-relaxed">A primeira linha deve ser o cabeçalho. Os dados devem começar na linha 2 seguindo esta ordem:</p>
              <div className="flex flex-wrap gap-3 mt-4">
                <div className="bg-white px-5 py-3 rounded-2xl border-2 border-indigo-200 shadow-sm flex items-center gap-3">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black text-xs">A</span>
                  <span className="text-[10px] font-black uppercase text-gray-700">Nome do Lead</span>
                </div>
                <div className="bg-white px-5 py-3 rounded-2xl border-2 border-indigo-200 shadow-sm flex items-center gap-3">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black text-xs">B</span>
                  <span className="text-[10px] font-black uppercase text-gray-700">Concurso/Campanha</span>
                </div>
                <div className="bg-white px-5 py-3 rounded-2xl border-2 border-indigo-600 shadow-sm flex items-center gap-3">
                  <span className="w-6 h-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center font-black text-xs text-white">C</span>
                  <span className="text-[10px] font-black uppercase text-indigo-600">Telefone (DDD+Número)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-16 rounded-[4rem] border-2 border-dashed border-gray-200 hover:border-indigo-600 hover:bg-indigo-50/10 flex flex-col items-center text-center gap-8 transition-all group cursor-pointer relative" onClick={() => !isImporting && fileInputRef.current?.click()}>
               {isImporting && (
                 <div className="absolute inset-0 bg-white/90 backdrop-blur-md z-50 flex flex-col items-center justify-center rounded-[4rem]">
                   <Loader2 className="w-16 h-16 text-indigo-600 animate-spin mb-6" />
                   <p className="font-black text-lg uppercase italic tracking-tighter text-indigo-950">Validando Planilha...</p>
                 </div>
               )}
               <div className="w-28 h-28 bg-indigo-50 rounded-[3rem] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xl ring-8 ring-white">
                  <Upload className="w-12 h-12" />
               </div>
               <div className="space-y-4">
                 <h3 className="font-black text-3xl uppercase tracking-tighter italic text-indigo-950">Escolher Arquivo</h3>
                 <p className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Arraste ou clique aqui (.XLSX)</p>
               </div>
               <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
            </div>
            <div className="bg-indigo-600 p-16 rounded-[4rem] text-white flex flex-col items-center text-center gap-8 hover:bg-indigo-700 transition-all shadow-2xl group cursor-pointer" onClick={onDistributeLeads}>
               <div className="w-28 h-28 bg-white/10 rounded-[3rem] flex items-center justify-center group-hover:scale-110 transition-all shadow-2xl ring-8 ring-white/10">
                  <ArrowRightLeft className="w-12 h-12" />
               </div>
               <div className="space-y-4">
                 <h3 className="font-black text-3xl uppercase tracking-tighter italic">Distribuir Fila</h3>
                 <p className="text-xs font-black text-indigo-200 uppercase tracking-[0.3em]">Repartir entre equipe ativa</p>
               </div>
            </div>
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
