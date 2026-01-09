
import React, { useState, useMemo, useRef } from 'react';
import { User, Lead, CallRecord, Sale, CallStatus } from '../types';
import { Users, Database, Power, Search, Trash2, Loader2, FileSpreadsheet, BarChart3, Clock, Activity, DollarSign, TrendingUp, PhoneCall, Share2, Ban, CheckCircle, ListFilter, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
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
}

export const AdminView: React.FC<AdminViewProps> = ({ users, leads, calls, sales, onImportLeads, onToggleUserStatus, onDeleteUser, onTransferLeads, onDeleteLeads }) => {
  const [tab, setTab] = useState<'dash' | 'leads' | 'users' | 'sales'>('dash');
  const [viewMode, setViewMode] = useState<'month' | 'day'>('day'); 
  const [date, setDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  });

  const [search, setSearch] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const sellers = useMemo(() => users.filter(u => u.tipo === 'vendedor'), [users]);
  
  const filteredCalls = useMemo(() => {
    const filterValue = viewMode === 'day' ? date : date.slice(0, 7);
    return calls.filter(c => (c.timestamp || (c as any).created_at)?.includes(filterValue));
  }, [calls, date, viewMode]);

  const stats = useMemo(() => {
    const totalVendido = sales.filter(s => s.created_at.includes(viewMode === 'day' ? date : date.slice(0, 7))).reduce((acc, s) => acc + s.amount, 0);
    const getCount = (st: string) => filteredCalls.filter(c => String(c.status).toUpperCase() === st).length;
    const ans = getCount('ANSWERED');
    const noAns = getCount('NO_ANSWER');
    const inv = getCount('INVALID_NUMBER');
    const total = filteredCalls.length;
    const pct = (v: number) => total > 0 ? ((v / total) * 100).toFixed(0) : '0';

    return {
      total, ans, noAns, inv,
      ansPct: pct(ans), noAnsPct: pct(noAns), invPct: pct(inv),
      totalVendido,
      chart: [
        { name: 'Atendidas', value: ans, color: '#10b981' },
        { name: 'Falhas', value: noAns, color: '#ef4444' },
        { name: 'Inválidos', value: inv, color: '#6366f1' }
      ].filter(d => d.value > 0)
    };
  }, [filteredCalls, sales, date, viewMode]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet) as any[];
      
      const newLeads = json.map(row => ({
        nome: String(row.nome || row.NOME || '').toUpperCase(),
        telefone: String(row.telefone || row.TELEFONE || '').replace(/\D/g, ''),
        base: String(row.base || row.BASE || file.name.split('.')[0]).toUpperCase()
      })).filter(l => l.nome && l.telefone);

      await onImportLeads(newLeads as any, target);
      alert(`${newLeads.length} leads importados com sucesso!`);
    } catch (err) {
      alert("Erro ao ler arquivo.");
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      
      <nav className="flex bg-white p-2 rounded-full border shadow-sm max-w-3xl mx-auto mb-10 overflow-hidden">
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

      {tab === 'dash' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-100 flex justify-between items-center shadow-sm">
            <div className="flex bg-gray-50 p-1 rounded-2xl">
              <button onClick={() => setViewMode('day')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'day' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400'}`}>Dia</button>
              <button onClick={() => setViewMode('month')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === 'month' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400'}`}>Mês</button>
            </div>
            <div className="flex items-center gap-3 bg-sky-50 px-6 py-3 rounded-2xl border-2 border-sky-100 text-sky-700">
              <Clock className="w-4 h-4" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent font-black text-sm uppercase outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl col-span-2 lg:col-span-1 relative overflow-hidden flex flex-col justify-center">
              <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
              <p className="text-[10px] uppercase font-black opacity-60 mb-1">Vendido</p>
              <p className="text-3xl font-black italic tracking-tighter">R$ {stats.totalVendido.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Atendidas</p>
              <p className="text-3xl font-black italic text-emerald-600 leading-none">{stats.ans} <span className="text-[10px] opacity-40">{stats.ansPct}%</span></p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Falhas</p>
              <p className="text-3xl font-black italic text-red-600 leading-none">{stats.noAns} <span className="text-[10px] opacity-40">{stats.noAnsPct}%</span></p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Inválidos</p>
              <p className="text-3xl font-black italic text-sky-500 leading-none">{stats.inv} <span className="text-[10px] opacity-40">{stats.invPct}%</span></p>
            </div>
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white hidden lg:flex flex-col justify-center">
              <p className="text-[10px] uppercase font-black opacity-60 mb-1">Total Calls</p>
              <p className="text-3xl font-black italic">{stats.total}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border-2 border-gray-100 min-h-[400px]">
              <h4 className="font-black uppercase italic text-slate-800 mb-8 flex items-center gap-2 tracking-tighter"><TrendingUp className="text-emerald-500" /> TOP OPERAÇÃO</h4>
              <div className="space-y-4">
                {sellers.slice(0, 5).map((s, idx) => {
                  const sCalls = filteredCalls.filter(c => c.sellerId === s.id).length;
                  const sSales = sales.filter(sa => sa.seller_id === s.id && sa.created_at.includes(date)).length;
                  return (
                    <div key={s.id} className="flex items-center gap-6 p-6 bg-gray-50 rounded-[2rem]">
                      <span className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-black text-xs">#{idx+1}</span>
                      <div className="flex-1">
                        <p className="font-black uppercase text-xs">{s.nome}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{sCalls} LIGAÇÕES HOJE</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black italic text-emerald-600">{sSales} VENDAS</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-white p-10 rounded-[3rem] border-2 border-gray-100 flex flex-col items-center">
              <h4 className="font-black uppercase italic text-slate-800 mb-8 self-start flex items-center gap-2"><Activity className="text-sky-500" /> QUALIDADE</h4>
              <div className="flex-1 w-full min-h-[200px]">
                {stats.total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.chart} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {stats.chart.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex items-center justify-center opacity-20 uppercase font-black text-xs italic">Sem dados</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-4">Importar Leads (XLSX/CSV)</p>
                <div className="grid grid-cols-1 gap-2">
                   <button onClick={() => fileInput.current?.click()} className="w-full py-4 bg-sky-600 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2">
                     {loading ? <Loader2 className="animate-spin" /> : <FileSpreadsheet size={16} />} Selecionar Arquivo
                   </button>
                   <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileUpload(e, 'none')} />
                </div>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-4">Filtro Rápido</p>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
                  <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl font-bold uppercase text-xs outline-none focus:border-sky-500 border-2 border-transparent transition-all" placeholder="Buscar lead ou base..." />
                </div>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 flex flex-col justify-center text-center">
                <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Leads Pendentes</p>
                <p className="text-3xl font-black italic text-amber-500">{leads.filter(l => l.status === 'PENDING').length}</p>
             </div>
          </div>

          {selectedLeads.length > 0 && (
            <div className="bg-slate-900 p-6 rounded-[2rem] flex items-center justify-between text-white animate-in slide-in-from-top-4">
               <p className="font-black uppercase text-[10px] italic">{selectedLeads.length} Leads selecionados</p>
               <div className="flex gap-3">
                  <select onChange={e => onTransferLeads(selectedLeads, e.target.value === 'none' ? null : e.target.value)} className="bg-white/10 px-4 py-2 rounded-xl font-black uppercase text-[9px] outline-none">
                    <option value="">Transferir para...</option>
                    <option value="none">Fila Geral</option>
                    {sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                  </select>
                  <button onClick={() => { onDeleteLeads(selectedLeads); setSelectedLeads([]); }} className="bg-red-500/20 text-red-400 p-2 rounded-xl border border-red-500/30 hover:bg-red-500 hover:text-white"><Trash2 size={16} /></button>
                  <button onClick={() => setSelectedLeads([])} className="text-white/40"><Ban size={16} /></button>
               </div>
            </div>
          )}

          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
             <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                  <tr>
                    <th className="px-10 py-6 w-10">
                      <input type="checkbox" checked={selectedLeads.length === leads.length} onChange={e => setSelectedLeads(e.target.checked ? leads.map(l => l.id) : [])} />
                    </th>
                    <th className="px-10 py-6">Lead</th>
                    <th className="px-10 py-6">Operador</th>
                    <th className="px-10 py-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {leads.filter(l => l.nome.toLowerCase().includes(search.toLowerCase()) || l.base.toLowerCase().includes(search.toLowerCase())).slice(0, 100).map(l => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-10 py-6"><input type="checkbox" checked={selectedLeads.includes(l.id)} onChange={e => setSelectedLeads(prev => e.target.checked ? [...prev, l.id] : prev.filter(id => id !== l.id))} /></td>
                      <td className="px-10 py-6">
                        <p className="font-black uppercase text-sm tracking-tight">{l.nome}</p>
                        <span className="text-[9px] font-bold text-sky-400">{l.telefone} • {l.base}</span>
                      </td>
                      <td className="px-10 py-6 text-xs font-black uppercase text-slate-500">{l.assignedTo ? users.find(u => u.id === l.assignedTo)?.nome : 'Disponível'}</td>
                      <td className="px-10 py-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border ${l.status === 'CALLED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                          {l.status === 'CALLED' ? 'Chamado' : 'Pendente'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
           <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden">
             <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h4 className="font-black uppercase italic text-slate-800">Equipe de Vendas</h4>
             </div>
             <table className="w-full text-left">
               <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                 <tr><th className="px-10 py-6">Vendedor</th><th className="px-10 py-6 text-center">Fila Atual</th><th className="px-10 py-6 text-right">Ação</th></tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                 {users.map(u => (
                   <tr key={u.id} className="hover:bg-gray-50">
                     <td className="px-10 py-6">
                       <div className="flex items-center gap-3">
                         <div className={`w-3 h-3 rounded-full ${u.online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                         <p className="font-black uppercase text-sm">{u.nome}</p>
                       </div>
                     </td>
                     <td className="px-10 py-6 text-center font-black text-sky-600">{leads.filter(l => l.assignedTo === u.id && l.status === 'PENDING').length}</td>
                     <td className="px-10 py-6 text-right">
                        <button onClick={() => onToggleUserStatus(u.id)} className={`p-3 rounded-xl border-2 ${u.online ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-gray-100'}`}><Power size={16} /></button>
                     </td>
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
