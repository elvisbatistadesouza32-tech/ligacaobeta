
import React, { useState, useEffect, useRef } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Users, UserPlus, PhoneIncoming, Upload, Database, 
  Play, CheckCircle, XCircle, AlertTriangle, Search, Filter, Sparkles, RefreshCw, Loader2, Settings, ExternalLink, FileSpreadsheet, Trash2, ArrowRightLeft, Power, PowerOff, Clock
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
  users, leads, calls, onImportLeads, onDistributeLeads, onToggleUserStatus, onPromoteUser 
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'users' | 'history' | 'leads'>('stats');
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInsights = async () => {
    if (calls.length === 0) return;
    setIsGeneratingInsights(true);
    try {
      const insights = await getSalesInsights(calls);
      setAiInsights(insights);
    } catch (error) { 
      setAiInsights('Mantenha o ritmo para bater a meta!'); 
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
    <div className="space-y-6 pb-20">
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><BarChart className="w-4" /> Geral</button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><Users className="w-4" /> Equipe ({onlineSellersCount})</button>
        <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><Database className="w-4" /> Leads ({unassignedLeadsCount})</button>
        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><PhoneIncoming className="w-4" /> Histórico</button>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total Chamadas</p>
                <p className="text-4xl font-black text-gray-900 mt-1">{calls.length}</p>
             </div>
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Tempo Falado</p>
                <p className="text-4xl font-black text-indigo-600 mt-1">{formatDuration(totalDurationSeconds)}</p>
             </div>
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Aguardando Fila</p>
                <p className="text-4xl font-black text-orange-500 mt-1">{unassignedLeadsCount}</p>
             </div>
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100">
                <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Atendimento</p>
                <p className="text-4xl font-black text-green-600 mt-1">
                  {calls.length > 0 ? ((calls.filter(c=>c.status===CallStatus.ANSWERED).length/calls.length)*100).toFixed(0) : 0}%
                </p>
             </div>
          </div>

          <div className="bg-indigo-600 text-white p-8 rounded-[3rem] shadow-xl">
             <div className="flex justify-between items-center mb-4">
                <h4 className="font-black text-xl flex items-center gap-2 italic"><Sparkles className="w-6 h-6 text-indigo-200" /> INSIGHTS DA IA</h4>
                <button onClick={fetchInsights} disabled={isGeneratingInsights} className="p-2 bg-white/10 rounded-xl"><RefreshCw className={`w-4 h-4 ${isGeneratingInsights ? 'animate-spin' : ''}`} /></button>
             </div>
             <p className="text-sm font-bold italic leading-relaxed">"{aiInsights || 'Analisando os dados da equipe...'}"</p>
          </div>

          <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100">
            <h3 className="text-[10px] font-black uppercase text-gray-400 mb-6 tracking-widest">Resumo de Conversão</h3>
            <div className="flex flex-wrap gap-8 justify-center sm:justify-between">
              {statsByStatus.map(s => (
                <div key={s.name} className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2" style={{backgroundColor: s.color + '20', color: s.color}}>
                    <PhoneIncoming className="w-8 h-8" />
                  </div>
                  <span className="text-[10px] font-black text-gray-400 uppercase">{s.name}</span>
                  <span className="text-2xl font-black text-gray-900">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm animate-in slide-in-from-bottom-4 duration-500">
          <div className="p-10 border-b">
            <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900">Gerenciamento de Equipe</h3>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-widest font-black">
              <tr><th className="px-12 py-6 text-left">Vendedor</th><th className="px-12 py-6 text-left">Status</th><th className="px-12 py-6 text-right">Ação</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50">
                  <td className="px-12 py-6 flex items-center gap-4">
                    <img src={u.avatar} className="w-12 h-12 rounded-2xl border-2 border-indigo-50" />
                    <div><p className="font-black text-sm">{u.nome}</p><p className="text-[10px] font-bold text-gray-400">{u.email}</p></div>
                  </td>
                  <td className="px-12 py-6">
                    {u.online ? <span className="flex items-center gap-2 text-[10px] font-black text-green-600 uppercase"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> ONLINE</span> : <span className="text-[10px] font-black text-gray-300 uppercase">OFFLINE</span>}
                  </td>
                  <td className="px-12 py-6 text-right">
                    <button onClick={() => onToggleUserStatus(u.id)} className={`p-3 rounded-xl transition-all ${u.online ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                      {u.online ? <PowerOff className="w-5 h-5" /> : <Power className="w-5 h-5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden animate-in fade-in duration-500">
          <div className="p-10 border-b flex justify-between items-center">
            <h3 className="font-black text-2xl uppercase tracking-tighter text-indigo-900">Histórico Completo</h3>
            <span className="text-[10px] font-black text-gray-400 uppercase">{calls.length} Chamadas Registradas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-widest font-black">
                <tr><th className="px-12 py-6">Vendedor</th><th className="px-12 py-6">Duração</th><th className="px-12 py-6">Resultado</th><th className="px-12 py-6 text-right">Gravação</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...calls].reverse().map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50">
                    <td className="px-12 py-6 font-black text-sm text-gray-900">{users.find(u => u.id === c.sellerId)?.nome || '---'}</td>
                    <td className="px-12 py-6 font-mono text-xs font-black text-indigo-600 italic"><Clock className="inline w-3 h-3 mr-1" />{formatDuration(c.durationSeconds)}</td>
                    <td className="px-12 py-6">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase border ${c.status === CallStatus.ANSWERED ? 'bg-green-50 border-green-100 text-green-600' : 'bg-red-50 border-red-100 text-red-600'}`}>
                        {c.status === CallStatus.ANSWERED ? 'CONTATO' : 'NÃO ATENDEU'}
                      </span>
                    </td>
                    <td className="px-12 py-6 text-right">
                      <button className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-all"><Play className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={() => fileInputRef.current?.click()} className="bg-white p-10 rounded-[3rem] border-2 border-dashed border-gray-200 hover:border-indigo-600 flex flex-col items-center gap-4 transition-all">
               <Upload className="w-10 h-10 text-indigo-600" />
               <span className="text-[10px] font-black uppercase tracking-widest">1. Importar Planilha</span>
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
                     nome: row[0] || '---',
                     concurso: row[1] || 'Geral',
                     telefone: String(row[2]) || ''
                   }));
                   onImportLeads(newLeads as any);
                 };
                 reader.readAsBinaryString(file);
               }} className="hidden" />
            </button>
            <button onClick={onDistributeLeads} className="bg-indigo-600 p-10 rounded-[3rem] text-white flex flex-col items-center gap-4 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">
               <ArrowRightLeft className="w-10 h-10" />
               <span className="text-[10px] font-black uppercase tracking-widest">2. Distribuir para Equipe</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
