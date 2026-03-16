'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchFinanceiro } from "@/lib/api";
import { DashboardData } from "@/types/financeiro";

const ACESSO_RESTRITO = "47881523000158";

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'explorar'>('home');
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

  // --- LÓGICA DE BUSCA E TRATAMENTO (BYPASS DE TIPAGEM PARA BUILD) ---

  const buscarValor = (termo: string) => {
    const dash = (data as any)?.dashboard;
    if (!dash) return "0";
    
    const normalizar = (t: string) => 
      String(t || "").toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");

    const alvo = normalizar(termo);
    const chave = Object.keys(dash).find(k => normalizar(k).includes(alvo));
    
    return chave ? dash[chave] : "0";
  };

  const limparNumero = (v: any) => {
    if (typeof v === 'number') return v;
    const s = String(v || "0")
      .replace(/R\$/g, '')
      .replace(/%/g, '')
      .replace(/\s/g, '')
      .replace(/\.(?=[^,]*$)/g, '') // Remove ponto de milhar
      .replace(/\./g, '')           // Remove pontos residuais
      .replace(',', '.');           // Vírgula para ponto
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const fmtReal = (label: string) => {
    const v = buscarValor(label);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(limparNumero(v));
  };

  const fmtCub = (label: string) => {
    const v = buscarValor(label);
    return limparNumero(v).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " CUB";
  };

  if (!mounted || carregando) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-blue-500 font-black tracking-widest uppercase">
      Sky App • Sincronizando
    </div>
  );

  if (!isAutorizado) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <form onSubmit={(e) => { 
          e.preventDefault(); 
          if (senhaInput === ACESSO_RESTRITO) { 
            setIsAutorizado(true); 
            localStorage.setItem('sky_auth', 'true'); 
          } 
        }} className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 w-full max-w-sm shadow-2xl">
          <h1 className="text-5xl font-black italic text-blue-500 text-center mb-10 tracking-tighter">SKY</h1>
          <input 
            type="text" 
            inputMode="numeric" 
            placeholder="CNPJ DE ACESSO" 
            className="w-full p-5 rounded-2xl bg-slate-800 border border-slate-700 text-white text-center mb-4 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
            value={senhaInput} 
            onChange={e => setSenhaInput(e.target.value)} 
          />
          <button className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-transform">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-32">
      {activeTab === 'home' && (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-10 animate-in fade-in duration-700">
          <header className="text-center py-4">
            <h1 className="text-7xl font-black italic tracking-tighter text-slate-900 uppercase">Sky</h1>
            <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.5em] mt-3">Atto Porto SPE</p>
          </header>

          {/* FINANCEIRO REAIS */}
          <section className="space-y-4">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Financeiro em Reais</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card label="VGV do Sky" value={fmtReal("vgvdosky")} />
              <Card label="Total a receber" value={fmtReal("totalareceberreais")} />
              <Card label="Depósitos realizados" value={fmtReal("depositosrealizadosreais")} color="text-green-600" />
              <Card label="Unidades disponíveis" value={fmtReal("unidadesdisponiveisreais")} />
              <Card label="Saldo Investimento BTG" value={fmtReal("saldoeminvestimento")} />
              <Card label="Total Rendimentos" value={fmtReal("totalrendimentos")} color="text-green-600" />
              <Card label="Despesas totais" value={fmtReal("totaldedespesasreais")} color="text-red-600" />
            </div>
          </section>

          {/* INDICADORES CUB */}
          <section className="space-y-4">
            <div className="flex justify-between items-center px-4">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Indicadores CUB</h2>
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded">ATUAL: {fmtReal("cubatual")}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card label="Previsto Total" value={fmtCub("totalprevistoparaosky")} />
              <Card label="Total dos Contratos" value={fmtCub("totaldoscontratoscubs")} />
              <Card label="Total a Receber" value={fmtCub("totalarecebercubs")} />
              <Card label="Depósitos realizados" value={fmtCub("depositosrealizadoscubs")} />
            </div>
          </section>

          {/* PROGRESSO */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 flex flex-col items-center justify-center shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Integralizado</p>
              <p className="text-6xl font-black text-blue-600">
                {limparNumero(buscarValor("percentualintegralizado")).toFixed(2)}%
              </p>
            </div>
            <div className="space-y-3">
              <Card label="Total Aplicado" value={fmtReal("totalaplicadoreais")} />
              <Card label="Total Resgatado" value={fmtReal("totalresgatedoreais")} />
              <Card label="Saldo Orçamento" value={fmtReal("saldoorcamento")} />
            </div>
          </section>

          <button 
            onClick={() => { localStorage.removeItem('sky_auth'); window.location.reload(); }} 
            className="w-full text-[9px] font-black text-slate-300 uppercase py-10 tracking-[0.3em]"
          >
            Encerrar Sessão
          </button>
        </div>
      )}

      {/* ABA EXPLORAR - SIMPLIFICADA PARA TESTE */}
      {activeTab === 'explorar' && (
        <div className="p-10 space-y-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white rounded-[2rem] border p-6">
             <h2 className="font-black uppercase text-xs text-slate-400 mb-4">Lançamentos Recentes</h2>
             <div className="space-y-4 max-h-[500px] overflow-auto">
               {data?.depositos.slice(0, 20).map((item, i) => (
                 <div key={i} className="flex justify-between items-center border-b pb-2">
                   <span className="text-sm font-bold truncate pr-4">{item.descricao}</span>
                   <span className="text-sm font-black text-green-600">{fmtReal(String(item.valor))}</span>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* NAVEGAÇÃO INFERIOR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-12 py-5 flex justify-around items-center z-50">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'home' ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011-1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
          <span className="text-[9px] font-black uppercase tracking-tighter">Início</span>
        </button>
        <button onClick={() => setActiveTab('explorar')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'explorar' ? 'text-blue-600 scale-110' : 'text-slate-300'}`}>
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
          <span className="text-[9px] font-black uppercase tracking-tighter">Explorar</span>
        </button>
      </nav>
    </main>
  );
}

function Card({ label, value, color = "text-slate-900" }: { label: string, value: string, color?: string }) {
  return (
    <div className="bg-white p-5 rounded-[1.8rem] border border-slate-100 flex justify-between items-center shadow-sm">
      <p className="text-[10px] font-bold text-slate-400 uppercase pr-4 leading-tight">{label}</p>
      <p className={`text-sm font-black text-right ${color} whitespace-nowrap`}>{value}</p>
    </div>
  );
}