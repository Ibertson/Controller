/**
 * Fila de alterações para usar o app sem internet. Cada gravação vira uma operação simples
 * (sem funções dentro), guardada no aparelho e enviada ao servidor, na ordem, quando há conexão.
 */
export type Row = Record<string, unknown>;

export type Op =
  /** Cria ou substitui linhas pelo id (repetir não duplica nada). */
  | { t: "upsert"; table: string; rows: Row[] }
  | { t: "update"; table: string; patch: Row; ids: string[] }
  | { t: "delete"; table: string; ids: string[] }
  /** Apaga tudo de uma tabela no espaço (usado em "apagar tudo"). */
  | { t: "clear"; table: string; workspaceId: string };

/** Resultado de enviar uma operação: ok, sem conexão (tentar depois) ou recusada pelo servidor. */
export type RunResult = { ok: true } | { ok: false; network: boolean; message: string };

export interface SyncStatus {
  online: boolean;
  /** Alterações guardadas no aparelho esperando envio. */
  pending: number;
  syncing: boolean;
  /** Última alteração que o servidor recusou (os dados são recarregados do servidor). */
  error: string | null;
}

/** Sem conexão: fetch falhou (status 0) ou o navegador diz que está offline. */
export function isNetworkFailure(status: number | undefined, message: string): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return status === 0 || /failed to fetch|fetch failed|networkerror|load failed|network request failed/i.test(message);
}

interface Store { get(key: string): string | null; set(key: string, value: string): void; remove(key: string): void }

export const browserStore: Store = {
  get: (k) => { try { return window.localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* cheio ou bloqueado: segue em memória */ } },
  remove: (k) => { try { window.localStorage.removeItem(k); } catch { /* idem */ } },
};

/**
 * Guarda e envia as operações de um usuário. `run` faz a chamada ao servidor.
 * `send` tenta na hora quando não há fila; sem conexão, guarda e devolve sem erro.
 */
export class Outbox {
  private ops: Op[] = [];
  private flushing: Promise<void> | null = null;
  private again = false;
  error: string | null = null;

  constructor(
    private key: string,
    private run: (op: Op) => Promise<RunResult>,
    private onChange: () => void,
    private onRejected: () => void,
    private store: Store = browserStore,
  ) {
    try { this.ops = JSON.parse(store.get(key) ?? "[]") as Op[]; } catch { this.ops = []; }
  }

  get pending() { return this.ops.length; }

  private save() {
    if (this.ops.length) this.store.set(this.key, JSON.stringify(this.ops));
    else this.store.remove(this.key);
  }

  /**
   * Grava uma operação. Com conexão e fila vazia, envia na hora e repassa a recusa do servidor
   * (o formulário mostra o erro). Sem conexão, ou com fila esperando, entra no fim da fila.
   */
  async send(op: Op): Promise<void> {
    if (!this.ops.length && !this.flushing) {
      const r = await this.run(op);
      if (r.ok) return;
      if (!r.network) throw new Error(r.message);
    }
    this.ops.push(op);
    this.save();
    this.onChange();
    void this.flush();
  }

  /** Envia a fila na ordem. Para na primeira falta de conexão; descarta o que o servidor recusar. */
  flush(): Promise<void> {
    // Pedido no meio de um envio (ex.: a conexão voltou agora): roda de novo ao terminar.
    if (this.flushing) { this.again = true; return this.flushing; }
    this.flushing = (async () => {
      do { this.again = false; await this.drain(); } while (this.again && this.ops.length);
    })().finally(() => { this.flushing = null; this.onChange(); });
    this.onChange();
    return this.flushing;
  }

  get syncing() { return this.flushing !== null; }

  private async drain() {
    let rejected = false;
    while (this.ops.length) {
      const r = await this.run(this.ops[0]);
      if (!r.ok && r.network) break;
      if (!r.ok) { rejected = true; this.error = r.message; }
      this.ops.shift();
      this.save();
      this.onChange();
    }
    if (rejected) this.onRejected();
  }

  clear() { this.ops = []; this.save(); this.error = null; this.onChange(); }
}
