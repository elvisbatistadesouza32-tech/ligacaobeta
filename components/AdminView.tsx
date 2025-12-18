
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

        const newLeads: Lead[] = data.slice(1)
          .filter(row => row[2] && String(row[2]).trim().length >= 8)
          .map((row, index): Lead => ({
            id: `temp-${Date.now()}-${index}`,
            nome: row[0] ? String(row[0]).trim() : 'Sem Nome', // Mapeia para 'nome'
            concurso: row[1] ? String(row[1]).trim() : 'Geral',
            phone: String(row[2]).trim(),
            status: 'PENDING',
            createdAt: new Date().toISOString()
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

  useEffect(() => { setIsImporting(false); }, [leads.length]);

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      <div className="flex bg-white p-1 rounded-2xl shadow-sm border overflow-x-auto scrollbar-hide">
        <button onClick={() => setActiveTab('stats')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><BarChart className="w-4" /> Dashboard</button>
        <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><Users className="w-4" /> Equipe</button>
        <button onClick={() => setActiveTab('leads')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'leads' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><Database className="w-4" /> Leads</button>
        <button onClick={() => setActiveTab('history')} className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:bg-gray-50'}`}><PhoneIncoming className="w-4" /> Histórico</button>
      </div>

      {activeTab === 'leads' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 flex flex-col items-center justify-center text-center space-y-4 group cursor-pointer hover:border-indigo-600 transition-all relative" onClick={() => !isImporting && fileInputRef.current?.click()}>
              {isImporting && <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center rounded-[2.5rem]"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>}
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
              <div className="w-16 h-16 bg-indigo-50 rounded-3xl flex items-center justify-center group-hover:bg-indigo-600 transition-all"><Upload className="w-8 h-8 text-indigo-600 group-hover:text-white" /></div>
              <div><h4 className="font-black text-gray-900 uppercase">Importar Leads</h4><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Col 1: Nome | Col 2: Concurso | Col 3: Telefone</p></div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 flex flex-col items-center justify-center text-center space-y-4">
               <div className="w-16 h-16 bg-green-50 rounded-3xl flex items-center justify-center"><Database className="w-8 h-8 text-green-600" /></div>
               <div><h4 className="font-black text-gray-900 uppercase">{leads.length} LEADS NO TOTAL</h4><p className="text-xs text-gray-400">{leads.filter(l => !l.assignedTo).length} aguardando distribuição</p></div>
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] border-2 border-gray-100 overflow-hidden shadow-sm">
            <div className="p-6 bg-gray-50/50 border-b flex justify-between items-center"><h3 className="font-black text-lg">BASE DE LEADS</h3></div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white z-10"><tr className="bg-gray-50 text-[10px] uppercase text-gray-400"><th className="px-8 py-3 font-black">Lead</th><th className="px-8 py-3 font-black">Telefone</th><th className="px-8 py-3 font-black">Status</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map(l => (
                    <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-8 py-4"><p className="text-sm font-bold text-gray-900">{l.nome}</p><span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{l.concurso}</span></td>
                      <td className="px-8 py-4 font-mono text-xs font-black text-indigo-600">{l.phone}</td>
                      <td className="px-8 py-4"><span className={`px-2 py-1 rounded-lg text-[10px] font-black ${l.status === 'CALLED' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-400'}`}>{l.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* ... demais abas ... */}
    </div>
  );
};
