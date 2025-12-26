
import React, { useState, useMemo, useRef } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { Users, Database, Power, Search, Trash2, Loader2, FileSpreadsheet, Check, BarChart3, Clock, AlertCircle, Share2, X, ChevronRight, Inbox } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [pendingLeads, setPendingLeads] = useState<Lead[] | null>(null);
  const [target, setTarget] = useState<'none' | 'online' | string>('none');
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Transfer State
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);

  const sellers = useMemo(() => users.filter(u => u.tipo === 'vendedor'), [users]);
  
  const stats = useMemo(() => {
    const filtered = calls.filter(c => viewMode === 'day' ? c.timestamp.startsWith(date) : c.timestamp.startsWith(date.slice(0, 7)));
    const ans = filtered.filter(c => c.status === CallStatus.ANSWERED).length;
    const noAns = filtered.filter(c => c.status === CallStatus.NO_ANSWER).length;
    const inv = filtered.filter(c => c.status === CallStatus.INVALID_NUMBER).length;
    
    const total = filtered.length;
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
  }, [calls, date, viewMode]);

  // Ranking de Operadores ordenado por volume de ligações + Pendências
  const rankedSellers = useMemo(() => {
    return [...sellers]
      .map(s => {
        const callCount = calls.filter(c => 
          c.sellerId === s.id && 
          (viewMode === 'day' ? c.timestamp.startsWith(date) : c.timestamp.startsWith(date.slice(0, 7)))
        ).length;
        
        const pendingCount = leads.filter(l => 
          l.assignedTo === s.id && l.status === 'PENDING'
        ).length;

        return { ...s, callCount, pendingCount };
      })
      .sort((a, b) => b.callCount - a.callCount);
  }, [sellers, calls, leads, date, viewMode]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => 
      l.nome.toLowerCase().includes(search.toLowerCase()) || 
      l.telefone.includes(search) ||
      l.base.toLowerCase().includes(search.toLowerCase())
    );
  }, [leads, search]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (json[0]?.length < 3) throw new Error("Layout Inválido: Certifique-se de ter NOME, BASE e CONTATO nas colunas A, B e C.");
        const parsed = json.slice(1).map((row, i) => {
          const fone = String(row[2] || '').replace(/\D/g, '');
          return fone.length >= 8 ? { id: `t-${i}`, nome: String(row[0]), base: String(row[1]), telefone: fone, status: 'PENDING' as const, createdAt: '' } : null;
        }).filter(Boolean) as Lead[];
        if (parsed.length === 0) throw new Error("Nenhum lead válido encontrado no arquivo.");
        setPendingLeads(parsed);
      } catch (err: any) { alert(err.message); }
    };
    r.readAsBinaryString(f);
    if (fileInput.current) fileInput.current.value = '';
  };

  const confirmImport = async () => {
    if (!pendingLeads) return;
    setLoading(true);
    await onImportLeads(pendingLeads, target);
    setPendingLeads(null);
    setLoading(false);
  };

  const toggleLeadSelection = (id: string) => {
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkTransfer = async (destId: string | null) => {
    if (selectedLeads.length === 0) return;
    setLoading(true);
    await onTransferLeads(selectedLeads, destId);
    setSelectedLeads([]);
    setIsTransferring(false);
    setLoading(false);
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return;
    setLoading(true);
    await onDeleteLeads(selectedLeads);
    setSelectedLeads([]);
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700 relative">
      
      {/* Modals e Barras de Ação omitidas para brevidade, mantendo lógica original */}
      {pendingLeads && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black mb-6 uppercase italic text-center text-slate-900">Distribuir {pendingLeads.length} Leads</h3>
            <div className="space-y-3">
              <button onClick={() => setTarget('none')} className={`w-full p-5 rounded-2xl border-2 flex justify-between items-center transition-all ${target === 'none' ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="text-left"><p className="font-black uppercase text-sm">Fila Geral</p><p className="text-[10px] opacity-60">Fica disponível para qualquer vendedor pegar</p></div>
                <Check className={target === 'none' ? 'block' : 'hidden'} />
              </button>
              <button onClick={() => setTarget('online')} className={`w-full p-5 rounded-2xl border-2 flex justify-between items-center transition-all ${target === 'online' ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="text-left"><p className="font-black uppercase text-sm">Vendedores Online</p><p className="text-[10px] opacity-60">Distribui proporcionalmente entre quem está logado</p></div>
                <Check className={target === 'online' ? 'block' : 'hidden'} />
              </button>
              <div className="relative">
                <select onChange={e => setTarget(e.target.value)} className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-gray-100 font-bold outline-none focus:border-sky-600 appearance-none transition-all">
                  <option value="">Destinar a Vendedor Específico...</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.nome} ({s.online ? 'Online' : 'Offline'})</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-8">
              <button onClick={() => setPendingLeads(null)} className="py-4 font-black uppercase text-xs text-gray-400 hover:text-gray-600 transition-colors">Descartar</button>
              <button onClick={confirmImport} disabled={loading} className="py-4 bg-sky-600 text-white rounded-2xl font-black uppercase text-xs flex justify-center items-center shadow-lg shadow-sky-100 hover:bg-sky-700 active:scale-95 transition-all">
                {loading ? <Loader2 className="animate-spin" /> : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isTransferring && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
               <h3 className="text-xl font-black uppercase italic text-slate-900 tracking-tight">Transferir {selectedLeads.length} Lead(s)</h3>
               <button onClick={() => setIsTransferring(false)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><X /></button>
            </div>
            <div className="max-h-96 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              <button onClick={() => handleBulkTransfer(null)} className="w-full p-5 rounded-3xl border-2 border-gray-100 hover:border-amber-400 hover:bg-amber-50 group flex justify-between items-center transition-all">
                <div className="text-left"><p className="font-black uppercase text-xs text-slate-800">Mover para Fila Geral</p><p className="text-[10px] text-gray-400">Remove o vendedor atual e deixa em aberto</p></div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-amber-500 transition-colors" />
              </button>
              <div className="h-px bg-gray-50 my-2"></div>
              {sellers.map(s => (
                <button key={s.id} onClick={() => handleBulkTransfer(s.id)} className="w-full p-5 rounded-3xl border-2 border-gray-100 hover:border-sky-500 hover:bg-sky-50 group flex justify-between items-center transition-all">
                  <div className="flex items-center gap-4">
                    <div className={`w-2.5 h-2.5 rounded-full ${s.online ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-300'}`}></div>
                    <div className="text-left"><p className="font-black uppercase text-xs text-slate-800">{s.nome}</p><p className="text-[10px] text-gray-400">{s.online ? 'Disponível agora' : 'Indisponível'}</p></div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-sky-500 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedLeads.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[90] animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-slate-900 text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-8 border border-white/10">
            <div className="flex items-center gap-3">
              <span className="bg-sky-600 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs">{selectedLeads.length}</span>
              <p className="font-black uppercase text-[10px] tracking-[0.2em]">Leads Selecionados</p>
            </div>
            <div className="w-px h-6 bg-white/10"></div>
            <div className="flex items-center gap-4">
               <button onClick={() => setIsTransferring(true)} className="flex items-center gap-2 bg-white text-slate-900 px-6 py-2.5 rounded-full font-black uppercase text-[10px] hover:bg-sky-400 hover:text-white transition-all active:scale-95"><Share2 className="w-3.5 h-3.5" /> Transferir</button>
               <button onClick={handleBulkDelete} className="flex items-center gap-2 bg-red-600/20 text-red-400 border border-red-500/30 px-6 py-2.5 rounded-full font-black uppercase text-[10px] hover:bg-red-600 hover:text-white transition-all active:scale-95"><Trash2 className="w-3.5 h-3.5" /> Excluir</button>
               <button onClick={() => setSelectedLeads([])} className="text-white/40 hover:text-white font-black uppercase text-[10px] transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <nav className="flex bg-white p-2 rounded-full border shadow-sm max-w-2xl mx-auto mb-10 overflow-hidden">
        {[
          { id: 'dash', label: 'Dashboard', icon: BarChart3 },
          { id: 'leads', label: 'Gestão de Leads', icon: Database },
          { id: 'users', label: 'Equipe', icon: Users }
        ].map((t) => (
          <button 
            key={t.id} 
            onClick={() => { setTab(t.id as any); setSelectedLeads([]); }} 
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${tab === t.id ? 'bg-sky-600 text-white shadow-xl shadow-sky-100 translate-y-[-2px]' : 'text-gray-400 hover:bg-gray-50'}`}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      {tab === 'dash' && (
        <div className="space-y-6 max-w-6xl mx-auto">
          <div className="bg-white p-5 rounded-[2.5rem] border-2 border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex bg-gray-50 p-1.5 rounded-2xl border border-gray-100">
              <button onClick={() => setViewMode('month')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'month' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400'}`}>Visão Mensal</button>
              <button onClick={() => setViewMode('day')} className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'day' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400'}`}>Visão Diária</button>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
              <Clock className="w-4 h-4 text-sky-500" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent font-black text-xs outline-none uppercase text-sky-900" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="bg-sky-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-sky-100">
              <p className="text-[10px] uppercase font-black opacity-60 mb-1">Chamadas</p>
              <p className="text-4xl font-black italic tracking-tighter">{stats.total}</p>
            </div>
            <div className="bg-amber-500 p-8 rounded-[2.5rem] text-white shadow-xl shadow-amber-100">
              <p className="text-[10px] uppercase font-black opacity-60 mb-1">Fila Total</p>
              <p className="text-4xl font-black italic tracking-tighter">{leads.filter(l => l.status === 'PENDING').length}</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 group hover:border-emerald-500 transition-colors">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1 group-hover:text-emerald-600">Atendidas</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black italic tracking-tighter text-emerald-600">{stats.ans}</p>
                <span className="text-xs font-black text-emerald-500/60 italic">({stats.ansPct}%)</span>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 group hover:border-red-500 transition-colors">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1 group-hover:text-red-600">Falhas</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black italic tracking-tighter text-red-600">{stats.noAns}</p>
                <span className="text-xs font-black text-red-500/60 italic">({stats.noAnsPct}%)</span>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 group hover:border-sky-400 transition-colors">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1 group-hover:text-sky-500">Inválidos</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black italic tracking-tighter text-sky-500">{stats.inv}</p>
                <span className="text-xs font-black text-sky-500/60 italic">({stats.invPct}%)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border-2 border-gray-100 h-[400px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-black uppercase italic text-slate-800 tracking-tighter">Qualidade de Chamadas</h4>
                <div className="flex gap-4">
                  {stats.chart.map(c => (
                    <div key={c.name} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }}></div>
                      <span className="text-[9px] font-black uppercase text-gray-400">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                {stats.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.chart} innerRadius={80} outerRadius={120} paddingAngle={8} dataKey="value" stroke="none">
                        {stats.chart.map((e, i) => <Cell key={i} fill={e.color} className="outline-none focus:opacity-80 transition-opacity" />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold', fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                    <AlertCircle className="w-12 h-12 opacity-20" /><p className="font-black uppercase italic text-xs">Sem dados no período</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-white p-10 rounded-[3rem] border-2 border-gray-100">
               <h4 className="font-black uppercase italic text-slate-800 tracking-tighter mb-8">Status da Equipe</h4>
               <div className="space-y-4">
                {rankedSellers.slice(0, 5).map((s, idx) => (
                  <div key={s.id} className="flex flex-col gap-2 p-4 bg-gray-50/50 rounded-3xl border border-gray-100 hover:border-sky-200 transition-all">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-sky-600 text-[10px] text-white flex items-center justify-center font-black">#{idx+1}</span><p className="font-black uppercase text-xs text-slate-700">{s.nome}</p></div>
                       <div className={`w-2 h-2 rounded-full ${s.online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="flex flex-col"><span className="text-[9px] font-black text-gray-400 uppercase">Chamadas</span><span className="text-lg font-black italic text-sky-600">{s.callCount}</span></div>
                      <div className="flex flex-col text-right"><span className="text-[9px] font-black text-gray-400 uppercase">Pendentes</span><span className={`text-lg font-black italic ${s.pendingCount > 10 ? 'text-red-500' : 'text-amber-500'}`}>{s.pendingCount}</span></div>
                    </div>
                    <div className="w-full h-1 bg-gray-200 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-sky-600 transition-all duration-1000" style={{ width: `${Math.min(100, (s.callCount / (stats.total || 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Outras abas (leads, users) mantêm a implementação original */}
      {tab === 'leads' && (
        <div className="space-y-6 max-w-6xl mx-auto">
          <div className="bg-white p-8 sm:p-12 rounded-[3.5rem] border-4 border-dashed border-sky-100 flex flex-col md:flex-row items-center gap-8 group hover:border-sky-300 transition-colors">
            <div className="bg-sky-50 p-6 rounded-[2rem] text-sky-600 group-hover:scale-110 transition-transform"><FileSpreadsheet className="w-10 h-10" /></div>
            <div className="flex-1 text-center md:text-left">
              <h4 className="text-xl font-black uppercase italic text-slate-900 tracking-tighter">Importar Nova Base de Leads</h4>
              <p className="text-xs font-bold text-gray-400 uppercase mt-1">Colunas Requeridas: A (Nome) | B (Base/Origem) | C (Contato/Telefone)</p>
            </div>
            <button onClick={() => fileInput.current?.click()} className="bg-sky-600 text-white px-10 py-5 rounded-3xl font-black uppercase text-xs shadow-xl shadow-sky-100 hover:bg-sky-700 active:scale-95 transition-all flex items-center gap-3"><Database className="w-4 h-4" />Selecionar Planilha</button>
            <input type="file" ref={fileInput} onChange={handleFile} accept=".xlsx, .xls" className="hidden" />
          </div>

          <div className="bg-white rounded-[3rem] border-2 border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar por nome, base ou telefone..." className="w-full pl-16 pr-6 py-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-sky-600 focus:bg-white font-bold outline-none transition-all" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 font-black uppercase text-[10px] text-gray-400 tracking-widest border-b border-gray-100">
                  <tr><th className="px-6 py-6 w-12 text-center"><div className="flex items-center justify-center"><Check className={`w-4 h-4 transition-all ${selectedLeads.length > 0 ? 'text-sky-600' : 'text-gray-200'}`} /></div></th><th className="px-10 py-6">Lead / Contato</th><th className="px-10 py-6">Base / Origem</th><th className="px-10 py-6">Operador Atribuído</th><th className="px-10 py-6 text-center">Status</th><th className="px-10 py-6 text-right">Ação</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLeads.map(l => (
                    <tr key={l.id} className={`transition-all ${selectedLeads.includes(l.id) ? 'bg-sky-50/50' : 'hover:bg-gray-50/30'}`}>
                      <td className="px-6 py-6"><div className="flex items-center justify-center"><input type="checkbox" checked={selectedLeads.includes(l.id)} onChange={() => toggleLeadSelection(l.id)} className="w-5 h-5 rounded-lg border-2 border-gray-300 text-sky-600 focus:ring-sky-500 transition-all cursor-pointer" /></div></td>
                      <td className="px-10 py-6"><p className="font-black uppercase text-sm text-slate-800">{l.nome}</p><p className="text-[10px] text-sky-600 font-bold mt-0.5">{l.telefone}</p></td>
                      <td className="px-10 py-6"><span className="px-3 py-1 bg-gray-100 rounded-lg text-[9px] font-black uppercase text-gray-500">{l.base}</span></td>
                      <td className="px-10 py-6"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${users.find(u => u.id === l.assignedTo)?.online ? 'bg-emerald-500' : 'bg-gray-300'}`}></div><span className="text-xs font-bold text-slate-600 uppercase">{users.find(u => u.id === l.assignedTo)?.nome || 'Fila Geral'}</span></div></td>
                      <td className="px-10 py-6 text-center"><span className={`px-4 py-1.5 rounded-full font-black uppercase text-[8px] tracking-widest border ${l.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{l.status === 'PENDING' ? 'Em Fila' : 'Contatado'}</span></td>
                      <td className="px-10 py-6 text-right"><div className="flex justify-end gap-2"><button onClick={() => { setSelectedLeads([l.id]); setIsTransferring(true); }} className="p-3 bg-white border-2 border-gray-100 rounded-xl text-gray-400 hover:text-sky-600 hover:border-sky-100 transition-all active:scale-90" title="Transferir Lead"><Share2 className="w-4 h-4" /></button><button onClick={() => onDeleteLeads([l.id])} className="p-3 bg-white border-2 border-gray-100 rounded-xl text-gray-400 hover:text-red-500 hover:border-red-100 transition-all active:scale-90" title="Excluir Lead"><Trash2 className="w-4 h-4" /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-[3rem] border-2 border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center"><h4 className="font-black uppercase italic text-slate-800 tracking-tighter">Equipe Comercial</h4></div>
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 font-black uppercase text-[10px] text-gray-400 tracking-widest border-b border-gray-100">
                <tr><th className="px-10 py-6">Colaborador</th><th className="px-10 py-6">Tipo</th><th className="px-10 py-6 text-right">Controle</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-10 py-6"><div className="flex items-center gap-4"><div className={`w-3 h-3 rounded-full shadow-sm ${u.online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div><div><p className="font-black uppercase text-sm text-slate-800">{u.nome}</p><p className="text-[10px] text-gray-400 font-bold">{u.email}</p></div></div></td>
                    <td className="px-10 py-6 uppercase font-black text-[10px] text-sky-600 tracking-widest">{u.tipo}</td>
                    <td className="px-10 py-6 text-right flex justify-end gap-3"><button onClick={() => onToggleUserStatus(u.id)} className={`p-4 rounded-2xl border-2 transition-all ${u.online ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-gray-50 border-gray-100 text-gray-300'}`}><Power className="w-4 h-4" /></button>{u.tipo !== 'adm' && (<button onClick={() => onDeleteUser(u.id)} className="p-4 rounded-2xl bg-red-50 border-2 border-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>)}</td>
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
