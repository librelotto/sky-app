export interface Lancamento {
  data: string;
  descricao: string;
  valor: number;
  tipo?: string;
  sala?: string;
  cubs_pagos?: number;
  cub_ajustado?: number;
  link_da_nota?: string;
  link_do_pagamento?: string;
}

export interface DashboardData {
  depositos: Lancamento[];
  despesas: Lancamento[];
  dadosGrafico: { mes: string; valor: number }[]; // <-- ADICIONE ESTA LINHA
  resumo: {
    totalEntradas: number;
    totalSaidasReais: number;
    saldoCofre: number;
  };
}