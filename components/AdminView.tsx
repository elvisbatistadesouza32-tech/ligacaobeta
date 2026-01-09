
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Lead, CallRecord, CallStatus, Sale } from '../types';
import { Users, Database, Power, Search, Trash2, Loader2, FileSpreadsheet, Check, BarChart3, Clock, AlertCircle, Share2, X, ChevronRight, Inbox, Award, Layers, LayoutGrid, CalendarDays, RotateCcw, Filter, CheckSquare, Square, ListFilter, Activity, DollarSign, TrendingUp, PhoneCall, MessageCircle, PhoneOff, Ban } from 'lucide-react';
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
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [search, setSearch] = useState('');
  const [operatorFilter, setOperatorFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);

  const sellers = useMemo(() => users.filter(u => u.tipo === 'vendedor'), [users]);
  
  const filteredCalls = useMemo(() => {
    return calls.filter(c => viewMode === 'day' ? c.timestamp.startsWith(date) : c.timestamp.startsWith(date.slice(0, 7)));
  }, [calls, date, viewMode]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => viewMode === 'day' ? s.created_at.startsWith(date) : s.created_at.startsWith(date.slice(0, 7)));
  }, [sales, date, viewMode]);

  const stats = useMemo(() => {
    const totalVendido = filteredSales.reduce((acc, s) => acc + s.amount, 0);
    const qtdVendas = filteredSales.length;
    
    const ans = filteredCalls.filter(c => c.status === CallStatus.ANSWERED).length;
    const noAns = filteredCalls.filter(c => c.status === CallStatus.NO_ANSWER).length;
    const inv = filteredCalls.filter(c => c.status === CallStatus.INVALID_NUMBER).length;
    
    const totalCalls = filteredCalls.length;
    const getPct = (val: number) => totalCalls > 0 ? ((val / totalCalls) * 100).toFixed(0) : '0';

    return {
      totalCalls, 
      ans, 
      noAns, 
      inv,
      ansPct: getPct(ans),
      noAnsPct: getPct(noAns),
      invPct: getPct(inv),
      totalVendido,
      qtdVendas,
      chart: [
        { name: 'Atendidas', value: ans, color: '#10b981' }, 
        { name: 'Não Atendidas', value: noAns, color: '#ef4444' }, 
        { name: 'Inválidas', value: inv, color: '#6366f1' }
      ].filter(d => d.value > 0)
    };
  }, [filteredCalls, filteredSales]);

  const topSellersCall = useMemo(() => {
    const callSales = filteredSales.filter(s => s.canal === 'call');
    const ranking = sellers.map(seller => {
      const sellerSales = callSales.filter(s => s.seller_id === seller.id);
      return {
        id: seller.id,
        nome: seller.nome,
        totalVendido: sellerSales.reduce((acc, s) => acc + s.amount, 0),
        vendasCount: sellerSales.length
      };
    }).filter(r => r.vendasCount > 0).sort((a, b) => b.totalVendido - a.totalVendido);
    
    return ranking.slice(0, 5);
  }, [sellers, filteredSales]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchesSearch = search === '' || l.nome.toLowerCase().includes(search.toLowerCase()) || l.telefone.includes(search);
      const matchesStatus = statusFilter === '' || l.status === statusFilter;
      const matchesOperator = operatorFilter === '' ? true : (operatorFilter === 'none' ? !l.assignedTo : l.assignedTo === operatorFilter);
      return matchesSearch && matchesStatus && matchesOperator;
    });
  }, [leads, search, operatorFilter, statusFilter]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      <nav className="flex bg-white p-2 rounded-full border shadow-sm max-w-3xl mx-auto mb-10 overflow-hidden">
        {[
          { id: 'dash', label: 'Dashboard', icon: BarChart3 },
          { id: 'leads', label: 'Leads', icon: Database },
          { id: 'users', label: 'Equipe', icon: Users },
          { id: 'sales', label: 'Vendas', icon: DollarSign }
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-full font-black text-[10px] uppercase transition-all duration-300 ${tab === t.id ? 'bg-sky-600 text-white shadow-xl translate-y-[-2px]' : 'text-gray-400 hover:bg-gray-50'}`}>
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </nav>

      {tab === 'dash' && (
        <div className="space-y-8 pb-20 animate-in fade-in duration-500">
          <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-100 flex justify-between items-center">
            <div className="flex bg-gray-50 p-1 rounded-2xl">
              <button onClick={() => setViewMode('day')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase ${viewMode === 'day' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400'}`}>Diário</button>
              <button onClick={() => setViewMode('month')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase ${viewMode === 'month' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400'}`}>Mensal</button>
            </div>
            <div className="flex items-center gap-3 bg-sky-50 px-6 py-3 rounded-2xl border-2 border-sky-100 text-sky-700">
              <Clock className="w-4 h-4" />
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-transparent font-black text-sm uppercase outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl col-span-2 lg:col-span-1 relative overflow-hidden">
              <DollarSign className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
              <p className="text-[10px] uppercase font-black opacity-60 mb-1">Total Vendido</p>
              <p className="text-3xl font-black italic tracking-tighter">R$ {stats.totalVendido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Atendidas</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black italic tracking-tighter text-emerald-600">{stats.ans}</p>
                <span className="text-[10px] font-black text-emerald-500/50">{stats.ansPct}%</span>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Falhas / Não At.</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black italic tracking-tighter text-red-600">{stats.noAns}</p>
                <span className="text-[10px] font-black text-red-500/50">{stats.noAnsPct}%</span>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
              <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Inválidos</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-black italic tracking-tighter text-sky-500">{stats.inv}</p>
                <span className="text-[10px] font-black text-sky-500/50">{stats.invPct}%</span>
              </div>
            </div>
            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl hidden lg:block">
              <p className="text-[10px] uppercase font-black opacity-60 mb-1">Qtd. Vendas</p>
              <p className="text-3xl font-black italic tracking-tighter">{stats.qtdVendas}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] border-2 border-gray-100 flex flex-col min-h-[450px]">
              <div className="flex items-center justify-between mb-8">
                 <h4 className="font-black uppercase italic text-slate-800 flex items-center gap-2"><TrendingUp className="text-emerald-500" /> Top 5 Ranking Financeiro (CALL)</h4>
                 <PhoneCall className="w-5 h-5 text-sky-500 opacity-30" />
              </div>
              <div className="space-y-4 flex-1 overflow-y-auto pr-2 scrollbar-thin">
                {topSellersCall.map((r, idx) => (
                  <div key={r.id} className="flex items-center gap-6 p-6 bg-gray-50 rounded-[2rem] border-2 border-transparent hover:border-emerald-100 transition-all">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-amber-400 text-white shadow-lg shadow-amber-100' : idx === 1 ? 'bg-slate-300 text-slate-600' : 'bg-orange-300 text-white'}`}>#{idx+1}</span>
                    <div className="flex-1">
                      <p className="font-black uppercase text-xs text-slate-700">{r.nome}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase">{r.vendasCount} vendas via ligação</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black italic text-emerald-600">R$ {r.totalVendido.toLocaleString('pt-BR')}</p>
                    </div>
                  </div>
                ))}
                {topSellersCall.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center opacity-20 py-20"><DollarSign size={64} /><p className="font-black uppercase text-xs mt-4">Sem dados de venda no período</p></div>
                )}
              </div>
            </div>
            
            <div className="bg-white p-10 rounded-[3rem] border-2 border-gray-100 flex flex-col">
              <h4 className="font-black uppercase italic text-slate-800 mb-8 flex items-center gap-2"><Activity className="text-sky-500" /> Conversão por Chamada</h4>
              <div className="flex-1 relative min-h-[250px]">
                {stats.totalCalls > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.chart} innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                        {stats.chart.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-200 gap-2">
                    <AlertCircle size={48} />
                    <p className="font-black text-[10px] uppercase">Sem dados de chamadas</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-6">
                <div className="p-4 bg-emerald-50 rounded-2xl text-center border border-emerald-100">
                  <p className="text-[8px] font-black uppercase text-emerald-600 opacity-60">Sucesso</p>
                  <p className="text-lg font-black italic text-emerald-700">{stats.ansPct}%</p>
                </div>
                <div className="p-4 bg-red-50 rounded-2xl text-center border border-red-100">
                  <p className="text-[8px] font-black uppercase text-red-600 opacity-60">Falhas</p>
                  <p className="text-lg font-black italic text-red-700">{stats.noAnsPct}%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'leads' && (
        <div className="animate-in fade-in duration-500 space-y-6 pb-20">
           <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
              <div className="p-8 border-b border-gray-100 flex flex-col lg:flex-row gap-4 items-center">
                 <div className="relative flex-1 w-full">
                   <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5" />
                   <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar leads..." className="w-full pl-16 pr-6 py-4 bg-gray-50 rounded-2xl border-2 border-transparent focus:border-sky-600 font-bold outline-none placeholder:text-gray-300" />
                 </div>
                 <div className="flex gap-3 w-full lg:w-auto">
                   <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="flex-1 lg:flex-none bg-gray-50 px-6 py-4 rounded-2xl border-2 border-sky-100 font-black text-[10px] uppercase outline-none cursor-pointer">
                     <option value="">Status: Todos</option>
                     <option value="PENDING">🕒 Pendentes</option>
                     <option value="CALLED">📞 Chamados</option>
                   </select>
                   <select value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)} className="flex-1 lg:flex-none bg-gray-50 px-6 py-4 rounded-2xl border-2 border-sky-100 font-black text-[10px] uppercase outline-none cursor-pointer">
                     <option value="">Operador: Todos</option>
                     <option value="none">📍 Fila Geral</option>
                     {sellers.map(s => <option key={s.id} value={s.id}>👤 {s.nome.toUpperCase()}</option>)}
                   </select>
                 </div>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="bg-gray-50 font-black uppercase text-[10px] text-gray-400">
                      <tr><th className="px-10 py-6">Lead / Cliente</th><th className="px-10 py-6">Vendedor</th><th className="px-10 py-6 text-center">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {filteredLeads.map(l => (
                         <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-10 py-6">
                              <p className="font-black uppercase text-sm text-slate-800">{l.nome}</p>
                              <span className="text-[10px] text-sky-600 font-bold">{l.telefone}</span>
                            </td>
                            <td className="px-10 py-6">
                              <span className="text-xs font-black uppercase text-slate-500 italic">
                                {l.assignedTo ? users.find(u => u.id === l.assignedTo)?.nome : 'Fila Geral'}
                              </span>
                            </td>
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

      {tab === 'sales' && (
        <div className="animate-in fade-in duration-500 pb-20">
          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
             <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <h4 className="font-black uppercase italic text-slate-800 flex items-center gap-2"><DollarSign className="text-emerald-500" /> Log de Vendas Realizadas</h4>
                <div className="bg-emerald-50 px-6 py-2 rounded-full border border-emerald-100 text-emerald-700 font-black text-xs uppercase italic tracking-widest">{filteredSales.length} Vendas</div>
             </div>
             <table className="w-full text-left">
                <thead className="bg-gray-50 font-black uppercase text-[10px] text-gray-400">
                  <tr><th className="px-10 py-6">Vendedor</th><th className="px-10 py-6">Cliente</th><th className="px-10 py-6">Canal</th><th className="px-10 py-6 text-right">Valor</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredSales.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50 transition-all">
                      <td className="px-10 py-6">
                        <p className="font-black uppercase text-sm text-slate-800">{users.find(u => u.id === v.seller_id)?.nome}</p>
                      </td>
                      <td className="px-10 py-6">
                        <p className="font-black uppercase text-xs text-slate-500">{v.customer_name}</p>
                        <span className="text-[9px] text-gray-400">{new Date(v.created_at).toLocaleString('pt-BR')}</span>
                      </td>
                      <td className="px-10 py-6">
                        <span className={`flex items-center gap-1.5 font-black uppercase text-[9px] ${v.canal === 'call' ? 'text-sky-600' : 'text-emerald-600'}`}>
                          {v.canal === 'call' ? <PhoneCall size={12} /> : <MessageCircle size={12} />} {v.canal}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right font-black italic text-emerald-600">
                        R$ {v.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {filteredSales.length === 0 && (
                    <tr><td colSpan={4} className="py-32 text-center opacity-20 font-black uppercase italic text-xs">Nenhuma venda registrada no período</td></tr>
                  )}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-500">
          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-gray-100 flex items-center gap-3">
              <Users className="w-6 h-6 text-sky-600" />
              <h4 className="font-black uppercase italic text-slate-800 tracking-tighter">Equipe Comercial</h4>
            </div>
            <table className="w-full text-left">
              <thead className="bg-gray-50 font-black uppercase text-[10px] text-gray-400">
                <tr><th className="px-10 py-6">Colaborador</th><th className="px-10 py-6">Tipo</th><th className="px-10 py-6 text-center">Fila Atual</th><th className="px-10 py-6 text-right">Status</th></tr>
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
                        <span className={`px-4 py-1.5 rounded-2xl font-black italic text-sm ${pendingCount === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                          {pendingCount}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right flex justify-end gap-3">
                        <button onClick={() => onToggleUserStatus(u.id)} className={`p-3 rounded-xl border-2 transition-all ${u.online ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-gray-100 border-gray-100 text-gray-400'}`}>
                          <Power size={16} />
                        </button>
                        {u.tipo !== 'adm' && (
                          <button onClick={() => onDeleteUser(u.id)} className="p-3 bg-red-50 text-red-500 rounded-xl border-2 border-red-50 hover:bg-red-500 hover:text-white transition-all">
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
        </div>
      )}
    </div>
  );
};
