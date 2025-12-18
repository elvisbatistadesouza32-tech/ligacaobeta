
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

  // Identifica leads que NÃO têm vendedor atribuído (independente de status textual)
  const unassignedLeadsCount = leads.filter(l => !l.assignedTo).length;
  const onlineSellersCount = users.filter(u => u.online && u.tipo === 'vendedor').length;

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><BarChart className="w-4" /> Dashboard</button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><Users className="w-4" /> Equipe ({onlineSellersCount} ON)</button>
        <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><Database className="w-4" /> Leads ({unassignedLeadsCount})</button>
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
            <div className="bg-indigo-600 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group">
               <div className="absolute -right-10 -top-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
               <div className="flex justify-between items-start mb-6 relative z-10"><h4 className="font-black text-2xl flex items-center gap-3 tracking-tighter italic uppercase"><Sparkles className="w-8 h-8 text-indigo-200 animate-pulse" /> IA Estratégica</h4><button onClick={fetchInsights} disabled={isGeneratingInsights} className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"><RefreshCw className={`w-6 h-6 ${isGeneratingInsights ? 'animate-spin' : ''}`} /></button></div>
               <p className="text-base opacity-95 leading-relaxed font-black relative z-10 italic">"{aiInsights || 'Analise a produtividade do time para obter insights valiosos.'}"</p>
            </div>
            
            <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 shadow-sm flex items-center justify-center">
               <div className="text-center w-full">
                 <p className="text-[10px] font-black text-gray-400 uppercase mb-8 tracking-[0.2em]">Resumo das Interações</p>
                 <div className="flex gap-10 justify-center">
                   {statsByStatus.map(s => (
                     <div key={s.name} className="flex flex-col items-center">
                       <div className="w-20 h-20 rounded-[2rem] flex items-center justify-center mb-3 shadow-inner border-2" style={{backgroundColor: s.color + '08', color: s.color, borderColor: s.color + '15'}}><Database className="w-10 h-10" /></div>
                       <span className="text-[10px] font-black text-gray-400 uppercase mb-1">{s.name}</span>
                       <span className="text-2xl font-black text-gray-900">{s.value}</span>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="p-10 bg-gray-50/50 border-b flex flex-col sm:flex-row justify-between items-center gap-4">
            <div><h3 className="font-black text-2xl tracking-tighter uppercase text-indigo-900">Operadores Ativos</h3><p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Gerencie a disponibilidade da sua equipe</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-widest font-black"><th className="px-12 py-6">Colaborador</th><th className="px-12 py-6">Perfil</th><th className="px-12 py-6">Estado Atual</th><th className="px-12 py-6 text-right">Controle Manual</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {users.sort((a,b) => (a.online === b.online ? 0 : a.online ? -1 : 1)).map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-12 py-8"><div className="flex items-center gap-5"><img src={u.avatar} className="w-14 h-14 rounded-3xl shadow-md border-2 border-white group-hover:scale-110 transition-transform" /><div className="text-sm font-black text-gray-900 leading-tight">{u.nome}<br/><span className="text-[10px] font-bold text-gray-400 lowercase">{u.email}</span></div></div></td>
                    <td className="px-12 py-8"><span className={`text-[10px] font-black px-4 py-1.5 rounded-xl border uppercase tracking-widest ${u.tipo === 'adm' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>{u.tipo}</span></td>
                    <td className="px-12 py-8"><div className="flex items-center gap-3 font-black text-[10px] tracking-widest">{u.online ? <><span className="w-3.5 h-3.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.6)]"></span> <span className="text-green-600">OPERANDO</span></> : <><span className="w-3.5 h-3.5 bg-gray-200 rounded-full"></span> <span className="text-gray-400">DESCONECTADO</span></>}</div></td>
                    <td className="px-12 py-8 text-right">
                       <button 
                         onClick={() => onToggleUserStatus(u.id)} 
                         className={`px-8 py-3.5 rounded-2xl text-[10px] font-black transition-all shadow-lg active:scale-95 flex items-center gap-3 ml-auto uppercase tracking-widest ${u.online ? 'bg-white text-red-600 border-2 border-red-50 hover:bg-red-600 hover:text-white hover:border-red-600' : 'bg-green-600 text-white hover:bg-green-700 shadow-green-100'}`}
                       >
                         {u.online ? <><PowerOff className="w-4 h-4" /> Desativar</> : <><Power className="w-4 h-4" /> Ativar Operação</>}
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
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-12 rounded-[3.5rem] border-2 border-gray-100 flex flex-col items-center justify-center text-center space-y-5 group cursor-pointer hover:border-indigo-600 hover:shadow-2xl transition-all relative" onClick={() => !isImporting && fileInputRef.current?.click()}>
              {isImporting && <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center rounded-[3.5rem]"><Loader2 className="w-14 h-14 text-indigo-600 animate-spin" /></div>}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
              <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center group-hover:bg-indigo-600 transition-all shadow-inner group-hover:-translate-y-2"><Upload className="w-12 h-12 text-indigo-600 group-hover:text-white" /></div>
              <div><h4 className="font-black text-gray-900 uppercase text-sm tracking-tighter">1. Importar Planilha</h4><p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.3em] mt-1">Envie o arquivo Excel</p></div>
            </div>

            <div className={`bg-white p-12 rounded-[3.5rem] border-2 border-gray-100 flex flex-col items-center justify-center text-center space-y-5 shadow-sm transition-all ${unassignedLeadsCount > 0 ? 'border-orange-200 bg-orange-50/30' : ''}`}>
               <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-inner ${unassignedLeadsCount > 0 ? 'bg-orange-100' : 'bg-gray-50'}`}><Database className={`w-12 h-12 ${unassignedLeadsCount > 0 ? 'text-orange-600 animate-bounce' : 'text-gray-200'}`} /></div>
               <div><h4 className="font-black text-gray-900 uppercase text-sm tracking-tighter">{leads.length} LEADS NA BASE</h4><p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-1 ${unassignedLeadsCount > 0 ? 'text-orange-600 animate-pulse' : 'text-gray-400'}`}>{unassignedLeadsCount} AGUARDANDO FILA</p></div>
            </div>

            <button 
              onClick={handleManualDistribute}
              disabled={isDistributing || unassignedLeadsCount === 0}
              className={`p-12 rounded-[3.5rem] border-2 flex flex-col items-center justify-center text-center space-y-5 transition-all active:scale-95 shadow-2xl group ${unassignedLeadsCount > 0 ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-300' : 'bg-gray-100 border-gray-200 text-gray-400 grayscale cursor-not-allowed opacity-40'}`}
            >
              <div className={`w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform ${unassignedLeadsCount > 0 ? 'bg-white/15' : 'bg-gray-200'}`}>
                {isDistributing ? <Loader2 className="w-12 h-12 animate-spin" /> : <ArrowRightLeft className="w-12 h-12" />}
              </div>
              <div><h4 className="font-black uppercase text-sm tracking-tighter">2. Distribuir para Time</h4><p className="text-[10px] font-bold uppercase tracking-[0.3em] mt-1 opacity-90">Enviar para ONlines</p></div>
            </button>
          </div>

          <div className="bg-white rounded-[4rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="p-10 bg-gray-50/50 border-b flex flex-col md:flex-row justify-between items-center gap-6">
              <h3 className="font-black text-2xl text-indigo-900 uppercase tracking-tighter">Inventário de Leads</h3>
              <div className="flex items-center gap-4">
                <div className="bg-white border-2 border-indigo-50 px-6 py-2.5 rounded-2xl flex items-center gap-3 shadow-sm"><div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div><span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Sincronização em Tempo Real</span></div>
              </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white/95 backdrop-blur-lg z-10 border-b shadow-sm"><tr className="text-[10px] uppercase text-gray-400 tracking-[0.2em] font-black"><th className="px-12 py-6">Cliente & Origem</th><th className="px-12 py-6">Telefone</th><th className="px-12 py-6">Situação</th><th className="px-12 py-6">Responsável Atual</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-12 py-8"><p className="text-sm font-black text-gray-900 leading-tight">{l.nome}</p><span className="text-[10px] text-indigo-600 font-black uppercase tracking-widest opacity-80">{l.concurso || 'GERAL'}</span></td>
                      <td className="px-12 py-8 font-mono text-xs font-black text-indigo-600 tracking-tighter">{l.telefone}</td>
                      <td className="px-12 py-8"><span className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 ${l.status === 'CALLED' ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>{l.status === 'CALLED' ? 'CONCLUÍDO' : 'PENDENTE'}</span></td>
                      <td className="px-12 py-8 text-xs font-black uppercase tracking-widest">
                        {l.assignedTo ? (
                          <div className="flex items-center gap-3 text-indigo-600"><CheckCircle className="w-5 h-5" /> {users.find(u => u.id === l.assignedTo)?.nome}</div>
                        ) : (
                          <div className="flex items-center gap-3 text-orange-500 italic opacity-80"><AlertTriangle className="w-5 h-5 animate-pulse" /> Disponível para Fila</div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {leads.length === 0 && (
                    <tr><td colSpan={4} className="px-12 py-40 text-center opacity-10"><Database className="w-24 h-24 mx-auto mb-6" /><p className="font-black uppercase text-lg tracking-[0.5em]">Sem Dados</p></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-[3rem] border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="p-10 border-b bg-gray-50/50"><h3 className="font-black text-2xl text-indigo-900 tracking-tighter uppercase">Registro de Atividades Comercial</h3></div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead><tr className="bg-gray-50 text-[10px] uppercase text-gray-400 tracking-[0.2em] font-black"><th className="px-12 py-6">Data & Hora</th><th className="px-12 py-6">Vendedor</th><th className="px-12 py-6">Resultado</th><th className="px-12 py-6 text-right">Ação</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {calls.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 group">
                      <td className="px-12 py-7 text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date(c.timestamp).toLocaleString('pt-BR')}</td>
                      <td className="px-12 py-7 text-sm font-black text-gray-900">{users.find(u => u.id === c.sellerId)?.nome}</td>
                      <td className="px-12 py-7">
                        <span className={`flex items-center gap-3 text-[10px] font-black uppercase tracking-widest ${c.status === CallStatus.ANSWERED ? 'text-green-600' : 'text-red-500'}`}>
                          {c.status === CallStatus.ANSWERED ? <CheckCircle className="w-5 h-5 shadow-sm" /> : <XCircle className="w-5 h-5 shadow-sm" />}
                          {c.status === CallStatus.ANSWERED ? 'CONTATO EFETUADO' : 'SEM RESPOSTA'}
                        </span>
                      </td>
                      <td className="px-12 py-7 text-right"><button className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90"><Play className="w-5 h-5 fill-current" /></button></td>
                    </tr>
                  ))}
                  {calls.length === 0 && (
                    <tr><td colSpan={4} className="px-12 py-40 text-center opacity-10 font-black uppercase text-lg tracking-[0.2em]">Histórico Vazio</td></tr>
                  )}
                </tbody>
             </table>
          </div>
        </div>
      )}
    </div>
  );
};
