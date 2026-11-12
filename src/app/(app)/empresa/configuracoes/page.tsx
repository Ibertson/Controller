"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { useShell } from "@/components/AppShell";
import { CompanyForm, CompanyModal, useSpace } from "@/components/business";
import { Button, Card, PageTitle, Skeleton } from "@/components/ui";
import { repo, useSnapshot } from "@/lib/data";

/** Dados da empresa (nome, CNPJ, atividade e tipo). */
export default function ConfiguracoesEmpresa() {
  const snap = useSnapshot();
  const { kind, hasBusiness, company } = useSpace();
  const { toast } = useShell();
  const [onboarding, setOnboarding] = useState(false);
  if (!snap) return <Skeleton className="h-64" />;
  if (kind !== "business") {
    return (
      <div className="flex flex-col gap-4">
        <PageTitle>Configurações da empresa</PageTitle>
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <Building2 aria-hidden className="size-9 text-text-muted" />
          <h2 className="font-semibold">{hasBusiness ? "Abra o Empresarial para ver os dados da empresa" : "Cadastre sua empresa"}</h2>
          <p className="max-w-md text-sm text-text-muted">{hasBusiness
            ? "Use a aba Empresarial no topo da tela."
            : "Para acessar o Painel Empresarial, primeiro cadastre os dados da sua empresa."}</p>
          {!hasBusiness && <Button onClick={() => setOnboarding(true)}>Cadastrar empresa</Button>}
        </Card>
        {onboarding && <CompanyModal onClose={() => setOnboarding(false)} onDone={() => setOnboarding(false)} />}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Configurações da empresa</PageTitle>
      <Card className="max-w-xl">
        <CompanyForm key={snap.workspace.id} initial={company} submitLabel="Salvar alterações"
          onSubmit={async (c) => { await repo.updateCompany(c); toast("Dados da empresa salvos"); }} />
      </Card>
    </div>
  );
}
