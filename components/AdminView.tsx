
import React, { useState, useEffect, useRef } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Users, UserPlus, PhoneIncoming, Upload, Database, 
  Play, CheckCircle, XCircle, AlertTriangle, Search, Filter, Sparkles, RefreshCw, Loader2, Settings, ExternalLink, FileSpreadsheet, Trash2, ArrowRightLeft, Power, PowerOff
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
    if (calls.length === 0) return setAiInsights('Sem chamadas para analisar ainda.');
    setIsGeneratingInsights(true);
    try {
      const insights = await getSalesInsights(calls);
      setAiInsights(insights);
    } catch (error) { 
      setAiInsights('Mantenha o ritmo de chamadas para atingir suas metas.'); 
    } finally { 
      setIsGeneratingInsights(false); 
    }
  };

  useEffect(() => { 
    if (activeTab === 'stats' && !aiInsights) fetchInsights(); 
  }, [activeTab]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bstr = event.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        const newLeads: Lead[] = data.slice(1)
          .filter(row => row[2] && String(row[2]).trim().length >= 8)
          .map((row, index): Lead => ({
            id: `temp-${Date.now()}-${index}`,
            nome: row[0] ? String(row[0]).trim() : 'Sem Nome',
            concurso: row[1] ? String(row[1]).trim() : 'Geral',
            telefone: String(row[2]).trim()
          }));

        if (newLeads.length > 0) {
          onImportLeads(newLeads);
        } else {
          alert("Nenhum lead válido encontrado.");
          setIsImporting(false);
        }
      } catch (err) {
        alert("Erro ao ler o arquivo.");
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleManualDistribute = async () => {
    setIsDistributing(true);
    await onDistributeLeads();
    setIsDistributing(false);
  };

  useEffect(() => { 
    setIsImporting(false); 
  }, [leads.length]);

  const statsByStatus = [
    { name: 'Atendidas', value: calls.filter(c => c.status === CallStatus.ANSWERED).length, color: '#10B981' },
    { name: 'Não Atendidas', value: calls.filter(c => c.status === CallStatus.NO_ANSWER).length, color: '#EF4444' },
    { name: 'Inválidos', value: calls.filter(c => c.status === CallStatus.INVALID_NUMBER).length, color: '#F59E0B' },
  ];

  const unassignedLeadsCount = leads.filter(l => !l.assignedTo).length;
  const onlineSellersCount = users.filter(u => u.online && u.tipo === 'vendedor').length;

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><BarChart className="w-4" /> Dashboard</button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><Users className="w-4" /> Equipe ({onlineSellersCount} ON)</button>
        <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><Database className="w-4" /> Leads ({unassignedLeadsCount} Pendentes)</button>
        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><PhoneIncoming className="w-4" /> Histórico</button>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100 shadow-sm"><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total Chamadas</p><p className="text-4xl font-black text-gray-900 mt-1">{calls.length}</p></div>
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100 shadow-sm"><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Tempo Falado (min)</p><p className="text-4xl font-black text-indigo-600 mt-1">{(calls.reduce((a,b)=>a+b.durationSeconds,0)/60).toFixed(0)}</p></div>
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100 shadow-sm"><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Aguardando Fila</p><p className="text-4xl font-black text-orange-500 mt-1">{unassignedLeadsCount}</p></div>
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100 shadow-sm"><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Conversão</p><p className="text-4xl font-black text-green-600 mt-1">{calls.length > 0 ? ((calls.filter(c=>c.status===CallStatus.ANSWERED).length/calls.length)*100).toFixed(0) : 0}%</p></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
               <div className="flex justify-between items-start mb-4 relative z-10"><h4 className="font-black text-xl flex items-center gap-2 tracking-tighter italic uppercase"><Sparkles className="w-6 h-6 text-indigo-200 animate-pulse" /> Inteligência Artificial</h4><button onClick={fetchInsights} disabled={isGeneratingInsights} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"><RefreshCw className={`w-5 h-5 ${isGeneratingInsights ? 'animate-spin' : ''}`} /></button></div>
               <p className="text-sm opacity-90 leading-relaxed font-black relative z-10 italic">"{aiInsights || 'Carregando análise estratégica...'}"</p>
            </div>
            
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm flex items-center justify-center">
               <div className="text-center w-full">
                 <p className="text-[10px] font-black text-gray-400 uppercase mb-6 tracking-widest">Distribuição de Status</p>
                 <div className="flex gap-8 justify-center">
                   {statsByStatus.map(s => (
                     <div key={s.name} className="flex flex-col items-center">
                       <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-2 shadow-inner border" style={{backgroundColor: s.color + '10', color: s.color, borderColor: s.color + '20'}}><Database className="w-8 h-8" /></div>
                       <span className="text-[10px] font-black text-gray-400 uppercase">{s.name}</span>
                       <span className="text-xl font-black text-gray-900">{s.value}</span>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-[2.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="p-8 bg-gray-50/50 border-b flex flex-col sm:flex-row justify-between items-center gap-4">
            <div><h3 className="font-black text-xl tracking-tighter uppercase text-indigo-900">Gerenciamento de Equipe</h3><p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Coloque vendedores ONLINE para receberem leads</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="bg-gray-50/50 text-[10px] uppercase text-gray-400 tracking-widest"><th className="px-10 py-5 font-black">Colaborador</th><th className="px-10 py-5 font-black">Tipo</th><th className="px-10 py-5 font-black">Status Operacional</th><th className="px-10 py-5 font-black text-right">Controle Manual</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {users.sort((a,b) => (a.online === b.online ? 0 : a.online ? -1 : 1)).map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-10 py-6"><div className="flex items-center gap-4"><img src={u.avatar} className="w-12 h-12 rounded-2xl shadow-sm border-2 border-white grayscale group-hover:grayscale-0 transition-all" /><div className="text-sm font-black text-gray-900">{u.nome}<br/><span className="text-[10px] font-bold text-gray-400 lowercase">{u.email}</span></div></div></td>
                    <td className="px-10 py-6"><span className={`text-[10px] font-black px-3 py-1 rounded-lg border uppercase tracking-widest ${u.tipo === 'adm' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>{u.tipo}</span></td>
                    <td className="px-10 py-6"><div className="flex items-center gap-2 font-black text-[10px] tracking-widest">{u.online ? <><span className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span> <span className="text-green-600 uppercase">DISPONÍVEL</span></> : <><span className="w-3 h-3 bg-gray-300 rounded-full"></span> <span className="text-gray-400 uppercase">DESCONECTADO</span></>}</div></td>
                    <td className="px-10 py-6 text-right">
                       <button 
                         onClick={() => onToggleUserStatus(u.id)} 
                         className={`px-6 py-2.5 rounded-xl text-[10px] font-black transition-all shadow-sm active:scale-95 flex items-center gap-2 ml-auto uppercase tracking-widest ${u.online ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white' : 'bg-green-600 text-white shadow-green-100 hover:bg-green-700'}`}
                       >
                         {u.online ? <><PowerOff className="w-3 h-3" /> Desligar</> : <><Power className="w-3 h-3" /> Ligar Agora</>}
                       </button>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-10 rounded-[2.5rem] border-2 border-gray-100 flex flex-col items-center justify-center text-center space-y-4 group cursor-pointer hover:border-indigo-600 hover:shadow-xl transition-all relative" onClick={() => !isImporting && fileInputRef.current?.click()}>
              {isImporting && <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center rounded-[2.5rem]"><Loader2 className="w-12 h-12 text-indigo-600 animate-spin" /></div>}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
              <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center group-hover:bg-indigo-600 group-hover:rotate-6 transition-all shadow-inner"><Upload className="w-10 h-10 text-indigo-600 group-hover:text-white" /></div>
              <div><h4 className="font-black text-gray-900 uppercase text-sm tracking-tighter">1. Importar Base</h4><p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Planilha Excel/CSV</p></div>
            </div>

            <div className={`bg-white p-10 rounded-[2.5rem] border-2 border-gray-100 flex flex-col items-center justify-center text-center space-y-4 shadow-sm transition-all ${unassignedLeadsCount > 0 ? 'border-orange-200 bg-orange-50/20' : ''}`}>
               <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-inner ${unassignedLeadsCount > 0 ? 'bg-orange-100' : 'bg-gray-50'}`}><Database className={`w-10 h-10 ${unassignedLeadsCount > 0 ? 'text-orange-600 animate-bounce' : 'text-gray-300'}`} /></div>
               <div><h4 className="font-black text-gray-900 uppercase text-sm tracking-tighter">{leads.length} TOTAL NA BASE</h4><p className={`text-[10px] font-black uppercase tracking-[0.2em] mt-1 ${unassignedLeadsCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{unassignedLeadsCount} PARA DISTRIBUIR</p></div>
            </div>

            <button 
              onClick={handleManualDistribute}
              disabled={isDistributing || unassignedLeadsCount === 0}
              className={`p-10 rounded-[2.5rem] border-2 flex flex-col items-center justify-center text-center space-y-4 transition-all active:scale-95 shadow-lg group ${unassignedLeadsCount > 0 ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200' : 'bg-gray-100 border-gray-200 text-gray-400 grayscale cursor-not-allowed opacity-50'}`}
            >
              <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform ${unassignedLeadsCount > 0 ? 'bg-white/10' : 'bg-gray-200'}`}>
                {isDistributing ? <Loader2 className="w-10 h-10 animate-spin" /> : <ArrowRightLeft className="w-10 h-10" />}
              </div>
              <div><h4 className="font-black uppercase text-sm tracking-tighter">2. Distribuir Leads</h4><p className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1 opacity-80">Enviar para Equipe ON</p></div>
            </button>
          </div>

          <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="p-8 bg-gray-50/50 border-b flex flex-col sm:flex-row justify-between items-center gap-4">
              <h3 className="font-black text-xl text-indigo-900 uppercase tracking-tighter">Visualização da Base</h3>
              <div className="flex items-center gap-3">
                <div className="bg-white border-2 border-indigo-100 px-5 py-2 rounded-2xl flex items-center gap-2"><div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Sincronização Ativa</span></div>
                <button onClick={() => window.location.reload()} className="p-2.5 bg-white border-2 border-gray-100 rounded-2xl hover:bg-gray-50 transition-all active:scale-90"><RefreshCw className="w-4 h-4 text-gray-400" /></button>
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b"><tr className="text-[10px] uppercase text-gray-400 tracking-widest"><th className="px-10 py-5 font-black">Cliente / Concurso</th><th className="px-10 py-5 font-black">Telefone</th><th className="px-10 py-5 font-black">Situação</th><th className="px-10 py-5 font-black">Vendedor Responsável</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-10 py-6"><p className="text-sm font-black text-gray-900">{l.nome}</p><span className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">{l.concurso || 'GERAL'}</span></td>
                      <td className="px-10 py-6 font-mono text-xs font-black text-indigo-600 tracking-tighter">{l.telefone}</td>
                      <td className="px-10 py-6"><span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${l.status === 'CALLED' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>{l.status === 'CALLED' ? 'FINALIZADO' : 'AGUARDANDO'}</span></td>
                      <td className="px-10 py-6 text-xs font-black uppercase tracking-widest">
                        {l.assignedTo ? (
                          <div className="flex items-center gap-2 text-indigo-600"><CheckCircle className="w-4 h-4" /> {users.find(u => u.id === l.assignedTo)?.nome}</div>
                        ) : (
                          <div className="flex items-center gap-2 text-orange-500 italic"><AlertTriangle className="w-4 h-4" /> Não Atribuído</div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr><td colSpan={4} className="px-10 py-32 text-center opacity-20"><Database className="w-20 h-20 mx-auto mb-4" /><p className="font-black uppercase text-sm tracking-[0.3em]">Base de Dados Vazia</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-[2.5rem] border-2 border-gray-100 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-5 duration-500">
          <div className="p-8 border-b bg-gray-50/50"><h3 className="font-black text-xl text-indigo-900 tracking-tighter uppercase">Relatório Consolidado de Chamadas</h3></div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead><tr className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-widest font-black"><th className="px-10 py-5">Momento</th><th className="px-10 py-5">Colaborador</th><th className="px-10 py-5">Resultado</th><th className="px-10 py-5 text-right">Mídia</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {calls.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 group">
                      <td className="px-10 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(c.timestamp).toLocaleString('pt-BR')}</td>
                      <td className="px-10 py-5 text-sm font-black text-gray-900">{users.find(u => u.id === c.sellerId)?.nome}</td>
                      <td className="px-10 py-5">
                        <span className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${c.status === CallStatus.ANSWERED ? 'text-green-600' : 'text-red-500'}`}>
                          {c.status === CallStatus.ANSWERED ? <CheckCircle className="w-4" /> : <XCircle className="w-4" />}
                          {c.status === CallStatus.ANSWERED ? 'CONVERSA OK' : 'SEM SUCESSO'}
                        </span>
                      </td>
                      <td className="px-10 py-5 text-right"><button className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90"><Play className="w-4 h-4 fill-current" /></button></td>
                    </tr>
                  ))}
                  {calls.length === 0 && (
                    <tr><td colSpan={4} className="px-10 py-32 text-center opacity-20 font-black uppercase text-sm tracking-widest italic">Nenhuma chamada registrada ainda</td></tr>
                  )}
                </tbody>
             </table>
          </div>
        </div>
      )}
    </div>
  );
};
