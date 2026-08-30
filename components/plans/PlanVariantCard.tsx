"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { PlanVariant } from "@/lib/types";
import { EstimateBadge } from "@/components/ui/EstimateBadge";

export function PlanVariantCard({
  plan,
  compact = false,
  onOpenPlace,
  onComment,
  onRevise
}: {
  plan: PlanVariant;
  compact?: boolean;
  onOpenPlace?: (nodeId: string) => void;
  onComment?: (plan: PlanVariant, text: string) => void;
  onRevise?: (plan: PlanVariant) => void;
}) {
  const [comment, setComment] = useState("");

  function submitComment() {
    const text = comment.trim();
    if (!text) return;
    onComment?.(plan, text);
    setComment("");
  }

  return (
    <article className="rounded-[24px] border border-ink/10 bg-white p-5 shadow-[0_10px_28px_rgba(23,33,31,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold leading-6 text-ink">{plan.title}</h3>
          <p className="mt-2 text-sm leading-6 text-ink/65">{plan.summary}</p>
        </div>
        {plan.budgetIsEstimate && <EstimateBadge />}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
        {plan.segments.map((segment, index) => (
          <span key={segment.nodeId} className="inline-flex items-center gap-2">
            <button
              type="button"
              className="focus-ring rounded-full bg-cloud px-3 py-1.5"
              onClick={() => onOpenPlace?.(segment.nodeId)}
            >
              {segment.name} {segment.days} 天
            </button>
            {index < plan.segments.length - 1 && <ArrowRight size={15} aria-hidden="true" />}
          </span>
        ))}
      </div>

      {!compact && (
        <>
          <dl className="mt-4 grid gap-3 text-sm leading-6 text-ink/65">
            <div>
              <dt className="font-semibold text-ink">移动强度</dt>
              <dd>{plan.mobilityText}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">粗预算</dt>
              <dd>{plan.budgetText}</dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <PlanList title="得到什么" items={plan.gains} />
            <PlanList title="放弃什么" items={plan.tradeoffs} />
          </div>

          {plan.unresolvedQuestions.length > 0 && (
            <div className="mt-4 rounded-2xl bg-cloud p-3 text-sm leading-6 text-ink/65">
              还要确认：{plan.unresolvedQuestions.join(" / ")}
            </div>
          )}
        </>
      )}

      {plan.changeSummary?.length ? (
        <div className="mt-4 rounded-2xl bg-sun/20 p-3 text-sm leading-6 text-ink/70">
          与上一版差异：{plan.changeSummary.join(" / ")}
        </div>
      ) : null}

      <div className="mt-4 border-t border-ink/10 pt-4">
        <div className="flex gap-2">
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="评论方案，例如：保留东京箱根，但能不能加 USJ"
            className="focus-ring min-w-0 flex-1 rounded-full border border-ink/10 bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink/35"
          />
          <button
            type="button"
            className="focus-ring rounded-full bg-pine px-3 py-2 text-xs font-semibold text-paper"
            onClick={submitComment}
          >
            发送
          </button>
        </div>
        <button
          type="button"
          className="focus-ring mt-3 w-full rounded-full bg-coral px-3 py-2 text-xs font-semibold text-white"
          onClick={() => onRevise?.(plan)}
        >
          根据结构反馈生成新版
        </button>
      </div>
    </article>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <ul className="mt-2 space-y-2 text-sm text-ink/65">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-coral" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
