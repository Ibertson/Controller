// Módulos do menu Empresarial que ainda não têm tela própria: o que cada um faz e onde fazer hoje.
export interface Module { slug: string; label: string; description: string; today?: { href: string; label: string } }

export const MODULES: Module[] = [
  { slug: "ponto-de-venda", label: "Ponto de Venda", description: "Registrar a venda no balcão: escolher produtos ou serviços, forma de pagamento e dar baixa no estoque.",
    today: { href: "/transacoes", label: "Lance a venda como receita em Vendas" } },
  { slug: "caixa-diario", label: "Caixa Diário", description: "Abrir e fechar o caixa do dia, com entradas, saídas, sangrias e a conferência do dinheiro.",
    today: { href: "/extrato", label: "Confira o dia no Extrato" } },
  { slug: "pedidos", label: "Pedidos", description: "Pedidos de clientes com situação (novo, em preparo, entregue) e o valor a receber de cada um." },
  { slug: "notas-fiscais", label: "Notas Fiscais", description: "Registro das notas emitidas e recebidas: número, cliente ou fornecedor, valor e data." },
  { slug: "obrigacoes-fiscais", label: "Obrigações Fiscais", description: "Calendário de guias e impostos (DAS, DARF, ISS) com vencimento e aviso antes do prazo.",
    today: { href: "/empresa/atividades", label: "Crie como atividade em Agenda / Atividades" } },
  { slug: "pro-labore", label: "Pró-Labore", description: "Retirada mensal dos sócios, separada das despesas da empresa.",
    today: { href: "/previsao", label: "Cadastre como gasto fixo na categoria Pró-labore" } },
  { slug: "funcionarios", label: "Funcionários", description: "Equipe com salário, data de admissão e encargos de cada mês." },
  { slug: "ranking-produtos", label: "Ranking Produtos", description: "Os produtos e serviços que mais vendem e mais dão lucro no período." },
  { slug: "relatorios", label: "Relatórios", description: "Relatórios do período: vendas, despesas por categoria, clientes e comparação entre meses.",
    today: { href: "/empresa/dre", label: "Veja o resultado do mês no DRE Simplificado" } },
  { slug: "metricas", label: "Métricas Tempo Real", description: "Números do dia: vendas, ticket médio e saldo em caixa, atualizados a cada lançamento.",
    today: { href: "/", label: "Veja o resumo no Painel Empresarial" } },
  { slug: "analytics", label: "Analytics", description: "Gráficos da evolução de vendas, despesas e margem ao longo dos meses.",
    today: { href: "/empresa/fluxo-de-caixa", label: "Veja os meses no Fluxo de Caixa" } },
  { slug: "gestao-de-capital", label: "Gestão de Capital", description: "Capital de giro, reservas e quanto a empresa pode retirar sem faltar caixa.",
    today: { href: "/empresa/fluxo-de-caixa", label: "Veja o saldo de cada mês no Fluxo de Caixa" } },
];

export const moduleBySlug = (slug: string) => MODULES.find((m) => m.slug === slug);
