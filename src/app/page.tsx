'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchFinanceiro } from "@/lib/api";
import GraficoEvolucao from "@/components/GraficoEvolucao";
import { DashboardData } from "@/types/financeiro";

const ACESSO_RESTRITO = "SKY2024";

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'filtros'>('home');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isAutorizado, setIsAutorizado] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');

  useEffect(() => {
    setMounted(true);
    if (localStorage.getItem('sky_auth') === 'true') setIsAutorizado(true);
    async function carregar() {
      try {
        const res = await fetchFinanceiro();
        setData(res);
      } finally { setCarregando(false); }
    }
    carregar();
  }, []);

  const garantirNumero = (v: any) => {
    if (typeof v === 'number') return v;
    const n = parseFloat(String(v || 0).replace(/[R$\s.]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  // CÁLCULOS DA PÁGINA PRINCIPAL (KPIs solicitados)
  const statsHome = useMemo(() => {
    if (!data) return null;

    // 1. Despesas Realizadas (ignora CDB e Aplicação)
    const despesasRealizadas = data.despesas.reduce((acc, item) => {
      const desc = String(item.descricao || "").toUpperCase();
      const tipo = String(item.tipo || "").toUpperCase();
      if (desc.includes("CDB BANCO BTG PACTUAL") || tipo.includes("APLICAÇÃO")) return acc;
      return acc + garantirNumero(item.valor);
    }, 0);

    // 2. Valor Aplicado (apenas CDB ou Aplicação)
    const valorAplicado = data.despesas.reduce((acc, item) => {
      const desc = String(item.descricao || "").toUpperCase();
      const tipo = String(item.tipo || "").toUpperCase();
      if (desc.includes("CDB BANCO BTG PACTUAL") || tipo.includes("APLICAÇÃO")) {
        return acc + garantirNumero(item.valor);
      }
      return acc;
    }, 0);

    // 3. Depósitos (ignora Resgate)
    const totalDepositos = data.depositos.reduce((acc, item) => {
      if (String(item.descricao || "").toUpperCase().includes("RESGATE DA APLICAÇÃO")) return acc;
      return acc + garantirNumero(item.valor);
    }, 0);

    // 4. Resgates (apenas Resgate)
    const totalResgates = data.depositos.reduce((acc, item) => {
      if (String(item.descricao || "").toUpperCase().includes("RESGATE DA APLICAÇÃO")) {
        return acc + garantirNumero(item.valor);
      }
      return acc;
    }, 0);

    return { despesasRealizadas, valorAplicado, totalDepositos, totalResgates };
  }, [data]);

  // Lógica da aba de Filtros (Gráfico e Busca)
  const filtered = useMemo(() => {
    if (!data || activeTab !== 'filtros') return null;
    const termo = busca.toLowerCase().trim();
    const dep = data.depositos.filter(i => `${i.descricao} ${i.sala} ${i.data}`.toLowerCase().includes(termo));
    const desp = data.despesas.filter(i => `${i.descricao} ${i.data}`.toLowerCase().includes(termo));
    
    // Agrupamento para o gráfico
    const graficoMap: Record<string, number> = {};
    dep.forEach(i => {
      const p = String(i.data).split(/[/-]/);
      if (p.length >= 2) {
        const chave = `${p[1].padStart(2,'0')}/${p[2]?.slice(-2) || '26'}`;
        graficoMap[chave] = (graficoMap[chave] || 0) + garantirNumero(i.valor);
      }
    });

    return {
      depositos: dep,
      despesas: desp,
      grafico: Object.keys(graficoMap).map(m => ({ mes: m, valor: graficoMap[m] })).sort((a,b) => a.mes.localeCompare(b.mes)),
      resumo: {
        totalEntradas: dep.reduce((a,c) => a + garantirNumero(c.valor), 0),
        totalSaidas: desp.reduce((a,c) => a + garantirNumero(c.valor), 0)
      }
    };
  }, [data, busca, activeTab]);

  if (!mounted || carregando) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-bold">SKY APP...</div>;

  if (!isAutorizado) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <form onSubmit={(e) => { e.preventDefault(); if (senhaInput.toUpperCase() === ACESSO_RESTRITO) { setIsAutorizado(true); localStorage.setItem('sky_auth', 'true'); } }} className="bg-slate-900 p-8 rounded-3xl border border-slate-800 w-full max-w-sm">
          <h1 className="text-4xl font-black italic text-blue-500 text-center mb-8">SKY</h1>
          <input type="password" placeholder="CHAVE DE ACESSO" className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-white text-center mb-4" value={senhaInput} onChange={e => setSenhaInput(e.target.value)} />
          <button className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold uppercase">Entrar</button>
        </form>
      </div>
    );
  }

  const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <main className="min-h-screen bg-slate-50 pb-24">
      {/* CONTEÚDO DA PÁGINA PRINCIPAL */}
      {activeTab === 'home' && (
        <div className="p-6 max-w-lg mx-auto space-y-8">
          <header className="text-center py-8">
            <h1 className="text-5xl font-black italic tracking-tighter text-slate-900">SKY</h1>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Construtora & Administradora</p>
          </header>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Despesas Realizadas</p>
              <p className="text-3xl font-black text-slate-900">{fmt(statsHome?.despesasRealizadas || 0)}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-medium">Exceto Aplicações e CDB BTG</p>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Valor Aplicado</p>
              <p className="text-3xl font-black text-slate-900">{fmt(statsHome?.valorAplicado || 0)}</p>
              <p className="text-[10px] text-slate-400 mt-2 font-medium">CDB BTG e Aplicações</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[9px] font-black text-green-600 uppercase tracking-widest">Depósitos</p>
                <p className="text-lg font-black text-slate-900 mt-1">{fmt(statsHome?.totalDepositos || 0)}</p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Resgates</p>
                <p className="text-lg font-black text-slate-900 mt-1">{fmt(statsHome?.totalResgates || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA PÁGINA DE EXPLORAÇÃO (ANTIGA) */}
      {activeTab === 'filtros' && (
        <div className="p-4 max-w-6xl mx-auto space-y-6">
          <div className="sticky top-4 z-30">
            <input 
              type="text" 
              placeholder="Pesquisar sala ou descrição..." 
              className="w-full p-5 rounded-2xl shadow-2xl border-none ring-2 ring-white focus:ring-blue-500 outline-none text-slate-700"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-green-500">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Aportes</p>
              <p className="text-xl font-black text-slate-900">{fmt(filtered?.resumo.totalEntradas || 0)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-red-500">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Custos</p>
              <p className="text-xl font-black text-slate-900">{fmt(filtered?.resumo.totalSaidas || 0)}</p>
            </div>
          </div>

          <GraficoEvolucao key={`chart-${busca}`} dados={filtered?.grafico || []} />

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
             <div className="p-4 bg-slate-50 border-b font-bold text-[10px] text-slate-500 uppercase">Lançamentos ({filtered?.depositos.length})</div>
             <div className="divide-y max-h-[300px] overflow-y-auto">
                {filtered?.depositos.slice(0,30).map((item, i) => (
                  <div key={i} className="p-4 flex justify-between items-center text-sm">
                    <span className="font-medium truncate max-w-[60%]">{String(item.descricao)}</span>
                    <span className="font-bold text-green-600">+{fmt(garantirNumero(item.valor))}</span>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* BARRA DE NAVEGAÇÃO INFERIOR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 flex justify-around items-center z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'home' ? 'text-blue-600' : 'text-slate-300'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1-1 0 001 1h3m10-11l2 2m-2-2v10a1-1 0 01-1 1h-3m-6 0a1-1 0 001-1v-4a1-1 0 011-1h2a1-1 0 011 1v4a1-1 0 001 1m-6 0h6" /></svg>
          <span className="text-[10px] font-bold uppercase tracking-widest">Início</span>
        </button>
        
        <button 
          onClick={() => setActiveTab('filtros')}
          className={`flex flex-col items-center space-y-1 transition-colors ${activeTab === 'filtros' ? 'text-blue-600' : 'text-slate-300'}`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <span className="text-[10px] font-bold uppercase tracking-widest">Explorar</span>
        </button>
      </nav>
    </main>
  );
}