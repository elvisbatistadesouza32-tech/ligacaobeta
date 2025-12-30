
import React, { useState, useMemo, useRef } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { Users, Database, Power, Search, Trash2, Loader2, FileSpreadsheet, Check, BarChart3, Clock, AlertCircle, Share2, X, ChevronRight, Inbox, Award, Layers, LayoutGrid } from 'lucide-react';
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

  // Ranking de Operadores e Carga de Trabalho
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
        if (json[0]?.length < 3) throw new Error("Layout Inválido.");
        const parsed = json.slice(1).map((row, i) => {
          const fone = String(row[2] || '').replace(/\D/g, '');
          return fone.length >= 8 ? { id: `t-${i}`, nome: String(row[0]), base: String(row[1]), telefone: fone, status: 'PENDING' as const, createdAt: '' } : null;
        }).filter(Boolean) as Lead[];
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
      
      {/* Modal de Importação */}
      {pendingLeads && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black mb-6 uppercase italic text-center text-slate-900">Distribuir {pendingLeads.length} Leads</h3>
            <div className="space-y-3">
              <button onClick={() => setTarget('none')} className={`w-full p-5 rounded-2xl border-2 flex justify-between items-center transition-all ${target === 'none' ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="text-left"><p className="font-black uppercase text-sm">Fila Geral</p></div>
                <Check className={target === 'none' ? 'block' : 'hidden'} />
              </button>
              <button onClick={() => setTarget('online')} className={`w-full p-5 rounded-2xl border-2 flex justify-between items-center transition-all ${target === 'online' ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-gray-100 hover:border-gray-200'}`}>
                <div className="text-left"><p className="font-black uppercase text-sm">Vendedores Online</p></div>
                <Check className={target === 'online' ? 'block' : 'hidden'} />
              </button>
              <div className="relative">
                <select onChange={e => setTarget(e.target.value)} className="w-full p-5 bg-gray-50 rounded-2xl border-2 border-gray-100 font-bold outline-none focus:border-sky-600 appearance-none transition-all">
                  <option value="">Destinar a Vendedor Específico...</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-8">
              <button onClick={() => setPendingLeads(null)} className="py-4 font-black uppercase text-xs text-gray-400">Descartar</button>
              <button onClick={confirmImport} disabled={loading} className="py-4 bg-sky-600 text-white rounded-2xl font-black uppercase text-xs flex justify-center items-center">
                {loading ? <Loader2 className="animate-spin" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isTransferring && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-lg p-10 shadow-2xl">
            <h3 className="text-xl font-black uppercase italic text-slate-900 mb-8">Transferir {selectedLeads.length} Lead(s)</h3>
            <div className="max-h-96 overflow-y-auto space-y-3">
              <button onClick={() => handleBulkTransfer(null)} className="w-full p-5 rounded-3xl border-2 border-gray-100 hover:border-amber-400 text-left">
                <p className="font-black uppercase text-xs text-slate-800">Fila Geral</p>
              </button>
              {sellers.map(s => (
                <button key={s.id} onClick={() => handleBulkTransfer(s.id)} className="w-full p-5 rounded-3xl border-2 border-gray-100 hover:border-sky-500 text-left">
                  <p className="font-black uppercase text-xs text-slate-800">{s.nome}</p>
                </button>
              ))}
            </div>
            <button onClick={() => setIsTransferring(false)} className="mt-6 w-full text-xs font-black uppercase text-gray-400">Cancelar</button>
          </div>
        </div>
      )}

      {selectedLeads.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[90] animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-slate-900 text-white px-8 py-5 rounded-full shadow-2xl flex items-center gap-8">
            <span className="bg-sky-600 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs">{selectedLeads.length}</span>
            <button onClick={() => setIsTransferring(true)} className="bg-white text-slate-900 px-6 py-2 rounded-full font-black uppercase text-[10px]">Transferir</button>
            <button onClick={handleBulkDelete} className="text-red-400 font-black uppercase text-[10px]">Excluir</button>
          </div>
        </div>
      )}

      <nav className="flex bg-white p-2 rounded-full border shadow-sm max-w-2xl mx-auto mb-10">
        {[
          { id: 'dash', label: 'Dashboard', icon: BarChart3 },
          { id: 'leads', label: 'Leads', icon: Database },
          { id: 'users', label: 'Equipe', icon: Users }
        ].map((t) => (
          <button 
            key={t.id} 
            onClick={() => { setTab(t.id as any); setSelectedLeads([]); }} 
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full font-black text-[10px] uppercase transition-all ${tab === t.id ? 'bg-sky-600 text-white shadow-xl shadow-sky-100' : 'text-gray-400'}`}
          >
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      {tab === 'dash' && (
        <div className="space-y-8 max-w-6xl mx-auto pb-20">
          {/* Header Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="bg-sky-600 p-8 rounded-[2.5rem] text-white shadow-xl">
              <p className="text-[10px] uppercase font-black opacity-60 mb-1">Total Chamadas</p>
              <p className="text-4xl font-black italic tracking-tighter">{stats.total}</p>
            </div>
            <div className="bg-amber-500 p-8 rounded-[2.5rem] text-white shadow-xl">
              <p className="text-[10px] uppercase font-black opacity-60 mb-1">Fila Total</p>
              <p className="text-4xl font-black italic tracking-tighter">{leads.filter(l => l.status === 'PENDING').length}</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Atendidas</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black italic tracking-tighter text-emerald-600">{stats.ans}</p>
                <span className="text-xs font-black text-emerald-500/60">({stats.ansPct}%)</span>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Falhas</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black italic tracking-tighter text-red-600">{stats.noAns}</p>
                <span className="text-xs font-black text-red-500/60">({stats.noAnsPct}%)</span>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Inválidos</p>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black italic tracking-tighter text-sky-500">{stats.inv}</p>
                <span className="text-xs font-black text-sky-500/60">({stats.invPct}%)</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Chart Area */}
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border-2 border-gray-100 h-[450px] flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-black uppercase italic text-slate-800 tracking-tighter">Qualidade das Ligações</h4>
                <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-2xl border">
                  <Clock className="w-4 h-4 text-sky-500" />
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent font-black text-xs outline-none uppercase" />
                </div>
              </div>
              <div className="flex-1">
                {stats.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.chart} innerRadius={90} outerRadius={130} paddingAngle={8} dataKey="value" stroke="none">
                        {stats.chart.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                    <AlertCircle className="w-12 h-12 opacity-20" /><p className="font-black uppercase italic text-xs">Sem dados</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Top 3 Performers */}
            <div className="bg-white p-10 rounded-[3rem] border-2 border-gray-100 shadow-sm">
               <div className="flex items-center gap-3 mb-8">
                  <Award className="text-amber-500 w-6 h-6" />
                  <h4 className="font-black uppercase italic text-slate-800 tracking-tighter">Top 3 Performance</h4>
               </div>
               <div className="space-y-4">
                {rankedSellers.slice(0, 3).map((s, idx) => (
                  <div key={s.id} className={`flex flex-col gap-2 p-5 rounded-[2rem] border-2 transition-all ${idx === 0 ? 'bg-sky-50 border-sky-100' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-slate-300 text-slate-600' : 'bg-orange-400 text-white'}`}>
                            #{idx+1}
                          </span>
                          <p className="font-black uppercase text-xs text-slate-700 leading-tight max-w-[120px]">{s.nome}</p>
                       </div>
                       <div className={`w-2 h-2 rounded-full ${s.online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                    </div>
                    
                    <div className="flex items-end justify-between mt-2">
                       <div>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Ligações</span>
                          <p className="text-2xl font-black italic text-sky-600 leading-none">{s.callCount}</p>
                       </div>
                       <div className="text-right">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Carga</span>
                          <p className={`text-xl font-black italic leading-none ${s.pendingCount > 15 ? 'text-red-500' : 'text-amber-500'}`}>{s.pendingCount}</p>
                       </div>
                    </div>
                  </div>
                ))}
               </div>
            </div>
          </div>

          {/* Monitor de Carga Geral */}
          <div className="bg-white p-10 rounded-[3.5rem] border-2 border-gray-100 shadow-sm">
             <div className="flex items-center gap-3 mb-10">
                <Layers className="text-sky-600 w-6 h-6" />
                <h4 className="font-black uppercase italic text-slate-800 tracking-tighter">Monitor de Pendências (Toda Equipe)</h4>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {rankedSellers.map(s => (
                  <div key={s.id} className="p-6 bg-gray-50/50 rounded-3xl border border-gray-200 hover:border-sky-300 transition-all flex justify-between items-center group">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${s.online ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-gray-300'}`} />
                      <div>
                        <p className="font-black uppercase text-[11px] text-slate-800 group-hover:text-sky-600 transition-colors">{s.nome}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{s.online ? 'Ativo' : 'Offline'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black italic ${s.pendingCount === 0 ? 'text-emerald-500' : s.pendingCount > 20 ? 'text-red-500' : 'text-slate-700'}`}>
                        {s.pendingCount}
                      </p>
                      <p className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Leads</p>
                    </div>
                  </div>
                ))}
                {rankedSellers.length === 0 && (
                  <div className="col-span-full py-10 text-center text-gray-300 italic uppercase font-black text-xs">Nenhum vendedor cadastrado</div>
                )}
             </div>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="space-y-6 max-w-6xl mx-auto">
          <div className="bg-white p-8 rounded-[3rem] border-4 border-dashed border-sky-100 flex items-center gap-8">
            <div className="bg-sky-50 p-6 rounded-[2rem] text-sky-600"><FileSpreadsheet className="w-10 h-10" /></div>
            <div className="flex-1">
              <h4 className="text-xl font-black uppercase italic text-slate-900">Importar Leads</h4>
              <p className="text-xs font-bold text-gray-400 uppercase mt-1">Colunas A (Nome), B (Base), C (Contato)</p>
            </div>
            <button onClick={() => fileInput.current?.click()} className="bg-sky-600 text-white px-10 py-5 rounded-3xl font-black uppercase text-xs">Selecionar Arquivo</button>
            <input type="file" ref={fileInput} onChange={handleFile} accept=".xlsx, .xls" className="hidden" />
          </div>

          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className="w-full pl-16 pr-6 py-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-sky-600 font-bold outline-none transition-all" />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 font-black uppercase text-[10px] text-gray-400">
                  <tr>
                    <th className="px-6 py-6 w-12 text-center"><Check /></th>
                    <th className="px-10 py-6">Lead</th>
                    <th className="px-10 py-6">Operador</th>
                    <th className="px-10 py-6 text-center">Status</th>
                    <th className="px-10 py-6 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLeads.map(l => (
                    <tr key={l.id} className={`transition-all ${selectedLeads.includes(l.id) ? 'bg-sky-50' : ''}`}>
                      <td className="px-6 py-6 text-center"><input type="checkbox" checked={selectedLeads.includes(l.id)} onChange={() => toggleLeadSelection(l.id)} className="w-5 h-5" /></td>
                      <td className="px-10 py-6"><p className="font-black uppercase text-sm">{l.nome}</p><p className="text-[10px] text-sky-600 font-bold">{l.telefone}</p></td>
                      <td className="px-10 py-6 text-xs font-bold uppercase">{users.find(u => u.id === l.assignedTo)?.nome || 'Fila Geral'}</td>
                      <td className="px-10 py-6 text-center"><span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[8px] font-black uppercase border border-amber-100">{l.status}</span></td>
                      <td className="px-10 py-6 text-right"><button onClick={() => onDeleteLeads([l.id])} className="text-red-500 hover:scale-110 transition-transform"><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-gray-100 flex items-center gap-3">
              <Users className="w-6 h-6 text-sky-600" />
              <h4 className="font-black uppercase italic text-slate-800 tracking-tighter">Gestão da Equipe Comercial</h4>
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50 font-black uppercase text-[10px] text-gray-400">
                <tr>
                  <th className="px-10 py-6">Nome / Colaborador</th>
                  <th className="px-10 py-6">Tipo</th>
                  <th className="px-10 py-6 text-center">Leads Pendentes</th>
                  <th className="px-10 py-6 text-right">Controle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => {
                  const pendingCount = leads.filter(l => l.assignedTo === u.id && l.status === 'PENDING').length;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${u.online ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] animate-pulse' : 'bg-gray-300'}`} />
                          <div>
                            <p className="font-black uppercase text-sm text-slate-800 group-hover:text-sky-600 transition-colors">{u.nome}</p>
                            <p className="text-[10px] text-gray-400 font-bold">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-6 uppercase font-black text-[10px] text-sky-600 tracking-widest">{u.tipo}</td>
                      <td className="px-10 py-6 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`px-4 py-1.5 rounded-2xl font-black italic text-sm ${pendingCount === 0 ? 'bg-emerald-50 text-emerald-600' : pendingCount > 15 ? 'bg-red-50 text-red-600' : 'bg-sky-50 text-sky-600'}`}>
                            {pendingCount}
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-right flex justify-end gap-3">
                        <button 
                          onClick={() => onToggleUserStatus(u.id)} 
                          className={`p-3 rounded-xl border-2 transition-all ${u.online ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-gray-100 border-gray-100 text-gray-400'}`}
                          title={u.online ? "Desconectar" : "Conectar"}
                        >
                          <Power size={16} />
                        </button>
                        {u.tipo !== 'adm' && (
                          <button 
                            onClick={() => onDeleteUser(u.id)} 
                            className="p-3 bg-red-50 text-red-500 rounded-xl border-2 border-red-50 hover:bg-red-500 hover:text-white transition-all"
                            title="Remover Usuário"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          <div className="mt-8 bg-sky-50/50 p-6 rounded-[2.5rem] border border-sky-100 flex items-center gap-4">
            <LayoutGrid className="text-sky-600" />
            <p className="text-[10px] font-bold text-sky-700 uppercase leading-relaxed">
              DICA: Vendedores com mais de 20 leads pendentes são marcados em vermelho. Tente redistribuir a carga para acelerar o atendimento.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
