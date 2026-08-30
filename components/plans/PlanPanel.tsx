import { Route } from "lucide-react";
import type { PlanVariant } from "@/lib/types";
import { PlanVariantCard } from "@/components/plans/PlanVariantCard";

export function PlanPanel({
  plans,
  selectedPlanId,
  status = "idle",
  error,
  onOpenPlace,
  onGeneratePlans,
  onPlanComment,
  onPlanSelect,
  onPlanRevise
}: {
  plans: PlanVariant[];
  selectedPlanId?: string;
  status?: "idle" | "generating" | "revising";
  error?: string;
  onOpenPlace: (nodeId: string) => void;
  onGeneratePlans: () => void;
  onPlanComment: (plan: PlanVariant, text: string) => void;
  onPlanSelect: (planId: string) => void;
  onPlanRevise: (plan: PlanVariant, instruction: string) => void;
}) {
  const isBusy = status === "generating" || status === "revising";

  return (
    <div className="h-full min-h-0 overflow-y-auto p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Route size={17} aria-hidden="true" />
          结构方案
        </div>
        <button
          type="button"
          className="focus-ring rounded-full bg-coral px-3 py-2 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          onClick={onGeneratePlans}
          disabled={isBusy}
        >
          {status === "generating" ? "生成中..." : "生成方案"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-2xl border border-coral/25 bg-coral/10 p-3 text-xs leading-5 text-coral">
          {error}
        </div>
      )}

      {plans.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-ink/15 p-5 text-sm leading-6 text-ink/55">
          当大家逐渐表达出城市、自然、主题乐园或节奏偏好后，AI 会先生成 2-3 个旅行结构方案。
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {plans.map((plan) => (
            <PlanVariantCard
              key={plan.id}
              plan={plan}
              selected={plan.id === selectedPlanId}
              isBusy={isBusy}
              onOpenPlace={onOpenPlace}
              onSelect={() => onPlanSelect(plan.id)}
              onComment={onPlanComment}
              onRevise={onPlanRevise}
            />
          ))}
        </div>
      )}
    </div>
  );
}
