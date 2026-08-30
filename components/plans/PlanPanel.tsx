import { Route } from "lucide-react";
import type { PlanVariant } from "@/lib/types";
import { PlanVariantCard } from "@/components/plans/PlanVariantCard";

export function PlanPanel({
  plans,
  onOpenPlace,
  onGeneratePlans,
  onPlanComment,
  onPlanRevise
}: {
  plans: PlanVariant[];
  onOpenPlace: (nodeId: string) => void;
  onGeneratePlans: () => void;
  onPlanComment: (plan: PlanVariant, text: string) => void;
  onPlanRevise: (plan: PlanVariant) => void;
}) {
  return (
    <div className="h-full min-h-0 overflow-y-auto p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Route size={17} aria-hidden="true" />
          结构方案
        </div>
        <button
          type="button"
          className="focus-ring rounded-full bg-coral px-3 py-2 text-xs font-semibold text-white"
          onClick={onGeneratePlans}
        >
          生成方案
        </button>
      </div>

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
              onOpenPlace={onOpenPlace}
              onComment={onPlanComment}
              onRevise={onPlanRevise}
            />
          ))}
        </div>
      )}
    </div>
  );
}
