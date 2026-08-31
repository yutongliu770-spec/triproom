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

  const plans: PlanVariant[] = [
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

  return plans.map((plan, index) =>
    withMockPlanningDetails(plan, {
      index,
      parentPlanId: input.parentPlanId,
      totalDays
    })
  );
}

function withMockPlanningDetails(
  plan: PlanVariant,
  input: { index: number; parentPlanId?: string; totalDays: number }
): PlanVariant {
  const isKansaiPlan = plan.includedNodeIds.includes("osaka");
  const itinerary = isKansaiPlan
    ? kansaiItinerary(input.totalDays)
    : kantoItinerary(input.totalDays, Boolean(input.parentPlanId));
  const routeNodeIds = isKansaiPlan
    ? ["tokyo", "asakusa-ueno", "shibuya-shinjuku", "osaka", "usj", "dotonbori"]
    : ["tokyo", "asakusa-ueno", "shibuya-shinjuku", "hakone", "fuji-kawaguchiko"];

  return {
    ...plan,
    score: input.parentPlanId ? 86 - input.index * 2 : 84 - input.index * 4,
    scoringBreakdown: {
      memberPreferenceFit: isKansaiPlan ? 78 : 86,
      groupFairness: isKansaiPlan ? 76 : 84,
      routeFeasibility: isKansaiPlan ? 72 : 88,
      schedulePace: input.parentPlanId ? 90 : isKansaiPlan ? 70 : 84,
      budgetFit: 76,
      dataConfidence: 72
    },
    validation: {
      passed: true,
      issues: [
        {
          severity: "warning",
          code: "mock_reference_estimate",
          message: "当前方案使用 Mock 交通与预算估算，未接入实时价格和班次。"
        }
      ]
    },
    itinerary,
    route: {
      nodeIds: routeNodeIds,
      summary: isKansaiPlan
        ? "东京进入，大阪 / USJ 收尾；地图展示一次关东到关西长距离移动。"
        : "东京为主轴，向箱根 / 富士山方向做轻量自然延展。"
    },
    modelName: "mock",
    modelVersion: "demo-fallback-v1"
  };
}

function kantoItinerary(totalDays: number, relaxed: boolean) {
  const base = [
    day(1, "东京", "浅草 / 上野", "浅草寺和上野公园轻量进入。", "博物馆或老街散步，不排满。", "回住宿区吃饭休息。", ["asakusa-ueno"]),
    day(2, "东京", "涩谷 / 新宿", relaxed ? "上午晚一点出门，先做咖啡和街区散步。" : "涩谷、新宿城市街区探索。", relaxed ? "只保留一个购物区，减少跨区移动。" : "购物、美食和夜景机动组合。", "新宿或涩谷吃饭。", ["shibuya-shinjuku"]),
    day(3, "东京", "迪士尼可选", "根据团队兴趣决定是否去迪士尼。", "不去迪士尼则换成清澄白河或银座。", "早回酒店，保留体力。", ["tokyo-disney"]),
    day(4, "箱根 / 富士山", "箱根", "从东京前往箱根，控制行李移动。", "温泉、湖景或美术馆二选一。", "住箱根，节奏放慢。", ["hakone"]),
    day(5, "箱根 / 富士山", "河口湖", "看天气决定富士山视角。", "湖边散步，不做过多打卡。", "返回东京或继续住周边。", ["fuji-kawaguchiko", "lake-kawaguchiko"]),
    day(6, "东京", "东京自由探索", "补大家前面没来得及看的地点。", "购物、咖啡、素材复盘。", "团队确认最终路线偏好。", ["tokyo"]),
    day(7, "东京", "返程缓冲", "只安排近距离早餐和采购。", "预留交通和机场时间。", "返程。", ["tokyo"])
  ];
  return fitDays(base, totalDays);
}

function kansaiItinerary(totalDays: number) {
  const base = [
    day(1, "东京", "浅草 / 上野", "东京传统街区轻量进入。", "上野或浅草周边慢慢走。", "回住宿区休息。", ["asakusa-ueno"]),
    day(2, "东京", "涩谷 / 新宿", "城市街区和购物体验。", "控制跨区数量，晚上看体力决定夜景。", "新宿晚餐。", ["shibuya-shinjuku"]),
    day(3, "东京", "东京可选日", "迪士尼或城市自由探索二选一。", "根据成员兴趣临场调整。", "整理行李准备移动。", ["tokyo-disney"]),
    day(4, "大阪", "东京到大阪", "新干线前往大阪。", "酒店入住后只做心斋桥轻量散步。", "道顿堀晚餐。", ["osaka", "dotonbori"]),
    day(5, "大阪", "环球影城 USJ", "整天留给 USJ。", "园区内机动安排。", "早回酒店。", ["usj"]),
    day(6, "大阪", "大阪城市", "梅田或大阪城二选一。", "补美食和购物。", "团队复盘最终偏好。", ["umeda", "dotonbori"]),
    day(7, "大阪", "返程缓冲", "近距离早餐和采购。", "预留机场交通时间。", "返程。", ["osaka"])
  ];
  return fitDays(base, totalDays);
}

function day(
  dayNumber: number,
  city: string,
  area: string,
  morning: string,
  afternoon: string,
  evening: string,
  placeNodeIds: string[]
) {
  return {
    day: dayNumber,
    city,
    area,
    morning,
    afternoon,
    evening,
    stayArea: city,
    placeNodeIds,
    transport: "以公共交通为主，具体时间以实际查询为准。",
    costText: "粗略估算，未接入实时价格。",
    imageNodeId: placeNodeIds[0]
  };
}

function fitDays(days: ReturnType<typeof day>[], totalDays: number) {
  if (days.length === totalDays) return days;
  if (days.length > totalDays) {
    return days.slice(0, totalDays).map((item, index) => ({ ...item, day: index + 1 }));
  }

  const last = days[days.length - 1]!;
  return [
    ...days,
    ...Array.from({ length: totalDays - days.length }, (_, index) => ({
      ...last,
      day: days.length + index + 1,
      area: "机动缓冲",
      morning: "保留机动时间，处理天气、交通或成员体力变化。",
      afternoon: "根据前几天反馈补充最想去的地点。",
      evening: "早休息。"
    }))
  ];
}
