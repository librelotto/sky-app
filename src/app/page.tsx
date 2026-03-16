'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchFinanceiro } from "@/lib/api";
import { DashboardData } from "@/types/financeiro";
import GraficoEvolucao from "@/components/GraficoEvolucao";

const ACESSO_RESTRITO = "47881523000158";

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'inicio' | 'depositos' | 'despesas'>('inicio');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isAutorizado, setIsAutorizado] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && localStorage.getItem('sky_auth') === 'true') {
      setIsAutorizado(true);
    }
    async function carregar() {
      try {
        const res = await fetchFinanceiro();
        setData(res);
      } catch (e) { 
        console.error("Erro ao carregar dados:", e); 
      } finally { 
        setCarregando(false); 
      }
    }
    carregar();
  }, []);

  // --- HELPERS DE TRATAMENTO ---

  const limparNumero = (v: any) => {
    if (typeof v === 'number') return v;
    if (!v || v === "---") return 0;
    const s = String(v).replace(/R\$/g, '').replace(/%/g, '').replace(/\s/g, '').replace(/\.(?=[^,]*$)/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const getItemValue = (item: any, prop: string) => {
    const key = Object.keys(item).find(k => k.toLowerCase().trim() === prop.toLowerCase());
    return key ? item[key] : null;
  };

  const getSpecificLink = (item: any, type: 'nota' | 'pagamento') => {
    const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
    const key = Object.keys(item).find(k => {
      const kNorm = normalizar(k);
      if (type === 'nota') return kNorm.includes('link') && kNorm.includes('nota');
      if (type === 'pagamento') return kNorm.includes('link') && kNorm.includes('pagamento');
      return false;
    });
    const value = key ? item[key] : null;
    return (value && String(value).startsWith('http')) ? value : null;
  };

  const buscarValorDashboard = (termo: string) => {
    const dash = (data as any)?.dashboard;
    if (!dash) return "0";
    const normalizar = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const alvo = normalizar(termo);
    const chave = Object.keys(dash).find(k => normalizar(k).includes(alvo));
    return chave ? dash[chave] : "0";
  };

  const fmtReal = (valor: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(limparNumero(valor));

  // --- LÓGICA DE FILTRO E GRÁFICO ---

  const filteredData = useMemo(() => {
    if (!data) return { lista: [], grafico: [] };
    const base = activeTab === 'depositos' ? data.depositos : data.despesas;
    const termo = busca.toLowerCase().trim();

    const lista = base
      .filter(item => {
        const desc = String(getItemValue(item, 'descricao') || "").toLowerCase();
        const sala = String(getItemValue(item, 'sala') || "").toLowerCase();
        return desc.includes(termo) || sala.includes(termo);
      })
      .sort((a, b) => {
        const parseData = (d: any) => {
          if (!d || typeof d !== 'string') return 0;
          const p = d.split(/[/-]/);
          return new Date(Number(p[2]?.length === 2 ? `20${p[2]}` : p[2]), Number(p[1]) - 1, Number(p[0])).getTime();
        };
        return parseData(getItemValue(b, 'data')) - parseData(getItemValue(a, 'data'));
      });

    const graficoMap: Record<string, number> = {};
    lista.forEach(item => {
      const dataStr = getItemValue(item, 'data');
      const p = dataStr?.split(/[/-]/);
      if (p && p.length >= 2) {
        const chave = `${p[1].padStart(2, '0')}/${p[2].slice(-2)}`;
        graficoMap[chave] = (graficoMap[chave] || 0) + limparNumero(getItemValue(item, 'valor'));
      }
    });

    return { 
      lista, 
      grafico: Object.keys(graficoMap).map(mes => ({ mes, valor: graficoMap[mes] })).sort((a, b) => a.mes.localeCompare(b.mes)) 
    };
  }, [data, activeTab, busca]);

  if (!mounted || carregando) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black tracking-widest uppercase">
      Sky App • Sincronizando
    </div>
  );

  if (!isAutorizado) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
        <form onSubmit={(e) => { e.preventDefault(); if (senhaInput === ACESSO_RESTRITO) { setIsAutorizado(true); localStorage.setItem('sky_auth', 'true'); } }} className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 w-full max-w-sm shadow-2xl">
          <h1 className="text-4xl font-black italic text-blue-500 text-center mb-8 uppercase">Sky</h1>
          <input 
            type="text" 
            inputMode="numeric" 
            placeholder="CNPJ" 
            className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-center mb-4 font-bold outline-none focus:ring-2 focus:ring-blue-500 text-white" 
            value={senhaInput} 
            onChange={e => setSenhaInput(e.target.value)} 
          />
          <button className="w-full bg-blue-600 py-4 rounded-xl font-bold uppercase tracking-widest">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-32 font-sans">
      {activeTab === 'inicio' ? (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-in fade-in duration-700">
          <header className="text-center py-6">
            <h1 className="text-7xl font-black italic tracking-tighter text-slate-900 uppercase">Sky</h1>
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.5em] mt-3">Gestão Atto Porto SPE</p>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <Card label="VGV do Sky" value={fmtReal(buscarValorDashboard("vgvdosky"))} />
             <Card label="Total a receber" value={fmtReal(buscarValorDashboard("totalareceberreais"))} />
             <Card label="Depósitos realizados" value={fmtReal(buscarValorDashboard("depositosrealizadosreais"))} color="text-green-600" />
             <Card label="Despesas totais" value={fmtReal(buscarValorDashboard("totaldedespesasreais"))} color="text-red-600" />
             <Card label="Saldo Investimento BTG" value={fmtReal(buscarValorDashboard("saldoeminvestimento"))} />
             <Card label="Saldo Conta BTG" value={fmtReal(buscarValorDashboard("saldoemcontabtg"))} />
          </section>

          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 flex flex-col items-center justify-center shadow-sm">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest text-center">Integralizado</p>
            <p className="text-6xl font-black text-blue-600">{limparNumero(buscarValorDashboard("percentualintegralizado")).toFixed(2)}%</p>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
          <header className="text-center">
            <h2 className={`text-4xl font-black uppercase italic tracking-tighter ${activeTab === 'depositos' ? 'text-green-600' : 'text-red-500'}`}>
              {activeTab === 'depositos' ? 'Depósitos' : 'Despesas'}
            </h2>
          </header>

          <input 
            type="text" 
            placeholder={`Filtrar lançamentos...`} 
            className="w-full p-5 rounded-2xl shadow-2xl border-none ring-2 ring-white focus:ring-blue-600 outline-none text-lg transition-all text-slate-900 placeholder-slate-400" 
            value={busca} 
            onChange={e => setBusca(e.target.value)} 
          />

          <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <GraficoEvolucao dados={filteredData.grafico} />
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {filteredData.lista.map((item, i) => {
                const linkNota = getSpecificLink(item, 'nota');
                const linkPgto = getSpecificLink(item, 'pagamento');
                
                return (
                  <div key={i} className="p-5 flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="max-w-[55%]">
                      <p className="font-bold text-slate-800 text-sm leading-tight">{getItemValue(item, 'descricao')}</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-1 uppercase">
                        {getItemValue(item, 'sala') ? `Sala ${getItemValue(item, 'sala')} • ` : ''}{getItemValue(item, 'data')}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {linkNota && (
                        <a href={linkNota} target="_blank" rel="noopener noreferrer" title="Nota Fiscal"
                          className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-blue-600 hover:text-white transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </a>
                      )}
                      {linkPgto && (
                        <a href={linkPgto} target="_blank" rel="noopener noreferrer" title="Comprovante"
                          className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-green-600 hover:text-white transition-all">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </a>
                      )}
                      <p className={`font-black text-sm whitespace-nowrap ml-1 ${activeTab === 'depositos' ? 'text-green-600' : 'text-red-500'}`}>
                        {fmtReal(getItemValue(item, 'valor'))}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-6 py-5 flex justify-around items-center z-50 shadow-2xl">
        <TabButton active={activeTab === 'inicio'} onClick={() => {setActiveTab('inicio'); setBusca('');}} label="Início" icon="home" />
        <TabButton active={activeTab === 'depositos'} onClick={() => {setActiveTab('depositos'); setBusca('');}} label="Depósitos" icon="plus" color="text-green-600" />
        <TabButton active={activeTab === 'despesas'} onClick={() => {setActiveTab('despesas'); setBusca('');}} label="Despesas" icon="minus" color="text-red-500" />
      </nav>
    </main>
  );
}

function Card({ label, value, color = "text-slate-900" }: { label: string, value: string, color?: string }) {
  return (
    <div className="bg-white p-5 rounded-[1.8rem] border border-slate-100 flex justify-between items-center shadow-sm">
      <p className="text-[10px] font-bold text-slate-400 uppercase pr-4 leading-tight">{label}</p>
      <p className={`text-sm font-black text-right ${color}`}>{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, label, icon, color }: any) {
  const icons: any = {
    home: <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011-1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />,
    plus: <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />,
    minus: <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
  };
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? (color || 'text-blue-600') + ' scale-110' : 'text-slate-300'}`}>
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">{icons[icon]}</svg>
      <span className="text-[9px] font-black uppercase tracking-tighter">{label}</span>
    </button>
  );
}