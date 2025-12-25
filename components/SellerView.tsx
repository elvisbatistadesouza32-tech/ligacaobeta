
import React, { useState, useMemo } from 'react';
import { Lead, CallStatus, CallRecord, User } from '../types';
import { Phone, CheckCircle, Ban, Loader2, PhoneForwarded, X, HelpCircle, PhoneOff, History, ListChecks, Clock, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SellerViewProps {
  user: User;
  leads: Lead[];
  calls: CallRecord[];
  onLogCall: (call: CallRecord) => void;
}

const CARRIERS = [
  { name: 'Claro', code: '021' },
  { name: 'Vivo', code: '015' },
  { name: 'Tim', code: '041' },
  { name: 'Oi', code: '031' }
];

export const SellerView: React.FC<SellerViewProps> = ({ user, leads, calls, onLogCall }) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [active, setActive] = useState<Lead | null>(null);
  const [carrier, setCarrier] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [start, setStart] = useState<number>(0);

  const myLeads = useMemo(() => leads.filter(l => l.assignedTo === user.id && l.status === 'PENDING'), [leads, user.id]);
  
  const myHistory = useMemo(() => {
    return calls
      .filter(c => c.sellerId === user.id)
      .map(call => {
        const lead = leads.find(l => l.id === call.leadId);
        return { ...call, lead };
      })
      .filter(item => item.lead); // Garante que o lead ainda existe
  }, [calls, leads, user.id]);

  const callsToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return myHistory.filter(c => c.timestamp.startsWith(today)).length;
  }, [myHistory]);

  const selectCarrier = (code: string) => {
    if (!active) return;
    setCarrier(false);
    setStart(Date.now());
    window.location.href = `tel:${code}${active.telefone.replace(/\D/g, '')}`;
  };

  const handleStatus = async (status: CallStatus) => {
    if (!active) return;
    setLoading(true);
    const call: CallRecord = {
      id: crypto.randomUUID(),
      leadId: active.id,
      sellerId: user.id,
      status,
      durationSeconds: Math.floor((Date.now() - start) / 1000),
      timestamp: new Date().toISOString()
    };
    onLogCall(call);
    setActive(null);
    setLoading(false);
  };

  const getStatusBadge = (status: CallStatus) => {
    switch (status) {
      case CallStatus.ANSWERED:
        return <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded text-[8px] font-black uppercase">Atendeu</span>;
      case CallStatus.NO_ANSWER:
        return <span className="bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded text-[8px] font-black uppercase">Não Atendeu</span>;
      case CallStatus.INVALID_NUMBER:
        return <span className="bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded text-[8px] font-black uppercase">Inválido</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-gray-100 shadow-sm flex flex-col items-center sm:items-start">
          <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1">Fila Pendente</p>
          <p className="text-4xl font-black italic text-slate-800 tracking-tighter">{myLeads.length}</p>
        </div>
        <div className="bg-sky-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-sky-100 flex flex-col items-center sm:items-start">
          <p className="text-[10px] uppercase font-black opacity-60 tracking-widest mb-1">Chamadas Hoje</p>
          <p className="text-4xl font-black italic tracking-tighter">{callsToday}</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex bg-white p-1.5 rounded-3xl border-2 border-gray-100 shadow-sm">
        <button 
          onClick={() => setActiveTab('queue')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === 'queue' ? 'bg-sky-600 text-white shadow-lg shadow-sky-100' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <ListChecks className="w-4 h-4" />
          Minha Fila
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === 'history' ? 'bg-sky-600 text-white shadow-lg shadow-sky-100' : 'text-gray-400 hover:bg-gray-50'}`}
        >
          <History className="w-4 h-4" />
          Meu Histórico
        </button>
      </div>

      {/* Modals remains the same */}
      {carrier && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] w-full max-w-xs p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="bg-sky-50 w-16 h-16 rounded-3xl flex items-center justify-center text-sky-600 mx-auto mb-6">
              <PhoneForwarded className="w-8 h-8" />
            </div>
            <h3 className="text-center font-black uppercase mb-8 italic text-slate-900 tracking-tight">Escolha a Operadora</h3>
            <div className="grid grid-cols-2 gap-3">
              {CARRIERS.map(c => (
                <button 
                  key={c.code} 
                  onClick={() => selectCarrier(c.code)} 
                  className="py-6 bg-gray-50 border-2 border-gray-100 text-sky-600 rounded-3xl font-black text-lg hover:bg-sky-600 hover:text-white hover:border-sky-600 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
                >
                  <span className="uppercase">{c.name}</span>
                  <span className="text-[10px] opacity-40">{c.code}</span>
                </button>
              ))}
            </div>
            <button 
              onClick={() => setCarrier(false)} 
              className="mt-8 w-full text-[10px] font-black uppercase text-gray-400 flex items-center justify-center gap-2"
            >
              <X className="w-3 h-3" /> Fechar
            </button>
          </div>
        </div>
      )}

      {active && !carrier && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6 text-center animate-in fade-in duration-300">
          <div className="bg-white rounded-[3.5rem] w-full max-w-sm p-10 sm:p-14 shadow-2xl animate-in zoom-in-95 duration-300">
             <div className="bg-emerald-50 w-20 h-20 rounded-[2.5rem] flex items-center justify-center text-emerald-600 mx-auto mb-8 animate-pulse">
              <Phone className="w-10 h-10" />
            </div>
            <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-2 text-slate-900 leading-tight">{active.nome}</h3>
            <p className="text-sky-600 font-bold text-xl mb-10 tracking-wider">{active.telefone}</p>
            <div className="space-y-4">
              {loading ? (
                <div className="flex flex-col items-center gap-4 py-6">
                  <Loader2 className="animate-spin text-sky-600 w-10 h-10" />
                  <p className="text-[10px] font-black text-gray-400 uppercase">Registrando Chamada...</p>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => handleStatus(CallStatus.ANSWERED)} 
                    className="w-full py-6 bg-emerald-500 text-white rounded-[2rem] font-black uppercase shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all active:scale-95"
                  >
                    <CheckCircle className="w-5 h-5" /> Atendeu
                  </button>
                  <button 
                    onClick={() => handleStatus(CallStatus.NO_ANSWER)} 
                    className="w-full py-6 bg-red-500 text-white rounded-[2rem] font-black uppercase shadow-xl shadow-red-100 flex items-center justify-center gap-3 hover:bg-red-600 transition-all active:scale-95"
                  >
                    <PhoneOff className="w-5 h-5" /> Não Atendeu
                  </button>
                  <button 
                    onClick={() => handleStatus(CallStatus.INVALID_NUMBER)} 
                    className="w-full py-6 bg-gray-400 text-white rounded-[2rem] font-black uppercase flex justify-center items-center gap-3 hover:bg-gray-500 transition-all active:scale-95"
                  >
                    <Ban className="w-5 h-5"/> Inválido
                  </button>
                  <button 
                    onClick={() => setActive(null)} 
                    className="pt-6 text-[11px] font-black uppercase text-gray-400 tracking-widest hover:text-gray-600 transition-colors"
                  >
                    Voltar para lista
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="space-y-4">
        {activeTab === 'queue' ? (
          <>
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] ml-6">Próximos Contatos</h4>
            {myLeads.map(l => (
              <div 
                key={l.id} 
                className="bg-white p-6 sm:p-8 rounded-[3rem] border-2 border-gray-100 flex justify-between items-center group hover:border-sky-600 transition-all shadow-sm hover:shadow-xl hover:shadow-sky-50"
              >
                <div className="flex-1">
                  <p className="font-black uppercase italic text-xl tracking-tighter text-slate-900">{l.nome}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-[8px] font-black text-gray-500 uppercase">{l.base}</span>
                    <span className="text-[10px] font-bold text-sky-400 uppercase">{l.telefone}</span>
                  </div>
                </div>
                <button 
                  onClick={() => { setActive(l); setCarrier(true); }} 
                  className="bg-sky-600 text-white p-6 sm:p-7 rounded-[2rem] shadow-xl shadow-sky-100 group-hover:scale-110 group-hover:bg-red-600 transition-all active:scale-90"
                >
                  <Phone className="w-6 h-6" />
                </button>
              </div>
            ))}
            {myLeads.length === 0 && (
              <div className="text-center py-24 bg-gray-50/50 rounded-[4rem] border-4 border-dashed border-gray-200 animate-in zoom-in-95 duration-300">
                <div className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center text-emerald-500 mx-auto mb-6">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <p className="font-black uppercase italic text-slate-400 text-xl tracking-tighter">Missão Cumprida!</p>
                <p className="text-[10px] font-bold text-gray-400 uppercase mt-2">Você não tem leads pendentes na fila.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] ml-6">Contatos Realizados</h4>
            <div className="space-y-3">
              {myHistory.map(item => (
                <div 
                  key={item.id} 
                  className="bg-white p-5 rounded-[2rem] border border-gray-100 flex justify-between items-center group hover:border-sky-200 transition-all shadow-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-black uppercase italic text-sm text-slate-700">{item.lead?.nome}</p>
                      {getStatusBadge(item.status)}
                    </div>
                    <div className="flex items-center gap-3 text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span className="text-[9px] font-bold uppercase">
                          {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                      <span className="text-[9px] font-black text-sky-400">{item.lead?.telefone}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setActive(item.lead!); setCarrier(true); }} 
                    className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-sky-600 hover:text-white hover:scale-110 transition-all active:scale-90 flex items-center gap-2"
                    title="Retornar Ligação"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="font-black uppercase text-[8px] hidden sm:inline">Re-ligar</span>
                  </button>
                </div>
              ))}
              {myHistory.length === 0 && (
                <div className="text-center py-20 bg-gray-50/30 rounded-[3rem] border-2 border-dashed border-gray-100">
                  <History className="w-10 h-10 text-gray-200 mx-auto mb-4" />
                  <p className="font-black uppercase text-[10px] text-gray-400 tracking-widest">Nenhuma ligação registrada ainda.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      <div className="bg-sky-50/50 p-6 rounded-[2.5rem] border border-sky-100 flex items-center gap-4 mt-12">
        <div className="bg-sky-600 text-white p-3 rounded-2xl">
          <HelpCircle className="w-5 h-5" />
        </div>
        <p className="text-[10px] font-bold text-sky-700 leading-relaxed uppercase">
          Dica: No histórico, você pode clicar em "Re-ligar" para tentar novamente contatos que não atenderam.
        </p>
      </div>
    </div>
  );
};
