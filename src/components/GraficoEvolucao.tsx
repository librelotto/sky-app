'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface Props {
  dados: { mes: string; valor: number }[];
}

export default function GraficoEvolucao({ dados }: Props) {
  const [isMounted, setIsMounted] = useState(false);

  // useEffect garante que o código só rode no navegador (Cliente)
  // Isso mata o erro de Hidratação do Next.js
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Enquanto não monta, exibe um esqueleto (placeholder) elegante
  if (!isMounted) {
    return (
      <div className="h-[350px] w-full bg-white rounded-2xl border border-slate-100 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-4 w-48 bg-slate-100 rounded mb-4"></div>
          <div className="text-slate-300 font-medium">Carregando histórico Sky...</div>
        </div>
      </div>
    );
  }

  // Como você tem 46 meses, vamos exibir os últimos 24 para não "amontoar" as barras
  // Mas o gráfico processa tudo internamente.
  const dadosExibidos = dados && dados.length > 24 ? dados.slice(-24) : dados;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-2">
        <div>
          <h3 className="text-slate-800 font-bold text-lg">Evolução de Aportes</h3>
          <p className="text-xs text-slate-400">Histórico mensal (Últimos 2 anos)</p>
        </div>
        <div className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded font-bold uppercase tracking-widest">
          Valores em R$
        </div>
      </div>
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dadosExibidos} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="mes" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#64748b', fontWeight: 500 }}
              dy={10}
              interval={1} // Pula um mês no eixo X para o texto não encavalar
            />
            <YAxis 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#94a3b8' }}
              tickFormatter={(value) => `R$${value >= 1000 ? (value/1000).toFixed(0) + 'k' : value}`}
            />
            <Tooltip 
              cursor={{ fill: '#f8fafc' }}
              contentStyle={{ 
                borderRadius: '12px', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
              formatter={(value: number) => [
                new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value),
                'Total Recebido'
              ]}
            />
            <Bar 
              dataKey="valor" 
              fill="#22c55e" 
              radius={[4, 4, 0, 0]} 
              barSize={20} // Ajuste fino para as barras não ficarem coladas
            >
              {dadosExibidos.map((entry, index) => (
                <Cell key={`cell-${index}`} className="hover:opacity-80 transition-opacity cursor-pointer" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}