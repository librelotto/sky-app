'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchFinanceiro } from "@/lib/api";
import { DashboardData } from "@/types/financeiro";
import GraficoEvolucao from "@/components/GraficoEvolucao";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const ACESSO_RESTRITO = "47881523000158";
const COLORS_IOS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF3B30', '#5856D6', '#FFCC00', '#8E8E93', '#6366f1', '#ec4899'];

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'inicio' | 'depositos' | 'despesas' | 'tipos'>('inicio');
  const [viewMode, setViewMode] = useState<'mes' | 'ano'>('mes'); 
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isAutorizado, setIsAutorizado] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');

  const [dataInicio, setDataInicio] = useState('2022-06-01');
  const [dataFim, setDataFim] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroOrcamento, setFiltroOrcamento] = useState('');

  useEffect(() => {
    setMounted(true);
    const hoje = new Date().toISOString().split('T')[0];
    setDataFim(hoje);

    if (typeof window !== 'undefined' && localStorage.getItem('sky_auth') === 'true') {
      setIsAutorizado(true);
    }

    async function carregar() {
      try {
        const res = await fetchFinanceiro();
        setData(res);
      } catch (e) { console.error(e); } finally { setCarregando(false); }
    }
    carregar();
  }, []);

  // --- HELPERS DE DADOS ---
  const getOrcValue = (item: any) => {
    if (!item) return "";
    const key = Object.keys(item).find(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('orc'));
    if (key && item[key]) return String(item[key]);
    const val = Object.values(item).find(v => typeof v === 'string' && /^\d+(\.\d+)?\s*-/.test(v.trim()));
    return val ? String(val) : "";
  };

  const getGenericValue = (item: any, alvo: string) => {
    if (!item) return "";
    const norm = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const key = Object.keys(item).find(k => norm(k).includes(norm(alvo)));
    return key ? item[key] : "";
  };

  const limparNumero = (v: any) => {
    if (typeof v === 'number') return v;
    const s = String(v || "0").replace(/R\$/g, '').replace(/%/g, '').replace(/\s/g, '').replace(/\.(?=[^,]*$)/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const converterDataBRparaISO = (dataBR: string) => {
    const parts = String(dataBR).split(/[/-]/);
    if (parts.length < 3) return new Date(0);
    const ano = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return new Date(Number(ano), Number(parts[1]) - 1, Number(parts[0]));
  };

  const fmtReal = (valor: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(limparNumero(valor));
  const fmtCub = (valor: any) => limparNumero(valor).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " CUB";

  const buscarValorDash = (termo: string) => {
    const dash = (data as any)?.dashboard;
    if (!dash) return "0";
    const normalizar = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
    const alvo = normalizar(termo);
    const chave = Object.keys(dash).find(k => normalizar(k).includes(alvo));
    return chave ? dash[chave] : "0";
  };

  // --- PROCESSAMENTO ---
  const options = useMemo(() => {
    if (!data) return { tipos: [], orcamentos: [] };
    const t = new Set<string>();
    const o = new Set<string>();
    data.despesas.forEach(i => {
      const vT = getGenericValue(i, 'tipo');
      const vO = getOrcValue(i);
      if (vT && vT !== "---") t.add(String(vT).trim());
      if (vO && vO !== "---") o.add(String(vO).trim());
    });
    return { 
      tipos: Array.from(t).sort(), 
      orcamentos: Array.from(o).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})) 
    };
  }, [data]);

  const processedData = useMemo(() => {
    if (!data) return { lista: [], grafico: [], pizza: [] };

    const baseListagem = activeTab === 'depositos' ? data.depositos : data.despesas;
    
    const lista = baseListagem
      .filter(i => {
        const dt = converterDataBRparaISO(String(getGenericValue(i, 'data')));
        const dIni = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
        const dFim = dataFim ? new Date(dataFim + 'T23:59:59') : null;
        if (dIni && dt < dIni) return false;
        if (dFim && dt > dFim) return false;
        if (activeTab === 'despesas') {
          if (filtroTipo && getGenericValue(i, 'tipo') !== filtroTipo) return false;
          if (filtroOrcamento && getOrcValue(i) !== filtroOrcamento) return false;
        }
        return String(getGenericValue(i, 'descricao')).toLowerCase().includes(busca.toLowerCase());
      })
      .sort((a, b) => converterDataBRparaISO(String(getGenericValue(b, 'data'))).getTime() - converterDataBRparaISO(String(getGenericValue(a, 'data'))).getTime());

    const graficoMap: Record<string, number> = {};
    lista.forEach(i => {
      const d = String(getGenericValue(i, 'data')).split(/[/-]/);
      if (d.length >= 3) {
        const chave = viewMode === 'mes' ? `${d[1]}/${d[2].slice(-2)}` : (d[2].length === 2 ? `20${d[2]}` : d[2]);
        graficoMap[chave] = (graficoMap[chave] || 0) + limparNumero(getGenericValue(i, 'valor'));
      }
    });

    const grafico = Object.keys(graficoMap).map(m => ({ mes: m, valor: graficoMap[m] }))
      .sort((a, b) => {
        const parseDate = (str: string) => {
            const [m, y] = str.split('/');
            return new Date(Number(`20${y}`), Number(m) - 1).getTime();
        };
        return viewMode === 'mes' ? parseDate(a.mes) - parseDate(b.mes) : Number(a.mes) - Number(b.mes);
      });

    const basePizza = data.despesas.filter(i => {
      const dt = converterDataBRparaISO(String(getGenericValue(i, 'data')));
      const dIni = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
      const dFim = dataFim ? new Date(dataFim + 'T23:59:59') : null;
      return !(dIni && dt < dIni) && !(dFim && dt > dFim);
    });

    const pizzaMap: Record<string, number> = {};
    basePizza.forEach(i => {
      const tipoOriginal = String(getGenericValue(i, 'tipo') || "Outros").trim();
      const tipoNorm = tipoOriginal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (tipoNorm !== 'aplicacao' && tipoNorm !== 'administracao' && tipoNorm !== "") {
        pizzaMap[tipoOriginal] = (pizzaMap[tipoOriginal] || 0) + limparNumero(getGenericValue(i, 'valor'));
      }
    });

    const totalPizza = Object.values(pizzaMap).reduce((a, b) => a + b, 0);
    const pizza = Object.keys(pizzaMap).map(name => ({
      name,
      value: pizzaMap[name],
      percent: totalPizza > 0 ? ((pizzaMap[name] / totalPizza) * 100).toFixed(1) : "0"
    })).sort((a, b) => b.value - a.value);

    return { lista, grafico, pizza };
  }, [data, activeTab, busca, viewMode, dataInicio, dataFim, filtroTipo, filtroOrcamento]);

  if (!mounted || carregando) return <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center font-bold text-[#007AFF]">Carregando Sky...</div>;

  return (
    <main className="min-h-screen bg-[#F2F2F7] text-black font-sans pb-32">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-black uppercase italic">Sky Dashboard</h1>
        <span className="text-[10px] font-bold bg-[#34C759]/10 text-[#34C759] px-2 py-1 rounded-full uppercase">Live</span>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-8">
        
        {/* ABA INICIO - RESTAURAÇÃO COMPLETA */}
        {activeTab === 'inicio' && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <section>
              <h2 className="text-2xl font-extrabold tracking-tight px-2 mb-4">Financeiro</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <IOSCard label="VGV do Sky" value={fmtReal(buscarValorDash("vgvdosky"))} />
                <IOSCard label="Total a Receber" value={fmtReal(buscarValorDash("totalareceberreais"))} />
                <IOSCard label="Depósitos Realizados" value={fmtReal(buscarValorDash("depositosrealizadosreais"))} color="text-[#34C759]" />
                <IOSCard label="Unidades Disponíveis" value={fmtReal(buscarValorDash("unidadesdisponiveisreais"))} />
                <IOSCard label="Saldo Investimento BTG" value={fmtReal(buscarValorDash("saldoeminvestimento"))} />
                <IOSCard label="Saldo Conta BTG" value={fmtReal(buscarValorDash("saldoemcontabtg"))} />
                <IOSCard label="Total Rendimentos" value={fmtReal(buscarValorDash("totalrendimentos"))} color="text-[#34C759]" />
                <IOSCard label="Total de Despesas" value={fmtReal(buscarValorDash("totaldedespesasreais"))} color="text-[#FF3B30]" />
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-extrabold tracking-tight px-2 mb-4">Indicadores CUB</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <IOSCard label="CUB Atual" value={fmtReal(buscarValorDash("cubatual"))} color="text-[#007AFF]" />
                <IOSCard label="Previsto Total" value={fmtCub(buscarValorDash("totalprevistoparaosky"))} />
                <IOSCard label="Total a Receber (CUB)" value={fmtCub(buscarValorDash("totalarecebercubs"))} />
                <IOSCard label="Depósitos (CUB)" value={fmtCub(buscarValorDash("depositosrealizadoscubs"))} />
                <IOSCard label="Unidades Disponíveis (CUB)" value={fmtCub(buscarValorDash("unidadesdisponiveiscubs"))} />
              </div>
            </section>

            <section className="bg-white rounded-3xl p-10 shadow-sm border border-slate-200 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Integralizado</p>
              <p className="text-6xl font-black text-[#007AFF]">{limparNumero(buscarValorDash("percentualintegralizado")).toFixed(2)}%</p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                <IOSCard label="Saldo Orçamento" value={fmtReal(buscarValorDash("saldoorcamento"))} />
                <IOSCard label="Comissão Paga" value={fmtReal(buscarValorDash("comissaopaga"))} color="text-orange-500" />
                <IOSCard label="Comissão Recebida" value={fmtReal(buscarValorDash("comissaorecebida"))} />
              </div>
            </section>
          </div>
        )}

        {/* ABA TIPOS */}
        {activeTab === 'tipos' && (
          <div className="space-y-6 animate-in zoom-in-95 duration-500">
            <h2 className="text-3xl font-extrabold px-2">Análise de Custos</h2>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 grid grid-cols-2 gap-4">
              <input type="date" className="bg-[#F2F2F7] p-3 rounded-xl text-sm font-bold outline-none text-black" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              <input type="date" className="bg-[#F2F2F7] p-3 rounded-xl text-sm font-bold outline-none text-black" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={processedData.pizza} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ percent }) => `${percent}%`}>
                      {processedData.pizza.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_IOS[index % COLORS_IOS.length]} strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => fmtReal(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-8 space-y-3">
                {processedData.pizza.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS_IOS[idx % COLORS_IOS.length] }} />
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-slate-800">{item.name}</span>
                        <span className="text-[10px] font-bold text-[#007AFF]">{item.percent}% do total</span>
                      </div>
                    </div>
                    <span className="text-[14px] font-black text-slate-900">{fmtReal(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LANÇAMENTOS */}
        {(activeTab === 'depositos' || activeTab === 'despesas') && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-10">
            <h2 className="text-3xl font-extrabold px-2">{activeTab === 'depositos' ? 'Depósitos' : 'Despesas'}</h2>
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="date" className="bg-[#F2F2F7] p-3 rounded-xl text-sm font-bold outline-none text-black" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
                <input type="date" className="bg-[#F2F2F7] p-3 rounded-xl text-sm font-bold outline-none text-black" value={dataFim} onChange={e => setDataFim(e.target.value)} />
              </div>
              {activeTab === 'despesas' && (
                <div className="grid grid-cols-2 gap-4">
                  <select className="bg-[#F2F2F7] p-3 rounded-xl text-sm font-bold outline-none text-black" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                    <option value="">Tipo</option>
                    {options.tipos.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select className="bg-[#F2F2F7] p-3 rounded-xl text-sm font-bold outline-none text-black" value={filtroOrcamento} onChange={e => setFiltroOrcamento(e.target.value)}>
                    <option value="">Orçamento</option>
                    {options.orcamentos.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              )}
              <input type="text" placeholder="Pesquisar..." className="w-full px-5 py-3 bg-[#F2F2F7] rounded-xl outline-none text-sm font-bold text-black" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest px-1">Evolução do Período</p>
              <GraficoEvolucao dados={processedData.grafico} />
            </div>
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {processedData.lista.map((item, i) => {
                  const orc = getOrcValue(item);
                  const tipo = getGenericValue(item, 'tipo');
                  return (
                    <div key={i} className="p-5 active:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <p className="font-bold text-[15px] text-slate-900 flex-1 pr-4">{getGenericValue(item, 'descricao')}</p>
                        <p className={`font-black text-[15px] ${activeTab === 'depositos' ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                          {fmtReal(getGenericValue(item, 'valor'))}
                        </p>
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{getGenericValue(item, 'data')}</span>
                        {activeTab === 'despesas' && tipo && <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold uppercase border border-blue-100">{tipo}</span>}
                      </div>
                      {activeTab === 'despesas' && orc && <div className="mt-2"><span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-bold border border-slate-200 inline-block uppercase italic">{orc}</span></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-slate-200 px-6 py-4 flex justify-around items-center z-50">
        <TabItem active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} label="Início" />
        <TabItem active={activeTab === 'depositos'} onClick={() => setActiveTab('depositos')} label="Depósitos" />
        <TabItem active={activeTab === 'despesas'} onClick={() => setActiveTab('despesas')} label="Despesas" />
        <TabItem active={activeTab === 'tipos'} onClick={() => setActiveTab('tipos')} label="Tipos" />
      </nav>
    </main>
  );
}

function IOSCard({ label, value, color = "text-black" }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
      <span className="text-[10px] font-bold text-slate-400 uppercase pr-4 leading-tight">{label}</span>
      <span className={`font-black text-sm whitespace-nowrap ${color}`}>{value}</span>
    </div>
  );
}

function TabItem({ active, onClick, label }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-[#007AFF]' : 'text-slate-300'}`}>
      <div className="w-6 h-6 bg-current rounded-md opacity-20" />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}