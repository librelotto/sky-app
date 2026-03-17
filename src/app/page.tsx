'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchFinanceiro } from "@/lib/api";
import { DashboardData } from "@/types/financeiro";
import GraficoEvolucao from "@/components/GraficoEvolucao";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const ACESSO_RESTRITO = "47881523000158";
const COLORS_IOS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF3B30', '#5856D6', '#FFCC00', '#8E8E93'];

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'inicio' | 'depositos' | 'despesas' | 'tipos'>('inicio');
  const [viewMode, setViewMode] = useState<'mes' | 'ano'>('mes'); 
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isAutorizado, setIsAutorizado] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');

  // Estados para o filtro de data (Iniciando com o mês atual por padrão)
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    setMounted(true);
    
    // Define datas padrão: Primeiro e último dia do mês atual
    const hoje = new Date();
    const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
    const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0];
    setDataInicio(primeiroDia);
    setDataFim(ultimoDia);

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

  // --- HELPERS DE TRATAMENTO ---
  const limparNumero = (v: any) => {
    if (typeof v === 'number') return v;
    const s = String(v || "0").replace(/R\$/g, '').replace(/%/g, '').replace(/\s/g, '').replace(/\.(?=[^,]*$)/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const getItemValue = (item: any, prop: string) => {
    const key = Object.keys(item).find(k => k.toLowerCase().trim() === prop.toLowerCase());
    return key ? item[key] : null;
  };

  const converterDataBRparaISO = (dataBR: string) => {
    const parts = String(dataBR).split(/[/-]/);
    if (parts.length < 3) return new Date(0);
    const ano = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    return new Date(Number(ano), Number(parts[1]) - 1, Number(parts[0]));
  };

  const getSpecificLink = (item: any, type: 'nota' | 'pagamento') => {
    const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
    const key = Object.keys(item).find(k => {
      const kn = normalizar(k);
      return type === 'nota' ? (kn.includes('link') && kn.includes('nota')) : (kn.includes('link') && kn.includes('pagamento'));
    });
    const value = key ? item[key] : null;
    return (value && String(value).startsWith('http')) ? value : null;
  };

  const buscarValorDash = (termo: string) => {
    const dash = (data as any)?.dashboard;
    if (!dash) return "0";
    const normalizar = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
    const alvo = normalizar(termo);
    const chave = Object.keys(dash).find(k => normalizar(k).includes(alvo));
    return chave ? dash[chave] : "0";
  };

  const fmtReal = (valor: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(limparNumero(valor));
  const fmtCub = (valor: any) => limparNumero(valor).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " CUB";

  // --- LÓGICA DE PROCESSAMENTO ---
  const processedData = useMemo(() => {
    if (!data) return { lista: [], grafico: [], pizza: [] };

    const baseListagem = activeTab === 'depositos' ? data.depositos : data.despesas;
    
    // 1. Filtragem da lista (Tabela)
    const lista = baseListagem
      .filter(i => String(getItemValue(i, 'descricao') || "").toLowerCase().includes(busca.toLowerCase()) || 
                   String(getItemValue(i, 'sala') || "").toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => converterDataBRparaISO(String(getItemValue(b, 'data'))).getTime() - converterDataBRparaISO(String(getItemValue(a, 'data'))).getTime());

    // 2. Processamento do Gráfico (Cronológico Antigo -> Novo)
    const graficoMap: Record<string, number> = {};
    baseListagem.forEach(i => {
      const d = String(getItemValue(i, 'data')).split(/[/-]/);
      if (d.length >= 3) {
        const anoCurto = d[2].slice(-2);
        const chave = viewMode === 'mes' ? `${d[1]}/${anoCurto}` : (d[2].length === 2 ? `20${d[2]}` : d[2]);
        graficoMap[chave] = (graficoMap[chave] || 0) + limparNumero(getItemValue(i, 'valor'));
      }
    });

    const grafico = Object.keys(graficoMap).map(m => ({ mes: m, valor: graficoMap[m] }))
      .sort((a, b) => {
        if (viewMode === 'ano') return Number(a.mes) - Number(b.mes);
        const [mA, aA] = a.mes.split('/');
        const [mB, aB] = b.mes.split('/');
        return new Date(Number(`20${aA}`), Number(mA)-1).getTime() - new Date(Number(`20${aB}`), Number(mB)-1).getTime();
      });

    // 3. Lógica da Pizza (Aba Tipos)
    let basePizza = data.despesas;
    if (dataInicio || dataFim) {
      basePizza = basePizza.filter(i => {
        const dt = converterDataBRparaISO(String(getItemValue(i, 'data')));
        const dIni = dataInicio ? new Date(dataInicio + 'T00:00:00') : null;
        const dFim = dataFim ? new Date(dataFim + 'T23:59:59') : null;
        if (dIni && dt < dIni) return false;
        if (dFim && dt > dFim) return false;
        return true;
      });
    }

    const pizzaMap: Record<string, number> = {};
    basePizza.forEach(i => {
      const tipo = String(getItemValue(i, 'tipo') || "Outros").trim();
      pizzaMap[tipo] = (pizzaMap[tipo] || 0) + limparNumero(getItemValue(i, 'valor'));
    });

    const pizza = Object.keys(pizzaMap)
      .map(name => ({ name, value: pizzaMap[name] }))
      .sort((a, b) => b.value - a.value);

    return { lista, grafico, pizza };
  }, [data, activeTab, busca, viewMode, dataInicio, dataFim]);

  if (!mounted || carregando) return <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center text-[#007AFF] font-bold animate-pulse">Sincronizando...</div>;

  if (!isAutorizado) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-6">
        <form onSubmit={(e) => { e.preventDefault(); if (senhaInput === ACESSO_RESTRITO) { setIsAutorizado(true); localStorage.setItem('sky_auth', 'true'); } }} className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <h1 className="text-5xl font-black tracking-tighter text-black uppercase italic">Sky</h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2">Atto Porto SPE</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <input type="text" inputMode="numeric" placeholder="CNPJ de Acesso" className="w-full p-3 text-center text-lg font-bold outline-none text-black" value={senhaInput} onChange={e => setSenhaInput(e.target.value)} />
          </div>
          <button className="w-full bg-[#007AFF] text-white py-4 rounded-2xl font-bold text-lg">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F2F7] text-black font-sans pb-32">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-black tracking-tight uppercase italic">Sky</h1>
          <span className="text-[10px] font-bold bg-[#007AFF]/10 text-[#007AFF] px-2 py-1 rounded-full uppercase">Live</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-8">
        
        {/* ABA INICIO (RESTAURADA COM TODOS OS DADOS) */}
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

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center flex flex-col justify-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Integralizado</p>
                <p className="text-6xl font-black text-[#007AFF]">{limparNumero(buscarValorDash("percentualintegralizado")).toFixed(2)}%</p>
              </div>
              <div className="space-y-3">
                <IOSCard label="Saldo Orçamento" value={fmtReal(buscarValorDash("saldoorcamento"))} />
                <IOSCard label="Comissão Paga" value={fmtReal(buscarValorDash("comissaopaga"))} color="text-orange-500" />
                <IOSCard label="Comissão Recebida" value={fmtReal(buscarValorDash("comissaorecebida"))} />
              </div>
            </section>
          </div>
        )}

        {/* ABA TIPOS DE DESPESA */}
        {activeTab === 'tipos' && (
          <div className="space-y-6 animate-in zoom-in-95 duration-500">
            <h2 className="text-3xl font-extrabold px-2">Análise por Tipo</h2>
            
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Período Início</label>
                <input type="date" className="w-full bg-[#F2F2F7] p-3 rounded-xl text-sm font-bold outline-none text-slate-900" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase ml-2">Período Fim</label>
                <input type="date" className="w-full bg-[#F2F2F7] p-3 rounded-xl text-sm font-bold outline-none text-slate-900" value={dataFim} onChange={e => setDataFim(e.target.value)} />
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={processedData.pizza} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                      {processedData.pizza.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS_IOS[index % COLORS_IOS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => fmtReal(value)} contentStyle={{ borderRadius: '15px', border: 'none' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2">
                {processedData.pizza.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-slate-50">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS_IOS[idx % COLORS_IOS.length] }} />
                      <span className="text-[13px] font-bold text-slate-700">{item.name}</span>
                    </div>
                    <span className="text-[13px] font-black text-slate-900">{fmtReal(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABAS LISTAGEM */}
        {(activeTab === 'depositos' || activeTab === 'despesas') && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-10">
            <h2 className="text-3xl font-extrabold px-2">{activeTab === 'depositos' ? 'Depósitos' : 'Despesas'}</h2>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input type="text" placeholder="Pesquisar..." className="w-full pl-12 pr-6 py-4 bg-white rounded-2xl shadow-sm border border-slate-200 outline-none focus:ring-2 focus:ring-[#007AFF] text-slate-900 font-medium" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Evolução</p>
                <div className="flex bg-[#F2F2F7] p-1 rounded-lg">
                  <button onClick={() => setViewMode('mes')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'mes' ? 'bg-white text-[#007AFF] shadow-sm' : 'text-slate-400'}`}>MÊS</button>
                  <button onClick={() => setViewMode('ano')} className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${viewMode === 'ano' ? 'bg-white text-[#007AFF] shadow-sm' : 'text-slate-400'}`}>ANO</button>
                </div>
              </div>
              <GraficoEvolucao dados={processedData.grafico} />
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {processedData.lista.map((item, i) => {
                  const ln = getSpecificLink(item, 'nota');
                  const lp = getSpecificLink(item, 'pagamento');
                  return (
                    <div key={i} className="p-5 flex justify-between items-center active:bg-slate-50 transition-colors">
                      <div className="max-w-[55%]">
                        <p className="font-bold text-[15px] leading-tight text-slate-900">{getItemValue(item, 'descricao')}</p>
                        <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">
                          {getItemValue(item, 'sala') ? `SALA ${getItemValue(item, 'sala')} • ` : ''}{getItemValue(item, 'data')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {ln && <IOSFileBtn href={ln} icon="doc" />}
                        {lp && <IOSFileBtn href={lp} icon="cash" />}
                        <p className={`font-black text-[15px] ml-1 ${activeTab === 'depositos' ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
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
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-slate-200 px-6 py-4 flex justify-around items-center z-50 shadow-2xl">
        <IOSTab active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} label="Início" icon="home" />
        <IOSTab active={activeTab === 'depositos'} onClick={() => setActiveTab('depositos')} label="Depósitos" icon="plus" />
        <IOSTab active={activeTab === 'despesas'} onClick={() => setActiveTab('despesas')} label="Despesas" icon="minus" />
        <IOSTab active={activeTab === 'tipos'} onClick={() => setActiveTab('tipos')} label="Tipos" icon="chart" />
      </nav>
    </main>
  );
}

function IOSCard({ label, value, color = "text-black" }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
      <span className="text-[10px] font-bold text-slate-400 uppercase pr-4">{label}</span>
      <span className={`font-black text-sm whitespace-nowrap ${color}`}>{value}</span>
    </div>
  );
}

function IOSTab({ active, onClick, label, icon }: any) {
  const icons: any = {
    home: <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011-1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />,
    plus: <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />,
    minus: <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />,
    chart: <><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.001 8.001 0 0117.748 8H12V2.252z" /></>
  };
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-[#007AFF]' : 'text-slate-300'}`}>
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">{icons[icon]}</svg>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function IOSFileBtn({ href, icon }: any) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 active:bg-slate-200 transition-colors border border-slate-100">
      {icon === 'doc' ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )}
    </a>
  );
}