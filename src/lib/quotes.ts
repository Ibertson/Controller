// Orçamentos da empresa: tipos de serviço editáveis, totais, situação, filtros e calculadora.
import type { Quote, QuoteCategory, QuoteItem, QuoteStatus } from "./types";

export const QUOTE_ICONS = ["home", "sparkles", "wrench", "wind", "droplets", "hammer", "grid", "car", "laptop", "scissors", "camera", "tag"] as const;
export type QuoteIcon = (typeof QUOTE_ICONS)[number];

const cat = (id: string, name: string, icon: QuoteIcon, items: string[]): QuoteCategory => ({ id, name, icon, items });

/** Tipos de serviço sugeridos na primeira vez; a empresa pode renomear, apagar e criar outros. */
export const DEFAULT_QUOTE_CATALOG: QuoteCategory[] = [
  cat("construcao", "Construção & Reforma", "home", ["Reforma completa de casa/apartamento", "Construção de muro", "Construção de garagem",
    "Instalação de piso (porcelanato, cerâmica, laminado, vinílico, piso em geral)", "Troca de piso", "Reboco / massa corrida",
    "Pintura interna", "Pintura externa", "Gesso e drywall (sanca, divisória, teto)", "Troca/instalação de portas"]),
  cat("marmoraria", "Marmoraria", "sparkles", ["Bancada de cozinha em granito/mármore", "Bancada de banheiro", "Nicho de banheiro",
    "Soleiras e peitoris", "Escadas em granito", "Revestimento de parede", "Ilhas gourmet", "Mesa em pedra (tampo de mesa)"]),
  cat("manutencao", "Manutenção Geral", "wrench", ["Serviços elétricos", "Serviços hidráulicos", "Instalação de ventilador de teto",
    "Instalação de chuveiro", "Conserto de infiltração", "Troca de torneiras/registros", "Pequenos reparos gerais"]),
  cat("climatizacao", "Climatização", "wind", ["Instalação de ar-condicionado", "Manutenção de ar-condicionado", "Higienização de AC"]),
  cat("limpeza", "Limpeza", "droplets", ["Limpeza residencial", "Limpeza comercial", "Limpeza pós-obra", "Limpeza de vidros", "Limpeza de estofado"]),
  cat("marcenaria", "Marcenaria", "hammer", ["Armário planejado de cozinha", "Guarda-roupa / closet", "Painel de TV", "Rack / home office planejado",
    "Armários sob medida para lavanderia"]),
  cat("serralheria", "Serralheria", "grid", ["Portão basculante", "Portão de correr", "Grades e corrimões", "Estruturas metálicas sob medida"]),
  cat("automotiva", "Estética Automotiva", "car", ["Polimento automotivo", "Higienização interna", "Funilaria e pintura de peças"]),
  cat("transporte", "Transporte / Motoristas", "car", ["Viagem intermunicipal", "Viagem interestadual", "Transfer aeroporto", "Frete / entrega",
    "Motorista particular (diária)"]),
  cat("digital", "Serviços Digitais", "laptop", ["Criação de site", "Tráfego pago", "Social media / produção de conteúdo", "Identidade visual", "Edição de vídeos"]),
];

const fold = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca no catálogo: a categoria inteira quando o nome dela bate, senão só as subcategorias que batem. */
export function searchCatalog(list: QuoteCategory[], q: string): QuoteCategory[] {
  const t = fold(q.trim());
  if (!t) return list;
  return list.flatMap((c) => {
    if (fold(c.name).includes(t)) return [c];
    const items = c.items.filter((i) => fold(i).includes(t));
    return items.length ? [{ ...c, items }] : [];
  });
}

/** Limpa o catálogo antes de salvar: nomes aparados, sem vazios nem repetidos. */
export function cleanCatalog(list: QuoteCategory[]): QuoteCategory[] {
  const seen = new Set<string>();
  return list.flatMap((c) => {
    const name = c.name.trim().replace(/\s+/g, " ").slice(0, 60);
    if (!name || seen.has(fold(name))) return [];
    seen.add(fold(name));
    const inner = new Set<string>();
    const items = c.items.map((i) => i.trim().replace(/\s+/g, " ").slice(0, 120)).filter((i) => i && !inner.has(fold(i)) && inner.add(fold(i)));
    return [{ ...c, name, items }];
  });
}

