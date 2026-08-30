import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  DEFAULT_DEMO_TRIP_ID,
  getKnownDemoTripIds,
  getMockDemoSeed,
  isKnownDemoTripId,
  QUICK_DEMO_TRIP_ID
} from "@/lib/travel/mock-provider";
import { travelDataService } from "@/lib/travel/service";
import type { DemoRoomData } from "@/lib/types";

type DemoSeedLogger = (message: string) => void;

interface DemoSeedOptions {
  logger?: DemoSeedLogger;
}

export async function ensureDemoRoomPersisted(
  tripId: string = DEFAULT_DEMO_TRIP_ID,
  options: DemoSeedOptions = {}
) {
  if (!isKnownDemoTripId(tripId)) return;

  const seed = getMockDemoSeed(tripId);
  const log = scopedLogger(options.logger, tripId);
  log("creating trip: loading seed and destination nodes");
  const [nodes, initialRoomStates] = await Promise.all([
    travelDataService.getAllNodes(),
    Promise.resolve(seed.roomNodeStates)
  ]);

  log("creating trip");
  await prisma.trip.upsert({
    where: { id: seed.trip.id },
    create: {
      id: seed.trip.id,
      name: seed.trip.name,
      inviteCode: seed.trip.inviteCode,
      status: "active",
      roughDestination: seed.trip.roughDestination,
      tripDurationDays: seed.trip.tripDurationDays,
      roughDateText: seed.trip.roughDateText,
      currentFocusNodeId: seed.trip.currentFocusNodeId
    },
    update: {
      name: seed.trip.name,
      inviteCode: seed.trip.inviteCode,
      roughDestination: seed.trip.roughDestination,
      tripDurationDays: seed.trip.tripDurationDays,
      roughDateText: seed.trip.roughDateText,
      currentFocusNodeId: seed.trip.currentFocusNodeId
    }
  });
  log("creating trip: done");

  log(`creating members: ${seed.trip.members.length}`);
  for (const member of seed.trip.members) {
    await prisma.member.upsert({
      where: { id: member.id },
      create: {
        id: member.id,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl
      },
      update: {
        displayName: member.displayName,
        avatarUrl: member.avatarUrl
      }
    });

    await prisma.tripMember.upsert({
      where: {
        tripId_memberId: {
          tripId: seed.trip.id,
          memberId: member.id
        }
      },
      create: {
        tripId: seed.trip.id,
        memberId: member.id,
        role: member.role ?? "member",
        joinStatus: "joined"
      },
      update: {
        role: member.role ?? "member"
      }
    });
  }
  log("creating members: done");

  log(`creating messages: ${seed.messages.length}`);
  if (seed.messages.length > 0) {
    await prisma.chatMessage.createMany({
      data: seed.messages.map((message) => ({
        id: message.id,
        tripId: message.tripId,
        authorType: message.authorType,
        authorMemberId: message.authorMemberId,
        messageType: message.messageType,
        textContent: message.textContent,
        payload: jsonInput(message.payload),
        visibility: message.visibility,
        createdAt: new Date(message.createdAt)
      })),
      skipDuplicates: true
    });
  }
  log("creating messages: done");

  log(`creating places: ${nodes.length}`);
  for (const node of nodes) {
    await prisma.destinationNode.upsert({
      where: { id: node.id },
      create: {
        id: node.id,
        provider: node.provider,
        providerPlaceId: node.providerPlaceId,
        canonicalName: node.canonicalName,
        aliases: jsonRequired(node.aliases),
        nodeType: node.nodeType,
        parentId: node.parentId,
        countryCode: node.countryCode,
        latitude: node.geo?.latitude,
        longitude: node.geo?.longitude,
        shortSummary: node.shortSummary,
        longDescription: node.longDescription,
        highlights: jsonRequired(node.highlights),
        tags: jsonRequired(node.tags),
        suggestedStayText: node.suggestedStayText,
        budgetBand: node.budgetBand,
        heroImageUrl: node.heroImageUrl,
        images: jsonInput(node.images),
        imageAlt: node.imageAlt,
        dataSource: node.dataSource,
        dataFreshness: node.dataFreshness,
        dataAsOf: node.dataAsOf,
        lastSyncedAt: node.lastSyncedAt,
        popularityScore: node.popularityScore,
        socialDiscovery: jsonInput(node.socialDiscovery),
        isSeedData: node.isSeedData
      },
      update: {
        canonicalName: node.canonicalName,
        aliases: jsonInput(node.aliases),
        nodeType: node.nodeType,
        parentId: node.parentId,
        latitude: node.geo?.latitude,
        longitude: node.geo?.longitude,
        shortSummary: node.shortSummary,
        highlights: jsonInput(node.highlights),
        tags: jsonInput(node.tags),
        suggestedStayText: node.suggestedStayText,
        budgetBand: node.budgetBand,
        heroImageUrl: node.heroImageUrl,
        images: jsonInput(node.images),
        imageAlt: node.imageAlt,
        socialDiscovery: jsonInput(node.socialDiscovery)
      }
    });
  }
  log("creating places: done");

  log(`creating room node states: ${initialRoomStates.length}`);
  if (initialRoomStates.length > 0) {
    await prisma.roomNodeState.createMany({
      data: initialRoomStates.map((state) => ({
        tripId: state.tripId,
        nodeId: state.nodeId,
        state: state.state,
        explorationState: state.explorationState,
        engagementScore: state.engagementScore,
        interestScore: state.interestScore,
        disagreementScore: state.disagreementScore,
        mentionCount: state.mentionCount ?? 0,
        interactionCount: state.interactionCount ?? 0,
        source: state.source,
        shownCount: state.shownCount,
        aggregateSignal: jsonInput(state.aggregateSignal)
      })),
      skipDuplicates: true
    });
  }
  log("creating room node states: done");

  if (tripId === QUICK_DEMO_TRIP_ID) {
    await seedDemoPreferenceActivity(tripId, seed, options);
  }

  log("creating planning context: skipped until user triggers planning");
}

