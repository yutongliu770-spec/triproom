import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { modelProvider } from "@/lib/preferences/model-provider";

const AGGREGATION_VERSION = "room-place-v1";

export class RoomPlaceAggregator {
  async updateRoomPlaceProfile(tripId: string, nodeId: string) {
    const [profiles, constraints, node] = await Promise.all([
      prisma.memberPlaceProfile.findMany({
        where: { tripId, nodeId },
        include: { member: true }
      }),
      prisma.memberConstraint.findMany({
        where: {
          tripId,
          status: "active",
          OR: [
            { targetType: "node", targetId: nodeId },
            { targetType: "trip", targetId: tripId },
            { targetType: null }
          ]
        }
      }),
      prisma.destinationNode.findUnique({ where: { id: nodeId } })
    ]);

    const memberStances = profiles.map((profile) => ({
      memberId: profile.memberId,
      displayName: profile.member.displayName,
      stance: profile.stance,
      interestScore: profile.interestScore,
      summary: profile.summary
    }));
    const teamInterestScore = profiles.length
      ? clampScore(profiles.reduce((sum, profile) => sum + profile.interestScore, 0) / profiles.length)
      : 0;
    const engagementScore = clampScore(
      profiles.reduce((sum, profile) => sum + profile.signalCount + profile.evidenceCount, 0) +
        constraints.length
    );
    const disagreementScore = computeDisagreementScore(profiles.map((profile) => profile.interestScore));
    const commonPositiveReasons = topRepeatedStrings(
      profiles.flatMap((profile) => stringArray(profile.positiveReasons))
    );
    const mainConcerns = topRepeatedStrings([
      ...profiles.flatMap((profile) => stringArray(profile.negativeReasons)),
      ...constraints
        .filter((constraint) => constraint.polarity != null && constraint.polarity < 0)
        .map((constraint) => constraint.summary)
    ]);
    const conditionalFitNotes = uniqueStrings(
      profiles
        .map((profile) => profile.conditionText)
        .filter((value): value is string => Boolean(value))
    );
    const mustGoMemberIds = profiles
      .filter((profile) => profile.mustGo)
      .map((profile) => profile.memberId);
    const hardRejectMemberIds = profiles
      .filter((profile) => profile.hardReject)
      .map((profile) => profile.memberId);
    const memberProfileIds = profiles.map((profile) => profile.id);
    const sourceEvidenceIds = uniqueStrings(
      profiles.flatMap((profile) => stringArray(profile.sourceEvidenceIds))
    );
    const topSignalIds = uniqueStrings(profiles.flatMap((profile) => stringArray(profile.topSignalIds)));
    const constraintIds = uniqueStrings([
      ...profiles.flatMap((profile) => stringArray(profile.constraintIds)),
      ...constraints.map((constraint) => constraint.id)
    ]);
    const summary = await modelProvider.summarizeRoomPlace({
      placeName: node?.canonicalName,
      commonPositiveReasons,
      mainConcerns,
      memberStanceCount: profiles.length
    });
    const now = new Date();

    const roomProfile = await prisma.roomPlaceProfile.upsert({
      where: {
        tripId_nodeId: {
          tripId,
          nodeId
        }
      },
      create: {
        id: `rpp-${tripId}-${nodeId}`,
        tripId,
        nodeId,
        teamInterestScore,
        engagementScore,
        disagreementScore,
        memberStances: jsonInput(memberStances),
        summary,
        commonPositiveReasons: jsonInput(commonPositiveReasons),
        mainConcerns: jsonInput(mainConcerns),
        conditionalFitNotes: jsonInput(conditionalFitNotes),
        unresolvedQuestions: jsonInput([]),
        mustGoMemberIds: jsonInput(mustGoMemberIds),
        hardRejectMemberIds: jsonInput(hardRejectMemberIds),
        memberProfileIds: jsonInput(memberProfileIds),
        sourceEvidenceIds: jsonInput(sourceEvidenceIds),
        topSignalIds: jsonInput(topSignalIds),
        constraintIds: jsonInput(constraintIds),
        aggregationVersion: AGGREGATION_VERSION,
        lastCalculatedAt: now
      },
      update: {
        teamInterestScore,
        engagementScore,
        disagreementScore,
        memberStances: jsonInput(memberStances),
        summary,
        commonPositiveReasons: jsonInput(commonPositiveReasons),
        mainConcerns: jsonInput(mainConcerns),
        conditionalFitNotes: jsonInput(conditionalFitNotes),
        unresolvedQuestions: jsonInput([]),
        mustGoMemberIds: jsonInput(mustGoMemberIds),
        hardRejectMemberIds: jsonInput(hardRejectMemberIds),
        memberProfileIds: jsonInput(memberProfileIds),
        sourceEvidenceIds: jsonInput(sourceEvidenceIds),
        topSignalIds: jsonInput(topSignalIds),
        constraintIds: jsonInput(constraintIds),
        aggregationVersion: AGGREGATION_VERSION,
        lastCalculatedAt: now,
        staleAt: null
      }
    });

    await prisma.roomNodeState.upsert({
      where: {
        tripId_nodeId: {
          tripId,
          nodeId
        }
      },
      create: {
        tripId,
        nodeId,
        state: engagementScore > 0 ? "shown" : "undiscovered",
        explorationState: teamInterestScore >= 6 ? "candidate" : engagementScore >= 3 ? "engaged" : "seed",
        engagementScore,
        interestScore: teamInterestScore,
        disagreementScore,
        firstDiscoveredAt: now,
        lastInteractedAt: now,
        mentionCount: sourceEvidenceIds.length,
        interactionCount: topSignalIds.length,
        source: "conversation",
        shownCount: 0,
        aggregateSignal: jsonInput({
          positiveMembers: profiles.filter((profile) => profile.interestScore >= 6).length,
          negativeMembers: profiles.filter((profile) => profile.interestScore <= 3).length,
          interestedMembers: profiles.filter((profile) => profile.interestScore >= 4).length,
          comments: profiles.reduce((sum, profile) => sum + profile.evidenceCount, 0)
        })
      },
      update: {
        state: "shown",
        explorationState: teamInterestScore >= 6 ? "candidate" : engagementScore >= 3 ? "engaged" : "discovered",
        engagementScore,
        interestScore: teamInterestScore,
        disagreementScore,
        lastInteractedAt: now,
        mentionCount: { increment: 0 },
        interactionCount: topSignalIds.length,
        source: "conversation",
        aggregateSignal: jsonInput({
          positiveMembers: profiles.filter((profile) => profile.interestScore >= 6).length,
          negativeMembers: profiles.filter((profile) => profile.interestScore <= 3).length,
          interestedMembers: profiles.filter((profile) => profile.interestScore >= 4).length,
          comments: profiles.reduce((sum, profile) => sum + profile.evidenceCount, 0)
        })
      }
    });

    return roomProfile;
  }
}

export const roomPlaceAggregator = new RoomPlaceAggregator();

function computeDisagreementScore(scores: number[]) {
  if (scores.length < 2) return 0;
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + (score - average) ** 2, 0) / scores.length;
  return clampScore(Math.sqrt(variance) * 1.8);
}

function topRepeatedStrings(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([value]) => value);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function jsonInput(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
