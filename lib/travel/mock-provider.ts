import freshDemoRoom from "@/seed/demo-room-fresh.json";
import quickDemoRoom from "@/seed/demo-room-quick.json";
import japanDestinations from "@/seed/japan-destinations.json";
import { createTravelCard } from "@/lib/graph/cards";
import { signalTypeForReaction } from "@/lib/preferences/reaction";
import { getPlaceSocialDiscovery } from "@/lib/travel/social-discovery";
import type {
  BudgetEstimate,
  FlightSearchResult,
  HotelSearchResult,
  PlaceResolution,
  RouteEstimate,
  TravelProvider,
  WeatherResult
} from "@/lib/travel/provider";
import type {
  ChatMessage,
  DestinationNode,
  DestinationRelation,
  Evidence,
  Material,
  MemberPlaceProfile,
  MemberSignal,
  PlaceOpinion,
  PlanVariant,
  ReactionType,
  RoomPlaceProfile,
  RoomNodeState,
  Trip
} from "@/lib/types";

const nodes = (japanDestinations.nodes as DestinationNode[]).map(normalizeSeedNode);
const relations = japanDestinations.relations as DestinationRelation[];
const MOCK_AS_OF = "2026-08-23";
export const DEFAULT_DEMO_TRIP_ID = "demo-japan-7d";
export const QUICK_DEMO_TRIP_ID = "demo-japan-quick";
export const DEMO_TRIP_IDS = [DEFAULT_DEMO_TRIP_ID, QUICK_DEMO_TRIP_ID] as const;

type DemoTripId = (typeof DEMO_TRIP_IDS)[number];

interface DemoRoomSeed {
  trip: Trip;
  messages: ChatMessage[];
  materials?: Material[];
  seedEvents?: DemoSeedEvent[];
  initialCardIds?: string[];
  exploredNodeIds?: string[];
  initialActiveMemberIds?: string[];
}

export type DemoSeedEvent =
  | {
      id: string;
      type: "reaction";
      memberId: string;
      nodeId: string;
      reaction: ReactionType;
      createdAt: string;
    }
  | {
      id: string;
      type: "place_comment";
      memberId: string;
      nodeId: string;
      sourceType: PlaceOpinion["sourceType"];
      text: string;
      reaction: ReactionType;
      createdAt: string;
    };

export class MockTravelProvider implements TravelProvider {
  async searchDestinations(query: string) {
    return findNodes(query).filter((node) =>
      ["country", "region", "city"].includes(node.nodeType)
    );
  }

  async searchPlaces(query: string) {
    return findNodes(query);
  }

  async getPopularPlaces(parentNodeId = "japan") {
    return this.getChildPlaces(parentNodeId).then((places) =>
      places.sort((a, b) => (b.popularityScore ?? 0) - (a.popularityScore ?? 0))
    );
  }

  async getChildPlaces(parentNodeId: string) {
    const childIds = relations
      .filter(
        (relation) =>
          relation.fromNodeId === parentNodeId &&
          ["contains", "nearby_day_trip", "pairs_well_with", "alternative_to"].includes(
            relation.relationType
          )
      )
      .map((relation) => relation.toNodeId);

    return childIds
      .map((childId) => nodes.find((node) => node.id === childId))
      .filter((node): node is DestinationNode => Boolean(node));
  }

  async getPlaceDetails(nodeId: string) {
    return nodes.find((node) => node.id === nodeId);
  }

  async getRelatedPlaces(nodeId: string) {
    const relatedIds = relations
      .filter((relation) => relation.fromNodeId === nodeId)
      .map((relation) => relation.toNodeId);

    return relatedIds
      .map((relatedId) => nodes.find((node) => node.id === relatedId))
      .filter((node): node is DestinationNode => Boolean(node));
  }

  async resolvePlaceMention(name: string): Promise<PlaceResolution> {
    const match = findNodes(name)[0];
    if (match) {
      return {
        status: "resolved",
        query: name,
        place: match
      };
    }

    return {
      status: "unresolved",
      query: name,
      unresolvedMention: {
        name,
        source: "conversation",
        reason: "当前 MVP 不接真实地点 Provider，不能伪造坐标、父级或 provider id。"
      }
    };
  }

  async getPlaceImages(nodeId: string) {
    const node = await this.getPlaceDetails(nodeId);
    return node?.images ?? (node?.heroImageUrl ? [{ url: node.heroImageUrl, alt: node.imageAlt }] : []);
  }

  async getRouteEstimate(fromNodeId: string, toNodeId: string): Promise<RouteEstimate> {
    const relation = relations.find(
      (item) => item.fromNodeId === fromNodeId && item.toNodeId === toNodeId
    );
    const metadataText =
      typeof relation?.metadata?.travelTimeText === "string"
        ? relation.metadata.travelTimeText
        : undefined;
    const reasonText =
      typeof relation?.metadata?.reason === "string" ? relation.metadata.reason : undefined;

    return {
      fromNodeId,
      toNodeId,
      text: metadataText ?? reasonText ?? "Mock Data：示例交通时间待结合路线确认。",
      mode: "mixed",
      sourceType: "mock",
      isEstimate: true,
      asOf: MOCK_AS_OF
    };
  }

