import { describe, expect, it } from "vitest";
import { counterpart, parseBankStatement } from "./bankStatement";
import { parseCsv } from "./statement";

// Mesmo formato do CSV do Bradesco, com nomes e valores fictícios.
const SAMPLE = [
  "Extrato de: Ag: 1234 | Conta: 55555-5 | Entre 01/09/2026 e 30/09/2026",
  "Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$);",
  '31/08/26;SALDO ANTERIOR;;;;"1.000,00"',
  '02/09/26; Pix Recebido;1258316;"500,00";;"1.500,00"',
  ";Rem: Fulano de Tal 02/09;;",
  '04/09/26; Pagto Cobranca;0000477;;"-200,50";',
  ";Empresa Exemplo Ltda;;",
  '04/09/26; Pix Enviado;0633306;;"-99,50";"1.200,00"',
  ";Des: Ciclano Souza 04/09;;",
  '30/09/26; Rent.inv.facil;0000002;"0,07";;"1.200,07"',
  ';Total;;"500,07";"-300,00";"1.200,07"',
  "Os dados acima têm como base 02/11/2026 às 18h47 e estão sujeitos a alterações.",
  "Últimos Lançamentos",
  "Data;Histórico;Docto.;Crédito (R$);Débito (R$);",
  "29/10/26;SALDO ANTERIOR;;;;",
  '30/10/26; Pix Enviado;0639101;;"-20,00";',
  ";Des: Beltrano 30/10;;",
  ';Total;;"0,00";"-20,00"',
  "Saldos Invest Fácil",
  "Data;Histórico;Saldo (R$);",
  "01/09/26; Saldo Invest Fácil;1.000,10;",
].join("\r");

describe("parseBankStatement", () => {
  const parsed = parseBankStatement(parseCsv(SAMPLE), "Bradesco_02112026.csv")!;

  it("lê cabeçalho, saldos e totais", () => {
    expect(parsed.info).toMatchObject({
      bank: "Bradesco", agency: "1234", account: "55555-5", periodStart: "2026-09-01", periodEnd: "2026-09-30",
      openingCents: 100000, openingDate: "2026-08-31", totalCreditCents: 50007, totalDebitCents: -30000, closingCents: 120007,
      generatedAt: "02/11/2026 às 18h47",
    });
    expect(parsed.info.checks).toEqual({ totalsOk: true, columnsOk: true, balanceMismatches: 0 });
    expect(parsed.info.dailyBalances).toEqual([{ date: "2026-09-01", balanceCents: 100010 }]);
  });

  it("separa colunas e junta a linha de complemento", () => {
    expect(parsed.rows).toHaveLength(5);
    expect(parsed.rows[0]).toMatchObject({ date: "2026-09-02", history: "Pix Recebido", detail: "Rem: Fulano de Tal 02/09", doc: "1258316",
      creditCents: 50000, amountCents: 50000, balanceCents: 150000, runningCents: 150000, description: "Pix Recebido · Fulano de Tal" });
    expect(parsed.rows[1]).toMatchObject({ debitCents: -20050, amountCents: -20050, detail: "Empresa Exemplo Ltda", balanceCents: undefined, runningCents: 129950 });
    expect(parsed.rows[3]).toMatchObject({ history: "Rent.inv.facil", amountCents: 7 });
    expect(parsed.rows[4]).toMatchObject({ section: "recentes", date: "2026-10-30", amountCents: -2000 });
  });

  it("aponta saldo que não bate", () => {
    const bad = parseBankStatement(parseCsv(SAMPLE.replace('"1.500,00"', '"1.600,00"')))!;
    expect(bad.info.checks.balanceMismatches).toBe(1);
  });

  it("não é extrato de banco sem Histórico", () => {
    expect(parseBankStatement(parseCsv("Data;Descrição;Valor\n01/09/2026;Mercado;-10,00"))).toBeNull();
  });

  it("limpa Rem/Des e a data do fim", () => {
    expect(counterpart("Des: Receita Federal 21/09")).toBe("Receita Federal");
    expect(counterpart("Remet.ibertson Henrique s")).toBe("ibertson Henrique s");
  });
});
