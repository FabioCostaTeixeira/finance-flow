export interface PlanStep {
  id: string;
  description: string;
  tool: string;
  args: Record<string, unknown>;
  depends_on?: string[];
  status: "pending" | "running" | "done" | "failed";
  result?: unknown;
  error?: string;
}

export interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
  created_at: string;
}

export function createPlan(goal: string, steps: Omit<PlanStep, "status">[]): Plan {
  return {
    id: crypto.randomUUID(),
    goal,
    steps: steps.map((s) => ({ ...s, status: "pending" })),
    created_at: new Date().toISOString(),
  };
}

export function getNextStep(plan: Plan): PlanStep | null {
  for (const step of plan.steps) {
    if (step.status !== "pending") continue;
    const deps = step.depends_on ?? [];
    const depsResolved = deps.every((depId) => {
      const dep = plan.steps.find((s) => s.id === depId);
      return dep?.status === "done";
    });
    if (depsResolved) return step;
  }
  return null;
}

export function markStep(
  plan: Plan,
  stepId: string,
  status: "done" | "failed",
  result?: unknown,
  error?: string,
): Plan {
  return {
    ...plan,
    steps: plan.steps.map((s) =>
      s.id === stepId ? { ...s, status, result, error } : s,
    ),
  };
}

export function isPlanComplete(plan: Plan): boolean {
  return plan.steps.every((s) => s.status === "done" || s.status === "failed");
}

export function hasFailed(plan: Plan): boolean {
  return plan.steps.some((s) => s.status === "failed");
}

export function planSummary(plan: Plan): string {
  const done = plan.steps.filter((s) => s.status === "done").length;
  const failed = plan.steps.filter((s) => s.status === "failed").length;
  const total = plan.steps.length;
  return `Plan "${plan.goal}" — ${done}/${total} concluídos, ${failed} com falha`;
}