  async getBudgetEstimate(input: { nodeId?: string }): Promise<BudgetEstimate> {
    const node = input.nodeId ? nodes.find((item) => item.id === input.nodeId) : undefined;
    const band = node?.budgetBand ?? "unknown";

    return {
      nodeId: input.nodeId,
      band,
      text: `参考估算 / Mock Data：${budgetLabel(band)}。未连接实时价格、库存或预订数据。`,
      basis: "日本演示种子库，用于 MVP 产品体验验证。",
      sourceType: "mock",
      isEstimate: true,
      asOf: node?.dataAsOf ?? MOCK_AS_OF
    };
  }

  async searchHotels(input: { nodeId?: string; query?: string }): Promise<HotelSearchResult[]> {
    const budget = await this.getBudgetEstimate({ nodeId: input.nodeId });

    return [
      {
        nodeId: input.nodeId,
        title: "Mock 酒店区域建议",
        summary: "当前 MVP 不接酒店 API，仅返回用于讨论住宿区域的示例数据。",
        budget
      }
    ];
  }

  async searchFlights(): Promise<FlightSearchResult[]> {
    return [
      {
        title: "Mock 航班占位",
        summary: "当前 MVP 不接航班 API，不提供实时航班、库存或票价。",
        sourceType: "mock",
        isEstimate: true
      }
    ];
  }

  async getWeather(input: { nodeId?: string }): Promise<WeatherResult> {
    return {
      nodeId: input.nodeId,
      text: "Mock Data：当前 MVP 不接实时天气 API，天气只作为未来 Provider 能力预留。",
      sourceType: "mock",
      isEstimate: true,
      asOf: MOCK_AS_OF
    };
  }

  async getAllNodes() {
    return nodes;
  }

  async getAllRelations() {
    return relations;
  }

  async getCardsForNodes(nodeIds: string[]) {
    return nodeIds
      .map((nodeId) => nodes.find((node) => node.id === nodeId))
      .filter((node): node is DestinationNode => Boolean(node))
      .map((node) => createTravelCard(node, relations));
  }
}

export function getMockDemoSeed(tripId: string = DEFAULT_DEMO_TRIP_ID) {
  const demoSeed = demoSeedForTripId(tripId);
  const trip = demoSeed.trip as Trip;
  const messages = demoSeed.messages as ChatMessage[];
  const initialCardIds = demoSeed.initialCardIds ?? initialExploreNodeIds();
  const seedActivity = buildSeedActivityFallback(demoSeed);
  const materials = seedActivity.materials;

  const roomNodeStates: RoomNodeState[] = nodes.map((node) => ({
    tripId: trip.id,
    nodeId: node.id,
    state: node.id === "japan" ? "focused" : demoSeed.exploredNodeIds?.includes(node.id) ? "shown" : "undiscovered",
    shownCount: demoSeed.exploredNodeIds?.includes(node.id) ? 1 : 0,
    lastShownAt: demoSeed.exploredNodeIds?.includes(node.id) ? MOCK_AS_OF : undefined,
    explorationState: demoSeed.exploredNodeIds?.includes(node.id) ? "discovered" : "seed",
    engagementScore: demoSeed.exploredNodeIds?.includes(node.id) ? 1.4 : 0,
    interestScore: 0,
    disagreementScore: 0,
    mentionCount: 0,
    interactionCount: 0,
    source: "seed"
  }));
  const derivedRoomNodeStates = applySeedActivityToRoomNodeStates({
    tripId: trip.id,
    baseStates: roomNodeStates,
    messages,
    signals: seedActivity.signals,
    materials
  });

  return {
    trip,
    messages,
    materials,
    roomNodeStates: derivedRoomNodeStates,
    signals: seedActivity.signals,
    evidences: seedActivity.evidences,
    constraints: [],
    memberPlaceProfiles: seedActivity.memberPlaceProfiles,
    roomPlaceProfiles: seedActivity.roomPlaceProfiles,
    placeOpinions: seedActivity.placeOpinions,
    plans: [] as PlanVariant[],
    initialCardIds,
    initialActiveMemberIds: demoSeed.initialActiveMemberIds
  };
}

export function isKnownDemoTripId(tripId: string): tripId is DemoTripId {
  return DEMO_TRIP_IDS.includes(tripId as DemoTripId);
}

export function getKnownDemoTripIds() {
  return [...DEMO_TRIP_IDS];
}

export function getDemoSeedEvents(tripId: string) {
  return demoSeedForTripId(tripId).seedEvents ?? [];
}

function demoSeedForTripId(tripId: string): DemoRoomSeed {
  if (tripId === QUICK_DEMO_TRIP_ID) return quickDemoRoom as DemoRoomSeed;
  return freshDemoRoom as DemoRoomSeed;
}

