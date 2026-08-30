import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { modelProvider } from "@/lib/preferences/model-provider";
import { roomPlaceAggregator } from "@/lib/preferences/room-place-aggregator";

const AGGREGATION_VERSION = "member-place-v1";

export class PreferenceReducer {
  async updateMemberPlaceProfile(input: { tripId: string; memberId: string; nodeId: string }) {
    const [signals, constraints, opinions, node] = await Promise.all([
      prisma.memberSignal.findMany({
        where: {
          tripId: input.tripId,
          memberId: input.memberId,
          targetType: "node",
          targetId: input.nodeId,
          invalidatedAt: null
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.memberConstraint.findMany({
        where: {
          tripId: input.tripId,
          memberId: input.memberId,
          status: "active",
          OR: [
            { targetType: "node", targetId: input.nodeId },
            { targetType: "trip", targetId: input.tripId },
            { targetType: null }
          ]
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.placeOpinion.findMany({
        where: {
          tripId: input.tripId,
          memberId: input.memberId,
          nodeId: input.nodeId
        },
        orderBy: { createdAt: "asc" }
      }),
      prisma.destinationNode.findUnique({ where: { id: input.nodeId } })
    ]);

    const positiveScore = signals
      .filter((signal) => signal.polarity > 0 || signal.signalType === "must_go")
      .reduce((sum, signal) => sum + signal.intensity * signal.confidence, 0);
    const negativeScore = signals
      .filter((signal) => signal.polarity < 0 || signal.signalType === "hard_reject")
      .reduce((sum, signal) => sum + Math.abs(signal.intensity) * signal.confidence, 0);
    const mustGo = signals.some((signal) => signal.signalType === "must_go") ||
      constraints.some((constraint) => constraint.constraintType === "must_go");
    const hardReject = signals.some((signal) => signal.signalType === "hard_reject") ||
      constraints.some((constraint) => constraint.constraintType === "hard_reject" && constraint.severity === "hard");
    const hasCondition = signals.some((signal) => Boolean(signal.conditionText)) ||
      constraints.some((constraint) => Boolean(constraint.conditionText));
    const interestScore = scoreInterest({ positiveScore, negativeScore, mustGo, hardReject, hasCondition });
    const stance = inferStance({ interestScore, mustGo, hardReject, hasCondition, negativeScore });
    const positiveReasons = uniqueStrings([
      ...signals
        .filter((signal) => signal.polarity > 0)
        .flatMap((signal) => reasonsFromSignal(signal)),
      ...opinions
        .filter((opinion) => ["want_to_go", "must_go"].includes(opinion.reaction))
        .map((opinion) => opinion.content)
    ]).slice(0, 6);
    const negativeReasons = uniqueStrings([
      ...signals
        .filter((signal) => signal.polarity < 0 || signal.signalType === "concern")
        .flatMap((signal) => reasonsFromSignal(signal)),
      ...constraints
        .filter((constraint) => constraint.polarity != null && constraint.polarity < 0)
        .map((constraint) => constraint.summary)
    ]).slice(0, 6);
    const conditionText = uniqueStrings([
      ...signals.map((signal) => signal.conditionText),
      ...constraints.map((constraint) => constraint.conditionText)
    ]).join("；") || undefined;
    const constraintSummary = constraints.length
      ? constraints.map((constraint) => constraint.summary).join("；")
      : undefined;
    const topSignalIds = signals
      .slice()
      .sort((left, right) => right.intensity * right.confidence - left.intensity * left.confidence)
      .slice(0, 8)
      .map((signal) => signal.id);
    const sourceEvidenceIds = uniqueStrings(signals.map((signal) => signal.evidenceId));
    const confidenceScore = signals.length
      ? clamp01(signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length)
      : 0;
    const summary = await modelProvider.summarizeMemberPlace({
      placeName: node?.canonicalName,
      positiveReasons,
      negativeReasons,
      conditionText,
      stance
    });
    const now = new Date();

    const profile = await prisma.memberPlaceProfile.upsert({
      where: {
        tripId_memberId_nodeId: {
          tripId: input.tripId,
          memberId: input.memberId,
          nodeId: input.nodeId
        }
      },
      create: {
        id: `mpp-${input.tripId}-${input.memberId}-${input.nodeId}`,
        tripId: input.tripId,
        memberId: input.memberId,
        nodeId: input.nodeId,
        interestScore,
        positiveScore,
        negativeScore,
        confidenceScore,
        stance,
        summary,
        positiveReasons: jsonInput(positiveReasons),
        negativeReasons: jsonInput(negativeReasons),
        conditionText,
        constraintSummary,
        mustGo,
        hardReject,
        evidenceCount: sourceEvidenceIds.length,
        signalCount: signals.length,
        constraintIds: jsonInput(constraints.map((constraint) => constraint.id)),
        topSignalIds: jsonInput(topSignalIds),
        sourceEvidenceIds: jsonInput(sourceEvidenceIds),
        lastSignalAt: signals.at(-1)?.createdAt,
        aggregationVersion: AGGREGATION_VERSION,
        lastCalculatedAt: now
      },
      update: {
        interestScore,
        positiveScore,
        negativeScore,
        confidenceScore,
        stance,
        summary,
        positiveReasons: jsonInput(positiveReasons),
        negativeReasons: jsonInput(negativeReasons),
        conditionText,
        constraintSummary,
        mustGo,
        hardReject,
        evidenceCount: sourceEvidenceIds.length,
        signalCount: signals.length,
        constraintIds: jsonInput(constraints.map((constraint) => constraint.id)),
        topSignalIds: jsonInput(topSignalIds),
        sourceEvidenceIds: jsonInput(sourceEvidenceIds),
        lastSignalAt: signals.at(-1)?.createdAt,
        aggregationVersion: AGGREGATION_VERSION,
        lastCalculatedAt: now,
        staleAt: null
      }
    });

    await roomPlaceAggregator.updateRoomPlaceProfile(input.tripId, input.nodeId);
    return profile;
  }
}

export const preferenceReducer = new PreferenceReducer();

function reasonsFromSignal(signal: {
  reason: string | null;
  aspect: string | null;
  extractedAttributes: unknown;
}) {
  const attributes = Array.isArray(signal.extractedAttributes)
    ? signal.extractedAttributes
        .filter((item): item is { text: string } => {
          if (!item || typeof item !== "object") return false;
          return typeof (item as Record<string, unknown>).text === "string";
        })
        .map((item) => item.text)
    : [];
  return uniqueStrings([signal.reason, ...attributes, signal.aspect ? aspectLabel(signal.aspect) : undefined]);
}

function inferStance(input: {
  interestScore: number;
  mustGo: boolean;
  hardReject: boolean;
  hasCondition: boolean;
  negativeScore: number;
}) {
  if (input.hardReject) return "avoid";
  if (input.mustGo || input.interestScore >= 8.5) return "strong_like";
  if (input.hasCondition) return "conditional";
  if (input.interestScore >= 5.8) return "like";
  if (input.negativeScore > 0 || input.interestScore <= 3.2) return "concerned";
  if (input.interestScore > 0) return "neutral";
  return "unknown";
}

function scoreInterest(input: {
  positiveScore: number;
  negativeScore: number;
  mustGo: boolean;
  hardReject: boolean;
  hasCondition: boolean;
}) {
  if (input.hardReject) return 0.5;
  if (input.mustGo) return 9.4;
  const base = input.positiveScore > 0 || input.negativeScore > 0 ? 4.5 : 0;
  const score = base + input.positiveScore * 0.9 - input.negativeScore * 0.65 - (input.hasCondition ? 0.4 : 0);
  return clamp10(score);
}

function aspectLabel(aspect: string) {
  const labels: Record<string, string> = {
    sea: "海边",
    train_experience: "电车体验",
    time_cost: "时间成本",
    overall: "整体兴趣"
  };
  return labels[aspect] ?? aspect;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function clamp10(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function jsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
