import type { MemberSignal, PlanVariant, Trip } from "@/lib/types";

export function shouldOfferPlans(input: {
  trip: Pick<Trip, "tripDurationDays" | "currentFocusNodeId">;
  signals: MemberSignal[];
  mentionedRouteQuestion?: boolean;
}) {
  const effectiveSignals = input.signals.filter((signal) => signal.intensity >= 2);
  const targetCount = new Set(effectiveSignals.map((signal) => signal.targetId)).size;
  const positiveTokyo = input.signals.some(
    (signal) => signal.targetId === "tokyo" && signal.polarity > 0
  );

  return Boolean(
    input.trip.tripDurationDays &&
      (input.mentionedRouteQuestion || (positiveTokyo && targetCount >= 3))
  );
}

export function generateJapanPlanVariants(input: {
  tripId: string;
  totalDays?: number;
  basedOnSignalIds?: string[];
  parentPlanId?: string;
}): PlanVariant[] {
  const totalDays = input.totalDays ?? 7;
  const now = new Date().toISOString();

  return [
    {
      id: input.parentPlanId ? "plan-a-v2" : "plan-a-v1",
      tripId: input.tripId,
      version: input.parentPlanId ? 2 : 1,
      title: "东京 + 富士山 / 箱根",
      summary: "把东京作为主轴，加入 1-2 天自然和温泉缓冲，移动强度较低。",
      status: "active",
      totalDays,
      segments: [
        {
          nodeId: "tokyo",
          name: "东京",
          days: Math.max(totalDays - 2, 3),
          representativeNodeIds: ["asakusa-ueno", "shibuya-shinjuku", "tokyo-disney"],
          experienceSummary: "城市街区、购物、美食和可选迪士尼"
        },
        {
          nodeId: "hakone",
          name: "箱根 / 富士山方向",
          days: Math.min(2, totalDays - 3),
          representativeNodeIds: ["hakone", "fuji-kawaguchiko"],
          experienceSummary: "温泉、湖景、富士山视角和更慢节奏"
        }
      ],
      includedNodeIds: ["tokyo", "hakone", "fuji-kawaguchiko", "tokyo-disney"],
      excludedHighlights: ["USJ 通常需要舍弃或压缩", "关西美食体验较少"],
      mobilityText: "移动较少，主要围绕东京和周边。",
      budgetText: "粗略估算：中到偏高，温泉住宿和迪士尼会抬高预算。",
      budgetIsEstimate: true,
      gains: ["共同东京方向更稳定", "保留自然和温泉", "不用跨东西两端频繁换城市"],
      tradeoffs: ["不包含 USJ", "关西体验不足"],
      basedOnSignalIds: input.basedOnSignalIds ?? [],
      unresolvedQuestions: ["迪士尼是否必须去？", "箱根和河口湖更偏哪一种？"],
      parentPlanId: input.parentPlanId,
      changeSummary: input.parentPlanId ? ["保留东京和箱根主轴", "把可选项目压缩到东京周边"] : undefined,
      createdAt: now
    },
    {
      id: input.parentPlanId ? "plan-b-v2" : "plan-b-v1",
      tripId: input.tripId,
      version: input.parentPlanId ? 2 : 1,
      title: "东京 + 大阪 / USJ",
      summary: "保留东京城市体验，同时满足 USJ 强兴趣，但需要接受一次长距离移动。",
      status: "draft",
      totalDays,
      segments: [
        {
          nodeId: "tokyo",
          name: "东京",
          days: Math.max(totalDays - 3, 3),
          representativeNodeIds: ["asakusa-ueno", "shibuya-shinjuku", "tokyo-disney"],
          experienceSummary: "东京街区和可选迪士尼"
        },
        {
          nodeId: "osaka",
          name: "大阪",
          days: Math.min(3, totalDays - 3),
          representativeNodeIds: ["usj", "dotonbori"],
          experienceSummary: "USJ 和大阪美食夜景"
        }
      ],
      includedNodeIds: ["tokyo", "osaka", "usj", "dotonbori"],
      excludedHighlights: ["富士山 / 箱根通常需要舍弃或只做很压缩版本"],
      mobilityText: "有一次东京到大阪的长距离移动，换酒店概率更高。",
      budgetText: "粗略估算：中到偏高，长距离交通和 USJ 门票是主要变量。",
      budgetIsEstimate: true,
      gains: ["满足 USJ", "城市体验更丰富", "东京与大阪差异明显"],
      tradeoffs: ["移动强度更高", "富士山方向被压缩"],
      basedOnSignalIds: input.basedOnSignalIds ?? [],
      unresolvedQuestions: ["大家是否接受长距离移动？", "USJ 是否属于必去？"],
      parentPlanId: input.parentPlanId,
      changeSummary: input.parentPlanId ? ["保留 USJ", "压缩自然段以换取大阪时间"] : undefined,
      createdAt: now
    }
  ];
}
