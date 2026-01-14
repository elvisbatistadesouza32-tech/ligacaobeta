
import React, { useState, useMemo } from 'react';
import { Lead, CallStatus, CallRecord, User, Sale, SaleChannel } from '../types';
import { Phone, CheckCircle, Ban, Loader2, PhoneForwarded, X, HelpCircle, PhoneOff, History, ListChecks, Clock, RotateCcw, Target, Zap, DollarSign, MessageCircle, TrendingUp, RefreshCw, AlertCircle, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
// Fix: Import ptBR from 'date-fns/locale' to ensure the object is correctly typed as a Locale for date-fns functions.
import { ptBR } from 'date-fns/locale';

interface SellerViewProps {
  user: User;
  leads: Lead[];
  calls: CallRecord[];
  sales: Sale[];
  onLogCall: (call: CallRecord) => void;
  onRegisterSale: (sale: Omit<Sale, 'id' | 'created_at'>) => Promise<void>;
}

const CARRIERS = [
  { name: 'Claro', code: '021' },
  { name: 'Vivo', code: '015' },
  { name: 'Tim', code: '041' },
  { name: 'Oi', code: '031' }
];

export const SellerView: React.FC<SellerViewProps> = ({ user, leads, calls, sales, onLogCall, onRegisterSale }) => {
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [active, setActive] = useState<Lead | null>(null);
  const [carrier, setCarrier] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [start, setStart] = useState<number>(0);

  // Form Venda
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleCustomer, setSaleCustomer] = useState('');
  const [saleAmount, setSaleAmount] = useState('');
  const [saleChannel, setSaleChannel] = useState<SaleChannel>('call');

  const myAssignedLeads = useMemo(() => leads.filter(l => l.assignedTo === user.id), [leads, user.id]);
  const myLeads = useMemo(() => myAssignedLeads.filter(l => l.status === 'PENDING'), [myAssignedLeads]);
  const myCalledCount = useMemo(() => myAssignedLeads.filter(l => l.status === 'CALLED').length, [myAssignedLeads]);
  
  const mySalesStats = useMemo(() => {
    const mySales = sales.filter(s => s.seller_id === user.id);
    const totalValue = mySales.reduce((acc, s) => acc + Number(s.amount), 0);
    return {
      count: mySales.length,
      value: totalValue
    };
  }, [sales, user.id]);
  
  const totalLeads = myAssignedLeads.length;
  const progressPercent = totalLeads > 0 ? Math.round((myCalledCount / totalLeads) * 100) : 0;

  const myHistory = useMemo(() => {
    return calls
      .filter(c => c.sellerId === user.id)
      .map(call => {
        const lead = leads.find(l => l.id === call.leadId);
        return { ...call, lead };
      })
      .filter(item => item.lead);
  }, [calls, leads, user.id]);

  const selectCarrier = (code: string) => {
    if (!active) return;
    setCarrier(false);
    setStart(Date.now());
    window.location.href = `tel:${code}${active.telefone.replace(/\D/g, '')}`;
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      window.location.reload();
    }, 600);
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

  const handleRegisterSaleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleCustomer || !saleAmount) return;
    setLoading(true);
    try {
      await onRegisterSale({
        seller_id: user.id,
        customer_name: saleCustomer.toUpperCase(),
        amount: parseFloat(saleAmount.replace(',', '.')),
        canal: saleChannel
      });
      setSaleCustomer('');
      setSaleAmount('');
      setShowSaleModal(false);
    } catch (err) {
      alert("Erro ao registrar venda.");
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto pb-24 relative">
      
      <button 
        onClick={() => setShowSaleModal(true)}
        className="fixed bottom-8 left-8 z-[60] bg-emerald-500 text-white px-8 py-5 rounded-full font-black uppercase italic shadow-2xl shadow-emerald-200 flex items-center gap-3 hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all"
      >
        <DollarSign className="w-5 h-5" /> Registrar Venda
      </button>

      <button 
        onClick={handleSync}
        className="fixed bottom-8 right-8 z-[60] bg-white text-sky-600 p-5 rounded-full shadow-2xl border-2 border-sky-50 hover:bg-sky-50 hover:scale-110 active:scale-90 transition-all flex items-center gap-2 group"
      >
        <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
        <span className="text-[10px] font-black uppercase hidden sm:inline">Atualizar</span>
      </button>

      {showSaleModal && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-sm p-10 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black uppercase italic text-slate-900 mb-8 text-center flex items-center justify-center gap-2">
              <DollarSign className="text-emerald-500" /> Nova Venda Realizada
            </h3>
            <form onSubmit={handleRegisterSaleAction} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-5 tracking-widest">Nome do Cliente</label>
                <input type="text" placeholder="EX: MARIA SOUZA" value={saleCustomer} onChange={e => setSaleCustomer(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center uppercase" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-5 tracking-widest">Valor da Venda (R$)</label>
                <input type="text" placeholder="0.00" value={saleAmount} onChange={e => setSaleAmount(e.target.value)} className="w-full p-5 bg-gray-50 border-2 border-gray-100 rounded-3xl font-bold text-center" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase ml-5 tracking-widest text-center block">Canal de Contato</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setSaleChannel('call')} className={`py-4 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 border-2 transition-all ${saleChannel === 'call' ? 'bg-sky-50 border-sky-500 text-sky-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                    <Phone className="w-3 h-3" /> Ligação
                  </button>
                  <button type="button" onClick={() => setSaleChannel('whatsapp')} className={`py-4 rounded-2xl font-black uppercase text-[10px] flex items-center justify-center gap-2 border-2 transition-all ${saleChannel === 'whatsapp' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>
                    <MessageCircle className="w-3 h-3" /> WhatsApp
                  </button>
                </div>
              </div>
              <div className="pt-6 grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setShowSaleModal(false)} className="py-4 text-xs font-black uppercase text-gray-400">Cancelar</button>
                <button type="submit" disabled={loading} className="py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-emerald-100 flex items-center justify-center">
                  {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Confirmar Venda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white p-8 rounded-[3rem] border-2 border-gray-100 shadow-sm relative group">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Target size={120} className="text-sky-600" /></div>
        <div className="relative z-10">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-1">Carga de Trabalho</p>
              <h2 className="text-4xl font-black italic text-slate-800 tracking-tighter">{myLeads.length === 0 ? 'Fila Zerada!' : `Faltam ${myLeads.length}`}</h2>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black italic text-sky-600">{progressPercent}%</span>
              <p className="text-[10px] uppercase font-black text-gray-400">Completo</p>
            </div>
          </div>
          <div className="h-4 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
            <div className="h-full bg-gradient-to-r from-sky-400 to-sky-600 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(2,132,199,0.3)]" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-sky-600 p-6 rounded-[2rem] text-white shadow-xl shadow-sky-100">
          <p className="text-[9px] uppercase font-black opacity-60 mb-1 leading-tight">Calls</p>
          <p className="text-2xl font-black italic tracking-tighter">{myHistory.length}</p>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2rem] text-white shadow-xl">
          <p className="text-[9px] uppercase font-black opacity-60 mb-1 leading-tight">Vendas</p>
          <p className="text-2xl font-black italic tracking-tighter">{mySalesStats.count}</p>
        </div>
        <div className="bg-emerald-500 p-6 rounded-[2rem] text-white shadow-xl shadow-emerald-100">
          <p className="text-[9px] uppercase font-black opacity-60 mb-1 leading-tight">Valor</p>
          <p className="text-xl font-black italic tracking-tighter">R$ {mySalesStats.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      {carrier && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-xs p-10 shadow-2xl">
            <h3 className="text-center font-black uppercase mb-8 italic text-slate-900 tracking-tight">Escolha a Operadora</h3>
            <div className="grid grid-cols-2 gap-3">
              {CARRIERS.map(c => <button key={c.code} onClick={() => selectCarrier(c.code)} className="py-6 bg-gray-50 border-2 border-gray-100 text-sky-600 rounded-3xl font-black text-lg hover:bg-sky-600 hover:text-white transition-all uppercase">{c.name}</button>)}
            </div>
            <button onClick={() => setCarrier(false)} className="mt-8 w-full text-[10px] font-black uppercase text-gray-400 flex items-center justify-center gap-2"><X className="w-3 h-3" /> Fechar</button>
          </div>
        </div>
      )}

      {active && !carrier && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[3.5rem] w-full max-w-sm p-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-2 text-slate-900 leading-tight">{active.nome}</h3>
            <div className="flex flex-col items-center gap-2 mb-10">
              <p className="text-sky-600 font-bold text-xl tracking-wider">{active.telefone}</p>
              <div className="bg-gray-100 px-4 py-1.5 rounded-full flex items-center gap-2 text-[9px] font-black uppercase text-gray-500 italic">
                <Bookmark size={10} className="text-sky-500" /> Base: {active.base}
              </div>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => handleStatus(CallStatus.ANSWERED)} 
                className="w-full py-6 bg-emerald-500 text-white rounded-[2rem] font-black uppercase italic shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <CheckCircle className="w-5 h-5" /> Atendeu
              </button>
              
              <button 
                onClick={() => handleStatus(CallStatus.NO_ANSWER)} 
                className="w-full py-6 bg-red-500 text-white rounded-[2rem] font-black uppercase italic shadow-xl shadow-red-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <PhoneOff className="w-5 h-5" /> Não Atendeu
              </button>

              <button 
                onClick={() => handleStatus(CallStatus.INVALID_NUMBER)} 
                className="w-full py-6 bg-amber-500 text-white rounded-[2rem] font-black uppercase italic shadow-xl shadow-amber-100 flex items-center justify-center gap-3 active:scale-95 transition-all"
              >
                <AlertCircle className="w-5 h-5" /> Número Inválido
              </button>

              <button 
                onClick={() => setActive(null)} 
                className="pt-6 text-[11px] font-black uppercase text-gray-400 tracking-widest hover:text-gray-600 transition-colors"
              >
                Voltar para lista
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex bg-white p-1.5 rounded-3xl border-2 border-gray-100 shadow-sm">
        <button onClick={() => setActiveTab('queue')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === 'queue' ? 'bg-sky-600 text-white shadow-lg shadow-sky-100' : 'text-gray-400 hover:bg-gray-50'}`}><ListChecks className="w-4 h-4" /> Minha Fila</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === 'history' ? 'bg-sky-600 text-white shadow-lg shadow-sky-100' : 'text-gray-400 hover:bg-gray-50'}`}><History className="w-4 h-4" /> Meu Histórico</button>
      </div>

      <div className="space-y-4">
        {activeTab === 'queue' ? (
          <>
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] ml-6">Próximos Contatos</h4>
            {myLeads.map(l => (
              <div key={l.id} className="bg-white p-6 rounded-[3rem] border-2 border-gray-100 flex justify-between items-center group hover:border-sky-600 transition-all shadow-sm">
                <div className="flex-1">
                  <p className="font-black uppercase italic text-xl tracking-tighter text-slate-900">{l.nome}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">{l.telefone}</span>
                    <span className="bg-sky-50 text-sky-600 px-3 py-1 rounded-full text-[8px] font-black uppercase italic border border-sky-100">Base: {l.base}</span>
                  </div>
                </div>
                <button onClick={() => { setActive(l); setCarrier(true); }} className="bg-sky-600 text-white p-6 rounded-[2rem] shadow-xl shadow-sky-100 active:scale-90 transition-all"><Phone className="w-6 h-6" /></button>
              </div>
            ))}
            {myLeads.length === 0 && (
              <div className="py-20 text-center opacity-30 italic font-black text-xs uppercase">Sem leads pendentes</div>
            )}
          </>
        ) : (
          <div className="space-y-3">
             <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.3em] ml-6">Contatos Realizados</h4>
             {myHistory.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-[2rem] border border-gray-100 flex justify-between items-center group shadow-sm">
                  <div className="flex-1">
                    <p className="font-black uppercase italic text-sm text-slate-700">{item.lead?.nome}</p>
                    <div className="flex items-center gap-2">
                      {/* Fix: use the correct locale from named export to avoid FormatDistanceOptions type error */}
                      <span className="text-[9px] font-bold uppercase text-gray-400">{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: ptBR })}</span>
                      <span className="text-[8px] font-black uppercase text-sky-300">Base: {item.lead?.base}</span>
                    </div>
                  </div>
                  <button onClick={() => { setActive(item.lead!); setCarrier(true); }} className="p-4 bg-gray-50 text-gray-400 rounded-2xl hover:bg-sky-600 hover:text-white transition-all"><RotateCcw className="w-4 h-4" /></button>
                </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};
