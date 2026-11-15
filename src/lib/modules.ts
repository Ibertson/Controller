// Módulos do menu Empresarial que ainda não têm tela própria: o que cada um faz e onde fazer hoje.
export interface Module { slug: string; label: string; description: string; today?: { href: string; label: string } }

export const MODULES: Module[] = [
  { slug: "notas-fiscais", label: "Notas Fiscais", description: "Registro das notas emitidas e recebidas: número, cliente ou fornecedor, valor e data." },
  { slug: "funcionarios", label: "Funcionários", description: "Equipe com salário, data de admissão e encargos de cada mês." },
];

export const moduleBySlug = (slug: string) => MODULES.find((m) => m.slug === slug);
