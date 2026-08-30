"use client";

import { ArrowRight, CheckCircle2, MapPinned } from "lucide-react";
import { useState } from "react";
import type { PlanVariant } from "@/lib/types";
import { EstimateBadge } from "@/components/ui/EstimateBadge";

export function PlanVariantCard({
  plan,
  selected = false,
  isBusy = false,
  compact = false,
  onOpenPlace,
  onSelect,
  onComment,
  onRevise
}: {
  plan: PlanVariant;
  selected?: boolean;
  isBusy?: boolean;
  compact?: boolean;
  onOpenPlace?: (nodeId: string) => void;
  onSelect?: () => void;
  onComment?: (plan: PlanVariant, text: string) => void;
  onRevise?: (plan: PlanVariant, instruction: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [revisionInstruction, setRevisionInstruction] = useState("第二天太满了，轻松一点");
  const [showItinerary, setShowItinerary] = useState(false);

  function submitComment() {
    const text = comment.trim();
    if (!text) return;
    onComment?.(plan, text);
    setComment("");
  }

  return (
    <article className={`rounded-[24px] border bg-white p-5 shadow-[0_10px_28px_rgba(23,33,31,0.08)] ${selected ? "border-coral/55 ring-4 ring-coral/10" : "border-ink/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold leading-6 text-ink">{plan.title}</h3>
            {typeof plan.score === "number" && (
              <span className="rounded-full bg-pine px-2.5 py-1 text-xs font-bold text-paper">
                Score {plan.score}
              </span>
            )}
            {plan.modelName && (
              <span className="rounded-full bg-cloud px-2.5 py-1 text-[10px] font-semibold text-ink/55">
                {plan.modelName} · v{plan.version}
              </span>
            )}
          </div>
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
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-ink/65 md:grid-cols-3">
            <Metric label="偏好匹配" value={plan.scoringBreakdown?.memberPreferenceFit} />
            <Metric label="路线可行" value={plan.scoringBreakdown?.routeFeasibility} />
            <Metric label="节奏" value={plan.scoringBreakdown?.schedulePace} />
          </div>

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

          {plan.validation?.issues.length ? (
            <div className="mt-4 rounded-2xl bg-cloud p-3 text-xs leading-5 text-ink/60">
              校验：{plan.validation.issues.map((issue) => issue.message).join(" / ")}
            </div>
          ) : null}
        </>
      )}

      {plan.changeSummary?.length ? (
        <div className="mt-4 rounded-2xl bg-sun/20 p-3 text-sm leading-6 text-ink/70">
          与上一版差异：{plan.changeSummary.join(" / ")}
        </div>
      ) : null}

      <div className="mt-4 border-t border-ink/10 pt-4">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className={`focus-ring inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ${selected ? "bg-pine text-paper" : "bg-cloud text-ink"}`}
            onClick={onSelect}
          >
            <MapPinned size={14} aria-hidden="true" />
            {selected ? "地图展示中" : "在地图展示"}
          </button>
          <button
            type="button"
            className="focus-ring rounded-full bg-cloud px-3 py-2 text-xs font-semibold text-ink"
            onClick={() => setShowItinerary((current) => !current)}
          >
            {showItinerary ? "收起完整行程" : "查看完整行程"}
          </button>
        </div>
        {showItinerary && <ItineraryList plan={plan} onOpenPlace={onOpenPlace} />}
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
        <div className="mt-3 flex gap-2">
          <input
            value={revisionInstruction}
            onChange={(event) => setRevisionInstruction(event.target.value)}
            placeholder="AI 修改，例如：第二天太满了，轻松一点"
            className="focus-ring min-w-0 flex-1 rounded-full border border-ink/10 bg-paper px-3 py-2 text-xs text-ink placeholder:text-ink/35"
          />
          <button
            type="button"
            className="focus-ring rounded-full bg-coral px-3 py-2 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            disabled={isBusy}
            onClick={() => onRevise?.(plan, revisionInstruction)}
          >
            AI 修改
          </button>
        </div>
        <button
          type="button"
          className="focus-ring mt-3 w-full rounded-full bg-cloud px-3 py-2 text-xs font-semibold text-ink disabled:cursor-wait disabled:opacity-60"
          disabled={isBusy}
          onClick={() => onRevise?.(plan, revisionInstruction)}
        >
          根据结构反馈生成新版
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl bg-cloud px-3 py-2">
      <div className="font-semibold text-ink">{label}</div>
      <div>{typeof value === "number" ? `${Math.round(value)}` : "待评估"}</div>
    </div>
  );
}

function ItineraryList({
  plan,
  onOpenPlace
}: {
  plan: PlanVariant;
  onOpenPlace?: (nodeId: string) => void;
}) {
  if (!plan.itinerary?.length) {
    return (
      <div className="mb-3 rounded-2xl bg-cloud p-3 text-sm leading-6 text-ink/60">
        这个方案还没有完整 Day-by-Day。
      </div>
    );
  }

  return (
    <div className="mb-3 space-y-3">
      {plan.itinerary.map((day) => (
        <section key={day.day} className="rounded-2xl border border-ink/10 bg-paper p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-ink">Day {day.day} · {day.city}</h4>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-ink/55">
              住 {day.stayArea}
            </span>
          </div>
          {day.area && <div className="mt-1 text-xs font-semibold text-coral">{day.area}</div>}
          <div className="mt-2 grid gap-1.5 text-xs leading-5 text-ink/65">
            <p>上午：{day.morning}</p>
            <p>下午：{day.afternoon}</p>
            <p>晚上：{day.evening}</p>
            <p>交通：{day.transport}</p>
            <p>费用：{day.costText}</p>
          </div>
          {day.placeNodeIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {day.placeNodeIds.map((nodeId) => (
                <button
                  key={nodeId}
                  type="button"
                  className="focus-ring rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-ink/60"
                  onClick={() => onOpenPlace?.(nodeId)}
                >
                  {nodeId}
                </button>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
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
