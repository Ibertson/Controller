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

## Dados

Sem configuração, os dados ficam só no navegador (`src/lib/data/local.ts`) e você entra pelo nome.
Com o Supabase, entra por um link no email e os dados ficam na sua conta (`src/lib/data/supabase.ts`):

1. No Supabase, rode `supabase/migrations/20261019000000_fase1.sql` no SQL Editor.
2. Em Authentication → URL Configuration, coloque o endereço do app em Site URL e adicione
   `http://localhost:3000/**` e o endereço da Vercel em Redirect URLs.
3. Copie `.env.example` para `.env.local` (ou cadastre as duas variáveis na Vercel) com a URL e a
   chave pública (`sb_publishable_...`).

As duas versões seguem a mesma interface `Repo` (`src/lib/data/repo.ts`), então as telas não mudam.

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
