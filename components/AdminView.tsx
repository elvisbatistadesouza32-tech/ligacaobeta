
import React, { useState, useEffect, useRef } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
} from 'recharts';
import { 
  // Added AlertTriangle to imports
  Users, PhoneIncoming, Upload, Database, 
  Play, Sparkles, RefreshCw, Clock, ArrowRightLeft, Power, PowerOff, TrendingUp, CheckCircle, XCircle, AlertTriangle
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
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInsights = async () => {
    if (calls.length === 0) return;
    setIsGeneratingInsights(true);
    try {
      const insights = await getSalesInsights(calls);
      setAiInsights(insights);
    } catch (error) { 
      setAiInsights('Aumente o volume de chamadas para obter uma análise detalhada.'); 
    } finally { 
      setIsGeneratingInsights(false); 
    }
  };

  useEffect(() => { 
    if (activeTab === 'stats' && !aiInsights) fetchInsights(); 
  }, [activeTab, calls.length]);

  const statsByStatus = [
    { name: 'Atendidas', value: calls.filter(c => c.status === CallStatus.ANSWERED).length, color: '#10B981' },
    { name: 'Não Atendidas', value: calls.filter(c => c.status === CallStatus.NO_ANSWER).length, color: '#EF4444' },
    { name: 'Inválidos', value: calls.filter(c => c.status === CallStatus.INVALID_NUMBER).length, color: '#F59E0B' },
  ];

  const unassignedLeadsCount = leads.filter(l => !l.assignedTo).length;
  const onlineSellersCount = users.filter(u => u.online && u.tipo === 'vendedor').length;
  const totalDurationSeconds = calls.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-700">
      <div className="flex bg-white p-1.5 rounded-[2rem] shadow-sm border overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><TrendingUp className="w-4" /> Dashboard</button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Users className="w-4" /> Equipe ({onlineSellersCount})</button>
        <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><Database className="w-4" /> Leads ({unassignedLeadsCount})</button>
        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-xs uppercase transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-50'}`}><PhoneIncoming className="w-4" /> Chamadas</button>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total Chamadas</p>
                <p className="text-4xl font-black text-gray-900 mt-2">{calls.length}</p>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Tempo de Fala</p>
                <p className="text-4xl font-black text-indigo-600 mt-2 tracking-tighter">{formatDuration(totalDurationSeconds)}</p>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Leads em Espera</p>
                <p className="text-4xl font-black text-orange-500 mt-2">{unassignedLeadsCount}</p>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">% Conversão</p>
                <p className="text-4xl font-black text-green-600 mt-2">
                  {calls.length > 0 ? ((calls.filter(c=>c.status===CallStatus.ANSWERED).length/calls.length)*100).toFixed(0) : 0}%
                </p>
             </div>
          </div>

          <div className="bg-indigo-600 text-white p-10 rounded-[3.5rem] shadow-2xl shadow-indigo-100 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10"><Sparkles className="w-32 h-32" /></div>
             <div className="relative z-10">
               <div className="flex justify-between items-center mb-6">
                  <h4 className="font-black text-xl flex items-center gap-3 italic uppercase tracking-tighter"><Sparkles className="w-6 h-6 text-indigo-300" /> Consultoria de IA</h4>
                  <button onClick={fetchInsights} disabled={isGeneratingInsights} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><RefreshCw className={`w-5 h-5 ${isGeneratingInsights ? 'animate-spin' : ''}`} /></button>
               </div>
               <div className="text-sm font-bold italic leading-relaxed bg-white/5 p-6 rounded-[2rem] border border-white/10">
                 {aiInsights ? (
                   <div className="whitespace-pre-line">"{aiInsights}"</div>
                 ) : (
                   <div className="flex items-center gap-3">
                     <RefreshCw className="w-4 h-4 animate-spin" /> Analisando métricas de produtividade...
                   </div>
                 )}
               </div>
             </div>
          </div>

          <div className="bg-white p-10 rounded-[3.5rem] border-2 border-gray-100">
            <h3 className="text-[10px] font-black uppercase text-gray-400 mb-8 tracking-widest">Distribuição de Status</h3>
            <div className="flex flex-wrap gap-8 justify-between">
              {statsByStatus.map(s => (
                <div key={s.name} className="flex flex-col items-center flex-1 min-w-[120px]">
                  <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center mb-4 transition-transform hover:scale-110" style={{backgroundColor: s.color + '15', color: s.color}}>
                    {s.name === 'Atendidas' ? <CheckCircle className="w-8 h-8" /> : s.name === 'Inválidos' ? <AlertTriangle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                  </div>
                  <span className="text-[10px] font-black text-gray-400 uppercase mb-1">{s.name}</span>
                  <span className="text-3xl font-black text-gray-900 tracking-tighter">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="p-10 border-b flex justify-between items-center">
            <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900 italic">Equipe de Operações</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-widest font-black">
                <tr><th className="px-10 py-6 text-left">Membro</th><th className="px-10 py-6 text-left">Status</th><th className="px-10 py-6 text-right">Ação</th></tr>
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
        <div className="bg-white rounded-[3.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="p-10 border-b flex justify-between items-center">
            <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900 italic">Histórico de Ligações</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-widest font-black">
                <tr><th className="px-10 py-6">Vendedor</th><th className="px-10 py-6">Duração</th><th className="px-10 py-6">Resultado</th><th className="px-10 py-6 text-right">Player</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calls.length > 0 ? (
                  [...calls].reverse().map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
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
                        <button className="bg-indigo-600 text-white p-4 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all"><Play className="w-4 h-4 fill-white" /></button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-12 rounded-[3.5rem] border-2 border-dashed border-gray-200 hover:border-indigo-600 flex flex-col items-center text-center gap-6 transition-all group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
             <div className="w-20 h-20 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all"><Upload className="w-10 h-10" /></div>
             <div>
               <h3 className="font-black text-xl uppercase tracking-tighter italic">Importar Planilha</h3>
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2">XLSX com Nome, Curso e Telefone</p>
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
          <div className="bg-indigo-600 p-12 rounded-[3.5rem] text-white flex flex-col items-center text-center gap-6 hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 group cursor-pointer" onClick={onDistributeLeads}>
             <div className="w-20 h-20 bg-white/10 rounded-[2.5rem] flex items-center justify-center group-hover:scale-110 transition-transform"><ArrowRightLeft className="w-10 h-10" /></div>
             <div>
               <h3 className="font-black text-xl uppercase tracking-tighter italic">Distribuir Fila</h3>
               <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mt-2">Repassar leads para vendedores online</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
