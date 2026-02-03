// server/_core/nfeProvider.ts

export interface NfeData {
  description: string;
  amount: number;
  date: string; // ISO date string
  notes?: string;
  isHomologation?: boolean; // Indica se os dados são de homologação
}

/**
 * Simula a consulta a uma API de NF-e interna.
 * Em um ambiente de produção real, esta função faria uma chamada HTTP para um serviço externo.
 * Para fins de desenvolvimento/teste, ela retorna dados mocados.
 *
 * @param accessKey A chave de acesso da NF-e (44 dígitos).
 * @returns Dados da NF-e simulados.
 */
export async function fetchNfeDataInternal(accessKey: string): Promise<NfeData> {
  // Simulação de chamada de API com um pequeno delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Lógica para simular diferentes cenários ou dados baseados na chave de acesso
  // Por exemplo, chaves específicas podem retornar dados de homologação ou erros.
  const isHomologationKey = accessKey.startsWith("999"); // Exemplo: chaves que começam com 999 são de homologação

  if (isHomologationKey) {
    return {
      description: `NF-e de Homologação - Chave: ${accessKey.substring(0, 10)}...`,
      amount: Math.floor(Math.random() * 1000) + 100, // Valor aleatório
      date: new Date().toISOString().split("T")[0],
      notes: "Este é um documento fiscal emitido em ambiente de homologação (teste) e não possui valor fiscal.",
      isHomologation: true,
    };
  }

  // MOCK: Simulação de uma nota fiscal com múltiplos itens
  const items = [
    { q: 20, desc: "Saco de Cimento 50kg", val: 32.50 },
    { q: 5, desc: "Metro de Areia Média", val: 110.00 },
    { q: 2, desc: "Milheiro de Tijolo", val: 850.00 },
    { q: 10, desc: "Vergalhão 3/8", val: 45.00 }
  ];

  const totalAmount = items.reduce((acc, item) => acc + (item.q * item.val), 0);

  const itemsList = items
    .map(i => `- ${i.q}x ${i.desc}: R$ ${(i.q * i.val).toFixed(2)}`)
    .join("\n");

  return {
    description: `Materiais Diversos - NF ${accessKey.substring(25, 34)}`,
    amount: parseFloat(totalAmount.toFixed(2)),
    date: new Date().toISOString().split("T")[0],
    notes: `Fornecedor: Depósito Construção LTDA\nCNPJ: 99.999.999/0001-99\n\nItens Inclusos:\n${itemsList}`,
    isHomologation: false,
  };
}
