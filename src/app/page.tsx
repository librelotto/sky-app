'use client';

import { useState, useEffect, useMemo } from 'react';
import { fetchFinanceiro } from "@/lib/api";
import GraficoEvolucao from "@/components/GraficoEvolucao";
import { DashboardData } from "@/types/financeiro";

// DEFINA A SUA SENHA AQUI
const ACESSO_RESTRITO = "47881523000158"; 

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Estados para o Login
  const [isAutorizado, setIsAutorizado] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [erroSenha, setErroSenha] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Verifica se o usuário já logou anteriormente neste dispositivo
    const auth = localStorage.getItem('sky_auth');
    if (auth === 'true') {
      setIsAutorizado(true);
    }

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (senhaInput.toUpperCase() === ACESSO_RESTRITO) {
      setIsAutorizado(true);
      localStorage.setItem('sky_auth', 'true');
      setErroSenha(false);
    } else {
      setErroSenha(true);
    }
  };

  const garantirNumero = (valor: any): number => {
    if (typeof valor === 'number') return valor;
    if (!valor) return 0;
    const n = parseFloat(String(valor).replace(/[R$\s.]/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  const filtered = useMemo(() => {
    if (!data) return null;
    const termo = busca.toLowerCase().trim();

    const depFiltrados = data.depositos.filter(item => 
      `${item.descricao} ${item.sala} ${item.data}`.toLowerCase().includes(termo)
    );
    const despFiltradas = data.despesas.filter(item => 
      `${item.descricao} ${item.data}`.toLowerCase().includes(termo)
    );

    const totalEntradas = depFiltrados.reduce((acc, curr) => acc + garantirNumero(curr.valor), 0);
    const totalSaidas = despFiltradas.reduce((acc, curr) => acc + garantirNumero(curr.valor), 0);

    const entradasPorMes: Record<string, number> = {};
    depFiltrados.forEach(item => {
      const dataStr = String(item.data || "").trim();
      const partes = dataStr.split(/[/-]/);
      if (partes.length >= 2) {
        const mes = partes[0].length === 4 ? partes[1] : partes[1];
        const ano = partes[0].length === 4 ? partes[0].slice(-2) : partes[2]?.slice(-2) || "26";
        const chave = `${mes.padStart(2, '0')}/${ano}`;
        entradasPorMes[chave] = (entradasPorMes[chave] || 0) + garantirNumero(item.valor);
      }
    });

    return {
      depositos: depFiltrados,
      despesas: despFiltradas,
      resumo: { totalEntradas, totalSaidasReais: totalSaidas, saldoCofre: totalEntradas - totalSaidas },
      grafico: Object.keys(entradasPorMes).map(mes => ({ mes, valor: entradasPorMes[mes] })).sort((a,b) => a.mes.localeCompare(b.mes))
    };
  }, [data, busca]);

  if (!mounted || carregando) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-blue-400 animate-pulse font-bold tracking-widest">SKY APP • CARREGANDO</p>
      </div>
    );
  }

  // TELA DE LOGIN (Só aparece se não estiver autorizado)
  if (!isAutorizado) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="max-w-sm w-full space-y-8 bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl">
          <div className="text-center">
            <h1 className="text-4xl font-black italic tracking-tighter text-blue-500">SKY</h1>
            <p className="text-slate-400 text-sm mt-2 font-medium">Área Restrita aos Sócios e Investidores</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Digite a Chave de Acesso"
                className={`w-full p-4 rounded-xl bg-slate-800 border ${erroSenha ? 'border-red-500' : 'border-slate-700'} focus:ring-2 focus:ring-blue-500 outline-none text-center text-lg font-bold tracking-widest`}
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
              />
              {erroSenha && <p className="text-red-500 text-[10px] font-bold mt-2 text-center uppercase">Chave de acesso incorreta</p>}
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20 uppercase tracking-widest">
              Entrar no Sistema
            </button>
          </form>
          
          <p className="text-[10px] text-slate-600 text-center font-bold uppercase">Sky Construtora & Administradora</p>
        </div>
      </div>
    );
  }

  // DASHBOARD PRINCIPAL (Só acessível após Login)
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
           <div>
              <h1 className="text-3xl font-extrabold italic">Sky App</h1>
              <p className="text-slate-500 text-sm">Controle de Obra</p>
           </div>
           <button 
             onClick={() => { localStorage.removeItem('sky_auth'); window.location.reload(); }}
             className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase"
           >
             Sair
           </button>
        </header>

        <div className="sticky top-4 z-30 mb-8">
            <input
              type="text"
              placeholder="Pesquisar sala, fornecedor..."
              className="w-full p-4 rounded-2xl shadow-xl border-none ring-2 ring-white focus:ring-blue-500 outline-none"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
        </div>

        {filtered && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-green-500">
                <p className="text-xs font-bold text-slate-400 uppercase">Aportes</p>
                <p className="text-2xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(filtered.resumo.totalEntradas)}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-red-500">
                <p className="text-xs font-bold text-slate-400 uppercase">Custos</p>
                <p className="text-2xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(filtered.resumo.totalSaidasReais)}</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-blue-500">
                <p className="text-xs font-bold text-slate-400 uppercase">Saldo</p>
                <p className="text-2xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(filtered.resumo.saldoCofre)}</p>
              </div>
            </div>

            <div className="mb-8">
              <GraficoEvolucao key={`chart-${busca}`} dados={filtered.grafico} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b font-bold text-xs text-slate-500 uppercase">Depósitos ({filtered.depositos.length})</div>
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {filtered.depositos.slice(0, 50).map((item, i) => (
                    <div key={i} className="p-4 flex justify-between hover:bg-slate-50">
                      <div className="max-w-[70%] text-sm font-medium">{String(item.descricao)}</div>
                      <div className="text-sm font-bold text-green-600">+{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(garantirNumero(item.valor))}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Coluna de Despesas similar aqui... */}
            </div>
          </>
        )}
      </div>
    </main>
  );
}