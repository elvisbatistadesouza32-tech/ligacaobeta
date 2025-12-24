
import React, { useState, useMemo, useEffect } from 'react';
import { Lead, CallStatus, CallRecord, User } from '../types';
import { Phone, CheckCircle, Smartphone, ListChecks, Loader2 } from 'lucide-react';

interface SellerViewProps {
  user: User;
  leads: Lead[];
  onLogCall: (call: CallRecord) => void;
}

const norm = (val: any) => String(val || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

export const SellerView: React.FC<SellerViewProps> = ({ user, leads, onLogCall }) => {
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [pendingLead, setPendingLead] = useState<Lead | null>(null);
  const [showCarrierModal, setShowCarrierModal] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // DEBUG FORENSE OBRIGATÓRIO
  useEffect(() => {
    console.log("SELLER ID (NORMALIZADO):", norm(user.id));
    console.log("TOTAL LEADS RECEBIDOS:", leads.length);
    const assigned = leads.filter(l => l.assignedTo);
    console.log("LEADS ATRIBUÍDOS (NORMALIZADOS):", assigned.map(l => norm(l.assignedTo)));
  }, [user, leads]);

  const myLeads = useMemo(() => {
    if (!user || !user.id) return [];
    const currentUserId = norm(user.id);
    
    return leads.filter(l => {
      // Regra 1: Deve ser pendente (ignora casing)
      const isPending = String(l.status).toUpperCase() === 'PENDING';
      if (!isPending) return false;
      
      // Regra 2: Comparação de ID normalizada (remove hifens e hifenizações)
      const assignedId = norm(l.assignedTo);
      return assignedId === currentUserId;
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
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-gray-900 font-black text-xl uppercase italic">Operador: {user.nome}</h2>
          <p className="text-indigo-600 text-[10px] font-black uppercase mt-1 flex items-center gap-2">
            <ListChecks className="w-4 h-4" /> {myLeads.length} leads na sua fila
          </p>
        </div>
        <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-lg">
          <Smartphone className="w-6 h-6" />
        </div>
      </div>

      {showCarrierModal && (
        <div className="fixed inset-0 z-[110] bg-indigo-950/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] w-full max-w-sm p-8 shadow-2xl">
            <h3 className="text-xl font-black text-center mb-6 uppercase">Operadora</h3>
            <div className="grid gap-3">
              {['021', '015', '041', '031'].map(code => (
                <button key={code} onClick={() => handleCarrierSelection(code)} className="py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-sm uppercase hover:bg-indigo-600 hover:text-white transition-all">Usar prefixo {code}</button>
              ))}
            </div>
            <button onClick={() => setShowCarrierModal(false)} className="w-full mt-4 text-gray-400 font-bold uppercase text-[10px]">Cancelar</button>
          </div>
        </div>
      )}

      {activeCallLead && (
        <div className="fixed inset-0 z-[100] bg-indigo-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 text-center shadow-2xl">
            <h3 className="text-2xl font-black mb-2 uppercase italic">{activeCallLead.nome}</h3>
            <p className="text-indigo-600 font-bold mb-8">{activeCallLead.telefone}</p>
            <div className="grid gap-4">
              {isSubmitting ? <Loader2 className="animate-spin mx-auto text-indigo-600 w-10 h-10" /> : (
                <>
                  <button onClick={() => handleStatusSelect(CallStatus.ANSWERED)} className="py-5 bg-green-500 text-white rounded-2xl font-black uppercase shadow-lg">Contato Efetivo</button>
                  <button onClick={() => handleStatusSelect(CallStatus.NO_ANSWER)} className="py-5 bg-red-500 text-white rounded-2xl font-black uppercase shadow-lg">Não Atendeu</button>
                  <button onClick={() => setActiveCallLead(null)} className="py-3 text-gray-400 font-black uppercase text-[10px]">Descartar Registro</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {myLeads.length > 0 ? myLeads.map(lead => (
          <div key={lead.id} className="bg-white border-2 border-gray-100 rounded-[2rem] p-6 shadow-sm flex items-center justify-between hover:border-indigo-600 transition-all">
            <div className="flex-1">
              <p className="font-black text-gray-900 uppercase italic">{lead.nome}</p>
              <p className="text-gray-400 font-bold text-xs">{lead.telefone}</p>
            </div>
            <button onClick={() => { setPendingLead(lead); setShowCarrierModal(true); }} className="bg-indigo-600 text-white p-5 rounded-2xl shadow-xl hover:scale-110 active:scale-90 transition-all">
              <Phone className="w-6 h-6" />
            </button>
          </div>
        )) : (
          <div className="text-center py-20 bg-white border-2 border-dashed border-gray-200 rounded-[3rem]">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4 opacity-20" />
            <p className="text-gray-400 font-black uppercase italic">Fila Vazia</p>
          </div>
        )}
      </div>
    </div>
  );
};
