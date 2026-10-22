// Metas: categorias, imagens prontas, cores e quanto já foi guardado.
import type { Goal, GoalCategory, Snapshot } from "./types";

export const GOAL_CATEGORIES: [GoalCategory, string][] = [
  ["viagem", "Viagem"], ["tecnologia", "Tecnologia"], ["educacao", "Educação"], ["saude", "Saúde"],
  ["casa", "Casa"], ["veiculo", "Veículo"], ["investimento", "Investimento"], ["outro", "Outro"],
];
export const goalCategoryLabel = (c: GoalCategory) => GOAL_CATEGORIES.find(([k]) => k === c)?.[1] ?? "Outro";

/** Imagem pronta de cada categoria: "preset:<categoria>". */
export const presetImage = (c: GoalCategory) => `preset:${c}`;
export const isPreset = (image: string | null): image is string => !!image?.startsWith("preset:");

export const GOAL_COLORS = ["#ea7a26", "#3fb34f", "#3a96dd", "#d99a1e", "#d6439a", "#d9443a"];

/** Quanto já foi guardado em cada meta (aportes menos resgates). */
export function savedByGoal(s: Snapshot): Map<string, number> {
  const out = new Map<string, number>();
  for (const c of s.goalContributions ?? []) out.set(c.goalId, (out.get(c.goalId) ?? 0) + c.amountCents);
  return out;
}

export function goalSummary(s: Snapshot) {
  const saved = savedByGoal(s);
  const goals = (s.goals ?? []).filter((g) => g.status !== "archived");
  const active = goals.filter((g) => g.status === "active");
  const done = goals.filter((g) => g.status === "done");
  return {
    active, done,
    totalSavedCents: goals.reduce((a, g) => a + Math.max(0, saved.get(g.id) ?? 0), 0),
    totalTargetCents: active.reduce((a, g) => a + g.targetCents, 0),
  };
}

/** Quanto falta guardar por mês até a data da meta (null sem data ou já atingida). */
export function monthlyNeeded(g: Pick<Goal, "targetCents" | "targetDate">, savedCents: number, todayStr: string): number | null {
  if (!g.targetDate || savedCents >= g.targetCents) return null;
  const [y1, m1] = todayStr.split("-").map(Number);
  const [y2, m2] = g.targetDate.split("-").map(Number);
  const months = Math.max(1, (y2 - y1) * 12 + (m2 - m1));
  return Math.ceil((g.targetCents - savedCents) / months);
}
