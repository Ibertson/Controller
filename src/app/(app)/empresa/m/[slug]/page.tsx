import { notFound } from "next/navigation";
import { MODULES, moduleBySlug } from "@/lib/modules";
import { ModuleView } from "./ModuleView";

export function generateStaticParams() {
  return MODULES.map((m) => ({ slug: m.slug }));
}

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const m = moduleBySlug((await params).slug);
  if (!m) notFound();
  return <ModuleView module={m} />;
}
