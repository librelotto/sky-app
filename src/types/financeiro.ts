export interface Deposito {
  data: string;
  descricao: string;
  valor: number;
  sala?: string;
}

export interface Despesa {
  data: string;
  descricao: string;
  valor: number;
  tipo?: string;
}

export interface DashboardData {
  // O segredo está aqui: aceitar qualquer chave dinâmica vinda da aba Dashboard
  dashboard: {
    [key: string]: any;
  };
  depositos: Deposito[];
  despesas: Despesa[];
}