function buildSeedActivityFallback(seed: DemoRoomSeed) {
  const evidences: Evidence[] = [];
  const signals: MemberSignal[] = [];
  const placeOpinions: PlaceOpinion[] = [];
  const materials = (seed.materials ?? []) as Material[];

  for (const message of seed.messages) {
    if (message.authorType !== "member" || !message.authorMemberId || !message.textContent) continue;

    for (const node of mentionedNodes(message.textContent)) {
      const evidenceId = `ev-${message.id}-${node.id}`;
      evidences.push(createEvidence({
        id: evidenceId,
        tripId: seed.trip.id,
        memberId: message.authorMemberId,
        targetType: "node",
        targetId: node.id,
        evidenceType: message.messageType === "user_voice" ? "voice_comment" : "chat_message",
        sourceEntityType: "chat_message",
        sourceEntityId: message.id,
        sourceMessageId: message.id,
        rawTextSnapshot: message.textContent,
        occurredAt: message.createdAt,
        rawPayload: { messageType: message.messageType }
      }));
      signals.push(
        ...signalsForTextFallback({
          tripId: seed.trip.id,
          memberId: message.authorMemberId,
          nodeId: node.id,
          text: message.textContent,
          evidenceId,
          sourceMessageId: message.id,
          createdAt: message.createdAt
        })
      );
      placeOpinions.push(createPlaceOpinionFallback({
        id: `op-${message.id}-${node.id}`,
        tripId: seed.trip.id,
        memberId: message.authorMemberId,
        nodeId: node.id,
        sourceType: message.messageType === "user_voice" ? "voice_comment" : "group_chat",
        sourceMessageId: message.id,
        sourceEvidenceId: evidenceId,
        content: message.textContent,
        reaction: inferFallbackReaction(message.textContent),
        createdAt: message.createdAt
      }));
    }
  }

  for (const material of materials) {
    const targetId = material.primaryNodeId ?? material.id;
    const targetType = material.primaryNodeId ? "node" : "material";
    const evidenceId = `ev-${material.id}-${targetId}`;
    evidences.push(createEvidence({
      id: evidenceId,
      tripId: seed.trip.id,
      memberId: material.createdByMemberId,
      targetType,
      targetId,
      evidenceType: material.materialType === "image" || material.materialType === "screenshot" ? "upload" : "material",
      sourceEntityType: "material",
      sourceEntityId: material.id,
      sourceMaterialId: material.id,
      rawTextSnapshot: material.rawText ?? material.summary,
      occurredAt: material.createdAt,
      rawPayload: {
        materialType: material.materialType,
        sourceProvider: material.sourceProvider,
        sourceUrl: material.sourceUrl
      }
    }));
    if (material.primaryNodeId && material.createdByMemberId) {
      signals.push(createSignalFallback({
        id: `sig-${evidenceId}-material`,
        tripId: seed.trip.id,
        memberId: material.createdByMemberId,
        evidenceId,
        targetId: material.primaryNodeId,
        signalType: material.status === "interested" ? "positive" : "shared",
        polarity: material.status === "interested" ? 1 : 0,
        intensity: material.status === "interested" ? 2 : 1,
        reason: material.summary ?? material.title,
        aspect: "material",
        intent: "learn_more",
        createdAt: material.createdAt,
        sourceMaterialId: material.id
      }));
    }
  }

  for (const event of seed.seedEvents ?? []) {
    if (event.type === "reaction") {
      const evidenceId = `ev-msg-${event.id}-${event.nodeId}`;
      evidences.push(createEvidence({
        id: evidenceId,
        tripId: seed.trip.id,
        memberId: event.memberId,
        targetType: "node",
        targetId: event.nodeId,
        evidenceType: "reaction",
        sourceEntityType: "chat_message",
        sourceEntityId: `msg-${event.id}`,
        sourceMessageId: `msg-${event.id}`,
        rawTextSnapshot: `成员对地点表达了 ${event.reaction}`,
        occurredAt: event.createdAt,
        rawPayload: { reaction: event.reaction }
      }));
      signals.push(signalForReactionFallback({
        tripId: seed.trip.id,
        memberId: event.memberId,
        nodeId: event.nodeId,
        reaction: event.reaction,
        evidenceId,
        sourceMessageId: `msg-${event.id}`,
        createdAt: event.createdAt
      }));
    } else {
      const evidenceId = `ev-${event.id}-${event.nodeId}`;
      evidences.push(createEvidence({
        id: evidenceId,
        tripId: seed.trip.id,
        memberId: event.memberId,
        targetType: "node",
        targetId: event.nodeId,
        evidenceType: event.sourceType === "voice_comment" ? "voice_comment" : "place_comment",
        sourceEntityType: "place_opinion",
        sourceEntityId: event.id,
        sourcePlaceOpinionId: event.id,
        rawTextSnapshot: event.text,
        occurredAt: event.createdAt,
        rawPayload: { reaction: event.reaction, sourceType: event.sourceType }
      }));
      signals.push(
        ...signalsForTextFallback({
          tripId: seed.trip.id,
          memberId: event.memberId,
          nodeId: event.nodeId,
          text: event.text,
          evidenceId,
          sourcePlaceOpinionId: event.id,
          createdAt: event.createdAt
        })
      );
      placeOpinions.push(createPlaceOpinionFallback({
        id: event.id,
        tripId: seed.trip.id,
        memberId: event.memberId,
        nodeId: event.nodeId,
        sourceType: event.sourceType,
        sourceEvidenceId: evidenceId,
        content: event.text,
        reaction: event.reaction,
        createdAt: event.createdAt
      }));
    }
  }

  const memberPlaceProfiles = buildMemberPlaceProfiles({
    trip: seed.trip,
    signals,
    evidences,
    createdAt: seed.messages.at(-1)?.createdAt ?? MOCK_AS_OF
  });
  const roomPlaceProfiles = buildRoomPlaceProfiles({
    trip: seed.trip,
    memberPlaceProfiles,
    createdAt: seed.messages.at(-1)?.createdAt ?? MOCK_AS_OF
  });

  return {
    evidences: dedupeById(evidences),
    signals: dedupeById(signals),
    placeOpinions: dedupeById(placeOpinions),
    materials,
    memberPlaceProfiles,
    roomPlaceProfiles
  };
}

