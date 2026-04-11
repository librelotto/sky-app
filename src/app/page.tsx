'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchFinanceiro } from "@/lib/api";
import { DashboardData } from "@/types/financeiro";
import GraficoEvolucao from "@/components/GraficoEvolucao";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

const ACESSO_RESTRITO = "47881523000158";
const COLORS_IOS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF3B30', '#5856D6', '#FFCC00', '#8E8E93', '#6366f1', '#ec4899'];

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<'inicio' | 'depositos' | 'despesas' | 'tipos' | 'saldo'>('inicio');
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

  const getSpecificLink = (item: any, type: 'nota' | 'pagamento') => {
    const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
    const key = Object.keys(item).find(k => {
      const kn = normalizar(k);
      return type === 'nota' ? (kn.includes('link') && kn.includes('nota')) : (kn.includes('link') && kn.includes('pagamento'));
    });
    const value = key ? item[key] : null;
    return (value && String(value).startsWith('http')) ? value : null;
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
    if (!data) return { lista: [], grafico: [], pizza: [], saldoAcumulado: [] };

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

    const saldoMap: Record<string, { dep: number, des: number }> = {};
    const todasDatas = new Set<string>();
    data.depositos.forEach(i => {
      const d = String(getGenericValue(i, 'data')).split(/[/-]/);
      if (d.length >= 3) {
        const chave = `${d[1]}/${d[2].slice(-2)}`;
        todasDatas.add(chave);
        if (!saldoMap[chave]) saldoMap[chave] = { dep: 0, des: 0 };
        saldoMap[chave].dep += limparNumero(getGenericValue(i, 'valor'));
      }
    });
    data.despesas.forEach(i => {
      const d = String(getGenericValue(i, 'data')).split(/[/-]/);
      if (d.length >= 3) {
        const chave = `${d[1]}/${d[2].slice(-2)}`;
        todasDatas.add(chave);
        if (!saldoMap[chave]) saldoMap[chave] = { dep: 0, des: 0 };
        saldoMap[chave].des += limparNumero(getGenericValue(i, 'valor'));
      }
    });

    let acumulado = 0;
    const saldoAcumulado = Array.from(todasDatas)
      .sort((a, b) => {
        const [mA, aA] = a.split('/'); const [mB, aB] = b.split('/');
        return new Date(Number(`20${aA}`), Number(mA)-1).getTime() - new Date(Number(`20${mB}`), Number(mB)-1).getTime();
      })
      .map(mes => {
        const dep = saldoMap[mes]?.dep || 0;
        const des = saldoMap[mes]?.des || 0;
        acumulado += (dep - des);
        return { mes, dep, des, acumulado };
      });

    return { lista, grafico, pizza, saldoAcumulado };
  }, [data, activeTab, busca, viewMode, dataInicio, dataFim, filtroTipo, filtroOrcamento]);

  if (!mounted || carregando) return <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center font-bold text-[#007AFF]">Carregando Sky...</div>;

  if (!isAutorizado) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-6 text-black">
        <form onSubmit={(e) => { e.preventDefault(); if (senhaInput === ACESSO_RESTRITO) { setIsAutorizado(true); localStorage.setItem('sky_auth', 'true'); } }} className="w-full max-w-sm space-y-8 text-center">
          <h1 className="text-5xl font-black italic">SKY</h1>
          <input type="text" placeholder="CNPJ" className="w-full p-4 rounded-2xl border text-center font-bold bg-white" value={senhaInput} onChange={e => setSenhaInput(e.target.value)} />
          <button className="w-full bg-[#007AFF] text-white py-4 rounded-2xl font-bold">Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F2F2F7] text-black font-sans pb-32">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-black uppercase italic">Sky Dashboard</h1>
        <span className="text-[10px] font-bold bg-[#34C759]/10 text-[#34C759] px-2 py-1 rounded-full uppercase">Live</span>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-8">
        
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

        {activeTab === 'saldo' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <h2 className="text-3xl font-extrabold px-2">Saldo Acumulado</h2>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <div className="h-96 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={processedData.saldoAcumulado}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEEEE" />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} tickFormatter={(v) => `R$${v/1000}k`} />
                    <Tooltip formatter={(v: any) => fmtReal(v)} contentStyle={{borderRadius: '15px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                    <Legend verticalAlign="top" align="right" iconType="circle" />
                    <Bar dataKey="dep" name="Depósitos" fill="#007AFF" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="des" name="Despesas" fill="#FF3B30" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="#34C759" strokeWidth={3} dot={{ r: 4, fill: '#34C759' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
            <IOSCard label="Saldo Atual em Obra" value={fmtReal(processedData.saldoAcumulado[processedData.saldoAcumulado.length - 1]?.acumulado || 0)} color="text-[#34C759]" />
          </div>
        )}

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
                  const ln = getSpecificLink(item, 'nota');
                  const lp = getSpecificLink(item, 'pagamento');

                  return (
                    <div key={i} className="p-5 active:bg-slate-50 transition-all duration-200">
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <p className="font-bold text-[15px] text-slate-900 flex-1 leading-snug">{getGenericValue(item, 'descricao')}</p>
                        <p className={`font-black text-[16px] whitespace-nowrap ${activeTab === 'depositos' ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>{fmtReal(getGenericValue(item, 'valor'))}</p>
                      </div>

                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">{getGenericValue(item, 'data')}</span>
                        {activeTab === 'despesas' && tipo && (
                          <span className="text-[9px] bg-blue-50 text-[#007AFF] px-2 py-0.5 rounded-md font-bold uppercase border border-blue-100">{tipo}</span>
                        )}
                      </div>

                      {(orc || ln || lp) && (
                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                          <div className="flex-1">
                            {activeTab === 'despesas' && orc && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-semibold border border-slate-200 inline-block uppercase italic tracking-tighter">{orc}</span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {ln && <IOSFileBtn href={ln} icon="doc" label="NF" />}
                            {lp && <IOSFileBtn href={lp} icon="cash" label="PAG" />}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-slate-200 px-2 py-4 flex justify-around items-center z-50 shadow-2xl">
        <TabItem active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} label="Home" icon="home" />
        <TabItem active={activeTab === 'saldo'} onClick={() => setActiveTab('saldo')} label="Saldo" icon="chart" />
        <TabItem active={activeTab === 'depositos'} onClick={() => setActiveTab('depositos')} label="Entradas" icon="plus" />
        <TabItem active={activeTab === 'despesas'} onClick={() => setActiveTab('despesas')} label="Saídas" icon="minus" />
        <TabItem active={activeTab === 'tipos'} onClick={() => setActiveTab('tipos')} label="Tipos" icon="pie" />
      </nav>
    </main>
  );
}

// SUBCOMPONENTES
function IOSCard({ label, value, color = "text-black" }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
      <span className="text-[10px] font-bold text-slate-400 uppercase pr-4 leading-tight">{label}</span>
      <span className={`font-black text-sm whitespace-nowrap ${color}`}>{value}</span>
    </div>
  );
}

function TabItem({ active, onClick, label, icon }: any) {
  const icons: any = {
    home: <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011-1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />,
    chart: <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />,
    plus: <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />,
    minus: <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />,
    pie: <><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.001 8.001 0 0117.748 8H12V2.252z" /></>
  };

  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-[#007AFF]' : 'text-slate-300'}`}>
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">{icons[icon]}</svg>
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function IOSFileBtn({ href, icon, label }: any) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors group">
      {icon === 'doc' ? (
        <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#34C759]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )}
      {label && <span className="text-[9px] font-bold text-slate-500 uppercase">{label}</span>}
    </a>
  );
}