import type { Snapshot, Transaction } from "./types";

const kindLabel: Record<Transaction["kind"], string> = { income: "Receita", expense: "Despesa", transfer: "Transferência", card_payment: "Pagamento de fatura" };

/** CSV com ponto e vírgula e vírgula decimal, que o Excel em português abre direto. */
export function transactionsCsv(s: Snapshot, items: Transaction[]): string {
  const name = <T extends { id: string; name: string }>(list: T[], id: string | null) => (id ? list.find((x) => x.id === id)?.name ?? "" : "");
  const cell = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [...items].sort((a, b) => a.occurredOn.localeCompare(b.occurredOn)).map((t) => [
    t.occurredOn, kindLabel[t.kind], t.description, name(s.categories, t.categoryId),
    name(s.accounts, t.accountId) || name(s.cards, t.cardId), name(s.people, t.personId),
    ((t.kind === "expense" || t.kind === "card_payment" ? -1 : 1) * t.amountCents / 100).toFixed(2).replace(".", ","),
    t.isPaid ? "Sim" : "Não",
    t.installmentTotal ? `${t.installmentNumber}/${t.installmentTotal}` : "",
  ]);
  return [["Data", "Tipo", "Descrição", "Categoria", "Conta ou cartão", "Pessoa", "Valor", "Pago", "Parcela"], ...rows]
    .map((r) => r.map((v) => cell(String(v))).join(";")).join("\r\n");
}
