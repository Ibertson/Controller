import { Car } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui";

export default function Page() {
  return (
    <div>
      <PageTitle>Veículos</PageTitle>
      <Card><EmptyState icon={Car} title="Gastos com cada carro ou moto: combustível, manutenção, IPVA. Esta tela chega numa próxima etapa." /></Card>
    </div>
  );
}
