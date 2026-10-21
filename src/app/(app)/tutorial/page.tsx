import { Card, PageTitle } from "@/components/ui";

const steps = [
  ["Cadastre suas contas", "Em Contas, informe cada conta e o saldo de hoje. A carteira também conta."],
  ["Cadastre seus cartões", "Em Cartões, informe o limite e os dias de fechamento e vencimento."],
  ["Lance o que entra e o que sai", "Use o botão Novo lançamento (ou a tecla N). Compras parceladas no cartão já viram parcelas."],
  ["Defina limites", "Em Categorias, coloque um limite por mês. O painel avisa quando chegar perto."],
  ["Acompanhe no painel", "Escolha o mês no topo e veja saldo, fatura, contas a pagar e os gráficos."],
  ["Olhe para frente", "Em Previsão, veja o saldo dos próximos meses com as parcelas e contas já lançadas."],
];

export default function Page() {
  return (
    <div>
      <PageTitle>Tutorial</PageTitle>
      <Card>
        <ol className="flex flex-col gap-4">
          {steps.map(([title, text], i) => (
            <li key={title} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-pill bg-accent font-semibold text-on-accent">{i + 1}</span>
              <div><h2 className="font-semibold">{title}</h2><p className="text-text-muted">{text}</p></div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
