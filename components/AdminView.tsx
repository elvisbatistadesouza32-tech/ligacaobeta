
import React, { useState, useMemo, useRef } from 'react';
import { User, Lead, CallRecord, Sale } from '../types';
import { Users, Database, Power, Search, Trash2, Loader2, FileSpreadsheet, BarChart3, Clock, Activity, DollarSign, TrendingUp, Ban, Edit3, Save, X, RotateCcw, Filter, UserPlus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
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
  const [date, setDate] = useState(() => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - (offset * 60 * 1000));
    return local.toISOString().split('T')[0];
  });

  const [search, setSearch] = useState('');
  const [filterOperator, setFilterOperator] = useState<string>('all');
  const [importTarget, setImportTarget] = useState<string>('none'); // Destino do upload
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const sellers = useMemo(() => users.filter(u => u.tipo === 'vendedor'), [users]);
  
  const filteredCalls = useMemo(() => {
    const filter = viewMode === 'day' ? date : date.slice(0, 7);
    return calls.filter(c => (c.timestamp || (c as any).created_at)?.includes(filter));
  }, [calls, date, viewMode]);

  const hourlyEffectiveness = useMemo(() => {
    if (calls.length < 100) return null;

    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, '0')}h`,
      total: 0,
      answered: 0
    }));

    calls.forEach(c => {
      const h = new Date(c.timestamp).getHours();
      hours[h].total++;
      if (String(c.status).toUpperCase() === 'ANSWERED') {
        hours[h].answered++;
      }
    });

    return hours.map(h => ({
      ...h,
      effectiveness: h.total > 0 ? Math.round((h.answered / h.total) * 100) : 0
    })).filter(h => h.total > 5);
  }, [calls]);

  const stats = useMemo(() => {
    const filter = viewMode === 'day' ? date : date.slice(0, 7);
    const periodSales = sales.filter(s => s.created_at.includes(filter));
    const totalVendido = periodSales.reduce((acc, s) => acc + s.amount, 0);
    
    const getCount = (st: string) => filteredCalls.filter(c => String(c.status).toUpperCase() === st).length;
    const ans = getCount('ANSWERED');
    const total = filteredCalls.length;
    const pct = (v: number) => total > 0 ? ((v / total) * 100).toFixed(0) : '0';

    return {
      total, ans, totalVendido,
      vendasCount: periodSales.length,
      ansPct: pct(ans)
    };
  }, [filteredCalls, sales, date, viewMode]);

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
      
      let targetName = 'Fila Geral';
      if (importTarget === 'online') targetName = 'Vendedores Online';
      else if (importTarget !== 'none') targetName = users.find(u => u.id === importTarget)?.nome || 'Vendedor';

      alert(`${newLeads.length} leads importados para: ${targetName}`);
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
            <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl col-span-2 lg:col-span-1 flex flex-col justify-center">
              <p className="text-[10px] uppercase font-black opacity-60 mb-1">Total Vendido</p>
              <p className="text-3xl font-black italic">R$ {stats.totalVendido.toLocaleString('pt-BR')}</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Taxa de Contato</p>
              <p className="text-3xl font-black italic text-emerald-600">{stats.ansPct}%</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Atendidas</p>
              <p className="text-3xl font-black italic text-sky-600">{stats.ans}</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Total Calls</p>
              <p className="text-3xl font-black italic text-slate-800">{stats.total}</p>
            </div>
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-center">
              <p className="text-[10px] uppercase font-black opacity-60 mb-1">Vendas (Qtd)</p>
              <p className="text-3xl font-black italic">{stats.vendasCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white p-10 rounded-[3rem] border-2 border-gray-100">
              <h4 className="font-black uppercase italic text-slate-800 mb-8 flex items-center gap-2"><TrendingUp className="text-emerald-500" /> TOP VENDEDORES</h4>
              <div className="space-y-4">
                {sellers.slice(0, 5).map((s, idx) => {
                  const sSales = sales.filter(sa => sa.seller_id === s.id && sa.created_at.includes(date)).length;
                  return (
                    <div key={s.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-[1.5rem]">
                      <span className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-black text-[10px]">#{idx+1}</span>
                      <p className="flex-1 font-black uppercase text-[10px]">{s.nome}</p>
                      <p className="text-lg font-black italic text-emerald-600">{sSales}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border-2 border-gray-100 flex flex-col">
              <h4 className="font-black uppercase italic text-slate-800 mb-8 flex items-center gap-2">
                <Clock className="text-sky-500" /> Eficiência por Horário de Atendimento
              </h4>
              <div className="flex-1 w-full min-h-[300px]">
                {hourlyEffectiveness ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlyEffectiveness}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                      <YAxis hide />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="effectiveness" name="Efetividade %" fill="#0284c7" radius={[10, 10, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-10 gap-4">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center border-4 border-dashed border-gray-200">
                      <Activity className="text-gray-200" size={32} />
                    </div>
                    <div>
                      <p className="font-black uppercase text-xs text-slate-400">Aguardando Amostra de Dados</p>
                      <p className="text-[10px] font-bold text-gray-400 mt-1">O gráfico de horários requer pelo menos 100 ligações registradas (Atual: {calls.length})</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-100 flex flex-col gap-3">
              <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Importar Leads</p>
              <div className="relative">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" size={14} />
                <select 
                  value={importTarget} 
                  onChange={e => setImportTarget(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold uppercase text-[9px] outline-none focus:border-sky-500 transition-all appearance-none"
                >
                  <option value="none">ENVIAR PARA FILA GERAL</option>
                  <option value="online">DISTRIBUIR ENTRE ONLINE</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>ENVIAR PARA: {s.nome}</option>)}
                </select>
              </div>
              <button onClick={() => fileInput.current?.click()} className="w-full py-4 bg-sky-600 text-white rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-sky-100 active:scale-95 transition-all">
                {loading ? <Loader2 className="animate-spin" /> : <FileSpreadsheet size={16} />} Selecionar XLSX
              </button>
              <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-100">
              <p className="text-[9px] font-black uppercase text-gray-400 mb-3 tracking-widest">Busca Rápida</p>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-4 bg-gray-50 rounded-2xl font-bold uppercase text-[10px] outline-none border-2 border-transparent focus:border-sky-500 transition-all" placeholder="Nome, base..." />
              </div>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-100">
              <p className="text-[9px] font-black uppercase text-gray-400 mb-3 tracking-widest">Filtrar Operador</p>
              <div className="relative">
                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={16} />
                <select value={filterOperator} onChange={e => setFilterOperator(e.target.value)} className="w-full pl-10 pr-4 py-4 bg-gray-50 rounded-2xl font-bold uppercase text-[10px] outline-none border-2 border-transparent focus:border-sky-500 appearance-none">
                  <option value="all">TODOS OPERADORES</option>
                  <option value="none">FILA GERAL (SEM DONO)</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-amber-500 p-6 rounded-[2.5rem] text-white flex flex-col justify-center text-center shadow-lg shadow-amber-100">
              <p className="text-[9px] font-black uppercase opacity-60 mb-1">Filtrados / Total</p>
              <p className="text-2xl font-black italic">{currentLeads.filter(l => l.status === 'PENDING').length} <span className="text-sm opacity-40">/ {leads.filter(l => l.status === 'PENDING').length}</span></p>
            </div>
          </div>

          {selectedLeads.length > 0 && (
            <div className="bg-slate-900 p-6 rounded-[2rem] flex items-center justify-between text-white animate-in slide-in-from-top-4">
              <p className="font-black uppercase text-[10px] italic">{selectedLeads.length} selecionados</p>
              <div className="flex gap-3">
                <select onChange={e => { onTransferLeads(selectedLeads, e.target.value === 'none' ? null : e.target.value); setSelectedLeads([]); }} className="bg-white/10 px-4 py-2 rounded-xl font-black uppercase text-[9px] outline-none border border-white/10 focus:border-white/40">
                  <option value="">Transferir para...</option>
                  <option value="none">Fila Geral</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
                <button onClick={() => { onDeleteLeads(selectedLeads); setSelectedLeads([]); }} className="bg-red-500 p-2 rounded-xl hover:bg-red-600 transition-colors"><Trash2 size={16} /></button>
                <button onClick={() => setSelectedLeads([])} className="text-white/40"><Ban size={16} /></button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                  <tr>
                    <th className="px-10 py-6 w-10">
                      <input type="checkbox" checked={selectedLeads.length > 0 && selectedLeads.length === currentLeads.length} onChange={e => setSelectedLeads(e.target.checked ? currentLeads.map(l => l.id) : [])} />
                    </th>
                    <th className="px-10 py-6">Lead</th>
                    <th className="px-10 py-6">Operador</th>
                    <th className="px-10 py-6 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {currentLeads.slice(0, 100).map(l => (
                    <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-10 py-6"><input type="checkbox" checked={selectedLeads.includes(l.id)} onChange={e => setSelectedLeads(prev => e.target.checked ? [...prev, l.id] : prev.filter(id => id !== l.id))} /></td>
                      <td className="px-10 py-6">
                        <p className="font-black uppercase text-sm">{l.nome}</p>
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
        </div>
      )}

      {tab === 'users' && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                <tr><th className="px-10 py-6">Vendedor</th><th className="px-10 py-6 text-center">Fila Atual</th><th className="px-10 py-6 text-right">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${u.online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                        <p className="font-black uppercase text-sm">{u.nome}</p>
                      </div>
                    </td>
                    <td className="px-10 py-6 text-center font-black text-sky-600">
                      {leads.filter(l => l.assignedTo === u.id && l.status === 'PENDING').length}
                    </td>
                    <td className="px-10 py-6 text-right flex justify-end gap-2">
                      <button onClick={() => onClearSellerLeads(u.id)} className="p-3 bg-red-50 text-red-500 rounded-xl border border-red-100 hover:bg-red-500 hover:text-white transition-all group relative" title="Zerar Leads do Vendedor">
                        <RotateCcw size={16} />
                      </button>
                      <button onClick={() => onToggleUserStatus(u.id)} className={`p-3 rounded-xl border-2 transition-all ${u.online ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                        <Power size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sales' && (
        <div className="animate-in fade-in duration-500 space-y-6">
          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-400">
                <tr><th className="px-10 py-6">Vendedor</th><th className="px-10 py-6">Cliente</th><th className="px-10 py-6 text-right">Valor</th><th className="px-10 py-6 text-right">Ação</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sales.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-10 py-6 font-black uppercase text-xs">{users.find(u => u.id === s.seller_id)?.nome}</td>
                    <td className="px-10 py-6 font-black uppercase text-[10px] text-slate-500">{s.customer_name}</td>
                    <td className="px-10 py-6 text-right font-black italic text-emerald-600">
                      {editingSaleId === s.id ? (
                        <input value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-24 p-2 border-2 border-sky-500 rounded-lg text-right outline-none" autoFocus />
                      ) : `R$ ${s.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        {editingSaleId === s.id ? (
                          <>
                            <button onClick={() => { onUpdateSale(s.id, parseFloat(editAmount.replace(',', '.'))); setEditingSaleId(null); }} className="p-2 bg-emerald-500 text-white rounded-lg"><Save size={14} /></button>
                            <button onClick={() => setEditingSaleId(null)} className="p-2 bg-gray-200 text-gray-500 rounded-lg"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingSaleId(s.id); setEditAmount(s.amount.toString()); }} className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg"><Edit3 size={14} /></button>
                            <button onClick={() => onDeleteSale(s.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
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
