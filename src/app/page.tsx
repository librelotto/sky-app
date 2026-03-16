'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchFinanceiro } from "@/lib/api";
import GraficoEvolucao from "@/components/GraficoEvolucao";
import { DashboardData } from "@/types/financeiro";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    async function carregarDados() {
      try {
        const resultado = await fetchFinanceiro();
        setData(resultado);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setCarregando(false);
      }
    }
    carregarDados();
  }, []);

  // Função para limpar e converter qualquer valor para número somável
  const garantirNumero = (valor: any): number => {
    if (typeof valor === 'number') return valor;
    if (!valor) return 0;
    const n = parseFloat(String(valor).replace(/[R$\s.]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  // Processamento unificado de filtros, totais e gráfico
  const filtered = useMemo(() => {
    if (!data) return null;

    const termo = busca.toLowerCase().trim();

    // 1. Filtragem das listas (Busca Global em múltiplos campos)
    const depFiltrados = data.depositos.filter(item => {
      const conteudo = `${item.descricao} ${item.sala} ${item.data}`.toLowerCase();
      return conteudo.includes(termo);
    });

    const despFiltradas = data.despesas.filter(item => {
      const conteudo = `${item.descricao} ${item.data}`.toLowerCase();
      return conteudo.includes(termo);
    });

    // 2. Cálculo dos Totais dos Cards
    const totalEntradas = depFiltrados.reduce((acc, curr) => acc + garantirNumero(curr.valor), 0);
    const totalSaidas = despFiltradas.reduce((acc, curr) => acc + garantirNumero(curr.valor), 0);

    // 3. Reconstrução do Gráfico baseado apenas no filtro atual
    const entradasPorMes: Record<string, number> = {};
    depFiltrados.forEach(item => {
      const dataStr = String(item.data || "").trim();
      if (!dataStr) return;

      const partes = dataStr.split(/[/-]/);
      if (partes.length >= 2) {
        // Detecta se é DD/MM/AAAA ou AAAA/MM/DD
        const mes = partes[0].length === 4 ? partes[1] : partes[1];
        const ano = partes[0].length === 4 ? partes[0].slice(-2) : partes[2]?.slice(-2) || "26";
        const chaveMesAno = `${mes.padStart(2, '0')}/${ano}`;
        
        entradasPorMes[chaveMesAno] = (entradasPorMes[chaveMesAno] || 0) + garantirNumero(item.valor);
      }
    });

    const dadosGraficoFiltrado = Object.keys(entradasPorMes)
      .map(mes => ({ mes, valor: entradasPorMes[mes] }))
      .sort((a, b) => {
        const [m1, a1] = a.mes.split('/');
        const [m2, a2] = b.mes.split('/');
        return a1.localeCompare(a2) || m1.localeCompare(m2);
      });

    return {
      depositos: depFiltrados,
      despesas: despFiltradas,
      resumo: {
        totalEntradas,
        totalSaidasReais: totalSaidas,
        saldoCofre: totalEntradas - totalSaidas
      },
      grafico: dadosGraficoFiltrado
    };
  }, [data, busca]);

  const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  if (!mounted || carregando || !filtered) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-medium">Sincronizando Sky App...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto">
        
        <header className="mb-8">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h1 className="text-3xl font-extrabold italic tracking-tight">Sky App</h1>
              <p className="text-slate-500 font-medium">Controle de Obras em Tempo Real</p>
            </div>
            <div className="hidden md:block bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Status: Conectado
            </div>
          </div>

          {/* Barra de Busca Dinâmica */}
          <div className="sticky top-4 z-30">
            <div className="relative group">
              <input
                type="text"
                placeholder="Pesquisar por sala (ex: 1304), fornecedor ou material..."
                className="w-full p-5 pl-14 rounded-2xl shadow-2xl border-none ring-2 ring-white focus:ring-4 focus:ring-blue-500/20 text-slate-700 outline-none transition-all text-lg"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <svg className="w-6 h-6 absolute left-5 top-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {busca && (
                <button 
                  onClick={() => setBusca('')}
                  className="absolute right-5 top-5 text-xs font-bold text-slate-300 hover:text-red-500 uppercase"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Cards de Resumo que respondem à Busca */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-green-500 transition-all">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aportes (Filtro)</p>
            <p className="text-2xl font-black mt-2">{formatter.format(filtered.resumo.totalEntradas)}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-red-500 transition-all">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Custos (Filtro)</p>
            <p className="text-2xl font-black mt-2">{formatter.format(filtered.resumo.totalSaidasReais)}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-500 transition-all">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saldo Disponível</p>
            <p className="text-2xl font-black mt-2">{formatter.format(filtered.resumo.saldoCofre)}</p>
          </div>
        </div>

        {/* Gráfico Dinâmico */}
        <div className="mb-8">
          <GraficoEvolucao key={`chart-${busca}`} dados={filtered.grafico} />
        </div>

        {/* Listagens Filtradas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 text-xs uppercase">Depósitos ({filtered.depositos.length})</h2>
            </div>
            <div className="divide-y divide-slate-50 max-h-[450px] overflow-y-auto">
              {filtered.depositos.slice(0, 50).map((item, i) => (
                <div key={i} className="px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <div className="max-w-[65%]">
                    <p className="text-sm font-bold text-slate-800 truncate">{String(item.descricao)}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase">Sala {item.sala || '--'} • {item.data}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">+{formatter.format(garantirNumero(item.valor))}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-bold text-slate-800 text-xs uppercase">Saídas da Obra ({filtered.despesas.length})</h2>
            </div>
            <div className="divide-y divide-slate-50 max-h-[450px] overflow-y-auto">
              {filtered.despesas.slice(0, 50).map((item, i) => (
                <div key={i} className="px-6 py-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <div className="max-w-[65%]">
                    <p className="text-sm font-bold text-slate-800 truncate">{String(item.descricao)}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase">{item.data}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">-{formatter.format(garantirNumero(item.valor))}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}