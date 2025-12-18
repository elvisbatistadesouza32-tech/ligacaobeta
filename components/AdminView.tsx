
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { 
  Users, PhoneIncoming, Upload, Database, 
  Play, Sparkles, RefreshCw, Clock, ArrowRightLeft, Power, PowerOff, TrendingUp, CheckCircle, XCircle, AlertTriangle, ChevronRight, UserCircle, BarChart3, Activity
} from 'lucide-react';
import { getSalesInsights } from '../services/geminiService';
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
  users, leads, calls, onImportLeads, onDistributeLeads, onToggleUserStatus 
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'history' | 'leads'>('stats');
  const [viewMode, setViewMode] = useState<'geral' | 'individual'>('geral');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtro de vendedores (exclui admins da listagem de performance)
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
        conversion: sellerCalls.length > 0 ? (answered / sellerCalls.length) * 100 : 0
      };
    }).sort((a, b) => b.totalCalls - a.totalCalls);
  }, [sellers, calls]);

  // Filtro de chamadas baseado no modo de visualização
  const filteredCalls = useMemo(() => {
    if (viewMode === 'individual' && selectedSellerId) {
      return calls.filter(c => c.sellerId === selectedSellerId);
    }
    return calls;
  }, [calls, viewMode, selectedSellerId]);

  const statsByStatus = useMemo(() => [
    { name: 'Atendidas', value: filteredCalls.filter(c => c.status === CallStatus.ANSWERED).length, color: '#10B981' },
    { name: 'Não Atendidas', value: filteredCalls.filter(c => c.status === CallStatus.NO_ANSWER).length, color: '#EF4444' },
    { name: 'Inválidos', value: filteredCalls.filter(c => c.status === CallStatus.INVALID_NUMBER).length, color: '#F59E0B' },
  ], [filteredCalls]);

  const fetchInsights = async () => {
    if (filteredCalls.length === 0) return;
    setIsGeneratingInsights(true);
    try {
      const insights = await getSalesInsights(filteredCalls);
      setAiInsights(insights);
    } catch (error) { 
      setAiInsights('Gere mais chamadas para obter insights profundos da IA.'); 
    } finally { 
      setIsGeneratingInsights(false); 
    }
  };

  useEffect(() => { 
    if (activeTab === 'stats') fetchInsights(); 
  }, [activeTab, selectedSellerId, viewMode]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const totalDurationSeconds = filteredCalls.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
  const unassignedLeadsCount = leads.filter(l => !l.assignedTo).length;

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      {/* Menu Principal */}
      <div className="flex bg-white p-2 rounded-[2.5rem] shadow-sm border overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><BarChart3 className="w-4" /> Dashboard</button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Users className="w-4" /> Equipe</button>
        <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Database className="w-4" /> Fila de Leads</button>
        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-8 py-4 rounded-3xl font-black text-xs uppercase transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><PhoneIncoming className="w-4" /> Log Completo</button>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          {/* Submenu de Visão */}
          <div className="flex items-center justify-between bg-white px-10 py-6 rounded-[3rem] border-2 border-gray-100">
            <div className="flex bg-gray-100 p-1 rounded-2xl">
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
                Performance Individual
              </button>
            </div>

            {viewMode === 'individual' && (
              <select 
                value={selectedSellerId} 
                onChange={(e) => setSelectedSellerId(e.target.value)}
                className="bg-indigo-50 border-2 border-indigo-100 text-indigo-900 font-black text-[10px] uppercase py-2.5 px-6 rounded-2xl outline-none focus:ring-2 ring-indigo-200"
              >
                <option value="">Selecione um Vendedor</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
            )}
          </div>

          {/* Cards de Métricas Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm hover:border-indigo-200 transition-all group">
                <div className="flex justify-between items-start">
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Atendimentos</p>
                  <Activity className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>
                <p className="text-4xl font-black text-gray-900 mt-2 tracking-tighter">{filteredCalls.length}</p>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm hover:border-indigo-200 transition-all group">
                <div className="flex justify-between items-start">
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Tempo Total</p>
                  <Clock className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>
                <p className="text-4xl font-black text-indigo-600 mt-2 tracking-tighter">{formatDuration(totalDurationSeconds)}</p>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm hover:border-indigo-200 transition-all group">
                <div className="flex justify-between items-start">
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Conversão</p>
                  <TrendingUp className="w-4 h-4 text-gray-300 group-hover:text-green-400 transition-colors" />
                </div>
                <p className="text-4xl font-black text-green-600 mt-2 tracking-tighter">
                  {filteredCalls.length > 0 ? ((filteredCalls.filter(c=>c.status===CallStatus.ANSWERED).length/filteredCalls.length)*100).toFixed(0) : 0}%
                </p>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm hover:border-orange-200 transition-all group">
                <div className="flex justify-between items-start">
                  <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Fila de Leads</p>
                  <Database className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition-colors" />
                </div>
                <p className="text-4xl font-black text-orange-500 mt-2 tracking-tighter">{unassignedLeadsCount}</p>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Insights IA */}
            <div className="lg:col-span-2 bg-indigo-600 text-white p-10 rounded-[3.5rem] shadow-2xl shadow-indigo-100 relative overflow-hidden flex flex-col justify-between">
               <div className="absolute top-0 right-0 p-8 opacity-10"><Sparkles className="w-40 h-40" /></div>
               <div className="relative z-10">
                 <div className="flex justify-between items-center mb-6">
                    <h4 className="font-black text-xl flex items-center gap-3 italic uppercase tracking-tighter"><Sparkles className="w-6 h-6 text-indigo-300" /> Diagnóstico do Gestor</h4>
                    <button onClick={fetchInsights} disabled={isGeneratingInsights} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><RefreshCw className={`w-5 h-5 ${isGeneratingInsights ? 'animate-spin' : ''}`} /></button>
                 </div>
                 <div className="text-sm font-bold italic leading-relaxed bg-white/5 p-8 rounded-[2.5rem] border border-white/10 min-h-[120px] flex items-center">
                   {isGeneratingInsights ? (
                     <div className="flex items-center gap-4 animate-pulse"><RefreshCw className="w-5 h-5 animate-spin" /> Processando dados...</div>
                   ) : (
                     <div className="whitespace-pre-line">"{aiInsights || 'Analise a performance clicando no botão de atualizar.'}"</div>
                   )}
                 </div>
               </div>
            </div>

            {/* Gráfico Circular de Conversão */}
            <div className="bg-white p-10 rounded-[3.5rem] border-2 border-gray-100 shadow-sm flex flex-col items-center justify-center">
              <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">Resultado das Chamadas</h3>
              <div className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statsByStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {statsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-4">
                {statsByStatus.map(s => (
                  <div key={s.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: s.color}} />
                    <span className="text-[9px] font-black text-gray-500 uppercase">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ranking de Vendedores */}
          {viewMode === 'geral' && (
            <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
              <div className="px-10 py-8 border-b flex justify-between items-center">
                <h3 className="font-black text-xl uppercase tracking-tighter text-indigo-900 italic">Performance de Equipe</h3>
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full uppercase">Top Performers</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-widest font-black">
                    <tr>
                      <th className="px-10 py-6 text-left">Vendedor</th>
                      <th className="px-10 py-6 text-center">Ligações</th>
                      <th className="px-10 py-6 text-center">Contatos</th>
                      <th className="px-10 py-6 text-center">Conversão</th>
                      <th className="px-10 py-6 text-right">Tempo em Linha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sellerStats.map((s, idx) => (
                      <tr key={s.id} className="hover:bg-gray-50/50 transition-colors group">
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-gray-300 w-4">{idx + 1}.</span>
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                              <img src={s.avatar} className="w-full h-full object-cover" />
                            </div>
                            <span className="font-black text-sm uppercase tracking-tighter text-gray-700">{s.nome}</span>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-center font-black text-gray-900">{s.totalCalls}</td>
                        <td className="px-10 py-6 text-center font-black text-green-600">{s.answered}</td>
                        <td className="px-10 py-6 text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-black text-sm text-gray-900">{s.conversion.toFixed(1)}%</span>
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                              <div className="h-full bg-green-500 rounded-full" style={{width: `${s.conversion}%`}} />
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-right font-mono font-black text-indigo-600 italic text-xs">{formatDuration(s.duration)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Outras Tabs (Uso de layout similar) */}
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
            <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900 italic">Logs de Atendimento</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-widest font-black">
                <tr><th className="px-10 py-6">Vendedor</th><th className="px-10 py-6">Duração</th><th className="px-10 py-6">Resultado</th><th className="px-10 py-6 text-right">Gravação</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calls.length > 0 ? (
                  [...calls].reverse().map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-10 py-6">
                        <p className="font-black text-sm text-gray-900 uppercase tracking-tighter">{users.find(u => u.id === c.sellerId)?.nome || 'Sistema'}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">{new Date(c.timestamp).toLocaleString('pt-BR')}</p>
                      </td>
                      <td className="px-10 py-6 font-mono text-xs font-black text-indigo-600 italic">
                        <div className="flex items-center gap-2"><Clock className="w-3 h-3" /> {formatDuration(c.durationSeconds)}</div>
                      </td>
                      <td className="px-10 py-6">
                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase border ${c.status === CallStatus.ANSWERED ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                          {c.status === CallStatus.ANSWERED ? 'CONTATO' : c.status === CallStatus.NO_ANSWER ? 'AUSENTE' : 'INVÁLIDO'}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <button className="bg-indigo-600 text-white p-4 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all group-hover:bg-indigo-700"><Play className="w-4 h-4 fill-white" /></button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="p-20 text-center text-gray-400 font-bold uppercase text-xs">Nenhuma ligação registrada hoje.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-14 rounded-[3.5rem] border-2 border-dashed border-gray-200 hover:border-indigo-600 flex flex-col items-center text-center gap-8 transition-all group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
             <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-inner"><Upload className="w-10 h-10" /></div>
             <div>
               <h3 className="font-black text-2xl uppercase tracking-tighter italic">Alimentar Base</h3>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-3">Arraste aqui sua planilha .XLSX</p>
             </div>
             <input type="file" ref={fileInputRef} onChange={(e) => {
               const file = e.target.files?.[0];
               if (!file) return;
               const reader = new FileReader();
               reader.onload = (evt) => {
                 const bstr = evt.target?.result;
                 const wb = XLSX.read(bstr, { type: 'binary' });
                 const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][];
                 const newLeads = data.slice(1).map((row, i) => ({
                   id: `imp-${Date.now()}-${i}`,
                   nome: row[0] || 'Lead Importado',
                   concurso: row[1] || '---',
                   telefone: String(row[2]) || '',
                   status: 'PENDING'
                 }));
                 onImportLeads(newLeads as any);
               };
               reader.readAsBinaryString(file);
             }} className="hidden" />
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