function initialExploreNodeIds() {
  const clusterOrder = ["kyoto", "tokyo", "osaka", "fuji-kawaguchiko", "hokkaido", "okinawa"];
  const byCluster = new Map<string, string[]>();

  for (const clusterId of clusterOrder) {
    byCluster.set(clusterId, descendantExploreNodeIds(clusterId));
  }

  const maxBucketLength = Math.max(
    ...Array.from(byCluster.values()).map((nodeIds) => nodeIds.length),
    0
  );
  const result: string[] = [];

  for (let index = 0; index < maxBucketLength; index += 1) {
    for (const clusterId of clusterOrder) {
      const nodeId = byCluster.get(clusterId)?.[index];
      if (nodeId) result.push(nodeId);
    }
  }

  return result;
}

function applySeedActivityToRoomNodeStates(input: {
  tripId: string;
  baseStates: RoomNodeState[];
  messages: ChatMessage[];
  signals: MemberSignal[];
  materials: Material[];
}) {
  const messagesByNode = new Map<string, number>();
  const materialsByNode = new Map<string, number>();
  const latestSignalsByMemberNode = new Map<string, MemberSignal>();

  for (const message of input.messages) {
    if (message.visibility !== "group" || !message.textContent) continue;
    for (const node of mentionedNodes(message.textContent)) {
      messagesByNode.set(node.id, (messagesByNode.get(node.id) ?? 0) + 1);
    }
  }

  for (const material of input.materials) {
    if (!material.primaryNodeId) continue;
    materialsByNode.set(material.primaryNodeId, (materialsByNode.get(material.primaryNodeId) ?? 0) + 1);
  }

  for (const signal of input.signals) {
    if (signal.targetType !== "node" || signal.visibility !== "group") continue;
    latestSignalsByMemberNode.set(`${signal.memberId}:${signal.targetId}`, signal);
  }

  const signalsByNode = new Map<string, MemberSignal[]>();
  for (const signal of latestSignalsByMemberNode.values()) {
    const current = signalsByNode.get(signal.targetId) ?? [];
    signalsByNode.set(signal.targetId, [...current, signal]);
  }

  return input.baseStates.map<RoomNodeState>((state) => {
    const nodeSignals = signalsByNode.get(state.nodeId) ?? [];
    const mentionCount = messagesByNode.get(state.nodeId) ?? 0;
    const materialCount = materialsByNode.get(state.nodeId) ?? 0;
    if (nodeSignals.length === 0 && mentionCount === 0 && materialCount === 0) return state;

    const positiveMembers = new Set(nodeSignals.filter((signal) => signal.polarity > 0).map((signal) => signal.memberId));
    const negativeMembers = new Set(nodeSignals.filter((signal) => signal.polarity < 0).map((signal) => signal.memberId));
    const positiveIntensity = nodeSignals.filter((signal) => signal.polarity > 0).reduce((sum, signal) => sum + signal.intensity, 0);
    const negativeIntensity = nodeSignals.filter((signal) => signal.polarity < 0).reduce((sum, signal) => sum + Math.abs(signal.intensity), 0);
    const commentCount = nodeSignals.filter((signal) => Boolean(signal.reason)).length;
    const engagementScore = clampScore((state.engagementScore ?? 0) + mentionCount * 2 + nodeSignals.length * 1.2 + materialCount * 1.4);
    const interestScore = clampScore(positiveIntensity - negativeIntensity * 0.7 + materialCount * 0.6);
    const disagreementScore =
      positiveIntensity > 0 && negativeIntensity > 0
        ? clampScore(Math.min(positiveIntensity, negativeIntensity) + 2)
        : 0;

    return {
      ...state,
      state: state.state === "focused" ? state.state : "shown",
      explorationState: interestScore >= 6 ? "candidate" : "engaged",
      engagementScore,
      interestScore,
      disagreementScore,
      mentionCount,
      interactionCount: nodeSignals.length + mentionCount + materialCount,
      firstDiscoveredAt: state.firstDiscoveredAt ?? MOCK_AS_OF,
      lastInteractedAt: latestIso([state.lastInteractedAt, ...nodeSignals.map((signal) => signal.createdAt)]),
      source: "mock",
      aggregateSignal: {
        positiveMembers: positiveMembers.size,
        negativeMembers: negativeMembers.size,
        interestedMembers: positiveMembers.size,
        comments: commentCount
      }
    };
  });
}

