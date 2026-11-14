// Módulos do menu Empresarial que ainda não têm tela própria: o que cada um faz e onde fazer hoje.
export interface Module { slug: string; label: string; description: string; today?: { href: string; label: string } }

export const MODULES: Module[] = [
  { slug: "ponto-de-venda", label: "Ponto de Venda", description: "Registrar a venda no balcão: escolher produtos ou serviços, forma de pagamento e dar baixa no estoque.",
    today: { href: "/transacoes", label: "Lance a venda como receita em Vendas" } },
  { slug: "notas-fiscais", label: "Notas Fiscais", description: "Registro das notas emitidas e recebidas: número, cliente ou fornecedor, valor e data." },
  { slug: "obrigacoes-fiscais", label: "Obrigações Fiscais", description: "Calendário de guias e impostos (DAS, DARF, ISS) com vencimento e aviso antes do prazo.",
    today: { href: "/empresa/atividades", label: "Crie como atividade em Agenda / Atividades" } },
  { slug: "funcionarios", label: "Funcionários", description: "Equipe com salário, data de admissão e encargos de cada mês." },
  { slug: "gestao-de-capital", label: "Gestão de Capital", description: "Capital de giro, reservas e quanto a empresa pode retirar sem faltar caixa.",
    today: { href: "/empresa/fluxo-de-caixa", label: "Veja o saldo de cada mês no Fluxo de Caixa" } },
];

export const moduleBySlug = (slug: string) => MODULES.find((m) => m.slug === slug);
