
import React, { useState } from 'react';
import { Lead, CallStatus, CallRecord, User } from '../types';
import { Phone, CheckCircle, XCircle, AlertTriangle, Users } from 'lucide-react';

interface SellerViewProps {
  user: User;
  leads: Lead[];
  onLogCall: (call: CallRecord) => void;
}

export const SellerView: React.FC<SellerViewProps> = ({ user, leads, onLogCall }) => {
  const [activeCallLead, setActiveCallLead] = useState<Lead | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  const myLeads = leads.filter(l => l.assignedTo === user.id && l.status === 'PENDING');

  const startCall = (lead: Lead) => {
    setActiveCallLead(lead);
    setStartTime(Date.now());
    window.location.href = `tel:${lead.phone}`;
  };

  const handleStatusSelect = (status: CallStatus) => {
    if (!activeCallLead || !startTime) return;
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
    onLogCall(newCall);
    setActiveCallLead(null);
    setStartTime(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex justify-between items-center">
        <div><h2 className="text-indigo-900 font-bold text-lg">Olá, {user.nome}</h2><p className="text-indigo-600 text-sm">Você tem {myLeads.length} leads pendentes hoje.</p></div>
        <div className="bg-white p-3 rounded-full shadow-sm"><Users className="w-6 h-6 text-indigo-600" /></div>
      </div>

      {activeCallLead && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto animate-pulse"><Phone className="w-10 h-10 text-indigo-600" /></div>
              <div><h3 className="text-xl font-bold">Chamada em Andamento</h3><p className="text-gray-500">{activeCallLead.name}</p><p className="text-indigo-600 font-mono mt-1">{activeCallLead.phone}</p></div>
              <div className="pt-4 border-t space-y-3"><p className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Qual foi o resultado?</p>
                <div className="grid grid-cols-1 gap-3">
                  <button onClick={() => handleStatusSelect(CallStatus.ANSWERED)} className="flex items-center justify-center gap-2 w-full py-4 bg-green-500 text-white rounded-xl font-bold transition-all active:scale-95"><CheckCircle className="w-5 h-5" /> Atendeu</button>
                  <button onClick={() => handleStatusSelect(CallStatus.NO_ANSWER)} className="flex items-center justify-center gap-2 w-full py-4 bg-red-500 text-white rounded-xl font-bold transition-all active:scale-95"><XCircle className="w-5 h-5" /> Não atendeu</button>
                  <button onClick={() => handleStatusSelect(CallStatus.INVALID_NUMBER)} className="flex items-center justify-center gap-2 w-full py-4 bg-orange-500 text-white rounded-xl font-bold transition-all active:scale-95"><AlertTriangle className="w-5 h-5" /> Número Inválido</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {myLeads.length > 0 ? (myLeads.map(lead => (
          <div key={lead.id} className="bg-white border rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="space-y-1"><p className="font-bold text-gray-800 text-lg">{lead.name}</p><div className="flex items-center gap-2 text-sm text-gray-500"><span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-tighter">{lead.concurso || 'Geral'}</span><span>•</span><span>{lead.phone}</span></div></div>
            <button onClick={() => startCall(lead)} className="bg-indigo-600 text-white p-4 rounded-full shadow-lg active:scale-90 transition-all"><Phone className="w-6 h-6" /></button>
          </div>
        ))) : (<div className="text-center py-20 bg-gray-50 border-2 border-dashed rounded-3xl"><p className="text-gray-400 font-medium">Parabéns! Você concluiu todos os seus leads.</p></div>)}
      </div>
    </div>
  );
};