export async function resetDemoSeeds(options: DemoSeedOptions = {}) {
  assertNonProductionDemoReset();
  const log = options.logger ?? (() => undefined);

  for (const tripId of getKnownDemoTripIds()) {
    log(`[${tripId}] clearing trip`);
    await clearDemoTrip(tripId);
    await ensureDemoRoomPersisted(tripId, options);
    log(`[${tripId}] ready`);
  }
}

async function seedDemoPreferenceActivity(
  tripId: string,
  seed: Pick<
    DemoRoomData,
    | "messages"
    | "materials"
    | "evidences"
    | "signals"
    | "constraints"
    | "placeOpinions"
    | "memberPlaceProfiles"
    | "roomPlaceProfiles"
  >,
  options: DemoSeedOptions
) {
  const log = scopedLogger(options.logger, tripId);
  const existingEvidenceCount = await prisma.evidence.count({ where: { tripId } });
  if (existingEvidenceCount > 0) {
    log(`creating evidence: skipped, ${existingEvidenceCount} rows already exist`);
    return;
  }

  log(`creating materials: ${seed.materials.length}`);
  if (seed.materials.length > 0) {
    await prisma.material.createMany({
      data: seed.materials.map((material) => ({
        id: material.id,
        tripId: material.tripId,
        createdByType: material.createdByType,
        createdByMemberId: material.createdByMemberId,
        materialType: material.materialType,
        sourceType: material.sourceType,
        sourceProvider: material.sourceProvider,
        sourceUrl: material.sourceUrl,
        rawText: material.rawText,
        attachmentUrl: material.attachmentUrl,
        title: material.title,
        summary: material.summary,
        status: material.status,
        primaryNodeId: material.primaryNodeId,
        extractionStatus: material.extractionStatus,
        extractionConfidence: material.extractionConfidence,
        createdAt: new Date(material.createdAt)
      })),
      skipDuplicates: true
    });
  }
  log("creating materials: done");

  log(`creating evidence: ${seed.evidences?.length ?? 0}`);
  if ((seed.evidences?.length ?? 0) > 0) {
    await prisma.evidence.createMany({
      data: (seed.evidences ?? []).map((evidence) => ({
        id: evidence.id,
        tripId: evidence.tripId,
        memberId: evidence.memberId,
        targetType: evidence.targetType,
        targetId: evidence.targetId,
        evidenceType: evidence.evidenceType,
        sourceEntityType: evidence.sourceEntityType,
        sourceEntityId: evidence.sourceEntityId,
        sourceMessageId: evidence.sourceMessageId,
        sourceMaterialId: evidence.sourceMaterialId,
        sourcePlaceOpinionId: evidence.sourcePlaceOpinionId,
        rawTextSnapshot: evidence.rawTextSnapshot,
        rawPayload: jsonInput(evidence.rawPayload),
        metadata: jsonInput({
          ...(evidence.metadata ?? {}),
          demoSeed: true,
          deterministic: true
        }),
        analysisStatus: "completed",
        analysisError: null,
        visibility: evidence.visibility,
        occurredAt: new Date(evidence.occurredAt),
        createdAt: new Date(evidence.createdAt)
      })),
      skipDuplicates: true
    });
  }
  log("creating evidence: done");

  log(`deriving signals: ${seed.signals.length}`);
  if (seed.signals.length > 0) {
    await prisma.memberSignal.createMany({
      data: seed.signals.map((signal) => ({
        id: signal.id,
        tripId: signal.tripId,
        memberId: signal.memberId,
        evidenceId: signal.evidenceId,
        targetType: signal.targetType,
        targetId: signal.targetId,
        signalType: signal.signalType,
        polarity: signal.polarity,
        intensity: signal.intensity,
        reason: signal.reason,
        aspect: signal.aspect,
        intent: signal.intent,
        conditionText: signal.conditionText,
        constraintCandidate: signal.constraintCandidate ?? false,
        extractedAttributes: jsonInput(signal.extractedAttributes),
        sourceMessageId: signal.sourceMessageId,
        sourceMaterialId: signal.sourceMaterialId,
        sourcePlaceOpinionId: signal.sourcePlaceOpinionId,
        visibility: signal.visibility,
        scope: signal.scope,
        createdBy: "mock_seed_fallback",
        modelName: "mock",
        modelVersion: "mock-preference-v1",
        extractionRunId: signal.extractionRunId,
        invalidatedAt: signal.invalidatedAt ? new Date(signal.invalidatedAt) : undefined,
        confidence: signal.confidence,
        createdAt: new Date(signal.createdAt)
      })),
      skipDuplicates: true
    });
  }
  log("deriving signals: done");

  log(`creating place opinions: ${seed.placeOpinions?.length ?? 0}`);
  if ((seed.placeOpinions?.length ?? 0) > 0) {
    await prisma.placeOpinion.createMany({
      data: (seed.placeOpinions ?? []).map((opinion) => ({
        id: opinion.id,
        tripId: opinion.tripId,
        nodeId: opinion.nodeId,
        memberId: opinion.memberId,
        sourceType: opinion.sourceType,
        sourceMessageId: opinion.sourceMessageId,
        sourceEvidenceId: opinion.sourceEvidenceId,
        content: opinion.content,
        reaction: opinion.reaction,
        visibility: opinion.visibility,
        signalType: opinion.signalType,
        createdAt: new Date(opinion.createdAt)
      })),
      skipDuplicates: true
    });
  }
  log("creating place opinions: done");

  log(`generating constraints: ${seed.constraints?.length ?? 0}`);
  if ((seed.constraints?.length ?? 0) > 0) {
    await prisma.memberConstraint.createMany({
      data: (seed.constraints ?? []).map((constraint) => ({
        id: constraint.id,
        tripId: constraint.tripId,
        memberId: constraint.memberId,
        targetType: constraint.targetType,
        targetId: constraint.targetId,
        sourceKind: constraint.sourceKind,
        constraintType: constraint.constraintType,
        severity: constraint.severity,
        polarity: constraint.polarity,
        priorityScore: constraint.priorityScore,
        confidence: constraint.confidence,
        summary: constraint.summary,
        conditionText: constraint.conditionText,
        structuredValue: jsonInput(constraint.structuredValue),
        evidenceIds: jsonInput(constraint.evidenceIds),
        signalIds: jsonInput(constraint.signalIds),
        status: constraint.status,
        modelName: constraint.modelName,
        modelVersion: constraint.modelVersion,
        createdAt: new Date(constraint.createdAt),
        invalidatedAt: constraint.invalidatedAt ? new Date(constraint.invalidatedAt) : undefined
      })),
      skipDuplicates: true
    });
  }
  log("generating constraints: done");

  log(`generating member profiles: ${seed.memberPlaceProfiles?.length ?? 0}`);
  if ((seed.memberPlaceProfiles?.length ?? 0) > 0) {
    await prisma.memberPlaceProfile.createMany({
      data: (seed.memberPlaceProfiles ?? []).map((profile) => ({
        id: profile.id,
        tripId: profile.tripId,
        memberId: profile.memberId,
        nodeId: profile.nodeId,
        interestScore: profile.interestScore,
        positiveScore: profile.positiveScore,
        negativeScore: profile.negativeScore,
        confidenceScore: profile.confidenceScore,
        stance: profile.stance,
        summary: profile.summary,
        positiveReasons: jsonRequired(profile.positiveReasons),
        negativeReasons: jsonRequired(profile.negativeReasons),
        conditionText: profile.conditionText,
        constraintSummary: profile.constraintSummary,
        mustGo: profile.mustGo,
        hardReject: profile.hardReject,
        evidenceCount: profile.evidenceCount,
        signalCount: profile.signalCount,
        constraintIds: jsonInput(profile.constraintIds),
        topSignalIds: jsonRequired(profile.topSignalIds),
        sourceEvidenceIds: jsonRequired(profile.sourceEvidenceIds),
        lastSignalAt: profile.lastSignalAt ? new Date(profile.lastSignalAt) : undefined,
        aggregationVersion: profile.aggregationVersion,
        lastCalculatedAt: new Date(profile.lastCalculatedAt),
        createdAt: new Date(profile.createdAt)
      })),
      skipDuplicates: true
    });
  }
  log("generating member profiles: done");

  log(`generating room profiles: ${seed.roomPlaceProfiles?.length ?? 0}`);
  if ((seed.roomPlaceProfiles?.length ?? 0) > 0) {
    await prisma.roomPlaceProfile.createMany({
      data: (seed.roomPlaceProfiles ?? []).map((profile) => ({
        id: profile.id,
        tripId: profile.tripId,
        nodeId: profile.nodeId,
        teamInterestScore: profile.teamInterestScore,
        engagementScore: profile.engagementScore,
        disagreementScore: profile.disagreementScore,
        memberStances: jsonRequired(profile.memberStances),
        summary: profile.summary,
        commonPositiveReasons: jsonRequired(profile.commonPositiveReasons),
        mainConcerns: jsonRequired(profile.mainConcerns),
        conditionalFitNotes: jsonInput(profile.conditionalFitNotes),
        unresolvedQuestions: jsonInput(profile.unresolvedQuestions),
        mustGoMemberIds: jsonInput(profile.mustGoMemberIds),
        hardRejectMemberIds: jsonInput(profile.hardRejectMemberIds),
        memberProfileIds: jsonRequired(profile.memberProfileIds),
        sourceEvidenceIds: jsonRequired(profile.sourceEvidenceIds),
        topSignalIds: jsonRequired(profile.topSignalIds),
        constraintIds: jsonInput(profile.constraintIds),
        aggregationVersion: profile.aggregationVersion,
        lastCalculatedAt: new Date(profile.lastCalculatedAt),
        createdAt: new Date(profile.createdAt)
      })),
      skipDuplicates: true
    });
  }
  log("generating room profiles: done");
}

async function clearDemoTrip(tripId: string) {
  await prisma.planningContextSnapshot.deleteMany({ where: { tripId } });
  await prisma.planVariant.deleteMany({ where: { tripId } });
  await prisma.roomPlaceProfile.deleteMany({ where: { tripId } });
  await prisma.memberPlaceProfile.deleteMany({ where: { tripId } });
  await prisma.memberConstraint.deleteMany({ where: { tripId } });
  await prisma.memberSignal.deleteMany({ where: { tripId } });
  await prisma.evidence.deleteMany({ where: { tripId } });
  await prisma.placeOpinion.deleteMany({ where: { tripId } });
  await prisma.material.deleteMany({ where: { tripId } });
  await prisma.roomNodeState.deleteMany({ where: { tripId } });
  await prisma.chatMessage.deleteMany({ where: { tripId } });
  await prisma.tripMember.deleteMany({ where: { tripId } });
  await prisma.trip.deleteMany({ where: { id: tripId } });
}

function assertNonProductionDemoReset() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing to reset demo data in production.");
  }
}

function scopedLogger(logger: DemoSeedLogger | undefined, tripId: string) {
  return (message: string) => logger?.(`[${tripId}] ${message}`);
}

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

function jsonRequired(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
