# Sobra

Controle simples do dinheiro pessoal: quanto entra, quanto sai e quanto sobra no mês.
App web instalável (PWA) feito com Next.js. Uso pessoal.

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # regras de dinheiro, fatura, parcelas e resumos
npm run build
```

Por enquanto os dados ficam no navegador (`src/lib/data/local.ts`). A troca para o Supabase
(login por email e banco Postgres) é uma nova implementação da mesma interface `Repo`
(`src/lib/data/repo.ts`), sem mudar as telas. O esquema do banco está em `supabase/migrations/`.

## Onde está cada coisa

| pasta | o que tem |
| --- | --- |
| `src/lib/money.ts`, `dates.ts` | centavos, formatação em reais, fatura do cartão, datas no fuso de São Paulo |
| `src/lib/transactions.ts` | validação do lançamento e geração das parcelas |
| `src/lib/summary.ts` | saldos, totais do mês, sobra prevista, limites, contas a vencer |
| `src/lib/data/` | camada de dados (`Repo`) e a versão local |
| `src/components/` | layout, formulário de lançamento, lista, primitivos de UI |
| `src/app/(app)/` | telas: visão geral, extrato, contas, cartões, categorias, pessoas, etc. |
| `src/app/globals.css` | tema (cores, tipos, espaços) gerado dos tokens de design |

## Regras importantes

- Dinheiro sempre em centavos inteiros.
- Datas de lançamento são dias (`AAAA-MM-DD`), sem fuso.
- Compra no cartão no dia do fechamento ou depois cai na fatura seguinte.
- Parcelado: uma linha por parcela; os centavos que sobram vão para a 1ª.
