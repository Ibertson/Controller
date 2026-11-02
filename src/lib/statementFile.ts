import { parseCsv, parseOfx, rowsFromTable, type StatementRow } from "./statement";
import { readXlsx } from "./xlsx";

/** Lê extrato ou fatura em OFX, CSV ou XLSX. Lança erro com texto para o usuário. */
export async function readStatementFile(file: File): Promise<StatementRow[]> {
  const lower = file.name.toLowerCase();
  let parsed: StatementRow[];
  if (lower.endsWith(".ofx") || lower.endsWith(".qfx")) parsed = parseOfx(await file.text());
  else if (lower.endsWith(".xlsx")) parsed = rowsFromTable(await readXlsx(await file.arrayBuffer()));
  else if (lower.endsWith(".xls")) throw new Error("Arquivos .xls antigos não são lidos. Abra no Excel e salve como .xlsx ou CSV.");
  else {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buf); // bancos antigos usam Latin-1
    parsed = /<OFX>|<STMTTRN>/i.test(text) ? parseOfx(text) : rowsFromTable(parseCsv(text));
  }
  if (!parsed.length) throw new Error("Não encontramos lançamentos neste arquivo.");
  return parsed;
}
