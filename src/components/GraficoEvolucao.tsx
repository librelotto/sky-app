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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-[350px] w-full bg-white rounded-2xl border border-slate-100 flex items-center justify-center">
        <div className="animate-pulse text-slate-300 font-medium">Carregando gráfico...</div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-slate-800 font-bold text-lg">Evolução de Aportes</h3>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Dados Filtrados</p>
        </div>
        <div className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
          {dados?.length || 0} meses encontrados
        </div>
      </div>
      
      <div className="h-[300px] w-full">
        {dados && dados.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="mes" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false} 
                tick={{ fill: '#64748b', fontWeight: 500 }}
                dy={10}
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
                // CORREÇÃO AQUI: Tipagem flexível para evitar erro no Build da Vercel
                formatter={(value: any) => [
                  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value)),
                  'Total no Mês'
                ]}
              />
              <Bar 
                dataKey="valor" 
                fill="#22c55e" 
                radius={[4, 4, 0, 0]} 
                barSize={35}
              >
                {dados.map((entry, index) => (
                  <Cell key={`cell-${index}`} className="hover:opacity-80 transition-opacity cursor-pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 italic text-sm border-2 border-dashed border-slate-50 rounded-xl">
            Nenhum dado financeiro para esta busca.
          </div>
        )}
      </div>
    </div>
  );
}