function mentionedNodes(text: string) {
  const normalized = text.toLowerCase();
  return nodes.filter(
    (node) =>
      node.nodeType !== "country" &&
      [node.canonicalName, ...node.aliases].some((name) => normalized.includes(name.toLowerCase()))
  );
}

function createEvidence(input: {
  id: string;
  tripId: string;
  memberId?: string;
  targetType: Evidence["targetType"];
  targetId?: string;
  evidenceType: Evidence["evidenceType"];
  sourceEntityType: string;
  sourceEntityId?: string;
  sourceMessageId?: string;
  sourceMaterialId?: string;
  sourcePlaceOpinionId?: string;
  rawTextSnapshot?: string;
  rawPayload?: Record<string, unknown>;
  occurredAt: string;
}): Evidence {
  return {
    id: input.id,
    tripId: input.tripId,
    memberId: input.memberId,
    targetType: input.targetType,
    targetId: input.targetId,
    evidenceType: input.evidenceType,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    sourceMessageId: input.sourceMessageId,
    sourceMaterialId: input.sourceMaterialId,
    sourcePlaceOpinionId: input.sourcePlaceOpinionId,
    rawTextSnapshot: input.rawTextSnapshot,
    rawPayload: input.rawPayload,
    metadata: { demoSeedFallback: true },
    analysisStatus: "completed",
    visibility: "group",
    occurredAt: input.occurredAt,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt
  };
}

function createPlaceOpinionFallback(input: {
  id: string;
  tripId: string;
  nodeId: string;
  memberId: string;
  sourceType: PlaceOpinion["sourceType"];
  sourceMessageId?: string;
  sourceEvidenceId?: string;
  content: string;
  reaction: ReactionType;
  createdAt: string;
}): PlaceOpinion {
  return {
    id: input.id,
    tripId: input.tripId,
    nodeId: input.nodeId,
    memberId: input.memberId,
    sourceType: input.sourceType,
    sourceMessageId: input.sourceMessageId,
    sourceEvidenceId: input.sourceEvidenceId,
    content: input.content,
    reaction: input.reaction,
    visibility: "group",
    signalType: signalTypeForReaction(input.reaction),
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  };
}

function buildMemberPlaceProfiles(input: {
  trip: Trip;
  signals: MemberSignal[];
  evidences: Evidence[];
  createdAt: string;
}) {
  const byMemberNode = new Map<string, MemberSignal[]>();

  for (const signal of dedupeById(input.signals)) {
    if (signal.targetType !== "node") continue;
    const key = `${signal.memberId}:${signal.targetId}`;
    byMemberNode.set(key, [...(byMemberNode.get(key) ?? []), signal]);
  }

  return Array.from(byMemberNode.entries()).map<MemberPlaceProfile>(([key, signalsForPlace]) => {
    const [memberId, nodeId] = key.split(":");
    const node = nodes.find((item) => item.id === nodeId);
    const positiveReasons = dedupeText(
      signalsForPlace.filter((signal) => signal.polarity > 0).map((signal) => signal.reason).filter(isString)
    );
    const negativeReasons = dedupeText(
      signalsForPlace.filter((signal) => signal.polarity < 0).map((signal) => signal.reason).filter(isString)
    );
    const conditionText = signalsForPlace.find((signal) => signal.conditionText)?.conditionText;
    const positiveScore = signalsForPlace
      .filter((signal) => signal.polarity > 0)
      .reduce((sum, signal) => sum + signal.intensity, 0);
    const negativeScore = signalsForPlace
      .filter((signal) => signal.polarity < 0)
      .reduce((sum, signal) => sum + Math.abs(signal.intensity), 0);
    const mustGo = signalsForPlace.some((signal) => signal.signalType === "must_go" || signal.intent === "must_go");
    const hardReject = signalsForPlace.some((signal) => signal.signalType === "hard_reject" || signal.intent === "hard_reject");
    const sourceEvidenceIds = dedupeText(signalsForPlace.map((signal) => signal.evidenceId).filter(isString));
    const sourceEvidences = input.evidences.filter((evidence) => sourceEvidenceIds.includes(evidence.id));
    const lastSignalAt = latestIso(signalsForPlace.map((signal) => signal.createdAt));
    const interestScore = clampScore(positiveScore - negativeScore * 0.65 + (conditionText ? 1.2 : 0));
    const stance = stanceForSignals({ mustGo, hardReject, positiveScore, negativeScore, conditionText });

    return {
      id: `mpp-${input.trip.id}-${memberId}-${nodeId}`,
      tripId: input.trip.id,
      memberId,
      nodeId,
      interestScore,
      positiveScore,
      negativeScore,
      confidenceScore: Math.min(1, 0.45 + signalsForPlace.length * 0.12),
      stance,
      summary: summarizeMemberFallback(node?.canonicalName, stance, positiveReasons, negativeReasons, conditionText),
      positiveReasons,
      negativeReasons,
      conditionText,
      constraintSummary: conditionText,
      mustGo,
      hardReject,
      evidenceCount: sourceEvidences.length,
      signalCount: signalsForPlace.length,
      constraintIds: [],
      topSignalIds: signalsForPlace.slice(0, 6).map((signal) => signal.id),
      sourceEvidenceIds,
      lastSignalAt,
      aggregationVersion: "mock-seed-fallback-v1",
      lastCalculatedAt: input.createdAt,
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    };
  });
}

