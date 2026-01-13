
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Lead, CallRecord, Sale, CallStatus } from '../types';
import { Users, Database, Power, Search, Trash2, Loader2, FileSpreadsheet, BarChart3, Clock, Activity, DollarSign, TrendingUp, Ban, Edit3, Save, X, RotateCcw, Filter, UserPlus, PhoneOff, AlertCircle, PhoneCall, MessageCircle, Smartphone, RefreshCw, CheckSquare, Square, Bookmark } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from 'recharts';
import * as XLSX from 'xlsx';

interface AdminViewProps {
  users: User[];
  leads: Lead[];
  calls: CallRecord[];
  sales: Sale[];
  onImportLeads: (leads: Lead[], target: 'none' | 'online' | string) => Promise<void>;
  onToggleUserStatus: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onTransferLeads: (leadIds: string[], userId: string | null) => Promise<void>;
  onDeleteLeads: (leadIds: string[]) => Promise<void>;
  onClearSellerLeads: (userId: string) => Promise<void>;
  onUpdateSale: (id: string, amount: number) => Promise<void>;
  onDeleteSale: (id: string) => Promise<void>;
}

export const AdminView: React.FC<AdminViewProps> = ({ 
  users, leads, calls, sales, onImportLeads, onToggleUserStatus, 
  onTransferLeads, onDeleteLeads, onClearSellerLeads, onUpdateSale, onDeleteSale 
}) => {
  const [tab, setTab] = useState<'dash' | 'leads' | 'users' | 'sales'>('dash');
  const [viewMode, setViewMode] = useState<'month' | 'day'>('day'); 
  const [isSyncing, setIsSyncing] = useState(false);
  const [date, setDate] = useState(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const local = new Date(d.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  });

  const [search, setSearch] = useState('');
  const [filterOperator, setFilterOperator] = useState<string>('all');
  const [importTarget, setImportTarget] = useState<string>('none'); 
  const [loading, setLoading] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const sellers = useMemo(() => users.filter(u => u.tipo === 'vendedor'), [users]);
  
  const getLocalDatePart = (isoString: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - (offset * 60 * 1000));
      return local.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const periodSales = useMemo(() => {
    const filter = viewMode === 'day' ? date : date.slice(0, 7);
    return sales.filter(s => {
      const saleDate = getLocalDatePart(s.created_at);
      return saleDate.startsWith(filter);
    });
  }, [sales, date, viewMode]);

  const filteredCalls = useMemo(() => {
    const filter = viewMode === 'day' ? date : date.slice(0, 7);
    return calls.filter(c => {
      const callDate = getLocalDatePart(c.timestamp || (c as any).created_at);
      return callDate.startsWith(filter);
    });
  }, [calls, date, viewMode]);

  const stats = useMemo(() => {
    const totalVendido = periodSales.reduce((acc, s) => acc + Number(s.amount), 0);
    const totalCalls = filteredCalls.length;
    
    const getCount = (st: string) => filteredCalls.filter(c => String(c.status).toUpperCase() === st).length;
    const ansCount = getCount('ANSWERED');
    const noAnsCount = getCount('NO_ANSWER');
    const invalidCount = getCount('INVALID_NUMBER');

    const pct = (v: number) => totalCalls > 0 ? ((v / totalCalls) * 100).toFixed(0) : '0';

    const totalVendasCount = periodSales.length;
    const callSales = periodSales.filter(s => s.canal === 'call');
    const whatsappSales = periodSales.filter(s => s.canal === 'whatsapp');

    const canalPct = (count: number) => totalVendasCount > 0 ? ((count / totalVendasCount) * 100).toFixed(0) : '0';

    return {
      totalCalls,
      totalVendido,
      totalVendasCount,
      ans: { count: ansCount, pct: pct(ansCount) },
      noAns: { count: noAnsCount, pct: pct(noAnsCount) },
      invalid: { count: invalidCount, pct: pct(invalidCount) },
      canais: {
        call: { count: callSales.length, pct: canalPct(callSales.length) },
        whatsapp: { count: whatsappSales.length, pct: canalPct(whatsappSales.length) }
      },
      ticketMedio: totalVendasCount > 0 ? (totalVendido / totalVendasCount) : 0
    };
  }, [filteredCalls, periodSales]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}h`,
      total: 0,
      atendidas: 0
    }));

    filteredCalls.forEach(c => {
      const d = new Date(c.timestamp);
      const h = d.getHours();
      hours[h].total++;
      if (c.status === 'ANSWERED') {
        hours[h].atendidas++;
      }
    });

    const hasActivity = hours.some(h => h.total > 0);
    if (!hasActivity) return [];

    return hours.filter((h, idx) => {
      if (h.total > 0) return true;
      return idx >= 8 && idx <= 20; 
    });
  }, [filteredCalls]);

  const topSellersByValue = useMemo(() => {
    return sellers.map(s => {
      const sellerSales = periodSales.filter(sa => sa.seller_id === s.id);
      const totalValue = sellerSales.reduce((acc, sa) => acc + Number(sa.amount), 0);
      return { ...s, totalValue, count: sellerSales.length };
    })
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);
  }, [sellers, periodSales]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
      const newLeads = rows.map((row, idx) => {
        if (idx === 0) return null; 
        return {
          nome: String(row[0] || '').toUpperCase(),
          base: String(row[1] || '').toUpperCase(),
          telefone: String(row[2] || '').replace(/\D/g, '')
        };
      }).filter(l => l && l.nome && l.telefone.length >= 8);
      await onImportLeads(newLeads as any, importTarget);
      alert(`${newLeads.length} leads importados com sucesso.`);
    } catch (err) {
      alert("Erro ao ler arquivo.");
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const currentLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesSearch = l.nome.toLowerCase().includes(search.toLowerCase()) || 
        l.base.toLowerCase().includes(search.toLowerCase()) ||
        l.telefone.includes(search);
      const matchesOperator = filterOperator === 'all' 
        ? true 
        : filterOperator === 'none' 
          ? l.assignedTo === null 
          : l.assignedTo === filterOperator;
      return matchesSearch && matchesOperator;
    });
  }, [leads, search, filterOperator]);

  const toggleLeadSelection = (id: string) => {
    setSelectedLeadIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllLeads = () => {
    if (selectedLeadIds.length === currentLeads.length && currentLeads.length > 0) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(currentLeads.map(l => l.id));
    }
  };

  const handleDeleteIndividualLead = async (id: string) => {
    if (confirm("Deseja realmente excluir este lead permanentemente?")) {
      await onDeleteLeads([id]);
      setSelectedLeadIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkDeleteLeads = async () => {
    if (confirm(`Deseja realmente excluir os ${selectedLeadIds.length} leads selecionados?`)) {
      await onDeleteLeads(selectedLeadIds);
      setSelectedLeadIds([]);
    }
  };

  useEffect(() => {
    setSelectedLeadIds([]);
  }, [tab, filterOperator, search]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      <nav className="flex bg-white p-2 rounded-full border shadow-sm max-w-3xl mx-auto mb-10 overflow-hidden relative">
        {[
          { id: 'dash', label: 'Painel', icon: BarChart3 },
          { id: 'leads', label: 'Leads', icon: Database },
          { id: 'users', label: 'Equipe', icon: Users },
          { id: 'sales', label: 'Vendas', icon: DollarSign }
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-full font-black text-[10px] uppercase transition-all ${tab === t.id ? 'bg-sky-600 text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-100 flex flex-wrap gap-4 justify-between items-center shadow-sm mb-8">
        <div className="flex bg-gray-50 p-1 rounded-2xl">
          <button onClick={() => setViewMode('day')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'day' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400'}`}>Dia</button>
          <button onClick={() => setViewMode('month')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'month' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400'}`}>Mês</button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-sky-50 px-6 py-3 rounded-2xl border-2 border-sky-100 text-sky-700">
            <Clock className="w-4 h-4" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent font-black text-sm uppercase outline-none" />
          </div>
          
          <button 
            onClick={handleSync}
            className={`flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] italic shadow-xl transition-all active:scale-95 group ${isSyncing ? 'opacity-50' : ''}`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            Atualizar Dados
          </button>
        </div>
      </div>

      {tab === 'dash' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col justify-center">
              <p className="text-[10px] uppercase font-black opacity-60 mb-1 tracking-widest">Total Vendido</p>
              <p className="text-3xl font-black italic tracking-tighter">R$ {stats.totalVendido.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm flex flex-col justify-center">
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Total Calls</p>
                <PhoneCall size={14} className="text-gray-300" />
              </div>
              <p className="text-4xl font-black italic text-slate-800">{stats.totalCalls}</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm flex flex-col justify-center">
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Atendidas</p>
                <span className="text-emerald-500 font-black text-sm italic">{stats.ans.pct}%</span>
              </div>
              <p className="text-4xl font-black italic text-emerald-600">{stats.ans.count}</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm flex flex-col justify-center">
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Não Atend.</p>
                <span className="text-amber-500 font-black text-sm italic">{stats.noAns.pct}%</span>
              </div>
              <p className="text-4xl font-black italic text-amber-600">{stats.noAns.count}</p>
            </div>
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col justify-center">
              <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] uppercase font-black opacity-60 tracking-widest">Inválidos</p>
                <span className="text-red-400 font-black text-sm italic">{stats.invalid.pct}%</span>
              </div>
              <p className="text-4xl font-black italic">{stats.invalid.count}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white p-10 rounded-[3rem] border-2 border-gray-100">
              <h4 className="font-black uppercase italic text-slate-800 mb-8 flex items-center gap-2"><TrendingUp className="text-emerald-500" /> RANKING VENDAS (VALOR)</h4>
              <div className="space-y-4">
                {topSellersByValue.map((s, idx) => (
                  <div key={s.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-[1.5rem]">
                    <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-black text-[10px]">#{idx+1}</span>
                    <div className="flex-1">
                      <p className="font-black uppercase text-[10px]">{s.nome}</p>
                      <p className="text-[9px] font-bold text-gray-400">{s.count} vendas realizadas</p>
                    </div>
                    <p className="text-lg font-black italic text-emerald-600">R$ {s.totalValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                  </div>
                ))}
                {topSellersByValue.length === 0 && <p className="text-center py-10 text-[10px] font-black uppercase text-gray-300">Sem vendas registradas</p>}
              </div>
            </div>
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border-2 border-gray-100 flex flex-col">
              <h4 className="font-black uppercase italic text-slate-800 mb-8 flex items-center gap-2">
                <Clock className="text-sky-500" /> Atividade por Horário
              </h4>
              <div className="flex-1 min-h-[300px] w-full">
                {hourlyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="hour" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 900, fill: '#94a3b8' }} 
                      />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '15px' }}
                        itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                        labelStyle={{ fontSize: '12px', fontWeight: '900', marginBottom: '5px', color: '#1e293b' }}
                      />
                      <Bar dataKey="total" name="Total Calls" fill="#0ea5e9" radius={[6, 6, 0, 0]} barSize={20} />
                      <Bar dataKey="atendidas" name="Atendidas" fill="#10b981" radius={[6, 6, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10 gap-4 opacity-30">
                    <Activity size={48} className="mx-auto" />
                    <p className="font-black uppercase text-xs">Aguardando dados de chamadas</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 flex flex-col gap-5 shadow-sm">
              <p className="text-xs font-black uppercase text-gray-400 tracking-[0.2em]">Importar Leads</p>
              <select value={importTarget} onChange={e => setImportTarget(e.target.value)} className="w-full pl-6 pr-6 py-5 bg-gray-50 border-2 border-gray-100 rounded-[1.5rem] font-black uppercase text-xs outline-none">
                <option value="none">FILA GERAL</option>
                <option value="online">DISTRIBUIR ONLINE</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              <button onClick={() => fileInput.current?.click()} className="w-full py-6 bg-sky-600 text-white rounded-[1.5rem] font-black uppercase italic text-sm flex items-center justify-center gap-3"><FileSpreadsheet size={20} /> XLSX</button>
              <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            </div>
            <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 flex flex-col justify-center shadow-sm">
              <p className="text-xs font-black uppercase text-gray-400 mb-4 tracking-[0.2em]">Busca Rápida</p>
              <input value={search} onChange={e => setSearch(e.target.value)} className="w-full px-6 py-5 bg-gray-50 rounded-[1.5rem] font-black uppercase text-xs outline-none" placeholder="NOME OU TELEFONE..." />
            </div>
            <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 flex flex-col justify-center shadow-sm">
              <p className="text-xs font-black uppercase text-gray-400 mb-4 tracking-[0.2em]">Vendedor</p>
              <select value={filterOperator} onChange={e => setFilterOperator(e.target.value)} className="w-full px-6 py-5 bg-gray-50 rounded-[1.5rem] font-black uppercase text-xs outline-none">
                <option value="all">TODOS</option>
                <option value="none">FILA GERAL</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            <div className="bg-amber-500 p-8 rounded-[3rem] text-white flex flex-col justify-center text-center shadow-lg shadow-amber-100">
              <p className="text-xs font-black uppercase opacity-60 mb-2">Pendentes</p>
              <p className="text-4xl font-black italic">{currentLeads.filter(l => l.status === 'PENDING').length}</p>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm relative">
            {selectedLeadIds.length > 0 && (
              <div className="absolute top-0 left-0 right-0 z-20 bg-slate-950 text-white p-6 flex items-center justify-between animate-in slide-in-from-top-full duration-300">
                <div className="flex items-center gap-4">
                  <span className="bg-sky-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase italic shadow-lg">
                    {selectedLeadIds.length} Selecionados
                  </span>
                  <p className="text-xs font-bold text-gray-400 hidden sm:block">Gerencie os leads selecionados na lista abaixo</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setSelectedLeadIds([])} className="px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:text-sky-400 transition-colors">Cancelar</button>
                  <button 
                    onClick={handleBulkDeleteLeads} 
                    className="flex items-center gap-2 px-8 py-3 bg-red-600 rounded-2xl text-[10px] font-black uppercase italic shadow-xl shadow-red-900/20 active:scale-95 transition-all"
                  >
                    <Trash2 size={14} /> Excluir Tudo
                  </button>
                </div>
              </div>
            )}

            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs font-black uppercase text-gray-400">
                <tr>
                  <th className="px-6 py-8 text-center w-16">
                    <button 
                      onClick={toggleSelectAllLeads} 
                      className={`p-2.5 rounded-xl transition-all border-2 ${selectedLeadIds.length === currentLeads.length && currentLeads.length > 0 ? 'bg-sky-500 border-sky-600 text-white' : 'bg-white border-gray-100 text-gray-300 hover:border-sky-200'}`}
                      title="Selecionar Todos Filtrados"
                    >
                      {selectedLeadIds.length === currentLeads.length && currentLeads.length > 0 ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>
                  </th>
                  <th className="px-10 py-8">Lead / Base</th>
                  <th className="px-10 py-8">Vendedor</th>
                  <th className="px-10 py-8 text-center">Status</th>
                  <th className="px-10 py-8 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {currentLeads.slice(0, 100).map(l => (
                  <tr key={l.id} className={`hover:bg-gray-50 transition-all ${selectedLeadIds.includes(l.id) ? 'bg-sky-50/50' : ''}`}>
                    <td className="px-6 py-7 text-center">
                      <button 
                        onClick={() => toggleLeadSelection(l.id)} 
                        className={`p-2.5 rounded-xl transition-all border-2 ${selectedLeadIds.includes(l.id) ? 'bg-sky-500 border-sky-600 text-white shadow-md' : 'bg-white border-gray-100 text-gray-200 hover:border-sky-100 hover:text-sky-300'}`}
                      >
                        {selectedLeadIds.includes(l.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                      </button>
                    </td>
                    <td className="px-10 py-7">
                      <p className="font-black uppercase text-slate-800 italic">{l.nome}</p>
                      <div className="flex flex-col mt-0.5">
                        <span className="text-xs font-bold text-sky-400 tracking-widest">{l.telefone}</span>
                        <span className="text-[9px] font-black uppercase text-gray-300 flex items-center gap-1">
                          <Bookmark size={10} /> {l.base}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-7 text-sm font-black uppercase text-slate-500">
                      {l.assignedTo ? users.find(u => u.id === l.assignedTo)?.nome : 'Fila Geral'}
                    </td>
                    <td className="px-10 py-7 text-center">
                      <span className={`px-6 py-2 rounded-full text-[10px] font-black uppercase border-2 ${l.status === 'CALLED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                        {l.status === 'CALLED' ? 'Chamado' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-10 py-7 text-right">
                      <button 
                        onClick={() => handleDeleteIndividualLead(l.id)} 
                        className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                        title="Excluir Lead Individual"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {currentLeads.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-20 text-[10px] font-black uppercase text-gray-300 tracking-[0.2em]">
                      Nenhum lead encontrado para os critérios selecionados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs font-black uppercase text-gray-400">
                <tr><th className="px-10 py-8">Equipe</th><th className="px-10 py-8 text-center">Fila Atual</th><th className="px-10 py-8 text-right">AÇÕES</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-10 py-7">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${u.online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                        <p className="font-black uppercase text-slate-800">{u.nome}</p>
                      </div>
                    </td>
                    <td className="px-10 py-7 text-center font-black text-xl text-sky-600">{leads.filter(l => l.assignedTo === u.id && l.status === 'PENDING').length}</td>
                    <td className="px-10 py-7 text-right flex justify-end gap-3">
                      <button onClick={() => onClearSellerLeads(u.id)} className="p-4 bg-red-50 text-red-500 rounded-2xl border-2 border-red-100" title="Limpar Fila"><RotateCcw size={18} /></button>
                      <button onClick={() => onToggleUserStatus(u.id)} className={`p-4 rounded-2xl border-2 transition-all ${u.online ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-100 text-gray-400'}`} title={u.online ? "Desativar" : "Ativar"}><Power size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sales' && (
        <div className="animate-in fade-in duration-500 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm">
              <p className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">Total de Vendas</p>
              <p className="text-4xl font-black italic text-slate-900">{stats.totalVendasCount}</p>
            </div>
            
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Via Ligação</p>
                <span className="text-sky-600 font-black text-xs italic">{stats.canais.call.pct}%</span>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-4xl font-black italic text-sky-600">{stats.canais.call.count}</p>
                <Smartphone className="mb-1 text-sky-200" size={20} />
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Via WhatsApp</p>
                <span className="text-emerald-500 font-black text-xs italic">{stats.canais.whatsapp.pct}%</span>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-4xl font-black italic text-emerald-600">{stats.canais.whatsapp.count}</p>
                <MessageCircle className="mb-1 text-emerald-200" size={20} />
              </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl">
              <p className="text-[10px] font-black uppercase opacity-60 mb-2 tracking-widest">Ticket Médio</p>
              <p className="text-2xl font-black italic">R$ {stats.ticketMedio.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-xs font-black uppercase text-gray-400">
                <tr><th className="px-10 py-8">Vendedor</th><th className="px-10 py-8">Canal</th><th className="px-10 py-8">Cliente</th><th className="px-10 py-8 text-right">Valor</th><th className="px-10 py-8 text-right">Ação</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {periodSales.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-10 py-7 font-black uppercase text-sm italic">{users.find(u => u.id === s.seller_id)?.nome}</td>
                    <td className="px-10 py-7">
                      <div className="flex items-center gap-2">
                        {s.canal === 'whatsapp' ? (
                          <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter border border-emerald-100">
                            <MessageCircle size={14} /> WhatsApp
                          </div>
                        ) : (
                          <div className="bg-sky-50 text-sky-600 p-2 rounded-xl flex items-center gap-2 text-[9px] font-black uppercase tracking-tighter border border-sky-100">
                            <PhoneCall size={14} /> Ligação
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-10 py-7 font-black uppercase text-xs text-slate-500">{s.customer_name}</td>
                    <td className="px-10 py-7 text-right font-black italic text-lg text-emerald-600">
                      {editingSaleId === s.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <input value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-32 p-3 border-2 border-sky-500 rounded-xl text-right outline-none font-black" autoFocus />
                          <button onClick={() => { onUpdateSale(s.id, parseFloat(editAmount)); setEditingSaleId(null); }} className="p-2 bg-sky-500 text-white rounded-lg"><Save size={16}/></button>
                        </div>
                      ) : `R$ ${Number(s.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="px-10 py-7 text-right flex justify-end gap-3">
                      <button onClick={() => { setEditingSaleId(s.id); setEditAmount(s.amount.toString()); }} className="p-3 text-sky-600 hover:bg-sky-50 rounded-xl"><Edit3 size={18} /></button>
                      <button onClick={() => onDeleteSale(s.id)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
                {periodSales.length === 0 && <tr><td colSpan={5} className="text-center py-20 text-[10px] font-black uppercase text-gray-300 tracking-[0.2em]">Sem vendas encontradas no período</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
