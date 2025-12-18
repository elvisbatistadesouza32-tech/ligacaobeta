
import React, { useState, useEffect, useRef } from 'react';
import { User, Lead, CallRecord, UserRole, UserStatus, CallStatus } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { 
  Users, UserPlus, PhoneIncoming, Upload, Database, 
  Play, CheckCircle, XCircle, AlertTriangle, Search, Filter, Sparkles, RefreshCw, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
    if (calls.length === 0) {
      setAiInsights('Aguardando dados de chamadas para gerar insights estratégicos.');
      return;
    }
    setIsGeneratingInsights(true);
    try {
      const insights = await getSalesInsights(calls);
      setAiInsights(insights);
    } catch (error) {
      setAiInsights('Erro ao conectar com o analista de IA. Tente novamente mais tarde.');
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'stats' && !aiInsights) {
      fetchInsights();
    }
  }, [activeTab]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Converte para JSON (array de arrays para facilitar mapeamento por coluna)
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const importedLeads: Lead[] = jsonData
          .filter((row, index) => index > 0 && row.length > 0) // Pula cabeçalho e linhas vazias
          .map((row, index) => {
            const name = row[0] ? String(row[0]) : 'Lead Importado';
            const contest = row[1] ? String(row[1]) : '';
            const phone = row[2] ? String(row[2]).replace(/\D/g, '') : '';

            if (!phone) return null;

            return {
              id: `temp-${Date.now()}-${index}`,
              name,
              phone,
              contest,
              status: 'PENDING',
              createdAt: new Date().toISOString()
            } as Lead;
          })
          .filter(l => l !== null) as Lead[];

        if (importedLeads.length > 0) {
          onImportLeads(importedLeads);
          alert(`${importedLeads.length} leads importados com sucesso!`);
        } else {
          alert("Nenhum lead válido encontrado. Verifique se a 3ª coluna possui os números de telefone.");
        }
      } catch (error) {
        console.error("Erro no processamento do arquivo:", error);
        alert("Erro ao processar arquivo. Verifique o formato.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  const statsByStatus = [
    { name: 'Atendidas', value: calls.filter(c => c.status === CallStatus.ANSWERED).length, color: '#10B981' },
    { name: 'Não Atendidas', value: calls.filter(c => c.status === CallStatus.NO_ANSWER).length, color: '#EF4444' },
    { name: 'Inválidos', value: calls.filter(c => c.status === CallStatus.INVALID_NUMBER).length, color: '#F59E0B' },
  ];

  const sellerPerf = users.filter(u => u.role === UserRole.SELLER).map(seller => {
    const sellerCalls = calls.filter(c => c.sellerId === seller.id);
    return {
      name: seller.name,
      total: sellerCalls.length,
      answered: sellerCalls.filter(c => c.status === CallStatus.ANSWERED).length,
      duration: sellerCalls.reduce((acc, curr) => acc + curr.durationSeconds, 0)
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex bg-white p-1 rounded-xl shadow-sm border overflow-x-auto scrollbar-hide">
        <button 
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <BarChart className="w-4 h-4" /> Dashboard
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Users className="w-4 h-4" /> Equipe
        </button>
        <button 
          onClick={() => setActiveTab('leads')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <Database className="w-4 h-4" /> Leads
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          <PhoneIncoming className="w-4 h-4" /> Histórico
        </button>
      </div>

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-transform hover:scale-[1.02]">
                <p className="text-gray-500 text-sm font-medium">Total de Ligações</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{calls.length}</p>
             </div>
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-transform hover:scale-[1.02]">
                <p className="text-gray-500 text-sm font-medium">Tempo Médio</p>
                <p className="text-3xl font-bold text-indigo-600 mt-1">
                  {calls.length > 0 ? (calls.reduce((a, b) => a + b.durationSeconds, 0) / calls.length).toFixed(1) : 0}s
                </p>
             </div>
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition-transform hover:scale-[1.02]">
                <p className="text-gray-500 text-sm font-medium">Taxa de Sucesso</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {calls.length > 0 ? ((calls.filter(c => c.status === CallStatus.ANSWERED).length / calls.length) * 100).toFixed(0) : 0}%
                </p>
             </div>
             
             <div className="sm:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg mb-6">Performance por Vendedor</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sellerPerf}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="total" fill="#4F46E5" radius={[4, 4, 0, 0]} name="Total Chamadas" />
                      <Bar dataKey="answered" fill="#10B981" radius={[4, 4, 0, 0]} name="Atendidas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-lg mb-4 text-center">Distribuição de Status</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statsByStatus}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 mt-4">
                {statsByStatus.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: s.color}}></div>
                      <span>{s.name}</span>
                    </div>
                    <span className="font-bold">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-12 h-12" />
               </div>
               <div className="flex justify-between items-start mb-4">
                 <h4 className="font-bold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-200" />
                    Insights Inteligentes
                 </h4>
                 <button 
                  onClick={fetchInsights}
                  disabled={isGeneratingInsights}
                  className="p-1 hover:bg-white/10 rounded transition-colors disabled:opacity-50"
                 >
                   <RefreshCw className={`w-4 h-4 ${isGeneratingInsights ? 'animate-spin' : ''}`} />
                 </button>
               </div>
               {isGeneratingInsights ? (
                 <div className="space-y-2 animate-pulse">
                   <div className="h-3 bg-white/20 rounded w-full"></div>
                   <div className="h-3 bg-white/20 rounded w-5/6"></div>
                   <div className="h-3 bg-white/20 rounded w-4/6"></div>
                 </div>
               ) : (
                 <p className="text-sm opacity-90 leading-relaxed font-medium">
                   {aiInsights || 'Clique no ícone de recarregar para gerar insights baseados na performance da equipe.'}
                 </p>
               )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h3 className="font-bold">Equipe de Vendas</h3>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              {users.filter(u => u.status === UserStatus.ONLINE).length} ONLINE AGORA
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-semibold">Vendedor</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Nível</th>
                  <th className="px-6 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={u.avatar} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" alt="" />
                        <div>
                          <p className="font-bold text-gray-800">{u.name}</p>
                          <p className="text-xs text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => onToggleUserStatus(u.id)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${u.status === UserStatus.ONLINE ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {u.status === UserStatus.ONLINE ? 'Online' : 'Offline'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded font-mono ${u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {u.role !== UserRole.ADMIN && (
                        <button 
                          onClick={() => onPromoteUser(u.id)}
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-bold underline"
                        >
                          Promover ADM
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="space-y-1">
              <h3 className="font-bold text-lg">Gerenciar Leads</h3>
              <p className="text-gray-500 text-sm">Total de {leads.length} leads no sistema.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.xlsx,.xls,.txt,.ods,.xml"
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Importar Planilha
              </button>
              <button 
                onClick={onDistributeLeads}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-md transition-all active:scale-95"
              >
                <Users className="w-4 h-4" /> Distribuir Leads (Online)
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
             <div className="p-4 border-b flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Filtrar por nome ou telefone..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm" />
             </div>
             <div className="max-h-96 overflow-y-auto scrollbar-thin">
               <table className="w-full text-left">
                  <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500 uppercase z-10">
                    <tr>
                      <th className="px-6 py-3">Nome</th>
                      <th className="px-6 py-3">Telefone</th>
                      <th className="px-6 py-3">Vendedor</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {leads.map(lead => (
                      <tr key={lead.id} className="text-sm hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium">{lead.name}</td>
                        <td className="px-6 py-4 font-mono text-xs">{lead.phone}</td>
                        <td className="px-6 py-4">
                          {users.find(u => u.id === lead.assignedTo)?.name || <span className="text-gray-400 italic">Não atribuído</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lead.status === 'PENDING' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            {lead.status === 'PENDING' ? 'PENDENTE' : 'LIGADO'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {leads.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-gray-400">Nenhum lead cadastrado. Importe uma planilha para começar.</td>
                      </tr>
                    )}
                  </tbody>
               </table>
             </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
           <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
              <h3 className="font-bold">Registro Geral de Chamadas</h3>
              <div className="flex gap-2">
                <button className="p-2 border rounded-lg hover:bg-white"><Filter className="w-4 h-4 text-gray-500" /></button>
              </div>
           </div>
           <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 text-xs uppercase text-gray-400">
                    <th className="px-6 py-3">Data/Hora</th>
                    <th className="px-6 py-3">Vendedor</th>
                    <th className="px-6 py-3">Lead</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Duração</th>
                    <th className="px-6 py-3">Gravação</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calls.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(call => (
                    <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono">
                        {format(new Date(call.timestamp), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                             {users.find(u => u.id === call.sellerId)?.name.charAt(0)}
                           </div>
                           <span className="text-sm">{users.find(u => u.id === call.sellerId)?.name}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {leads.find(l => l.id === call.leadId)?.name}
                      </td>
                      <td className="px-6 py-4">
                        {call.status === CallStatus.ANSWERED && <div className="flex items-center gap-1 text-green-600 font-bold text-xs"><CheckCircle className="w-3 h-3" /> ATENDEU</div>}
                        {call.status === CallStatus.NO_ANSWER && <div className="flex items-center gap-1 text-red-600 font-bold text-xs"><XCircle className="w-3 h-3" /> N. ATENDEU</div>}
                        {call.status === CallStatus.INVALID_NUMBER && <div className="flex items-center gap-1 text-orange-600 font-bold text-xs"><AlertTriangle className="w-3 h-3" /> INVÁLIDO</div>}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono">{call.durationSeconds}s</td>
                      <td className="px-6 py-4">
                        <button 
                          className="bg-indigo-50 text-indigo-600 p-2 rounded-full hover:bg-indigo-100 transition-colors"
                          onClick={() => window.open(call.recordingUrl, '_blank')}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {calls.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">Nenhuma chamada registrada hoje.</td>
                    </tr>
                  )}
                </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
};