function buildRoomPlaceProfiles(input: {
  trip: Trip;
  memberPlaceProfiles: MemberPlaceProfile[];
  createdAt: string;
}) {
  const byNode = new Map<string, MemberPlaceProfile[]>();
  for (const profile of input.memberPlaceProfiles) {
    byNode.set(profile.nodeId, [...(byNode.get(profile.nodeId) ?? []), profile]);
  }

  return Array.from(byNode.entries()).map<RoomPlaceProfile>(([nodeId, profiles]) => {
    const node = nodes.find((item) => item.id === nodeId);
    const scores = profiles.map((profile) => profile.interestScore);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const teamInterestScore = clampScore(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length));
    const commonPositiveReasons = dedupeText(profiles.flatMap((profile) => profile.positiveReasons)).slice(0, 5);
    const mainConcerns = dedupeText(profiles.flatMap((profile) => profile.negativeReasons)).slice(0, 5);

    return {
      id: `rpp-${input.trip.id}-${nodeId}`,
      tripId: input.trip.id,
      nodeId,
      teamInterestScore,
      engagementScore: clampScore(profiles.length * 2 + profiles.reduce((sum, profile) => sum + profile.signalCount, 0) * 0.5),
      disagreementScore: maxScore > 0 && minScore < 4 ? clampScore(maxScore - minScore) : 0,
      memberStances: profiles.map((profile) => ({
        memberId: profile.memberId,
        displayName: input.trip.members.find((member) => member.id === profile.memberId)?.displayName,
        stance: profile.stance,
        interestScore: profile.interestScore,
        summary: profile.summary
      })),
      summary: summarizeRoomFallback(node?.canonicalName, commonPositiveReasons, mainConcerns),
      commonPositiveReasons,
      mainConcerns,
      conditionalFitNotes: dedupeText(profiles.map((profile) => profile.conditionText).filter(isString)),
      unresolvedQuestions: [],
      mustGoMemberIds: profiles.filter((profile) => profile.mustGo).map((profile) => profile.memberId),
      hardRejectMemberIds: profiles.filter((profile) => profile.hardReject).map((profile) => profile.memberId),
      memberProfileIds: profiles.map((profile) => profile.id),
      sourceEvidenceIds: dedupeText(profiles.flatMap((profile) => profile.sourceEvidenceIds)),
      topSignalIds: profiles.flatMap((profile) => profile.topSignalIds).slice(0, 8),
      constraintIds: [],
      aggregationVersion: "mock-seed-fallback-v1",
      lastCalculatedAt: input.createdAt,
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    };
  });
}

function stanceForSignals(input: {
  mustGo: boolean;
  hardReject: boolean;
  positiveScore: number;
  negativeScore: number;
  conditionText?: string;
}): MemberPlaceProfile["stance"] {
  if (input.hardReject) return "avoid";
  if (input.mustGo) return "strong_like";
  if (input.positiveScore > 0 && (input.negativeScore > 0 || input.conditionText)) return "conditional";
  if (input.positiveScore >= 3) return "like";
  if (input.negativeScore > 0) return "concerned";
  return "neutral";
}

function summarizeMemberFallback(
  placeName: string | undefined,
  stance: MemberPlaceProfile["stance"],
  positiveReasons: string[],
  negativeReasons: string[],
  conditionText?: string
) {
  if (stance === "unknown") return "还没有形成明确态度。";
  const positive = positiveReasons.length ? `喜欢 ${positiveReasons.slice(0, 2).join("、")}` : "有初步兴趣";
  const negative = negativeReasons.length ? `，顾虑 ${negativeReasons.slice(0, 2).join("、")}` : "";
  const condition = conditionText ? `，条件是${conditionText}` : "";
  return `对${placeName ?? "这个地点"}${positive}${negative}${condition}。`;
}

function summarizeRoomFallback(placeName: string | undefined, positives: string[], concerns: string[]) {
  const positive = positives.length ? `共同兴趣集中在 ${positives.slice(0, 3).join("、")}` : "团队已有成员开始表态";
  const concern = concerns.length ? `，主要顾虑是 ${concerns.slice(0, 3).join("、")}` : "";
  return `${placeName ? `${placeName}：` : ""}${positive}${concern}。`;
}

