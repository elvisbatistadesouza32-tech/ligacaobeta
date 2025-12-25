
import React, { useState, useMemo } from 'react';
import { Lead, CallStatus, CallRecord, User } from '../types';
import { Phone, CheckCircle, Smartphone, ListChecks, Loader2, AlertTriangle } from 'lucide-react';

interface SellerViewProps {
  user: User;
  leads: Lead[];
  onLogCall: (call: CallRecord) => void;
}

const isSameId = (id1: any, id2: any) => {
  const clean = (val: any) => {
    if (!val) return "";
    return String(val).replace(/-/g, "").toLowerCase().trim();
  };
  const c1 = clean(id1);
  const c2 = clean(id2);
  return c1 === c2 && c1 !== "";
};

export const SellerView: React.FC<SellerViewProps> = ({ user, leads, onLogCall }) => {
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [pendingLead, setPendingLead] = useState<Lead | null>(null);
  const [showCarrierModal, setShowCarrierModal] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtragem ultra-resiliente
  const myLeads = useMemo(() => {
    if (!user || !user.id) return [];
    return leads.filter(l => {
      const statusMatch = String(l.status || "").toUpperCase() === 'PENDING';
      const ownerMatch = isSameId(l.assignedTo, user.id);
      return statusMatch && ownerMatch;
    });
  }, [leads, user]);

  const handleCarrierSelection = (code: string) => {
    if (!pendingLead) return;
    const formattedNumber = `${code}${pendingLead.telefone.replace(/\D/g, '')}`;
    setActiveCallLead(pendingLead);
    setPendingLead(null);
    setShowCarrierModal(false);
    setStartTime(Date.now());
    window.location.href = `tel:${formattedNumber}`;
  };

  const handleStatusSelect = async (status: CallStatus) => {
    if (!activeCallLead || !startTime) return;
    setIsSubmitting(true);
    const duration = Math.floor((Date.now() - startTime) / 1000);
    const newCall: CallRecord = {
      id: crypto.randomUUID(),
      leadId: activeCallLead.id,
      sellerId: user.id,
      status,
      durationSeconds: duration,
      timestamp: new Date().toISOString()
    };
    try {
      await onLogCall(newCall);
      setActiveCallLead(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-500 font-sans">
      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-sm flex justify-between items-center overflow-hidden relative">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full opacity-50 blur-2xl"></div>
        <div>
          <h2 className="text-gray-900 font-black text-xl uppercase italic tracking-tighter">Operador: {user.nome}</h2>
          <p className="text-indigo-600 text-[10px] font-black uppercase mt-1 flex items-center gap-2 tracking-widest">
            <ListChecks className="w-4 h-4" /> {myLeads.length} leads na sua fila
          </p>
        </div>
        <div className="flex gap-2 relative z-10">
          <button onClick={() => setShowDiagnostics(!showDiagnostics)} title="Diagnóstico" className={`p-4 rounded-2xl transition-all border-2 ${showDiagnostics ? 'bg-amber-100 text-amber-600 border-amber-200' : 'bg-gray-50 text-gray-400 border-transparent'}`}>
            <AlertTriangle className="w-6 h-6" />
          </button>
          <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-100">
            <Smartphone className="w-6 h-6" />
          </div>
        </div>
      </div>

      {showDiagnostics && (
        <div className="bg-amber-50 border-2 border-amber-200 p-8 rounded-[2.5rem] animate-in slide-in-from-top-4">
           <h3 className="font-black uppercase italic text-amber-800 text-sm mb-4 tracking-widest">Painel de Diagnóstico</h3>
           <div className="space-y-3 text-[11px] font-bold text-amber-700">
              <p>ID VENDEDOR (LOGADO): <code className="bg-white px-2 py-0.5 rounded border border-amber-300">{user.id}</code></p>
              <p>TOTAL LEADS CARREGADOS: {leads.length}</p>
              <p>PENDENTES COM MEU ID: {leads.filter(l => isSameId(l.assignedTo, user.id) && l.status === 'PENDING').length}</p>
              <div className="mt-4 p-4 bg-white rounded-2xl border border-amber-200 overflow-x-auto">
                <p className="mb-2 text-gray-500 uppercase">Amostra de Leads (Primeiros 5):</p>
                <table className="w-full">
                  <thead><tr className="border-b text-gray-400"><td className="pb-2">Nome</td><td className="pb-2">Dono (assignedTo)</td><td className="pb-2 text-right">Status</td></tr></thead>
                  <tbody>
                    {leads.slice(0, 5).map(l => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-2 text-gray-800">{l.nome}</td>
                        <td className="py-2 font-mono text-[9px] text-gray-500">{l.assignedTo || 'FILA GERAL'}</td>
                        <td className="py-2 text-right">{l.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           </div>
        </div>
      )}

      {showCarrierModal && (
        <div className="fixed inset-0 z-[110] bg-indigo-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black text-center mb-6 uppercase italic tracking-tighter">Prefixo de Discagem</h3>
            <div className="grid gap-3">
              {['021', '015', '041', '031'].map(code => (
                <button key={code} onClick={() => handleCarrierSelection(code)} className="py-5 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm uppercase hover:bg-indigo-600 hover:text-white transition-all active:scale-95">Usar {code}</button>
              ))}
            </div>
            <button onClick={() => setShowCarrierModal(false)} className="w-full mt-6 text-gray-400 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
          </div>
        </div>
      )}

      {activeCallLead && (
        <div className="fixed inset-0 z-[100] bg-indigo-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 text-center shadow-2xl animate-in zoom-in-90">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
               <Phone className="w-10 h-10 text-indigo-600 animate-pulse" />
            </div>
            <h3 className="text-2xl font-black mb-2 uppercase italic tracking-tighter">{activeCallLead.nome}</h3>
            <p className="text-indigo-600 font-bold text-xl mb-8 tracking-widest">{activeCallLead.telefone}</p>
            <div className="grid gap-4">
              {isSubmitting ? (
                <div className="py-10 flex flex-col items-center gap-4"><Loader2 className="animate-spin text-indigo-600 w-12 h-12" /></div>
              ) : (
                <>
                  <button onClick={() => handleStatusSelect(CallStatus.ANSWERED)} className="py-6 bg-green-500 text-white rounded-2xl font-black uppercase shadow-lg shadow-green-100 active:scale-95 transition-all text-sm tracking-widest">Contato Efetivo</button>
                  <button onClick={() => handleStatusSelect(CallStatus.NO_ANSWER)} className="py-6 bg-red-500 text-white rounded-2xl font-black uppercase shadow-lg shadow-red-100 active:scale-95 transition-all text-sm tracking-widest">Não Atendeu</button>
                  <button onClick={() => setActiveCallLead(null)} className="py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest hover:text-indigo-600">Fechar sem salvar</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 pb-20">
        {myLeads.length > 0 ? myLeads.map(lead => (
          <div key={lead.id} className="bg-white border-2 border-gray-100 rounded-[2.5rem] p-7 shadow-sm flex items-center justify-between hover:border-indigo-600 transition-all group animate-in slide-in-from-bottom-2">
            <div className="flex-1">
              <p className="font-black text-gray-900 uppercase italic tracking-tighter text-xl">{lead.nome}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-xl text-[9px] font-black uppercase border border-indigo-100">{lead.concurso || 'Campanha'}</span>
                <p className="text-gray-400 font-bold text-sm tracking-widest">{lead.telefone}</p>
              </div>
            </div>
            <button onClick={() => { setPendingLead(lead); setShowCarrierModal(true); }} className="bg-indigo-600 text-white p-6 rounded-[1.5rem] shadow-xl hover:scale-110 active:scale-90 transition-all shadow-indigo-100">
              <Phone className="w-7 h-7" />
            </button>
          </div>
        )) : (
          <div className="text-center py-40 bg-white border-4 border-dashed border-gray-50 rounded-[4rem] px-10">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <CheckCircle className="w-12 h-12 text-green-500 opacity-40" />
            </div>
            <p className="text-gray-900 font-black uppercase italic text-2xl tracking-tighter mb-2">Tudo em ordem!</p>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest leading-relaxed">Sua fila de atendimento está vazia no momento.</p>
          </div>
        )}
      </div>
    </div>
  );
};
