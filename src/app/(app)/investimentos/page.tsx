import { TrendingUp } from "lucide-react";
import { Card, EmptyState, PageTitle } from "@/components/ui";

export default function Page() {
  return (
    <div>
      <PageTitle>Investimentos</PageTitle>
      <Card><EmptyState icon={TrendingUp} title="Acompanhe quanto você tem aplicado e quanto rendeu. Esta tela chega numa próxima etapa." /></Card>
    </div>
  );
}
