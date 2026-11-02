import { parseBankStatement, type BankLine, type StatementInfo } from "./bankStatement";
import { parseCsv, parseOfx, rowsFromTable, type StatementRow } from "./statement";
import { readXlsx, type Cell } from "./xlsx";

export interface StatementFile { rows: (StatementRow & Partial<BankLine>)[]; info?: StatementInfo }

function fromTable(table: Cell[][], name: string): StatementFile {
  const bank = parseBankStatement(table, name);
  return bank ?? { rows: rowsFromTable(table) };
}

/** Lê extrato ou fatura em OFX, CSV ou XLSX, com as colunas e os saldos do banco quando houver. */
export async function readStatementDetail(file: File): Promise<StatementFile> {
  const lower = file.name.toLowerCase();
  let parsed: StatementFile;
  if (lower.endsWith(".ofx") || lower.endsWith(".qfx")) parsed = { rows: parseOfx(await file.text()) };
  else if (lower.endsWith(".xlsx")) parsed = fromTable(await readXlsx(await file.arrayBuffer()), file.name);
  else if (lower.endsWith(".xls")) throw new Error("Arquivos .xls antigos não são lidos. Abra no Excel e salve como .xlsx ou CSV.");
  else {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf); // bancos antigos usam Latin-1
    parsed = /<OFX>|<STMTTRN>/i.test(text) ? { rows: parseOfx(text) } : fromTable(parseCsv(text), file.name);
  }
  if (!parsed.rows.length) throw new Error("Não encontramos lançamentos neste arquivo.");
  return parsed;
}

/** Só as linhas (data, descrição, valor). Lança erro com texto para o usuário. */
export async function readStatementFile(file: File): Promise<StatementRow[]> {
  return (await readStatementDetail(file)).rows;
}
