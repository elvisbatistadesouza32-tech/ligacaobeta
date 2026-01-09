
import React, { useState, useMemo, useRef } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { Users, Database, Power, Search, Trash2, Loader2, FileSpreadsheet, Check, BarChart3, Clock, AlertCircle, Share2, X, ChevronRight, Inbox, Award, Layers, LayoutGrid, CalendarDays, RotateCcw, Filter, CheckSquare, Square, ListFilter } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';

interface AdminViewProps {
  users: User[];
  leads: Lead[];
  calls: CallRecord[];
  onImportLeads: (leads: Lead[], target: 'none' | 'online' | string) => Promise<void>;
  onToggleUserStatus: (id: string) => void;
  onDeleteUser: (id: string) => void;
  onTransferLeads: (leadIds: string[], userId: string | null) => Promise<void>;
  onDeleteLeads: (leadIds: string[]) => Promise<void>;
}

export const AdminView: React.FC<AdminViewProps> = ({ users, leads, calls, onImportLeads, onToggleUserStatus, onDeleteUser, onTransferLeads, onDeleteLeads }) => {
  const [tab, setTab] = useState<'dash' | 'leads' | 'users'>('dash');
  const [viewMode, setViewMode] = useState<'month' | 'day'>('day'); 
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [operatorFilter, setOperatorFilter] = useState<string>(''); // '' = todos, 'none' = fila geral
  const [pendingLeads, setPendingLeads] = useState<Lead[] | null>(null);
  const [target, setTarget] = useState<'none' | 'online' | string>('none');
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);

  const sellers = useMemo(() => users.filter(u => u.tipo === 'vendedor'), [users]);
  
  const filteredCalls = useMemo(() => {
    return calls.filter(c => {
      if (viewMode === 'day') {
        return c.timestamp.startsWith(date);
      } else {
        return c.timestamp.startsWith(date.slice(0, 7));
      }
    });
  }, [calls, date, viewMode]);

  const stats = useMemo(() => {
    const ans = filteredCalls.filter(c => c.status === CallStatus.ANSWERED).length;
    const noAns = filteredCalls.filter(c => c.status === CallStatus.NO_ANSWER).length;
    const inv = filteredCalls.filter(c => c.status === CallStatus.INVALID_NUMBER).length;
    
    const total = filteredCalls.length;
    const getPct = (val: number) => total > 0 ? ((val / total) * 100).toFixed(0) : '0';

    return {
      total, 
      ans, 
      noAns, 
      inv,
      ansPct: getPct(ans),
      noAnsPct: getPct(noAns),
      invPct: getPct(inv),
      chart: [
        { name: 'Atendidas', value: ans, color: '#10b981' }, 
        { name: 'Não Atendidas', value: noAns, color: '#ef4444' }, 
        { name: 'Inválidas', value: inv, color: '#6366f1' }
      ].filter(d => d.value > 0)
    };
  }, [filteredCalls]);

  const rankedSellers = useMemo(() => {
    return [...sellers]
      .map(s => {
        const callCount = filteredCalls.filter(c => c.sellerId === s.id).length;
        const pendingCount = leads.filter(l => l.assignedTo === s.id && l.status === 'PENDING').length;
        return { ...s, callCount, pendingCount };
      })
      .sort((a, b) => b.callCount - a.callCount);
  }, [sellers, filteredCalls, leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      // Filtro de Texto
      const searchTerm = search.toLowerCase().trim();
      const matchesSearch = searchTerm === '' || 
        l.nome.toLowerCase().includes(searchTerm) || 
        l.telefone.includes(searchTerm) ||
        l.base.toLowerCase().includes(searchTerm);
      
      // Filtro de Operador (Lógica Corrigida)
      let matchesOperator = true;
      if (operatorFilter === 'none') {
        matchesOperator = !l.assignedTo;
      } else if (operatorFilter !== '') {
        matchesOperator = l.assignedTo === operatorFilter;
      }

      return matchesSearch && matchesOperator;
    });
  }, [leads, search, operatorFilter]);

  // Função para verificar se todos os leads filtrados estão selecionados
  const isAllFilteredSelected = useMemo(() => {
    if (filteredLeads.length === 0) return false;
    return filteredLeads.every(l => selectedLeads.includes(l.id));
  }, [filteredLeads, selectedLeads]);

  const handleSelectAll = () => {
    if (isAllFilteredSelected) {
      // Desmarca apenas os que estão visíveis no filtro atual
      const filteredIds = filteredLeads.map(l => l.id);
      setSelectedLeads(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Adiciona todos os visíveis na seleção global
      const filteredIds = filteredLeads.map(l => l.id);
      setSelectedLeads(prev => {
        const newSelection = [...prev];
        filteredIds.forEach(id => {
          if (!newSelection.includes(id)) newSelection.push(id);
        });
        return newSelection;
      });
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const parsed = json.slice(1).map((row, i) => {
          const fone = String(row[2] || '').replace(/\D/g, '');
          return fone.length >= 8 ? { id: `t-${i}`, nome: String(row[0]), base: String(row[1]), telefone: fone, status: 'PENDING' as const, createdAt: '' } : null;
        }).filter(Boolean) as Lead[];
        setPendingLeads(parsed);
      } catch (err: any) { alert("Erro ao ler planilha"); }
    };
    r.readAsBinaryString(f);
  };

  const confirmImport = async () => {
    if (!pendingLeads) return;
    setLoading(true);
    await onImportLeads(pendingLeads, target);
    setPendingLeads(null);
    setLoading(false);
  };

  const handleBulkTransfer = async (destId: string | null) => {
    setLoading(true);
    await onTransferLeads(selectedLeads, destId);
    setSelectedLeads([]);
    setIsTransferring(false);
    setLoading(false);
  };

  const toggleLeadSelection = (id: string) => {
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleClearUserLeads = async (userId: string, userName: string) => {
    const userPendingLeads = leads.filter(l => l.assignedTo === userId && l.status === 'PENDING').map(l => l.id);
    if (userPendingLeads.length === 0) return;
    
    if (confirm(`Deseja zerar a fila de ${userName}? Os ${userPendingLeads.length} leads pendentes voltarão para a Fila Geral.`)) {
      setLoading(true);
      await onTransferLeads(userPendingLeads, null);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700 relative">
      
      {pendingLeads && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black mb-6 uppercase italic text-center text-slate-900">Distribuir {pendingLeads.length} Leads</h3>
            <div className="space-y-3">
              <button onClick={() => setTarget('none')} className={`w-full p-5 rounded-2xl border-2 flex justify-between items-center transition-all ${target === 'none' ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-gray-100'}`}><div className="text-left"><p className="font-black uppercase text-sm">Fila Geral</p></div><Check className={target === 'none' ? 'block' : 'hidden'} /></button>
              <button onClick={() => setTarget('online')} className={`w-full p-5 rounded-2xl border-2 flex justify-between items-center transition-all ${target === 'online' ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-gray-100'}`}><div className="text-left"><p className="font-black uppercase text-sm">Vendedores Online</p></div><Check className={target === 'online' ? 'block' : 'hidden'} /></button>
              <div className="relative"><select onChange={e => setTarget(e.target.value)} className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-gray-100 font-bold outline-none focus:border-sky-600 appearance-none transition-all"><option value="">Destinar a Vendedor Específico...</option>{sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-8"><button onClick={() => setPendingLeads(null)} className="py-4 font-black uppercase text-xs text-gray-400">Descartar</button><button onClick={confirmImport} disabled={loading} className="py-4 bg-sky-600 text-white rounded-2xl font-black uppercase text-xs flex justify-center items-center">{loading ? <Loader2 className="animate-spin" /> : 'Confirmar'}</button></div>
          </div>
        </div>
      )}

      {isTransferring && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black uppercase italic text-slate-900 mb-8">Transferir {selectedLeads.length} Lead(s)</h3>
            <div className="max-h-96 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
              <button onClick={() => handleBulkTransfer(null)} className="w-full p-5 rounded-3xl border-2 border-gray-100 hover:border-amber-400 hover:bg-amber-50 text-left transition-all"><p className="font-black uppercase text-xs text-slate-800">Fila Geral</p></button>
              {sellers.map(s => (
                <button key={s.id} onClick={() => handleBulkTransfer(s.id)} className="w-full p-5 rounded-3xl border-2 border-gray-100 hover:border-sky-500 hover:bg-sky-50 text-left transition-all"><p className="font-black uppercase text-xs text-slate-800">{s.nome}</p></button>
              ))}
            </div>
            <button onClick={() => setIsTransferring(false)} className="mt-6 w-full text-xs font-black uppercase text-gray-400 hover:text-slate-900 transition-colors py-4">Cancelar</button>
          </div>
        </div>
      )}

      {selectedLeads.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[90] animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-slate-900 text-white px-8 py-5 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-8 border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="bg-sky-500 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-lg shadow-sky-500/30">{selectedLeads.length}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Selecionados</span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex items-center gap-4">
              <button onClick={() => setIsTransferring(true)} className="bg-white text-slate-900 px-6 py-2.5 rounded-full font-black uppercase text-[10px] hover:bg-sky-400 hover:text-white transition-all">Transferir</button>
              <button onClick={() => onDeleteLeads(selectedLeads)} className="text-red-400 font-black uppercase text-[10px] hover:text-red-300 transition-all px-4">Excluir</button>
              <button onClick={() => setSelectedLeads([])} className="text-white/40 hover:text-white transition-all"><X size={16} /></button>
            </div>
          </div>
        </div>
      )}

      <nav className="flex bg-white p-2 rounded-full border shadow-sm max-w-2xl mx-auto mb-10 overflow-hidden">
        {[
          { id: 'dash', label: 'Dashboard', icon: BarChart3 },
          { id: 'leads', label: 'Leads', icon: Database },
          { id: 'users', label: 'Equipe', icon: Users }
        ].map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id as any); setSelectedLeads([]); }} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${tab === t.id ? 'bg-sky-600 text-white shadow-xl shadow-sky-100 translate-y-[-2px]' : 'text-gray-400 hover:bg-gray-50'}`}>
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      {tab === 'dash' && (
        <div className="space-y-8 max-w-6xl mx-auto pb-20">
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-200">
              <button onClick={() => setViewMode('day')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'day' ? 'bg-white text-sky-600 shadow-md border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}><CalendarDays className="w-3 h-3" />Diário</button>
              <button onClick={() => setViewMode('month')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'month' ? 'bg-white text-sky-600 shadow-md border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}><Layers className="w-3 h-3" />Mensal</button>
            </div>
            <div className="flex flex-col items-center md:items-end">
              <div className="flex items-center gap-3 bg-sky-50 px-6 py-3 rounded-2xl border-2 border-sky-100 text-sky-700 shadow-inner group">
                <Clock className="w-4 h-4 text-sky-500 group-hover:rotate-12 transition-transform" />
                <div className="flex flex-col"><span className="text-[8px] font-black uppercase opacity-50 mb-[-2px]">Data de Referência</span><input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent font-black text-sm outline-none uppercase cursor-pointer" /></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="bg-sky-600 p-8 rounded-[2.5rem] text-white shadow-xl"><p className="text-[10px] uppercase font-black opacity-60 mb-1">Chamadas no Período</p><p className="text-4xl font-black italic tracking-tighter">{stats.total}</p></div>
            <div className="bg-amber-500 p-8 rounded-[2.5rem] text-white shadow-xl"><p className="text-[10px] uppercase font-black opacity-60 mb-1">Fila Total Atual</p><p className="text-4xl font-black italic tracking-tighter">{leads.filter(l => l.status === 'PENDING').length}</p></div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100"><p className="text-[10px] uppercase font-black text-gray-400 mb-1">Atendidas</p><div className="flex items-baseline gap-2"><p className="text-4xl font-black italic tracking-tighter text-emerald-600">{stats.ans}</p><span className="text-xs font-black text-emerald-500/60">({stats.ansPct}%)</span></div></div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100"><p className="text-[10px] uppercase font-black text-gray-400 mb-1">Falhas</p><div className="flex items-baseline gap-2"><p className="text-4xl font-black italic tracking-tighter text-red-600">{stats.noAns}</p><span className="text-xs font-black text-red-500/60">({stats.noAnsPct}%)</span></div></div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100"><p className="text-[10px] uppercase font-black text-gray-400 mb-1">Inválidos</p><div className="flex items-baseline gap-2"><p className="text-4xl font-black italic tracking-tighter text-sky-500">{stats.inv}</p><span className="text-xs font-black text-sky-500/60">({stats.invPct}%)</span></div></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border-2 border-gray-100 h-[450px] flex flex-col">
              <h4 className="font-black uppercase italic text-slate-800 tracking-tighter mb-6">Qualidade do Atendimento</h4>
              <div className="flex-1">
                {stats.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.chart} innerRadius={90} outerRadius={130} paddingAngle={8} dataKey="value" stroke="none">{stats.chart.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie>
                      <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3"><AlertCircle className="w-12 h-12 opacity-20" /><p className="font-black uppercase italic text-xs">Nenhum registro encontrado</p></div>
                )}
              </div>
            </div>
            <div className="bg-white p-10 rounded-[3rem] border-2 border-gray-100 shadow-sm">
               <div className="flex items-center gap-3 mb-8"><Award className="text-amber-500 w-6 h-6" /><h4 className="font-black uppercase italic text-slate-800 tracking-tighter">Top 3 do Período</h4></div>
               <div className="space-y-4">
                {rankedSellers.slice(0, 3).map((s, idx) => (
                  <div key={s.id} className={`flex flex-col gap-2 p-5 rounded-[2rem] border-2 transition-all ${idx === 0 ? 'bg-sky-50 border-sky-100' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center justify-between"><div className="flex items-center gap-4"><span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-600' : 'bg-orange-400 text-white'}`}>#{idx+1}</span><p className="font-black uppercase text-xs text-slate-700 leading-tight">{s.nome}</p></div></div>
                    <div className="flex items-end justify-between mt-2"><div><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Ligações</span><p className="text-2xl font-black italic text-sky-600 leading-none">{s.callCount}</p></div><div className="text-right"><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Carga Atual</span><p className={`text-xl font-black italic leading-none ${s.pendingCount > 15 ? 'text-red-500' : 'text-amber-500'}`}>{s.pendingCount}</p></div></div>
                  </div>
                ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="space-y-6 max-w-6xl mx-auto">
          <div className="bg-white p-8 rounded-[3rem] border-4 border-dashed border-sky-100 flex items-center gap-8">
            <div className="bg-sky-50 p-6 rounded-[2rem] text-sky-600"><FileSpreadsheet className="w-10 h-10" /></div>
            <div className="flex-1"><h4 className="text-xl font-black uppercase italic text-slate-900">Importar Leads</h4><p className="text-xs font-bold text-gray-400 uppercase mt-1">Colunas A (Nome), B (Base), C (Contato)</p></div>
            <button onClick={() => fileInput.current?.click()} className="bg-sky-600 text-white px-10 py-5 rounded-3xl font-black uppercase text-xs">Selecionar Arquivo</button>
            <input type="file" ref={fileInput} onChange={handleFile} accept=".xlsx, .xls" className="hidden" />
          </div>

          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-gray-100 flex flex-col lg:flex-row gap-6 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                <input 
                  value={search} 
                  onChange={e => { setSearch(e.target.value); setSelectedLeads([]); }} 
                  placeholder="Pesquisar por nome, base ou telefone..." 
                  className="w-full pl-16 pr-6 py-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-sky-600 font-bold outline-none transition-all placeholder:text-gray-300" 
                />
              </div>
              <div className="flex items-center gap-4 w-full lg:w-auto">
                <div className="flex items-center gap-3 bg-gray-50 px-6 py-2 rounded-2xl border-2 border-transparent hover:border-sky-200 focus-within:border-sky-600 transition-all flex-1 lg:flex-none">
                  <ListFilter className="w-4 h-4 text-sky-500" />
                  <select 
                    value={operatorFilter} 
                    onChange={e => { setOperatorFilter(e.target.value); setSelectedLeads([]); }}
                    className="bg-transparent font-black text-[10px] uppercase text-slate-700 outline-none h-10 w-full sm:w-56 cursor-pointer"
                  >
                    <option value="">Filtrar: Todos os Leads</option>
                    <option value="none">📍 Fila Geral (Sem Operador)</option>
                    <optgroup label="OPERADORES ATIVOS">
                      {sellers.map(s => (
                        <option key={s.id} value={s.id}>👤 {s.nome.toUpperCase()}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                <div className="bg-sky-50 px-5 py-3 rounded-2xl border border-sky-100 flex flex-col items-center min-w-[100px]">
                  <span className="text-[8px] font-black text-sky-600 uppercase opacity-60">Encontrados</span>
                  <span className="text-sm font-black italic text-sky-700">{filteredLeads.length}</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 font-black uppercase text-[10px] text-gray-400">
                  <tr>
                    <th className="px-6 py-6 w-16 text-center cursor-pointer select-none group" onClick={handleSelectAll}>
                      <div className="flex justify-center items-center gap-2">
                        {isAllFilteredSelected ? (
                          <CheckSquare className="w-6 h-6 text-sky-600 animate-in zoom-in-75 duration-200" />
                        ) : (
                          <div className="w-6 h-6 border-2 border-gray-300 rounded-lg group-hover:border-sky-400 transition-colors flex items-center justify-center">
                            {selectedLeads.length > 0 && !isAllFilteredSelected && <div className="w-2 h-2 bg-sky-400 rounded-sm" />}
                          </div>
                        )}
                      </div>
                    </th>
                    <th className="px-10 py-6">Lead / Cliente</th>
                    <th className="px-10 py-6">Operador Atribuído</th>
                    <th className="px-10 py-6 text-center">Status</th>
                    <th className="px-10 py-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLeads.map(l => (
                    <tr key={l.id} className={`transition-all hover:bg-gray-50/50 ${selectedLeads.includes(l.id) ? 'bg-sky-50/50' : ''}`}>
                      <td className="px-6 py-6 text-center">
                        <input 
                          type="checkbox" 
                          checked={selectedLeads.includes(l.id)} 
                          onChange={() => toggleLeadSelection(l.id)} 
                          className="w-5 h-5 accent-sky-600 cursor-pointer" 
                        />
                      </td>
                      <td className="px-10 py-6">
                        <p className="font-black uppercase text-sm text-slate-800">{l.nome}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-sky-600 font-bold">{l.telefone}</span>
                          <span className="text-[9px] text-gray-300 font-bold">•</span>
                          <span className="text-[9px] text-gray-400 font-black uppercase">{l.base}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-2">
                          {l.assignedTo ? (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-sky-500" />
                              <span className="text-xs font-black uppercase text-slate-600">{users.find(u => u.id === l.assignedTo)?.nome}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-amber-400" />
                              <span className="text-xs font-black uppercase text-amber-600">Fila Geral</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-10 py-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border ${
                          l.status === 'CALLED' 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                            : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}>
                          {l.status === 'CALLED' ? 'Chamado' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <button 
                          onClick={() => onDeleteLeads([l.id])} 
                          className="p-3 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-32 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-20">
                          <Database size={64} />
                          <p className="font-black uppercase text-sm italic">Nenhum lead encontrado com estes filtros</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-gray-100 flex items-center gap-3"><Users className="w-6 h-6 text-sky-600" /><h4 className="font-black uppercase italic text-slate-800 tracking-tighter">Gestão da Equipe Comercial</h4></div>
            <table className="w-full text-left">
              <thead className="bg-gray-50 font-black uppercase text-[10px] text-gray-400">
                <tr><th className="px-10 py-6">Nome / Colaborador</th><th className="px-10 py-6">Tipo</th><th className="px-10 py-6 text-center">Leads Pendentes</th><th className="px-10 py-6 text-right">Controle</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => {
                  const pendingCount = leads.filter(l => l.assignedTo === u.id && l.status === 'PENDING').length;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-10 py-6"><div className="flex items-center gap-4"><div className={`w-3 h-3 rounded-full ${u.online ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse' : 'bg-gray-300'}`} /><div><p className="font-black uppercase text-sm text-slate-800 group-hover:text-sky-600 transition-colors">{u.nome}</p><p className="text-[10px] text-gray-400 font-bold">{u.email}</p></div></div></td><td className="px-10 py-6 uppercase font-black text-[10px] text-sky-600 tracking-widest">{u.tipo}</td>
                      <td className="px-10 py-6 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <span className={`px-4 py-1.5 rounded-2xl font-black italic text-sm ${pendingCount === 0 ? 'bg-emerald-50 text-emerald-600' : pendingCount > 15 ? 'bg-red-50 text-red-600' : 'bg-sky-50 text-sky-600'}`}>{pendingCount}</span>
                          {pendingCount > 0 && (
                            <button 
                              onClick={() => handleClearUserLeads(u.id, u.nome)}
                              className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-all"
                              title="Zerar Pendentes (Mover para Fila Geral)"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-10 py-6 text-right flex justify-end gap-3"><button onClick={() => onToggleUserStatus(u.id)} className={`p-3 rounded-xl border-2 transition-all ${u.online ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-gray-100 border-gray-100 text-gray-400'}`}><Power size={16} /></button>{u.tipo !== 'adm' && (<button onClick={() => onDeleteUser(u.id)} className="p-3 bg-red-50 text-red-500 rounded-xl border-2 border-red-50 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16} /></button>)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
