import { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FlaskConical as Flask, CheckCircle2 as Check, BarChart3 as Chart, Settings, 
  Clock, AlertTriangle, ChevronRight, LogOut, 
  User, Activity, Play, Send,
  RefreshCw, Beaker, FileText, QrCode
} from 'lucide-react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { API_URL, SOCKET_URL } from '../utils/config';

type TestStatus = 'payment_pending' | 'payment_confirmed' | 'accepted' | 'in_progress' | 'completed';

interface LabOrder {
  id: string;
  patient_id: string;
  doctor_name: string;
  test_type: string;
  test_category: string;
  priority: 'urgent' | 'routine';
  status: TestStatus;
  payment_status: 'pending' | 'confirmed';
  ordered_at: string;
  queue_position: number;
  notes: string;
  patients: {
    name: string;
    vela_id: string;
    age: number;
    gender: string;
    blood_group: string;
    allergies: string[];
    atlas_analysis: string;
    atlas_confidence: string;
  };
}

export default function LabController() {
  const socket = useMemo(() => io(SOCKET_URL), []);
  const [activeTab, setActiveTab] = useState<'queue' | 'completed' | 'stats' | 'settings'>('queue');
  const [queue, setQueue] = useState<LabOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [filter, setFilter] = useState<'all' | 'payment_pending' | 'accepted' | 'in_progress'>('all');
  
  // Report Form State
  const [template, setTemplate] = useState<any>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [labNotes, setLabNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/lab/orders`);
      const data = await res.json();
      if (data.status === 'success') {
        setQueue(data.orders);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      // Loading state removed
    }
  }, []);

  useEffect(() => {
    fetchData();

    socket.on('payment_confirmed', (data) => {
      toast.success(`Payment confirmed for ${data.patient_name}`);
      fetchData();
    });

    socket.on('test_ordered', (data) => {
      toast(`New test ordered: ${data.tests.join(', ')}`, {
        icon: '🔬',
        style: { background: '#0C0C0B', color: '#fff', border: '1px solid #C8B89A' }
      });
      fetchData();
    });

    return () => {
      socket.off('payment_confirmed');
      socket.off('test_ordered');
    };
  }, [fetchData, socket]);

  const loadTemplate = async (testType: string) => {
    try {
      const res = await fetch(`${API_URL}/api/lab/template/${testType}`);
      const data = await res.json();
      setTemplate(data);
      
      const initialValues: Record<string, any> = {};
      data.fields.forEach((f: any) => {
        initialValues[f.name] = f.text_field ? '' : undefined;
      });
      setFormValues(initialValues);
    } catch (err) {
      toast.error('Failed to load template');
    }
  };

  useEffect(() => {
    if (selectedOrder?.status === 'in_progress') {
      loadTemplate(selectedOrder.test_type);
    } else {
      setTemplate(null);
    }
  }, [selectedOrder]);

  const handleAction = async (action: 'accept' | 'start') => {
    if (!selectedOrder) return;
    try {
      const res = await fetch(`${API_URL}/api/lab/orders/${selectedOrder.id}/${action}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.status === 'success') {
        toast.success(`Test ${action}ed`);
        fetchData();
        setSelectedOrder(data.order);
      }
    } catch (err) {
      toast.error(`Failed to ${action} test`);
    }
  };

  const submitReport = async () => {
    if (!selectedOrder || !template) return;
    setIsSubmitting(true);
    
    // Check if any abnormal/critical values
    const normalRanges: Record<string, any> = {};
    template.fields.forEach((f: any) => {
      if (!f.text_field) {
        normalRanges[f.name] = { min: f.normal_min, max: f.normal_max };
      }
    });

    try {
      const res = await fetch(`${API_URL}/api/lab/reports/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_order_id: selectedOrder.id,
          patient_id: selectedOrder.patient_id,
          test_type: selectedOrder.test_type,
          test_category: selectedOrder.test_category,
          values: formValues,
          normal_ranges: normalRanges,
          lab_notes: labNotes,
          doctor_name: 'Lab Controller Alpha'
        })
      });
      
      const data = await res.json();
      if (data.status === 'success') {
        toast.success('Report submitted successfully!');
        setSelectedOrder(null);
        fetchData();
      }
    } catch (err) {
      toast.error('Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQueue = queue.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  return (
    <div className="min-h-screen bg-[#0C0C0B] text-white flex flex-col font-sans">
      
      {/* NAVBAR */}
      <nav className="h-[56px] border-b border-white/10 flex items-center justify-between px-6 bg-[#0C0C0B]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/vela-icon.png" alt="Vela" style={{ height: 28, width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            <span className="text-xl font-bold tracking-tight text-[#C8B89A]">VELA</span>
          </div>
          <div className="h-4 w-[1px] bg-white/20"></div>
          <span className="text-sm font-medium text-white/90">Lab Controller</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-white/60">
            <Clock size={14} />
            <span className="text-xs font-mono">{new Date().toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="relative">
                <Activity size={20} className="text-white/60" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#C8B89A] text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                  {queue.length}
                </span>
             </div>
             <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium hover:bg-white/10 transition-colors">
               <LogOut size={14} />
               Sign Out
             </button>
          </div>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-[56px] border-r border-white/5 flex flex-col items-center py-6 gap-6 bg-[#0C0C0B]">
          <button 
            onClick={() => setActiveTab('queue')}
            className={`p-2 rounded-xl transition-all ${activeTab === 'queue' ? 'bg-[#C8B89A] text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Flask size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('completed')}
            className={`p-2 rounded-xl transition-all ${activeTab === 'completed' ? 'bg-[#C8B89A] text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Check size={20} />
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={`p-2 rounded-xl transition-all ${activeTab === 'stats' ? 'bg-[#C8B89A] text-black' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
          >
            <Chart size={20} />
          </button>
          <div className="mt-auto">
            <button className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all">
              <Settings size={20} />
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 flex overflow-hidden">
          {activeTab === 'queue' ? (
            <>
              {/* QUEUE LIST */}
              <div className="w-[320px] border-r border-white/5 flex flex-col bg-[#0C0C0B]">
                <div className="p-6">
                  <h2 className="text-2xl font-serif text-white mb-1">Test Queue</h2>
                  <div className="text-[11px] font-mono text-[#C8B89A] uppercase tracking-widest mb-4">
                    {queue.length} Tests Pending
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    {['all', 'accepted', 'in_progress'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilter(t as any)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all ${filter === t ? 'bg-[#C8B89A] text-black border-[#C8B89A]' : 'bg-transparent text-white/40 border-white/10 hover:border-white/20'}`}
                      >
                        {t === 'in_progress' ? 'Running' : t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
                  {filteredQueue.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer group ${selectedOrder?.id === order.id ? 'bg-white/10 border-[#C8B89A]/50' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-[#C8B89A] flex items-center justify-center text-black text-[10px] font-bold font-mono">
                             #{order.queue_position || '?'}
                           </div>
                           <span className="text-xs font-semibold">{order.patients?.name}</span>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${order.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/40'}`}>
                          {order.priority.toUpperCase()}
                        </span>
                      </div>
                      
                      <div className="space-y-1 mb-3">
                        <div className="text-[13px] text-white/90 flex items-center gap-2">
                          <Beaker size={12} className="text-[#C8B89A]" />
                          {order.test_type}
                        </div>
                        <div className="text-[10px] font-mono text-[#C8B89A]/60">{order.patients?.vela_id}</div>
                        <div className="text-[11px] text-white/40">Dr. {order.doctor_name}</div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${order.status === 'in_progress' ? 'bg-blue-500 animate-pulse' : order.status === 'accepted' ? 'bg-teal-500' : 'bg-amber-500'}`}></div>
                          <span className="text-[10px] font-medium text-white/60 capitalize">
                            {order.status.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-white/20">
                          {formatDistanceToNow(new Date(order.ordered_at))} ago
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ACTION PANEL */}
              <div className="flex-1 bg-[#090908] overflow-y-auto p-12">
                {!selectedOrder ? (
                  <div className="h-full flex flex-col items-center justify-center text-white/20 gap-4">
                    <Flask size={64} strokeWidth={1} />
                    <p className="text-lg font-light">Select a test from the queue to begin</p>
                  </div>
                ) : (
                  <div className="max-w-4xl mx-auto space-y-12">
                    {/* PATIENT HEADER */}
                    <div className="relative p-8 rounded-3xl overflow-hidden bg-gradient-to-br from-teal-900/20 to-blue-900/20 border border-white/10 ring-1 ring-white/5">
                      <div className="absolute top-0 right-0 p-8 text-white/5">
                        <QrCode size={120} />
                      </div>
                      <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                         <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                            <User size={40} className="text-white/60" />
                         </div>
                         <div className="space-y-4 flex-1">
                            <div>
                               <h1 className="text-4xl font-serif tracking-tight mb-2">{selectedOrder.patients?.name}</h1>
                               <div className="flex flex-wrap gap-4 text-sm font-mono text-white/40">
                                  <span className="text-[#C8B89A]">{selectedOrder.patients?.vela_id}</span>
                                  <span>{selectedOrder.patients?.age}Y • {selectedOrder.patients?.gender}</span>
                                  <span>Blood: {selectedOrder.patients?.blood_group}</span>
                               </div>
                            </div>
                            
                            <div className="flex gap-2">
                               {selectedOrder.patients?.allergies?.map((a: string) => (
                                 <span key={a} className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-medium">
                                   {a}
                                 </span>
                               ))}
                            </div>

                            {selectedOrder.patients?.atlas_analysis && (
                              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
                                 <div className="flex items-center gap-2 text-[10px] font-bold text-[#C8B89A] uppercase tracking-widest">
                                    <Activity size={12} />
                                    Atlas Clinical Insight
                                 </div>
                                 <p className="text-sm text-white/70 leading-relaxed italic">
                                   "{selectedOrder.patients?.atlas_analysis}"
                                 </p>
                              </div>
                            )}
                         </div>
                      </div>
                    </div>

                    {/* TEST DETAILS */}
                    <div className="space-y-8">
                       <div className="flex items-end justify-between border-b border-white/10 pb-6">
                          <div>
                             <div className="text-[12px] font-mono text-[#C8B89A] uppercase tracking-[0.2em] mb-2">{selectedOrder.test_category}</div>
                             <h2 className="text-5xl font-serif leading-tight">{selectedOrder.test_type}</h2>
                          </div>
                          <div className="text-right space-y-2">
                             <div className="text-sm text-white/40 font-mono">
                                Ordered by Dr. {selectedOrder.doctor_name}
                             </div>
                             <div className={`inline-flex px-4 py-1.5 rounded-full text-xs font-bold border ${selectedOrder.priority === 'urgent' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 text-white/40 border-white/10'}`}>
                                {selectedOrder.priority.toUpperCase()} PRIORITY
                             </div>
                          </div>
                       </div>

                       {selectedOrder.notes && (
                         <div className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                           <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Orders & Notes</h4>
                           <p className="text-white/80 leading-relaxed font-light">{selectedOrder.notes}</p>
                         </div>
                       )}

                       {/* LIFECYCLE ACTIONS */}
                       <div className="flex gap-4">
                          {selectedOrder.status === 'payment_confirmed' && (
                            <button 
                              onClick={() => handleAction('accept')}
                              className="flex-1 group relative h-16 bg-teal-500 text-black font-bold rounded-2xl overflow-hidden active:scale-[0.98] transition-all"
                            >
                               <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                               <div className="relative flex items-center justify-center gap-3">
                                  <Check size={24} />
                                  <span>Accept Case for Processing</span>
                               </div>
                            </button>
                          )}
                          {selectedOrder.status === 'accepted' && (
                            <button 
                              onClick={() => handleAction('start')}
                              className="flex-1 group relative h-16 bg-blue-600 text-white font-bold rounded-2xl overflow-hidden active:scale-[0.98] transition-all"
                            >
                               <div className="absolute inset-0 bg-black/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                               <div className="relative flex items-center justify-center gap-3">
                                  <Play size={24} fill="currentColor" />
                                  <span>Initiate Diagnostic Cycle</span>
                               </div>
                            </button>
                          )}
                       </div>

                       {/* REPORT FORM */}
                       {selectedOrder.status === 'in_progress' && (
                         <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center justify-between">
                               <h3 className="text-3xl font-serif">Diagnostic Results Entry</h3>
                               <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
                                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
                                  <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">Session Active</span>
                               </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                               {template?.fields.map((field: any) => {
                                 const val = formValues[field.name];
                                 const isAbnormal = !field.text_field && val != null && (val < field.normal_min || val > field.normal_max);
                                 const isCritical = !field.text_field && val != null && (
                                   field.normal_max - field.normal_min > 0 && 
                                   (Math.abs(val - (val < field.normal_min ? field.normal_min : field.normal_max)) / (field.normal_max - field.normal_min) * 100) > 50
                                 );

                                 return (
                                   <div key={field.name} className="space-y-4">
                                      <div className="flex justify-between items-end">
                                         <label className="text-sm font-medium text-white/60">{field.name}</label>
                                         {!field.text_field && (
                                           <span className="text-[10px] font-mono text-white/30">
                                             Normal: {field.normal_min} - {field.normal_max} {field.unit}
                                           </span>
                                         )}
                                      </div>
                                      
                                      <div className="relative group">
                                         <input 
                                           type={field.text_field ? "text" : "number"}
                                           placeholder={field.text_field ? "Details..." : "0.00"}
                                           value={val || ''}
                                           onChange={(e) => setFormValues(prev => ({ ...prev, [field.name]: field.text_field ? e.target.value : parseFloat(e.target.value) }))}
                                           className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-xl outline-none transition-all focus:bg-white/10 focus:ring-1 ${isCritical ? 'border-red-500 focus:ring-red-500 shadow-[0_0_15px_-3px_rgba(239,68,68,0.3)]' : isAbnormal ? 'border-amber-500 focus:ring-amber-500' : 'focus:ring-[#C8B89A]'}`}
                                         />
                                         {!field.text_field && val != null && (
                                           <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                              {isCritical ? (
                                                <div className="flex items-center gap-1.5 text-red-500">
                                                   <AlertTriangle size={16} />
                                                   <span className="text-[10px] font-black uppercase tracking-tighter">Critical</span>
                                                </div>
                                              ) : isAbnormal ? (
                                                <div className="flex items-center gap-1.5 text-amber-500">
                                                   <AlertTriangle size={16} />
                                                   <span className="text-[10px] font-black uppercase tracking-tighter">Abnormal</span>
                                                </div>
                                              ) : (
                                                <Check size={18} className="text-teal-500" />
                                              )}
                                           </div>
                                         )}
                                      </div>
                                   </div>
                                 );
                               })}

                               <div className="md:col-span-2 space-y-4">
                                  <label className="text-sm font-medium text-white/60">Lab Technician Observations</label>
                                  <textarea 
                                    rows={4}
                                    value={labNotes}
                                    onChange={(e) => setLabNotes(e.target.value)}
                                    placeholder="Add any visual observations or equipment flags..."
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white/80 outline-none focus:bg-white/10 transition-all focus:ring-1 focus:ring-[#C8B89A]"
                                  />
                               </div>
                            </div>

                            {/* SUBMIT BUTTON */}
                            <div className="pt-8">
                               <button 
                                 disabled={isSubmitting}
                                 onClick={submitReport}
                                 className="w-full h-20 bg-[#C8B89A] text-black font-black rounded-3xl flex items-center justify-center gap-4 text-xl active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-2xl shadow-[#C8B89A]/10"
                                >
                                  {isSubmitting ? (
                                    <>
                                      <RefreshCw size={24} className="animate-spin" />
                                      Synthesizing Analysis...
                                    </>
                                  ) : (
                                    <>
                                      <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                      Commit Final Report
                                    </>
                                  )}
                               </button>
                               <p className="text-center text-white/20 text-[10px] font-mono mt-4 uppercase tracking-[0.3em]">
                                 Authorized Submission Only • Atlas AI Co-Signing Enabled
                               </p>
                            </div>
                         </div>
                       )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : activeTab === 'completed' ? (
             <div className="flex-1 p-12 bg-[#090908] overflow-y-auto">
                <div className="max-w-5xl mx-auto space-y-8">
                   <h2 className="text-4xl font-serif">Processed Cases</h2>
                   <div className="grid grid-cols-1 gap-4">
                      {queue.filter(o => o.status === 'completed').map(report => (
                        <div key={report.id} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center justify-between group hover:bg-white/10 transition-all">
                           <div className="flex items-center gap-6">
                              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-[#C8B89A]">
                                 <FileText size={24} />
                              </div>
                              <div>
                                 <h4 className="text-lg font-medium">{report.patients?.name}</h4>
                                 <div className="text-sm text-white/40">{report.test_type} • Completed 2h ago</div>
                              </div>
                           </div>
                           <div className="flex items-center gap-8">
                              <div className="text-right">
                                 <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mb-1">Risk Profile</div>
                                 <div className="text-xl font-bold text-teal-400">Low Risk</div>
                              </div>
                              <button className="p-3 rounded-full bg-white/5 border border-white/10 hover:bg-[#C8B89A] hover:text-black transition-all">
                                 <ChevronRight size={20} />
                              </button>
                           </div>
                        </div>
                      ))}
                      {queue.filter(o => o.status === 'completed').length === 0 && (
                        <div className="text-center py-20 text-white/20 font-light italic">No cases completed in this cycle yet.</div>
                      )}
                   </div>
                </div>
             </div>
          ) : (
            <div className="flex-1 p-12 bg-[#090908] flex items-center justify-center">
               <div className="text-center space-y-4">
                  <Chart size={48} className="text-[#C8B89A] mx-auto opacity-20" />
                  <p className="text-white/40 font-light">Analytics engine warming up...</p>
               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
