import { DashboardData } from "@/types/financeiro";

export async function fetchFinanceiro(): Promise<DashboardData> {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("URL da API não configurada");

  // 'no-store' garante que o Next.js sempre busque dados frescos da planilha
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();

  const parseMoeda = (valor: any): number => {
    if (typeof valor === 'number') return valor;
    if (!valor || valor === "") return 0;
    const limpo = valor.toString().replace(/R\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(limpo);
    return isNaN(num) ? 0 : num;
  };

  const depositosRaw = data.depositos || [];
  const despesasRaw = data.despesas || [];

  const totalEntradas = depositosRaw.reduce((acc: number, curr: any) => acc + parseMoeda(curr.valor || curr.Valor), 0);
  const despesasReais = despesasRaw.filter((d: any) => {
    const tipo = (d.tipo || d.Tipo || "").toString().toLowerCase();
    return tipo !== "aplicacao" && tipo !== "aplicação";
  });
  const totalSaidasReais = despesasReais.reduce((acc: number, curr: any) => acc + parseMoeda(curr.valor || curr.Valor), 0);

  const entradasPorMes: Record<string, number> = {};
  depositosRaw.forEach((curr: any) => {
    const dataBruta = curr.data || curr.Data;
    const valor = parseMoeda(curr.valor || curr.Valor);
    if (!dataBruta || valor === 0) return;

    let mesAno = "";
    if (typeof dataBruta === 'string' && dataBruta.includes('/')) {
      const partes = dataBruta.split('/');
      if (partes.length >= 2) mesAno = `${partes[1].padStart(2, '0')}/${partes[2].toString().slice(-2)}`;
    } else {
      const d = new Date(dataBruta);
      if (!isNaN(d.getTime())) mesAno = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}`;
    }
    if (mesAno) entradasPorMes[mesAno] = (entradasPorMes[mesAno] || 0) + valor;
  });

  const dadosGrafico = Object.keys(entradasPorMes)
    .map(mes => ({ mes, valor: entradasPorMes[mes] }))
    .sort((a, b) => {
      const [m1, a1] = a.mes.split('/');
      const [m2, a2] = b.mes.split('/');
      return a1.localeCompare(a2) || m1.localeCompare(m2);
    });

  return {
    depositos: depositosRaw,
    despesas: despesasReais,
    dadosGrafico,
    resumo: {
      totalEntradas,
      totalSaidasReais,
      saldoCofre: totalEntradas - totalSaidasReais
    }
  };
}