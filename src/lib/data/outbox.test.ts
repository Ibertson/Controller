import { describe, expect, it } from "vitest";
import { Outbox, isNetworkFailure, type Op, type RunResult } from "./outbox";

function memStore() {
  const m = new Map<string, string>();
  return { m, get: (k: string) => m.get(k) ?? null, set: (k: string, v: string) => void m.set(k, v), remove: (k: string) => void m.delete(k) };
}
const op = (id: string): Op => ({ t: "upsert", table: "transactions", rows: [{ id }] });

/** Servidor de mentira: `net` liga/desliga a conexão; `reject` recusa ids. */
function fakeServer() {
  const s = { net: true, reject: new Set<string>(), sent: [] as string[] };
  const run = async (o: Op): Promise<RunResult> => {
    const id = o.t === "upsert" ? String(o.rows[0].id) : "?";
    if (!s.net) return { ok: false, network: true, message: "Failed to fetch" };
    if (s.reject.has(id)) return { ok: false, network: false, message: `recusado ${id}` };
    s.sent.push(id);
    return { ok: true };
  };
  return { s, run };
}

describe("fila offline", () => {
  it("com conexão envia na hora; recusa do servidor vira erro no formulário", async () => {
    const { s, run } = fakeServer(); const st = memStore();
    const box = new Outbox("k", run, () => {}, () => {}, st);
    await box.send(op("a"));
    expect(s.sent).toEqual(["a"]);
    s.reject.add("b");
    await expect(box.send(op("b"))).rejects.toThrow("recusado b");
    expect(box.pending).toBe(0);
  });

  it("sem conexão guarda no aparelho, sobrevive a reabrir o app e envia na ordem ao voltar", async () => {
    const { s, run } = fakeServer(); const st = memStore();
    s.net = false;
    const box = new Outbox("k", run, () => {}, () => {}, st);
    await box.send(op("a")); await box.send(op("b")); await box.send(op("c"));
    expect(box.pending).toBe(3);
    expect(JSON.parse(st.m.get("k")!)).toHaveLength(3);
    await box.flush(); // o app "fecha" sem conexão

    const reopened = new Outbox("k", run, () => {}, () => {}, st);
    expect(reopened.pending).toBe(3);
    s.net = true;
    await reopened.flush();
    expect(s.sent).toEqual(["a", "b", "c"]);
    expect(reopened.pending).toBe(0);
    expect(st.m.has("k")).toBe(false);
  });

  it("com fila esperando, gravação nova vai para o fim (mantém a ordem)", async () => {
    const { s, run } = fakeServer(); const st = memStore();
    s.net = false;
    const box = new Outbox("k", run, () => {}, () => {}, st);
    await box.send(op("a"));
    s.net = true;
    await box.send(op("b"));
    await box.flush();
    expect(s.sent).toEqual(["a", "b"]);
  });

  it("recusa durante o envio é descartada, avisa e pede recarregar; o resto segue", async () => {
    const { s, run } = fakeServer(); const st = memStore();
    s.net = false;
    let reloads = 0;
    const box = new Outbox("k", run, () => {}, () => { reloads++; }, st);
    await box.send(op("a")); await box.send(op("b")); await box.send(op("c"));
    s.net = true; s.reject.add("b");
    await box.flush();
    expect(s.sent).toEqual(["a", "c"]);
    expect(box.error).toBe("recusado b");
    expect(reloads).toBe(1);
  });

  it("reconhece falta de conexão", () => {
    expect(isNetworkFailure(0, "")).toBe(true);
    expect(isNetworkFailure(undefined, "TypeError: Failed to fetch")).toBe(true);
    expect(isNetworkFailure(409, "duplicate key")).toBe(false);
  });
});
