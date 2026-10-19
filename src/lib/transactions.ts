import { splitInstallments } from "./money";
import { addMonths, addMonthsToDay, statementMonthFor } from "./dates";
import type { Card, NewTransactionInput, Transaction } from "./types";

export class ValidationError extends Error {
  constructor(public field: string, message: string) { super(message); }
}

/** Valida a entrada e gera as linhas a gravar (uma por parcela). Pura: sem acesso a dados. */
export function buildTransactions(
  input: NewTransactionInput,
  ctx: { workspaceId: string; card?: Card; newId: () => string; now: string },
): Transaction[] {
  const n = input.installments ?? 1;
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new ValidationError("amount", "Informe um valor maior que zero.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.occurredOn)) throw new ValidationError("date", "Data inválida.");
  if (n < 1 || n > 120) throw new ValidationError("installments", "Parcelas entre 1 e 120.");

  const { kind } = input;
  if (kind === "expense" && !input.accountId === !input.cardId) throw new ValidationError("source", "Escolha uma conta ou um cartão.");
  if (kind === "income" && !input.accountId) throw new ValidationError("source", "Escolha a conta que recebeu.");
  if (kind === "transfer") {
    if (!input.accountId || !input.toAccountId) throw new ValidationError("source", "Escolha as duas contas.");
    if (input.accountId === input.toAccountId) throw new ValidationError("source", "As contas precisam ser diferentes.");
  }
  if (kind === "card_payment" && (!input.accountId || !input.cardId)) throw new ValidationError("source", "Escolha a conta e o cartão.");
  if (n > 1 && !(kind === "expense" && input.cardId)) throw new ValidationError("installments", "Parcelamento só para compras no cartão.");
  if (input.cardId && !ctx.card) throw new ValidationError("source", "Cartão não encontrado.");

  const amounts = splitInstallments(input.amountCents, n);
  const groupId = n > 1 ? ctx.newId() : null;
  const firstStatement = kind === "expense" && input.cardId && ctx.card ? statementMonthFor(input.occurredOn, ctx.card.closingDay) : null;

  return amounts.map((amountCents, i) => ({
    id: ctx.newId(),
    workspaceId: ctx.workspaceId,
    kind,
    amountCents,
    occurredOn: n > 1 ? addMonthsToDay(input.occurredOn, i) : input.occurredOn,
    description: input.description.trim(),
    categoryId: kind === "transfer" ? null : input.categoryId ?? null,
    accountId: input.cardId && kind === "expense" ? null : input.accountId ?? null,
    toAccountId: kind === "transfer" ? input.toAccountId ?? null : null,
    cardId: input.cardId ?? null,
    statementMonth: firstStatement ? addMonths(firstStatement, i) : kind === "card_payment" ? input.statementMonth ?? null : null,
    personId: input.personId ?? null,
    installmentGroupId: groupId,
    installmentNumber: groupId ? i + 1 : null,
    installmentTotal: groupId ? n : null,
    isPaid: input.cardId ? true : input.isPaid ?? true,
    dueOn: input.isPaid === false ? input.dueOn ?? input.occurredOn : null,
    source: "app",
    createdAt: ctx.now,
  }));
}
