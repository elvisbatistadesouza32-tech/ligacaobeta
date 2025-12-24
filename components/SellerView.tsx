
import React, { useState, useMemo, useEffect } from 'react';
import { Lead, CallStatus, CallRecord, User } from '../types';
import { Phone, CheckCircle, Smartphone, ListChecks, Loader2 } from 'lucide-react';

interface SellerViewProps {
  user: User;
  leads: Lead[];
  onLogCall: (call: CallRecord) => void;
}

// Função de normalização apenas para COMPARAR (não altera o dado original)
const normalize = (val: any) => String(val || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

export const SellerView: React.FC<SellerViewProps> = ({ user, leads, onLogCall }) => {
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [pendingLead, setPendingLead] = useState<Lead | null>(null);
  const [showCarrierModal, setShowCarrierModal] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // LOGS DE AUDITORIA SOLICITADOS
  useEffect(() => {
    console.log("--- AUDITORIA DE FILA ---");
    console.log("SELLER ID (RAW):", user.id);
    console.log("SELLER ID (NORM):", normalize(user.id));
    
    const assignedIds = leads
      .filter(l => l.assignedTo)
      .map(l => ({ raw: l.assignedTo, norm: normalize(l.assignedTo) }));
    
    console.log("AMOSTRA DE LEADS ATRIBUÍDOS:", assignedIds.slice(0, 5));
    console.log("-------------------------");
  }, [user, leads]);

  const myLeads = useMemo(() => {
    if (!user || !user.id) return [];
    const currentUserIdNorm = normalize(user.id);
    
    return leads.filter(l => {
      // 1. Status deve ser Pendente (insensível a caixa)
      const isPending = String(l.status).toUpperCase() === 'PENDING';
      if (!isPending) return false;
      
      // 2. O ID atribuído deve bater com o ID do usuário (insensível a hifens/caixa)
      const assignedIdNorm = normalize(l.assignedTo);
      return assignedIdNorm === currentUserIdNorm;
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
      sellerId: user.id, // Envia o ID original para o banco
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
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-sm flex justify-between items-center overflow-hidden relative">
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full opacity-50 blur-2xl"></div>
        <div>
          <h2 className="text-gray-900 font-black text-xl uppercase italic tracking-tighter">Operador: {user.nome}</h2>
          <p className="text-indigo-600 text-[10px] font-black uppercase mt-1 flex items-center gap-2 tracking-widest">
            <ListChecks className="w-4 h-4" /> {myLeads.length} leads na sua fila
          </p>
        </div>
        <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-100 relative z-10">
          <Smartphone className="w-6 h-6" />
        </div>
      </div>

      {showCarrierModal && (
        <div className="fixed inset-0 z-[110] bg-indigo-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-8 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black text-center mb-6 uppercase italic">Escolher Operadora</h3>
            <div className="grid gap-3">
              {['021', '015', '041', '031'].map(code => (
                <button key={code} onClick={() => handleCarrierSelection(code)} className="py-5 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm uppercase hover:bg-indigo-600 hover:text-white transition-all active:scale-95">Usar prefixo {code}</button>
              ))}
            </div>
            <button onClick={() => setShowCarrierModal(false)} className="w-full mt-6 text-gray-400 font-black uppercase text-[10px] tracking-widest">Cancelar Chamada</button>
          </div>
        </div>
      )}

      {activeCallLead && (
        <div className="fixed inset-0 z-[100] bg-indigo-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 text-center shadow-2xl">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
               <Phone className="w-10 h-10 text-indigo-600 animate-pulse" />
            </div>
            <h3 className="text-2xl font-black mb-2 uppercase italic tracking-tighter">{activeCallLead.nome}</h3>
            <p className="text-indigo-600 font-bold text-xl mb-8">{activeCallLead.telefone}</p>
            <div className="grid gap-4">
              {isSubmitting ? (
                <div className="py-10 flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-indigo-600 w-12 h-12" />
                  <p className="text-[10px] font-black uppercase text-gray-400">Gravando resultado...</p>
                </div>
              ) : (
                <>
                  <button onClick={() => handleStatusSelect(CallStatus.ANSWERED)} className="py-6 bg-green-500 text-white rounded-2xl font-black uppercase shadow-lg shadow-green-100 active:scale-95 transition-all">Contato Efetivo</button>
                  <button onClick={() => handleStatusSelect(CallStatus.NO_ANSWER)} className="py-6 bg-red-500 text-white rounded-2xl font-black uppercase shadow-lg shadow-red-100 active:scale-95 transition-all">Não Atendeu</button>
                  <button onClick={() => setActiveCallLead(null)} className="py-4 text-gray-400 font-black uppercase text-[10px] tracking-widest">Ignorar Registro</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {myLeads.length > 0 ? myLeads.map(lead => (
          <div key={lead.id} className="bg-white border-2 border-gray-100 rounded-[2rem] p-6 shadow-sm flex items-center justify-between hover:border-indigo-600 transition-all group">
            <div className="flex-1">
              <p className="font-black text-gray-900 uppercase italic tracking-tighter text-lg">{lead.nome}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="bg-gray-100 text-gray-400 px-3 py-0.5 rounded-lg text-[9px] font-black uppercase">{lead.concurso || 'Geral'}</span>
                <p className="text-indigo-600 font-bold text-sm">{lead.telefone}</p>
              </div>
            </div>
            <button onClick={() => { setPendingLead(lead); setShowCarrierModal(true); }} className="bg-indigo-600 text-white p-5 rounded-2xl shadow-xl hover:scale-110 active:scale-90 transition-all">
              <Phone className="w-6 h-6" />
            </button>
          </div>
        )) : (
          <div className="text-center py-32 bg-white border-2 border-dashed border-gray-200 rounded-[3rem] px-10">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500 opacity-40" />
            </div>
            <p className="text-gray-900 font-black uppercase italic text-xl tracking-tighter">Fila Vazia!</p>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-2 leading-relaxed">Você não possui leads pendentes no momento. Aguarde nova distribuição.</p>
          </div>
        )}
      </div>
    </div>
  );
};
