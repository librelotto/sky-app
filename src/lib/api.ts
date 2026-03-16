export async function fetchFinanceiro() {
  // Use a URL da sua última implantação do Google Apps Script
  const URL_API = "https://script.google.com/macros/s/AKfycbz5XVCwPAZWTITyDdDZMq5ISAqQASHYD9376XGrgzc6omD9ZQ54edggIwFzPDBqgkcR/exec";

  try {
    const response = await fetch(URL_API, {
      method: 'GET',
      cache: 'no-store', // Garante que ele pegue dados novos, não do cache
    });

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    const data = await response.json();
    
    // Log para você ver no console do navegador (F12) se o dashboard existe aqui
    console.log("API Log - Estrutura recebida:", data);

    return data;
  } catch (error) {
    console.error("Erro ao buscar dados da API:", error);
    return {
      dashboard: {},
      depositos: [],
      despesas: []
    };
  }
}