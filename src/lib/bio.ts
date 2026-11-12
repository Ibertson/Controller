// Link Bio: página pública da empresa com contato, serviços e links, em um dos modelos prontos.
import type { Company } from "./types";

export type TemplateId = "vitrine" | "boutique" | "robusto" | "agil" | "seguranca" | "essence" | "lumina" | "barbearia" | "sabor";

export interface BioItem { id: string; name: string; price?: string }
export interface BioLink { id: string; label: string; url: string }

export interface BioData {
  template: TemplateId;
  /** Cor de destaque (#rrggbb). */
  color: string;
  name: string;
  /** Linha embaixo do nome: categoria ou especialidade. */
  tagline: string;
  city: string;
  /** Logo e capa já reduzidas no navegador (data URL). */
  logo: string | null;
  cover: string | null;
  whatsapp: string;
  instagram: string;
  address: string;
  /** Texto do botão principal (WhatsApp). */
  cta: string;
  /** Diferenciais (até 4). */
  highlights: string[];
  /** Título da lista de serviços/produtos. */
  servicesTitle: string;
  services: BioItem[];
  links: BioLink[];
}

export interface BioPage { slug: string; published: boolean; data: BioData }

export interface Template {
  id: TemplateId; name: string; description: string;
  dark: boolean; serif: boolean;
  /** plain: logo e nome sobre fundo claro; cover: foto/cor de capa no topo; band: faixa da cor com o botão. */
  header: "plain" | "cover" | "band";
  /** circles: bolinhas com a inicial; tiles: quadrados; list: lista com preço. */
  items: "circles" | "tiles" | "list";
  /** icons: linha de ícones; cards: blocos 2×2. */
  badges: "icons" | "cards";
  defaults: { tagline: string; cta: string; servicesTitle: string; highlights: string[] };
}

export const TEMPLATES: Template[] = [
  { id: "vitrine", name: "Vitrine", description: "Loja completa: serviços, destaques, contato e links", dark: false, serif: true, header: "plain", items: "list", badges: "icons",
    defaults: { tagline: "Categoria do seu negócio", cta: "Chamar no WhatsApp", servicesTitle: "Nossos serviços", highlights: ["Atendimento rápido", "Profissional especializado", "Produtos de qualidade", "Pagamento seguro"] } },
  { id: "boutique", name: "Boutique", description: "Serviços em destaque e os mais contratados", dark: false, serif: false, header: "plain", items: "circles", badges: "icons",
    defaults: { tagline: "Nail Designer", cta: "Agendar horário", servicesTitle: "Serviços", highlights: ["Agendamento fácil", "Produtos de qualidade", "Pagamento seguro", "Atendimento personalizado"] } },
  { id: "robusto", name: "Robusto", description: "Visual firme para serviços e reformas: selos de confiança e orçamento rápido", dark: false, serif: false, header: "cover", items: "tiles", badges: "icons",
    defaults: { tagline: "Pintor profissional", cta: "Pedir orçamento", servicesTitle: "Serviços", highlights: ["Garantia de serviço", "Pontualidade", "Materiais de qualidade", "Orçamento em 24h"] } },
  { id: "agil", name: "Ágil", description: "Atendimento rápido para prestadores de serviço: capa, destaques e contato direto", dark: false, serif: false, header: "band", items: "circles", badges: "icons",
    defaults: { tagline: "Encanador 24h", cta: "Chamar agora pelo WhatsApp", servicesTitle: "Serviços", highlights: ["Atendimento 24h", "Serviço garantido", "Orçamento grátis", "Profissional experiente"] } },
  { id: "seguranca", name: "Segurança", description: "Visual técnico e confiável para serviços especializados", dark: true, serif: false, header: "band", items: "list", badges: "cards",
    defaults: { tagline: "Eletricista residencial", cta: "Solicitar orçamento", servicesTitle: "Serviços", highlights: ["Serviço certificado", "Atendimento rápido", "Instalação segura", "Orçamento sem compromisso"] } },
  { id: "essence", name: "Essence", description: "Estética e bem-estar: tratamentos em destaque e contato fácil", dark: false, serif: true, header: "cover", items: "circles", badges: "icons",
    defaults: { tagline: "Esteticista", cta: "Agendar horário", servicesTitle: "Nossos serviços", highlights: ["Agendamento fácil", "Produtos de qualidade", "Atendimento personalizado", "Profissional especializada"] } },
  { id: "lumina", name: "Lumina", description: "Visual sofisticado para moda: peças em destaque e mais vendidos", dark: false, serif: true, header: "cover", items: "circles", badges: "icons",
    defaults: { tagline: "Moda feminina", cta: "Comprar pelo WhatsApp", servicesTitle: "Categorias", highlights: ["Peças exclusivas", "Pagamento seguro", "Qualidade garantida", "Atendimento personalizado"] } },
  { id: "barbearia", name: "Barbearia", description: "Clássico e elegante para barbearias e salões: serviços e combos", dark: true, serif: true, header: "plain", items: "circles", badges: "icons",
    defaults: { tagline: "Barbearia", cta: "Agendar horário", servicesTitle: "Nossos serviços", highlights: ["Barbeiros experientes", "Sem espera", "Higiene e cuidado", "Satisfação garantida"] } },
  { id: "sabor", name: "Sabor", description: "Cardápio visual e vibrante para delivery e restaurantes", dark: true, serif: false, header: "cover", items: "circles", badges: "icons",
    defaults: { tagline: "Hamburgueria artesanal", cta: "Fazer pedido", servicesTitle: "Cardápio", highlights: ["Entrega rápida", "Ingredientes frescos", "Pagamento na entrega", "Aprovado pelos clientes"] } },
];
export const templateOf = (id: TemplateId) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];