function signalsForTextFallback(input: {
  tripId: string;
  memberId: string;
  nodeId: string;
  text: string;
  evidenceId: string;
  sourceMessageId?: string;
  sourcePlaceOpinionId?: string;
  createdAt: string;
}) {
  const signals: MemberSignal[] = [];
  const base = {
    tripId: input.tripId,
    memberId: input.memberId,
    evidenceId: input.evidenceId,
    targetId: input.nodeId,
    sourceMessageId: input.sourceMessageId,
    sourcePlaceOpinionId: input.sourcePlaceOpinionId,
    createdAt: input.createdAt
  };

  if (/海边|海|江之岛/.test(input.text)) {
    signals.push(createSignalFallback({
      ...base,
      id: `sig-${input.evidenceId}-sea`,
      signalType: "positive",
      polarity: 1,
      intensity: 3,
      reason: "喜欢海边氛围",
      aspect: "sea",
      intent: "want_to_go"
    }));
  }
  if (/电车|江之电/.test(input.text)) {
    signals.push(createSignalFallback({
      ...base,
      id: `sig-${input.evidenceId}-train`,
      signalType: "positive",
      polarity: 1,
      intensity: 3,
      reason: "喜欢电车体验",
      aspect: "train_experience",
      intent: "want_to_go"
    }));
  }
  if (/温泉/.test(input.text)) {
    signals.push(createSignalFallback({
      ...base,
      id: `sig-${input.evidenceId}-onsen`,
      signalType: "positive",
      polarity: 1,
      intensity: 3,
      reason: "喜欢温泉和放松体验",
      aspect: "onsen",
      intent: "want_to_go"
    }));
  }
  if (/祇园|伏见稻荷|京都|寺社|传统/.test(input.text)) {
    signals.push(createSignalFallback({
      ...base,
      id: `sig-${input.evidenceId}-culture`,
      signalType: "positive",
      polarity: 1,
      intensity: 3,
      reason: "喜欢传统文化和街区氛围",
      aspect: "culture",
      intent: "want_to_go"
    }));
  }
  if (/USJ|环球影城/.test(input.text)) {
    signals.push(createSignalFallback({
      ...base,
      id: `sig-${input.evidenceId}-theme-park`,
      signalType: /很想|最想|完整一天/.test(input.text) ? "must_go" : "positive",
      polarity: 1,
      intensity: /很想|最想|完整一天/.test(input.text) ? 5 : 3,
      reason: "对主题乐园兴趣强",
      aspect: "theme_park",
      intent: /很想|最想|完整一天/.test(input.text) ? "must_go" : "want_to_go",
      constraintCandidate: /很想|最想|完整一天/.test(input.text)
    }));
  }
  if (/不值|太远|太久|太累|太折腾|不想专门|不要换乘太多|不要塞太多|轻松一点|少走/.test(input.text)) {
    signals.push(createSignalFallback({
      ...base,
      id: `sig-${input.evidenceId}-condition`,
      signalType: "concern",
      polarity: -1,
      intensity: 4,
      reason: "顾虑时间成本、移动强度或节奏",
      aspect: /走|塞太多|轻松/.test(input.text) ? "pace" : "time_cost",
      intent: "condition",
      conditionText: /轻松|少走|不要塞太多/.test(input.text)
        ? "希望节奏轻松，不要一天塞太满"
        : "不希望为了这个地点单独花一整天或明显绕路",
      constraintCandidate: true
    }));
  }
  if (signals.length === 0 && input.text.trim()) {
    signals.push(createSignalFallback({
      ...base,
      id: `sig-${input.evidenceId}-overall`,
      signalType: "want_to_know",
      polarity: 0,
      intensity: 1,
      reason: input.text.trim(),
      aspect: "overall",
      intent: "learn_more"
    }));
  }

  return signals;
}

function signalForReactionFallback(input: {
  tripId: string;
  memberId: string;
  nodeId: string;
  reaction: ReactionType;
  evidenceId: string;
  sourceMessageId: string;
  createdAt: string;
}) {
  const mapped = reactionSignalAttributes(input.reaction);
  return createSignalFallback({
    id: `sig-${input.evidenceId}-reaction`,
    tripId: input.tripId,
    memberId: input.memberId,
    evidenceId: input.evidenceId,
    targetId: input.nodeId,
    sourceMessageId: input.sourceMessageId,
    createdAt: input.createdAt,
    ...mapped
  });
}

function createSignalFallback(input: {
  id: string;
  tripId: string;
  memberId: string;
  evidenceId?: string;
  targetId: string;
  sourceMessageId?: string;
  sourceMaterialId?: string;
  sourcePlaceOpinionId?: string;
  signalType: MemberSignal["signalType"];
  polarity: -1 | 0 | 1;
  intensity: MemberSignal["intensity"];
  reason?: string;
  aspect?: string;
  intent?: string;
  conditionText?: string;
  constraintCandidate?: boolean;
  createdAt: string;
}): MemberSignal {
  return {
    id: input.id,
    tripId: input.tripId,
    memberId: input.memberId,
    evidenceId: input.evidenceId,
    targetType: "node",
    targetId: input.targetId,
    sourceMessageId: input.sourceMessageId,
    sourceMaterialId: input.sourceMaterialId,
    sourcePlaceOpinionId: input.sourcePlaceOpinionId,
    signalType: input.signalType,
    polarity: input.polarity,
    intensity: input.intensity,
    reason: input.reason,
    aspect: input.aspect,
    intent: input.intent,
    conditionText: input.conditionText,
    constraintCandidate: input.constraintCandidate ?? false,
    visibility: "group",
    scope: "trip",
    createdBy: "mock_seed_fallback",
    modelName: "mock",
    modelVersion: "mock-preference-v1",
    extractionRunId: `seed-${input.evidenceId ?? input.id}`,
    confidence: 0.86,
    createdAt: input.createdAt
  };
}

