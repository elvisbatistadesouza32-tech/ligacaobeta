
import React, { useState, useMemo } from 'react';
import { Lead, CallStatus, CallRecord, User } from '../types';
import { Phone, CheckCircle, XCircle, AlertTriangle, Users, Loader2, Sparkles, X, Smartphone, ListChecks } from 'lucide-react';

interface SellerViewProps {
  user: User;
  leads: Lead[];
  onLogCall: (call: CallRecord) => void;
}

const CARRIERS = [
  { name: 'Claro', code: '021', color: 'bg-red-600' },
  { name: 'Vivo', code: '015', color: 'bg-purple-600' },
  { name: 'Tim', code: '041', color: 'bg-blue-600' },
  { name: 'Oi', code: '031', color: 'bg-yellow-500' },
];

export const SellerView: React.FC<SellerViewProps> = ({ user, leads, onLogCall }) => {
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [pendingLead, setPendingLead] = useState<Lead | null>(null);
  const [showCarrierModal, setShowCarrierModal] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtro otimizado para garantir que leads atribuídos apareçam imediatamente
  const myLeads = useMemo(() => {
    if (!user.id) return [];
    const currentUserId = String(user.id).toLowerCase().trim();
    
    return leads.filter(l => {
      if (!l.assignedTo) return false;
      const assignedId = String(l.assignedTo).toLowerCase().trim();
      const isAssignedToMe = assignedId === currentUserId;
      const isPending = l.status === 'PENDING';
      return isAssignedToMe && isPending;
    });
  }, [leads, user.id]);

  const initiateCallSequence = (lead: Lead) => {
    setPendingLead(lead);
    setShowCarrierModal(true);
  };

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
      id: crypto.randomUUID(), // Usando UUID nativo
      leadId: activeCallLead.id,
      sellerId: user.id,
      status,
      durationSeconds: duration,
      timestamp: new Date().toISOString()
    };
    try {
      await onLogCall(newCall);
      setActiveCallLead(null);
      setStartTime(null);
    } catch (err) {
      alert("Erro ao salvar histórico.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-2xl mx-auto">
      <div className="bg-white p-10 rounded-[3rem] border-2 border-indigo-100 shadow-sm flex justify-between items-center relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-gray-900 font-black text-2xl tracking-tighter uppercase italic">Boas vendas, {user.nome}!</h2>
          <p className="text-indigo-600 text-[10px] font-black uppercase tracking-widest mt-1 flex items-center gap-2">
            <ListChecks className="w-4 h-4" /> {myLeads.length} leads na sua fila pessoal
          </p>
        </div>
        <div className="bg-indigo-600 p-5 rounded-[2rem] shadow-xl text-white">
          <Users className="w-8 h-8" />
        </div>
      </div>

      {showCarrierModal && (
        <div className="fixed inset-0 z-[110] bg-indigo-950/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white rounded-[4rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center mx-auto text-indigo-600"><Smartphone className="w-10 h-10" /></div>
              <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tighter italic">Selecionar Operadora</h3>
              <div className="grid grid-cols-1 gap-3">
                {CARRIERS.map((c) => (
                  <button key={c.name} onClick={() => handleCarrierSelection(c.code)} className={`flex items-center justify-between px-8 py-5 rounded-[2rem] text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95 shadow-lg ${c.color}`}>{c.name} <span className="bg-white/20 px-3 py-1 rounded-full text-[10px]">{c.code}</span></button>
                ))}
              </div>
              <button onClick={() => setShowCarrierModal(false)} className="text-gray-400 font-black uppercase text-[10px] tracking-widest pt-4">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {activeCallLead && (
        <div className="fixed inset-0 z-[100] bg-indigo-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-[4rem] w-full max-w-lg p-12 shadow-2xl">
            <div className="text-center space-y-8">
              <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mx-auto animate-bounce border-2 border-indigo-100"><Phone className="w-12 h-12 text-indigo-600" /></div>
              <div>
                <h3 className="text-3xl font-black text-gray-900 uppercase tracking-tighter italic">Em Chamada...</h3>
                <p className="text-indigo-600 font-black text-xl mt-2">{activeCallLead.nome}</p>
                <p className="text-gray-400 font-bold uppercase text-xs">{activeCallLead.telefone}</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {isSubmitting ? <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" /> : (
                  <>
                    <button onClick={() => handleStatusSelect(CallStatus.ANSWERED)} className="flex items-center justify-center gap-4 w-full py-6 bg-green-500 text-white rounded-[2rem] font-black uppercase shadow-lg hover:bg-green-600 active:scale-95 transition-all">CONCLUÍDO</button>
                    <button onClick={() => handleStatusSelect(CallStatus.NO_ANSWER)} className="flex items-center justify-center gap-4 w-full py-6 bg-red-500 text-white rounded-[2rem] font-black uppercase shadow-lg hover:bg-red-600 active:scale-95 transition-all">NÃO ATENDEU</button>
                    <button onClick={() => handleStatusSelect(CallStatus.INVALID_NUMBER)} className="py-4 bg-orange-100 text-orange-600 rounded-[2rem] font-black uppercase text-[10px] active:scale-95 transition-all">NÚMERO INVÁLIDO</button>
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
            <div key={lead.id} className="bg-white border-2 border-gray-100 rounded-[2.5rem] p-8 shadow-sm flex items-center justify-between group hover:border-indigo-600 transition-all">
              <div>
                <p className="font-black text-gray-900 text-xl tracking-tighter italic uppercase">{lead.nome}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase">{lead.concurso || 'Geral'}</span>
                  <span className="text-gray-400 font-bold text-sm tracking-tighter">{lead.telefone}</span>
                </div>
              </div>
              <button onClick={() => initiateCallSequence(lead)} className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-xl hover:scale-110 active:scale-90 transition-all"><Phone className="w-8 h-8" /></button>
            </div>
          ))
        ) : (
          <div className="text-center py-40 bg-white border-2 border-dashed border-gray-100 rounded-[4rem]">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <p className="text-gray-900 font-black text-xl uppercase tracking-tighter">Fila Vazia!</p>
            <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-2">Nenhum lead atribuído a você no momento.</p>
          </div>
        )}
      </div>
    </div>
  );
};