export const QUOTE_STATUSES: { value: QuoteStatus | "vencido"; label: string; tone: string }[] = [
  { value: "enviado", label: "Enviado", tone: "text-text" },
  { value: "visualizado", label: "Visualizado", tone: "text-blue-600 dark:text-blue-400" },
  { value: "aprovado", label: "Aprovado", tone: "text-income" },
  { value: "andamento", label: "Em andamento", tone: "text-warning" },
  { value: "concluido", label: "Concluído", tone: "text-success" },
  { value: "recusado", label: "Recusado", tone: "text-danger" },
  { value: "vencido", label: "Vencido", tone: "text-danger" },
];
export const statusLabel = (s: QuoteStatus | "vencido") => QUOTE_STATUSES.find((x) => x.value === s)?.label ?? s;

/** Vencido: a validade passou e o cliente ainda não respondeu (enviado ou visualizado). */
export function effectiveStatus(q: Pick<Quote, "status" | "validUntil">, todayStr: string): QuoteStatus | "vencido" {
  return (q.status === "enviado" || q.status === "visualizado") && q.validUntil && q.validUntil < todayStr ? "vencido" : q.status;
}

export const itemTotal = (i: Pick<QuoteItem, "qty" | "unitCents">) => Math.round(i.qty * i.unitCents);

export function quoteTotals(q: Pick<Quote, "items" | "discountCents">) {
  const subtotal = q.items.reduce((t, i) => t + itemTotal(i), 0);
  const discount = Math.min(Math.max(0, q.discountCents), subtotal);
  return { subtotal, discount, total: subtotal - discount };
}

export const formatNumber = (n: number) => `ORC-${String(n).padStart(4, "0")}`;
export const nextNumber = (list: Pick<Quote, "number">[]) => list.reduce((m, q) => Math.max(m, q.number), 0) + 1;

export type MonthFilter = "all" | "current";
export function filterQuotes(list: Quote[], f: { q: string; status: QuoteStatus | "vencido" | "all"; month: MonthFilter }, todayStr: string): Quote[] {
  const t = fold(f.q.trim()).replace(/^orc-?/, "");
  return list.filter((q) => {
    if (f.status !== "all" && effectiveStatus(q, todayStr) !== f.status) return false;
    if (f.month === "current" && q.issuedOn.slice(0, 7) !== todayStr.slice(0, 7)) return false;
    if (!t) return true;
    return fold(q.clientName).includes(t) || fold(q.title).includes(t) || String(q.number).padStart(4, "0").includes(t) || String(q.number) === t;
  });
}

export function statusCounts(list: Quote[], todayStr: string): Record<QuoteStatus | "vencido", number> {
  const out = { enviado: 0, visualizado: 0, aprovado: 0, andamento: 0, concluido: 0, recusado: 0, vencido: 0 };
  for (const q of list) out[effectiveStatus(q, todayStr)]++;
  return out;
}

export interface CalcInput { materials: number; labor: number; marginPct: number; taxPct: number; discount: number }
/** Calculadora: margem sobre materiais + mão de obra; impostos sobre o valor com margem; desconto no fim. */
export function calcBudget(c: CalcInput) {
  const subtotal = c.materials + c.labor;
  const margin = Math.round(subtotal * (c.marginPct / 100));
  const taxes = Math.round((subtotal + margin) * (c.taxPct / 100));
  const total = Math.max(0, subtotal + margin + taxes - c.discount);
  return { subtotal, margin, taxes, total };
}

/** Itens de um orçamento a partir da calculadora: margem e impostos entram no preço de materiais e mão de obra. */
export function itemsFromCalc(c: CalcInput, newId: () => string): QuoteItem[] {
  const r = calcBudget({ ...c, discount: 0 });
  const gross = r.subtotal + r.margin + r.taxes;
  const mat = r.subtotal ? Math.round((c.materials * gross) / r.subtotal) : 0;
  const rows: QuoteItem[] = [];
  if (c.materials > 0) rows.push({ id: newId(), description: "Materiais", qty: 1, unitCents: mat });
  if (c.labor > 0 || !rows.length) rows.push({ id: newId(), description: "Mão de obra", qty: 1, unitCents: gross - mat });
  return rows;
}

/** "11 98765-4321" → link do WhatsApp com a mensagem; sem número, abre para escolher o contato. */
export function whatsappShare(phone: string, text: string): string {
  let d = phone.replace(/\D/g, "");
  if (d && d.length <= 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