function reactionSignalAttributes(reaction: ReactionType) {
  if (reaction === "must_go") {
    return {
      signalType: "must_go" as const,
      polarity: 1 as const,
      intensity: 5 as const,
      reason: "成员明确标记为必去。",
      aspect: "overall",
      intent: "must_go",
      constraintCandidate: true
    };
  }
  if (reaction === "not_interested") {
    return {
      signalType: "negative" as const,
      polarity: -1 as const,
      intensity: 3 as const,
      reason: "成员表达不想去。",
      aspect: "overall",
      intent: "avoid"
    };
  }
  if (reaction === "concern") {
    return {
      signalType: "concern" as const,
      polarity: -1 as const,
      intensity: 4 as const,
      reason: "成员对这个地点有顾虑。",
      aspect: "overall",
      intent: "concern",
      constraintCandidate: true
    };
  }
  if (reaction === "want_to_know") {
    return {
      signalType: "want_to_know" as const,
      polarity: 0 as const,
      intensity: 2 as const,
      reason: "成员想进一步了解。",
      aspect: "overall",
      intent: "learn_more"
    };
  }
  if (reaction === "neutral") {
    return {
      signalType: "neutral" as const,
      polarity: 0 as const,
      intensity: 1 as const,
      reason: "成员态度中立。",
      aspect: "overall",
      intent: "neutral"
    };
  }
  return {
    signalType: "positive" as const,
    polarity: 1 as const,
    intensity: 3 as const,
    reason: "成员表达想去。",
    aspect: "overall",
    intent: "want_to_go"
  };
}

function inferFallbackReaction(text: string): ReactionType {
  if (/必去|非常|很想|一定|最想/.test(text)) return "must_go";
  if (/不去|不想去|坚决不|避开/.test(text)) return "not_interested";
  if (/担心|顾虑|害怕|太赶|不值|太远|太久|太累|不想专门|折腾/.test(text)) return "concern";
  if (/一般|还行|都可以/.test(text)) return "neutral";
  return "want_to_go";
}

function dedupeById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function dedupeText(values: string[]) {
  return Array.from(new Set(values));
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function latestIso(values: Array<string | undefined>) {
  const sorted = values.filter((value): value is string => Boolean(value)).sort();
  return sorted.at(-1);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

function descendantExploreNodeIds(rootNodeId: string, seen = new Set<string>()) {
  const childIds = relations
    .filter(
      (relation) =>
        relation.fromNodeId === rootNodeId && relation.relationType === "contains"
    )
    .map((relation) => relation.toNodeId);
  const result: string[] = [];

  for (const childId of childIds) {
    if (seen.has(childId)) continue;
    const child = nodes.find((node) => node.id === childId);
    if (!child) continue;
    seen.add(child.id);
    if (isInitialExploreNode(child)) result.push(child.id);
    result.push(...descendantExploreNodeIds(child.id, seen));
  }

  return result;
}

function isInitialExploreNode(node: DestinationNode) {
  if (["district", "area", "attraction", "poi", "activity"].includes(node.nodeType)) return true;

  return (
    node.nodeType === "region" &&
    node.parentId !== "japan" &&
    node.tags.some((tag) => ["day_trip", "onsen", "mountain", "lake", "sea", "island", "nature"].includes(tag))
  );
}

function findNodes(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return nodes;

  return nodes.filter((node) => {
    const values = [node.id, node.canonicalName, ...node.aliases, ...node.tags].map((value) =>
      value.toLowerCase()
    );
    return values.some((value) => value.includes(normalized) || normalized.includes(value));
  });
}

function normalizeSeedNode(node: DestinationNode): DestinationNode {
  return {
    ...node,
    provider: node.provider ?? "seed",
    providerPlaceId: node.providerPlaceId ?? node.id,
    dataSource: node.dataSource ?? "seed",
    dataFreshness: node.dataFreshness ?? "seed_static",
    lastSyncedAt: node.lastSyncedAt ?? node.dataAsOf,
    popularityScore: node.popularityScore ?? defaultPopularity(node),
    socialDiscovery: node.socialDiscovery ?? getPlaceSocialDiscovery(node)
  };
}

function defaultPopularity(node: DestinationNode) {
  if (node.nodeType === "country") return 100;
  if (node.parentId === "japan") return 80;
  if (node.parentId === "tokyo") return 70;
  if (node.parentId === "osaka") return 66;
  return 50;
}

function budgetLabel(band: DestinationNode["budgetBand"]) {
  switch (band) {
    case "low":
      return "低预算档";
    case "medium":
      return "中等预算档";
    case "high":
      return "偏高预算档";
    case "luxury":
      return "高预算档";
    default:
      return "预算待确认";
  }
}