/** Cores de destaque prontas (a última opção do seletor é livre). */
export const BIO_COLORS = ["#c2410c", "#1d4ed8", "#0b7a5e", "#6d28d9", "#b91c1c", "#111827"];

export const MAX = { highlights: 4, services: 12, links: 8 };

/** Endereço do link: letras minúsculas, números e hífen, de 3 a 40. */
export function cleanSlug(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-/, "").slice(0, 40);
}
export const validSlug = (s: string) => /^[a-z0-9][a-z0-9-]{2,39}$/.test(s) && !s.endsWith("-");
export function randomSlug(): string {
  const a = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) => a[n % a.length]).join("");
}

/** Página nova com os dados da empresa e os textos do modelo escolhido. */
export function defaultBio(company: Company | null, template: TemplateId = "vitrine"): BioData {
  const t = templateOf(template);
  const d = company?.details ?? {};
  return {
    template, color: BIO_COLORS[0], name: company?.name ?? "", tagline: company?.activity || t.defaults.tagline,
    city: [d.city, d.uf].filter(Boolean).join(" - "), logo: null, cover: null, whatsapp: "", instagram: "", address: "",
    cta: t.defaults.cta, highlights: [...t.defaults.highlights], servicesTitle: t.defaults.servicesTitle, services: [], links: [],
  };
}

/** Troca de modelo: textos que ainda são os do modelo anterior passam a ser os do novo. */
export function switchTemplate(d: BioData, to: TemplateId): BioData {
  const from = templateOf(d.template).defaults, next = templateOf(to).defaults;
  const keep = (cur: string, old: string, neu: string) => (cur === old || !cur ? neu : cur);
  const sameHighlights = d.highlights.every((h, i) => h === from.highlights[i]);
  return {
    ...d, template: to, cta: keep(d.cta, from.cta, next.cta), servicesTitle: keep(d.servicesTitle, from.servicesTitle, next.servicesTitle),
    tagline: keep(d.tagline, from.tagline, next.tagline), highlights: sameHighlights ? [...next.highlights] : d.highlights,
  };
}

/** Link do WhatsApp (Brasil): só dígitos, com 55 na frente quando falta. */
export function whatsappUrl(phone: string, text = "Olá! Vim pelo seu link."): string | null {
  const d = phone.replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}?text=${encodeURIComponent(text)}`;
}
export function instagramUrl(v: string): string | null {
  const h = v.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
  return /^[a-z0-9._]{1,30}$/i.test(h) ? `https://instagram.com/${h}` : null;
}
export const mapsUrl = (address: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
/** Só deixa sair para http(s); sem esquema, completa com https://. */
export function safeUrl(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch { return null; }
}

/** Confere a página antes de salvar; devolve o primeiro problema ou null. */
export function bioProblem(p: BioPage): string | null {
  if (!validSlug(p.slug)) return "O endereço precisa de 3 a 40 letras minúsculas, números ou hífen.";
  if (!p.data.name.trim()) return "Informe o nome que aparece na página.";
  if (p.data.whatsapp && !whatsappUrl(p.data.whatsapp)) return "WhatsApp inválido. Use DDD + número.";
  if (p.data.instagram && !instagramUrl(p.data.instagram)) return "Instagram inválido. Use o @ do perfil.";
  const bad = p.data.links.find((l) => !l.label.trim() || !safeUrl(l.url));
  if (bad) return "Cada link precisa de um nome e de um endereço válido.";
  if (p.data.services.some((s) => !s.name.trim())) return "Dê um nome a cada serviço ou remova os vazios.";
  return null;
}
