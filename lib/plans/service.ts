import type { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db/client";
import { planningContextBuilder, type PlanningContext } from "@/lib/plans/context-builder";
import { planningScorer } from "@/lib/plans/scorer";
import { planValidator } from "@/lib/plans/validator";
import { modelProvider } from "@/lib/preferences/model-provider";
import { serializePlanVariant } from "@/lib/preferences/serializers";
import type { PlanVariant } from "@/lib/types";

export class TravelPlanningService {
  async listPlans(tripId: string) {
    const plans = await prisma.planVariant.findMany({
      where: { tripId },
      orderBy: [{ createdAt: "asc" }, { title: "asc" }]
    });
    return plans.map(serializePlanVariant);
  }

  async generatePlans(input: { tripId: string; memberId?: string }) {
    const context = await planningContextBuilder.build({
      tripId: input.tripId,
      createdByMemberId: input.memberId,
      triggerType: "manual_generate"
    });
    const drafts = await modelProvider.generateTravelPlans(toPromptInput(context));
    const plans = await this.finalizeAndPersist({
      context,
      drafts,
      statusForIndex: (index) => index === 0 ? "active" : "draft"
    });

    return {
      planningContextSnapshotId: context.snapshotId,
      provider: { name: modelProvider.name, version: modelProvider.version },
      plans
    };
  }

  async revisePlan(input: {
    tripId: string;
    planId: string;
    memberId?: string;
    instruction: string;
  }) {
    const existing = await prisma.planVariant.findUnique({ where: { id: input.planId } });
    if (!existing) throw new Error(`Plan not found: ${input.planId}`);

    const context = await planningContextBuilder.build({
      tripId: input.tripId,
      createdByMemberId: input.memberId,
      triggerType: "plan_revision"
    });
    const existingPlan = serializePlanVariant(existing);
    const drafts = await modelProvider.reviseTravelPlan({
      ...toPromptInput(context),
      existingPlan,
      revisionInstruction: input.instruction
    });

    const revisedPlans = await this.finalizeAndPersist({
      context,
      drafts,
      parentPlanId: existingPlan.id,
      statusForIndex: () => "active",
      revisionInstruction: input.instruction
    });

    await prisma.planVariant.updateMany({
      where: { tripId: input.tripId, id: input.planId },
      data: { status: "superseded" }
    });

    return {
      planningContextSnapshotId: context.snapshotId,
      provider: { name: modelProvider.name, version: modelProvider.version },
      plans: revisedPlans
    };
  }

  private async finalizeAndPersist(input: {
    context: PlanningContext;
    drafts: PlanVariant[];
    parentPlanId?: string;
    revisionInstruction?: string;
    statusForIndex: (index: number) => PlanVariant["status"];
  }) {
    const nextVersion = await nextPlanVersion(input.context.trip.id);
    const finalized = input.drafts.slice(0, 3).map((draft, index) => {
      const normalized = normalizePlan({
        draft,
        context: input.context,
        parentPlanId: input.parentPlanId,
        revisionInstruction: input.revisionInstruction,
        version: nextVersion + index,
        index
      });
      const validation = planValidator.validate(normalized, input.context);
      const scoring = planningScorer.score(normalized, input.context, validation);
      return {
        ...normalized,
        status: input.statusForIndex(index),
        validation,
        score: scoring.score,
        scoringBreakdown: scoring.breakdown
      };
    }).filter((plan) => plan.validation?.passed);

    if (finalized.length < 2 && !input.parentPlanId) {
      throw new Error("TravelPlanningAgent did not return at least 2 valid candidate plans.");
    }
    if (finalized.length < 1 && input.parentPlanId) {
      throw new Error("TravelPlanningAgent did not return a valid revised plan.");
    }

    for (const plan of finalized) {
      await prisma.planVariant.create({
        data: {
          id: plan.id,
          tripId: plan.tripId,
          planningContextSnapshotId: plan.planningContextSnapshotId,
          version: plan.version,
          title: plan.title,
          summary: plan.summary,
          status: plan.status,
          totalDays: plan.totalDays,
          segments: jsonInput(plan.segments),
          score: plan.score,
          scoringBreakdown: jsonInput(plan.scoringBreakdown),
          validation: jsonInput(plan.validation),
          itinerary: jsonInput(plan.itinerary),
          route: jsonInput(plan.route),
          includedNodeIds: jsonInput(plan.includedNodeIds),
          excludedHighlights: jsonInput(plan.excludedHighlights),
          mobilityText: plan.mobilityText,
          budgetText: plan.budgetText,
          budgetIsEstimate: plan.budgetIsEstimate,
          gains: jsonInput(plan.gains),
          tradeoffs: jsonInput(plan.tradeoffs),
          basedOnSignalIds: jsonInput(plan.basedOnSignalIds),
          unresolvedQuestions: jsonInput(plan.unresolvedQuestions),
          parentPlanId: plan.parentPlanId,
          changeSummary: jsonInput(plan.changeSummary),
          modelName: plan.modelName,
          modelVersion: plan.modelVersion,
          createdAt: new Date(plan.createdAt)
        }
      });
    }

    return finalized;
  }
}

export const travelPlanningService = new TravelPlanningService();

function toPromptInput(context: PlanningContext) {
  return {
    trip: context.trip,
    members: context.members,
    candidatePlaces: context.destinationNodes.map((node) => ({
      id: node.id,
      name: node.canonicalName,
      type: node.nodeType,
      parentId: node.parentId,
      tags: node.tags,
      summary: node.shortSummary,
      highlights: node.highlights,
      suggestedStayText: node.suggestedStayText,
      budgetBand: node.budgetBand,
      geo: node.geo
    })),
    roomPlaceProfiles: context.roomPlaceProfiles,
    memberPlaceProfiles: context.memberPlaceProfiles,
    constraints: context.constraints,
    keyEvidence: context.keyEvidence.map((evidence) => ({
      id: evidence.id,
      memberId: evidence.memberId,
      targetId: evidence.targetId,
      type: evidence.evidenceType,
      text: evidence.rawTextSnapshot,
      visibility: evidence.visibility
    })),
    relations: context.destinationRelations
  };
}

function normalizePlan(input: {
  draft: PlanVariant;
  context: PlanningContext;
  parentPlanId?: string;
  revisionInstruction?: string;
  version: number;
  index: number;
}): PlanVariant {
  const totalDays = input.context.trip.tripDurationDays ?? input.draft.totalDays ?? 7;
  const nodeById = new Map(input.context.destinationNodes.map((node) => [node.id, node]));
  const itinerary = normalizeItinerary(input.draft, totalDays, nodeById);
  const includedNodeIds = uniqueStrings([
    ...input.draft.includedNodeIds,
    ...input.draft.segments.map((segment) => segment.nodeId),
    ...input.draft.segments.flatMap((segment) => segment.representativeNodeIds),
    ...itinerary.flatMap((day) => day.placeNodeIds)
  ]).filter((nodeId) => nodeById.has(nodeId));
  const routeNodeIds = uniqueStrings([
    ...(input.draft.route?.nodeIds ?? []),
    ...input.draft.segments.map((segment) => segment.nodeId),
    ...itinerary.flatMap((day) => day.placeNodeIds.slice(0, 1))
  ]).filter((nodeId) => nodeById.has(nodeId));

  return {
    ...input.draft,
    id: `plan-${input.context.trip.id}-${input.parentPlanId ? "rev" : "cand"}-${input.version}-${input.index + 1}-${randomUUID().slice(0, 8)}`,
    tripId: input.context.trip.id,
    version: input.version,
    status: input.index === 0 ? "active" : "draft",
    totalDays,
    segments: input.draft.segments.length
      ? input.draft.segments.map((segment) => ({
          ...segment,
          days: Math.max(1, Math.round(segment.days || 1)),
          representativeNodeIds: segment.representativeNodeIds.filter((nodeId) => nodeById.has(nodeId))
        }))
      : [{ nodeId: "tokyo", name: "东京", days: totalDays, representativeNodeIds: ["asakusa-ueno"], experienceSummary: "东京城市探索", stayArea: "东京" }],
    includedNodeIds,
    excludedHighlights: input.draft.excludedHighlights.length ? input.draft.excludedHighlights : ["未接入实时酒店、票价和天气。"],
    mobilityText: input.draft.mobilityText,
    budgetText: input.draft.budgetText,
    budgetIsEstimate: true,
    gains: input.draft.gains.length ? input.draft.gains : ["覆盖当前团队高兴趣地点"],
    tradeoffs: input.draft.tradeoffs.length ? input.draft.tradeoffs : ["仍需确认真实交通和预算"],
    basedOnSignalIds: input.context.keySignals.slice(0, 30).map((signal) => signal.id),
    unresolvedQuestions: input.draft.unresolvedQuestions,
    parentPlanId: input.parentPlanId,
    changeSummary: input.parentPlanId
      ? uniqueStrings([
          ...(input.draft.changeSummary ?? []),
          input.revisionInstruction ? `响应修改要求：${input.revisionInstruction}` : undefined
        ])
      : input.draft.changeSummary,
    itinerary,
    route: {
      nodeIds: routeNodeIds.length ? routeNodeIds : includedNodeIds.slice(0, 6),
      summary: input.draft.route?.summary || input.draft.mobilityText
    },
    planningContextSnapshotId: input.context.snapshotId,
    modelName: modelProvider.name,
    modelVersion: modelProvider.version,
    createdAt: new Date().toISOString()
  };
}

function normalizeItinerary(
  draft: PlanVariant,
  totalDays: number,
  nodeById: Map<string, { canonicalName: string }>
) {
  const days = draft.itinerary ?? [];
  if (days.length === totalDays) {
    return days.map((day, index) => ({
      ...day,
      day: index + 1,
      placeNodeIds: day.placeNodeIds.filter((nodeId) => nodeById.has(nodeId)),
      imageNodeId: day.imageNodeId && nodeById.has(day.imageNodeId) ? day.imageNodeId : day.placeNodeIds.find((nodeId) => nodeById.has(nodeId))
    }));
  }

  const routeIds = uniqueStrings([
    ...draft.segments.flatMap((segment) => [segment.nodeId, ...segment.representativeNodeIds]),
    ...draft.includedNodeIds
  ]).filter((nodeId) => nodeById.has(nodeId));
  const fallbackIds = routeIds.length ? routeIds : ["tokyo", "asakusa-ueno"].filter((nodeId) => nodeById.has(nodeId));

  return Array.from({ length: totalDays }, (_, index) => {
    const nodeId = fallbackIds[index % fallbackIds.length] ?? "tokyo";
    const nodeName = nodeById.get(nodeId)?.canonicalName ?? "东京";
    return {
      day: index + 1,
      city: cityNameFor(nodeId),
      area: nodeName,
      morning: `围绕${nodeName}轻量展开，保留现场调整空间。`,
      afternoon: `继续探索${nodeName}附近地点。`,
      evening: "回到住宿区域吃饭休息。",
      stayArea: cityNameFor(nodeId),
      placeNodeIds: [nodeId],
      transport: "以铁路 / 地铁为主，具体时间以实际查询为准。",
      costText: "粗略估算，未接入实时价格。",
      imageNodeId: nodeId
    };
  });
}

async function nextPlanVersion(tripId: string) {
  const latest = await prisma.planVariant.findFirst({
    where: { tripId },
    orderBy: { version: "desc" }
  });
  return (latest?.version ?? 0) + 1;
}

function cityNameFor(nodeId: string) {
  if (["osaka", "usj", "dotonbori", "umeda"].includes(nodeId)) return "大阪";
  if (["kyoto", "arashiyama", "fushimi-inari", "gion"].includes(nodeId)) return "京都";
  if (["hakone", "fuji-kawaguchiko", "lake-kawaguchiko"].includes(nodeId)) return "箱根 / 富士山";
  return "东京";
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function jsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
