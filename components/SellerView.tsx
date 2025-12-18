
import React, { useState, useEffect } from 'react';
import { Lead, CallStatus, CallRecord, User } from '../types';
import { Phone, CheckCircle, XCircle, AlertTriangle, Users, Loader2, Sparkles } from 'lucide-react';

interface SellerViewProps {
  user: User;
  leads: Lead[];
  onLogCall: (call: CallRecord) => void;
}

export const SellerView: React.FC<SellerViewProps> = ({ user, leads, onLogCall }) => {
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtrar apenas leads PENDENTES atribuídos a este vendedor
  const myLeads = leads.filter(l => l.assignedTo === user.id && l.status === 'PENDING');

  const startCall = (lead: Lead) => {
    setActiveCallLead(lead);
    setStartTime(Date.now());
    // Disca para o número
    window.location.href = `tel:${lead.telefone}`;
  };

  const handleStatusSelect = async (status: CallStatus) => {
    if (!activeCallLead || !startTime) return;
    
    setIsSubmitting(true);
    const duration = Math.floor((Date.now() - startTime) / 1000);
    
    const newCall: CallRecord = {
      id: Math.random().toString(36).substr(2, 9),
      leadId: activeCallLead.id,
      sellerId: user.id,
      status,
      durationSeconds: duration,
      timestamp: new Date().toISOString(),
      recordingUrl: `https://actions.google.com/sounds/v1/science_fiction/robot_arm_whir.ogg`
    };

    try {
      await onLogCall(newCall);
      setActiveCallLead(null);
      setStartTime(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-10 rounded-[3rem] border-2 border-indigo-100 shadow-sm flex justify-between items-center relative overflow-hidden group">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-indigo-50 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000" />
        <div className="relative z-10">
          <h2 className="text-gray-900 font-black text-2xl tracking-tighter uppercase italic">Boas vendas, {user.nome.split(' ')[0]}!</h2>
          <p className="text-indigo-600 text-xs font-black uppercase tracking-widest mt-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> {myLeads.length} Leads aguardando seu contato
          </p>
        </div>
        <div className="bg-indigo-600 p-5 rounded-[2rem] shadow-xl shadow-indigo-100 text-white relative z-10">
          <Users className="w-8 h-8" />
        </div>
      </div>

      {activeCallLead && (
        <div className="fixed inset-0 z-[100] bg-indigo-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[4rem] w-full max-w-lg p-12 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-center space-y-8">
              <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mx-auto animate-bounce shadow-inner border-2 border-indigo-100">
                <Phone className="w-12 h-12 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter italic">Chamada Ativa</h3>
                <p className="text-gray-400 font-bold uppercase text-sm mt-2">{activeCallLead.nome}</p>
                <p className="text-indigo-600 font-black text-xl mt-1 tracking-tighter">{activeCallLead.telefone}</p>
              </div>
              
              <div className="grid grid-cols-1 gap-4 pt-4">
                {isSubmitting ? (
                  <div className="flex flex-col items-center py-8 gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                    <span className="text-[10px] font-black uppercase text-gray-400">Salvando histórico...</span>
                  </div>
                ) : (
                  <>
                    <button onClick={() => handleStatusSelect(CallStatus.ANSWERED)} className="flex items-center justify-center gap-4 w-full py-6 bg-green-500 text-white rounded-[2rem] font-black uppercase shadow-lg shadow-green-100 hover:bg-green-600 active:scale-95 transition-all tracking-widest text-sm">
                      <CheckCircle className="w-6 h-6" /> Concluí Atendimento
                    </button>
                    <button onClick={() => handleStatusSelect(CallStatus.NO_ANSWER)} className="flex items-center justify-center gap-4 w-full py-6 bg-red-500 text-white rounded-[2rem] font-black uppercase shadow-lg shadow-red-100 hover:bg-red-600 active:scale-95 transition-all tracking-widest text-sm">
                      <XCircle className="w-6 h-6" /> Não Atendido
                    </button>
                    <button onClick={() => handleStatusSelect(CallStatus.INVALID_NUMBER)} className="flex items-center justify-center gap-4 w-full py-5 bg-orange-100 text-orange-600 rounded-[2rem] font-black uppercase active:scale-95 transition-all tracking-widest text-[10px]">
                      <AlertTriangle className="w-5 h-5" /> Número Inválido
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {myLeads.length > 0 ? (
          myLeads.map(lead => (
            <div key={lead.id} className="bg-white border-2 border-gray-100 rounded-[2.5rem] p-8 shadow-sm flex items-center justify-between group hover:border-indigo-600 transition-all active:bg-gray-50">
              <div className="space-y-2">
                <p className="font-black text-gray-900 text-xl tracking-tighter italic uppercase">{lead.nome}</p>
                <div className="flex items-center gap-3">
                  <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">{lead.concurso || 'Geral'}</span>
                  <span className="text-gray-300 font-bold">•</span>
                  <span className="text-sm font-bold text-gray-400 tracking-tighter">{lead.telefone}</span>
                </div>
              </div>
              <button onClick={() => startCall(lead)} className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-2xl shadow-indigo-200 group-hover:scale-110 active:scale-90 transition-all">
                <Phone className="w-8 h-8" />
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-40 bg-white border-2 border-dashed border-gray-100 rounded-[4rem]">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
            <p className="text-gray-900 font-black text-xl uppercase tracking-tighter">Fila Vazia!</p>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-2">Você concluiu todos os seus atendimentos.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const CheckCircle2 = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
);
