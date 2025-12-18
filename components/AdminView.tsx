
import React, { useState, useEffect, useRef } from 'react';
import { User, Lead, CallRecord, CallStatus } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Users, UserPlus, PhoneIncoming, Upload, Database, 
  Play, CheckCircle, XCircle, AlertTriangle, Search, Filter, Sparkles, RefreshCw, Loader2, Settings, ExternalLink, FileSpreadsheet, Trash2
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchInsights = async () => {
    if (calls.length === 0) return setAiInsights('Sem chamadas para analisar ainda.');
    setIsGeneratingInsights(true);
    try {
      const insights = await getSalesInsights(calls);
      setAiInsights(insights);
    } catch (error) { setAiInsights('Erro ao gerar insights.'); } finally { setIsGeneratingInsights(false); }
  };

  useEffect(() => { if (activeTab === 'stats' && !aiInsights) fetchInsights(); }, [activeTab]);

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

        // Mapeamento seguindo a regra: Col 1: Nome, Col 2: Concurso, Col 3: Telefone (Obrigatório)
        const newLeads: Lead[] = data.slice(1) // Pula o cabeçalho
          .filter(row => row[2] && String(row[2]).trim().length >= 8) // Valida se a Coluna 3 tem telefone
          .map((row, index): Lead => ({
            id: `temp-${Date.now()}-${index}`,
            name: row[0] ? String(row[0]).trim() : 'Sem Nome',
            contest: row[1] ? String(row[1]).trim() : 'Geral',
            phone: String(row[2]).trim(),
            status: 'PENDING',
            createdAt: new Date().toISOString()
          }));

        if (newLeads.length > 0) {
          onImportLeads(newLeads);
        } else {
          alert("Nenhum lead válido encontrado. Certifique-se de que a Coluna 3 (Telefone) está preenchida.");
          setIsImporting(false);
        }
      } catch (err) {
        alert("Erro ao ler o arquivo. Use um formato compatível (.xlsx ou .csv)");
        setIsImporting(false);
      }
    };
    reader.readAsBinaryString(file);
    // Reseta o input para permitir subir o mesmo arquivo se necessário
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => {
    // Quando a importação termina (leads aumentam), paramos o loading
    setIsImporting(false);
  }, [leads.length]);

  const statsByStatus = [
    { name: 'Atendidas', value: calls.filter(c => c.status === CallStatus.ANSWERED).length, color: '#10B981' },
    { name: 'Não Atendidas', value: calls.filter(c => c.status === CallStatus.NO_ANSWER).length, color: '#EF4444' },
    { name: 'Inválidos', value: calls.filter(c => c.status === CallStatus.INVALID_NUMBER).length, color: '#F59E0B' },
  ];

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-500 hover:bg-gray-50'}`}><BarChart className="w-4" /> Dashboard</button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-500 hover:bg-gray-50'}`}><Users className="w-4" /> Equipe</button>
        <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-500 hover:bg-gray-50'}`}><Database className="w-4" /> Leads</button>
        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-500 hover:bg-gray-50'}`}><PhoneIncoming className="w-4" /> Histórico</button>
      </div>

      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100"><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Total Chamadas</p><p className="text-4xl font-black text-gray-900 mt-1">{calls.length}</p></div>
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100"><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Minutos Totais</p><p className="text-4xl font-black text-indigo-600 mt-1">{(calls.reduce((a,b)=>a+b.durationSeconds,0)/60).toFixed(0)}</p></div>
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100"><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Leads Restantes</p><p className="text-4xl font-black text-orange-500 mt-1">{leads.filter(l => l.status === 'PENDING').length}</p></div>
             <div className="bg-white p-6 rounded-[2rem] border-2 border-gray-100"><p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Conversão</p><p className="text-4xl font-black text-green-600 mt-1">{calls.length > 0 ? ((calls.filter(c=>c.status===CallStatus.ANSWERED).length/calls.length)*100).toFixed(0) : 0}%</p></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-indigo-600 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
               <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
               <div className="flex justify-between items-start mb-4 relative z-10"><h4 className="font-black text-xl flex items-center gap-2 tracking-tighter italic"><Sparkles className="w-6 h-6 text-indigo-200" /> INSIGHTS DA IA</h4><button onClick={fetchInsights} disabled={isGeneratingInsights} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"><RefreshCw className={`w-5 h-5 ${isGeneratingInsights ? 'animate-spin' : ''}`} /></button></div>
               <p className="text-sm opacity-90 leading-relaxed font-medium relative z-10 italic">"{aiInsights || 'Analise o desempenho da sua equipe com um clique.'}"</p>
            </div>
            
            <div className="bg-white p-6 rounded-[2.5rem] border-2 border-gray-100 flex items-center justify-center min-h-[200px]">
               <div className="text-center">
                 <p className="text-xs font-bold text-gray-400 uppercase mb-4">Distribuição de Status</p>
                 <div className="flex gap-6 justify-center">
                   {statsByStatus.map(s => (
                     <div key={s.name} className="flex flex-col items-center">
                       <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1 shadow-sm" style={{backgroundColor: s.color + '20', color: s.color}}><Database className="w-6 h-6" /></div>
                       <span className="text-[10px] font-black text-gray-500">{s.value}</span>
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
          <div className="p-6 bg-gray-50/50 border-b flex flex-col sm:flex-row justify-between items-center gap-4">
            <div><h3 className="font-black text-lg tracking-tight">EQUIPE COMERCIAL</h3><p className="text-xs text-gray-500">Gerencie permissões e disponibilidade</p></div>
            <button onClick={onDistributeLeads} className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center justify-center gap-2"><RefreshCw className="w-4" /> DISTRIBUIR MANUALMENTE</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="bg-gray-50/50 text-[10px] uppercase text-gray-400"><th className="px-8 py-4 font-black">Vendedor</th><th className="px-8 py-4 font-black">Status</th><th className="px-8 py-4 font-black text-right">Ações</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-8 py-5"><div className="flex items-center gap-4"><img src={u.avatar} className="w-10 h-10 rounded-2xl shadow-sm border-2 border-white" /><div className="text-sm font-bold text-gray-900">{u.nome}<br/><span className="text-[10px] font-medium text-gray-400 lowercase">{u.email}</span></div></div></td>
                    <td className="px-8 py-5"><button onClick={() => onToggleUserStatus(u.id)} className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${u.online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{u.online ? 'ONLINE' : 'OFFLINE'}</button></td>
                    <td className="px-8 py-5 text-right">{u.tipo !== 'adm' && <button onClick={() => onPromoteUser(u.id)} className="text-indigo-600 font-black text-[10px] uppercase tracking-wider hover:underline">Tornar ADM</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 flex flex-col items-center justify-center text-center space-y-4 group cursor-pointer hover:border-indigo-600 transition-all relative" onClick={() => !isImporting && fileInputRef.current?.click()}>
              {isImporting && (
                <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center rounded-[2.5rem]">
                  <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
              <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center group-hover:bg-indigo-600 transition-all"><Upload className="w-8 h-8 text-indigo-600 group-hover:text-white" /></div>
              <div><h4 className="font-black text-gray-900 uppercase">Importar e Distribuir</h4><p className="text-[10px] text-gray-400 font-bold">COL 1: NOME | COL 2: CONCURSO | COL 3: TELEFONE</p></div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 flex flex-col items-center justify-center text-center space-y-4">
               <div className="w-16 h-16 bg-green-50 rounded-3xl flex items-center justify-center"><Database className="w-8 h-8 text-green-600" /></div>
               <div><h4 className="font-black text-gray-900 uppercase">{leads.length} LEADS NO TOTAL</h4><p className="text-xs text-gray-400">{leads.filter(l => !l.assignedTo).length} aguardando distribuição</p></div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="p-6 bg-gray-50/50 border-b flex justify-between items-center"><h3 className="font-black text-lg">BASE DE LEADS</h3><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Buscar..." className="pl-10 pr-4 py-2 bg-white border rounded-xl text-xs outline-none focus:border-indigo-600 w-40 sm:w-64" /></div></div></div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white z-10"><tr className="bg-gray-50 text-[10px] uppercase text-gray-400"><th className="px-8 py-3 font-black">Lead</th><th className="px-8 py-3 font-black">Telefone</th><th className="px-8 py-3 font-black">Status</th><th className="px-8 py-3 font-black">Vendedor</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.slice(0, 100).map(l => (
                    <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-4"><p className="text-sm font-bold text-gray-900">{l.name}</p><span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{l.contest}</span></td>
                      <td className="px-8 py-4 font-mono text-xs font-black text-indigo-600">{l.phone}</td>
                      <td className="px-8 py-4"><span className={`px-2 py-1 rounded-lg text-[10px] font-black ${l.status === 'CALLED' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>{l.status}</span></td>
                      <td className="px-8 py-4 text-xs font-black text-gray-500">{users.find(u => u.id === l.assignedTo)?.nome || '—'}</td>
                    </tr>
                  ))}
                  {leads.length === 0 && <tr><td colSpan={4} className="p-20 text-center text-gray-400 font-bold italic">Nenhum lead importado. Clique acima para subir sua planilha.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-[2.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
          <div className="p-6 border-b bg-gray-50/50"><h3 className="font-black text-lg">HISTÓRICO DE LIGAÇÕES</h3></div>
          <div className="overflow-x-auto">
             <table className="w-full text-left">
                <thead><tr className="bg-gray-50 text-[10px] uppercase text-gray-400"><th className="px-8 py-4 font-black">Data/Hora</th><th className="px-8 py-4 font-black">Vendedor</th><th className="px-8 py-4 font-black">Resultado</th><th className="px-8 py-4 font-black">Gravação</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {calls.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-8 py-4 text-xs font-bold text-gray-500">{new Date(c.timestamp).toLocaleString('pt-BR')}</td>
                      <td className="px-8 py-4 text-sm font-bold text-gray-900">{users.find(u => u.id === c.sellerId)?.nome}</td>
                      <td className="px-8 py-4">
                        <span className={`flex items-center gap-1.5 text-[10px] font-black ${c.status === CallStatus.ANSWERED ? 'text-green-600' : c.status === CallStatus.NO_ANSWER ? 'text-red-500' : 'text-orange-500'}`}>
                          {c.status === CallStatus.ANSWERED ? <CheckCircle className="w-3" /> : c.status === CallStatus.NO_ANSWER ? <XCircle className="w-3" /> : <AlertTriangle className="w-3" />}
                          {c.status}
                        </span>
                      </td>
                      <td className="px-8 py-4"><button className="bg-gray-100 p-2 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Play className="w-4 h-4" /></button></td>
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
