import type {
  Evidence,
  MemberConstraint,
  MemberPlaceProfile,
  MemberSignal,
  PlaceOpinion,
  ReactionType,
  RoomNodeState,
  RoomPlaceProfile
} from "@/lib/types";

type JsonRecord = Record<string, unknown>;

export function serializeEvidence(record: {
  id: string;
  tripId: string;
  memberId: string | null;
  targetType: string;
  targetId: string | null;
  evidenceType: string;
  sourceEntityType: string;
  sourceEntityId: string | null;
  sourceMessageId: string | null;
  sourceMaterialId: string | null;
  sourcePlaceOpinionId: string | null;
  rawTextSnapshot: string | null;
  rawPayload: unknown;
  metadata: unknown;
  analysisStatus: string;
  analysisError: string | null;
  visibility: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}): Evidence {
  return {
    id: record.id,
    tripId: record.tripId,
    memberId: record.memberId ?? undefined,
    targetType: targetType(record.targetType),
    targetId: record.targetId ?? undefined,
    evidenceType: record.evidenceType as Evidence["evidenceType"],
    sourceEntityType: record.sourceEntityType,
    sourceEntityId: record.sourceEntityId ?? undefined,
    sourceMessageId: record.sourceMessageId ?? undefined,
    sourceMaterialId: record.sourceMaterialId ?? undefined,
    sourcePlaceOpinionId: record.sourcePlaceOpinionId ?? undefined,
    rawTextSnapshot: record.rawTextSnapshot ?? undefined,
    rawPayload: jsonRecord(record.rawPayload),
    metadata: jsonRecord(record.metadata),
    analysisStatus: record.analysisStatus as Evidence["analysisStatus"],
    analysisError: record.analysisError ?? undefined,
    visibility: visibility(record.visibility),
    occurredAt: record.occurredAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString()
  };
}

export function serializeSignal(record: {
  id: string;
  tripId: string;
  memberId: string;
  evidenceId: string | null;
  targetType: string;
  targetId: string;
  signalType: string;
  polarity: number;
  intensity: number;
  reason: string | null;
  aspect: string | null;
  intent: string | null;
  conditionText: string | null;
  constraintCandidate: boolean;
  extractedAttributes: unknown;
  sourceMessageId: string | null;
  sourceMaterialId: string | null;
  sourcePlaceOpinionId: string | null;
  visibility: string;
  scope: string;
  createdBy: string;
  modelName: string | null;
  modelVersion: string | null;
  extractionRunId: string | null;
  invalidatedAt: Date | null;
  confidence: number;
  createdAt: Date;
}): MemberSignal {
  return {
    id: record.id,
    tripId: record.tripId,
    memberId: record.memberId,
    evidenceId: record.evidenceId ?? undefined,
    targetType: signalTargetType(record.targetType),
    targetId: record.targetId,
    sourceMessageId: record.sourceMessageId ?? undefined,
    sourceMaterialId: record.sourceMaterialId ?? undefined,
    sourcePlaceOpinionId: record.sourcePlaceOpinionId ?? undefined,
    signalType: record.signalType as MemberSignal["signalType"],
    polarity: polarity(record.polarity),
    intensity: intensity(record.intensity),
    reason: record.reason ?? undefined,
    aspect: record.aspect ?? undefined,
    intent: record.intent ?? undefined,
    conditionText: record.conditionText ?? undefined,
    constraintCandidate: record.constraintCandidate,
    extractedAttributes: signalAttributes(record.extractedAttributes),
    visibility: visibility(record.visibility),
    scope: "trip",
    createdBy: record.createdBy,
    modelName: record.modelName ?? undefined,
    modelVersion: record.modelVersion ?? undefined,
    extractionRunId: record.extractionRunId ?? undefined,
    invalidatedAt: record.invalidatedAt?.toISOString(),
    confidence: record.confidence,
    createdAt: record.createdAt.toISOString()
  };
}

export function serializePlaceOpinion(record: {
  id: string;
  tripId: string;
  nodeId: string;
  memberId: string;
  sourceType: string;
  sourceMessageId: string | null;
  sourceEvidenceId: string | null;
  content: string;
  reaction: string;
  visibility: string;
  signalType: string;
  createdAt: Date;
  updatedAt: Date;
}): PlaceOpinion {
  return {
    id: record.id,
    tripId: record.tripId,
    nodeId: record.nodeId,
    memberId: record.memberId,
    sourceType: record.sourceType as PlaceOpinion["sourceType"],
    sourceMessageId: record.sourceMessageId ?? undefined,
    sourceEvidenceId: record.sourceEvidenceId ?? undefined,
    content: record.content,
    reaction: record.reaction as ReactionType,
    visibility: visibility(record.visibility),
    signalType: record.signalType as MemberSignal["signalType"],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeConstraint(record: {
  id: string;
  tripId: string;
  memberId: string | null;
  targetType: string | null;
  targetId: string | null;
  sourceKind: string;
  constraintType: string;
  severity: string;
  polarity: number | null;
  priorityScore: number | null;
  confidence: number | null;
  summary: string;
  conditionText: string | null;
  structuredValue: unknown;
  evidenceIds: unknown;
  signalIds: unknown;
  status: string;
  modelName: string | null;
  modelVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
  invalidatedAt: Date | null;
}): MemberConstraint {
  return {
    id: record.id,
    tripId: record.tripId,
    memberId: record.memberId ?? undefined,
    targetType: record.targetType ? constraintTargetType(record.targetType) : undefined,
    targetId: record.targetId ?? undefined,
    sourceKind: record.sourceKind,
    constraintType: record.constraintType,
    severity: record.severity as MemberConstraint["severity"],
    polarity: record.polarity == null ? undefined : polarity(record.polarity),
    priorityScore: record.priorityScore ?? undefined,
    confidence: record.confidence ?? undefined,
    summary: record.summary,
    conditionText: record.conditionText ?? undefined,
    structuredValue: jsonRecord(record.structuredValue),
    evidenceIds: stringArray(record.evidenceIds),
    signalIds: stringArray(record.signalIds),
    status: record.status,
    modelName: record.modelName ?? undefined,
    modelVersion: record.modelVersion ?? undefined,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    invalidatedAt: record.invalidatedAt?.toISOString()
  };
}

export function serializeMemberPlaceProfile(record: {
  id: string;
  tripId: string;
  memberId: string;
  nodeId: string;
  interestScore: number;
  positiveScore: number | null;
  negativeScore: number | null;
  confidenceScore: number;
  stance: string;
  summary: string;
  positiveReasons: unknown;
  negativeReasons: unknown;
  conditionText: string | null;
  constraintSummary: string | null;
  mustGo: boolean;
  hardReject: boolean;
  evidenceCount: number;
  signalCount: number;
  constraintIds: unknown;
  topSignalIds: unknown;
  sourceEvidenceIds: unknown;
  lastSignalAt: Date | null;
  aggregationVersion: string;
  lastCalculatedAt: Date;
  staleAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MemberPlaceProfile {
  return {
    id: record.id,
    tripId: record.tripId,
    memberId: record.memberId,
    nodeId: record.nodeId,
    interestScore: record.interestScore,
    positiveScore: record.positiveScore ?? undefined,
    negativeScore: record.negativeScore ?? undefined,
    confidenceScore: record.confidenceScore,
    stance: record.stance,
    summary: record.summary,
    positiveReasons: stringArray(record.positiveReasons),
    negativeReasons: stringArray(record.negativeReasons),
    conditionText: record.conditionText ?? undefined,
    constraintSummary: record.constraintSummary ?? undefined,
    mustGo: record.mustGo,
    hardReject: record.hardReject,
    evidenceCount: record.evidenceCount,
    signalCount: record.signalCount,
    constraintIds: stringArray(record.constraintIds),
    topSignalIds: stringArray(record.topSignalIds),
    sourceEvidenceIds: stringArray(record.sourceEvidenceIds),
    lastSignalAt: record.lastSignalAt?.toISOString(),
    aggregationVersion: record.aggregationVersion,
    lastCalculatedAt: record.lastCalculatedAt.toISOString(),
    staleAt: record.staleAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeRoomPlaceProfile(record: {
  id: string;
  tripId: string;
  nodeId: string;
  teamInterestScore: number;
  engagementScore: number;
  disagreementScore: number;
  memberStances: unknown;
  summary: string;
  commonPositiveReasons: unknown;
  mainConcerns: unknown;
  conditionalFitNotes: unknown;
  unresolvedQuestions: unknown;
  mustGoMemberIds: unknown;
  hardRejectMemberIds: unknown;
  memberProfileIds: unknown;
  sourceEvidenceIds: unknown;
  topSignalIds: unknown;
  constraintIds: unknown;
  aggregationVersion: string;
  lastCalculatedAt: Date;
  staleAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): RoomPlaceProfile {
  return {
    id: record.id,
    tripId: record.tripId,
    nodeId: record.nodeId,
    teamInterestScore: record.teamInterestScore,
    engagementScore: record.engagementScore,
    disagreementScore: record.disagreementScore,
    memberStances: memberStanceArray(record.memberStances),
    summary: record.summary,
    commonPositiveReasons: stringArray(record.commonPositiveReasons),
    mainConcerns: stringArray(record.mainConcerns),
    conditionalFitNotes: stringArray(record.conditionalFitNotes),
    unresolvedQuestions: stringArray(record.unresolvedQuestions),
    mustGoMemberIds: stringArray(record.mustGoMemberIds),
    hardRejectMemberIds: stringArray(record.hardRejectMemberIds),
    memberProfileIds: stringArray(record.memberProfileIds),
    sourceEvidenceIds: stringArray(record.sourceEvidenceIds),
    topSignalIds: stringArray(record.topSignalIds),
    constraintIds: stringArray(record.constraintIds),
    aggregationVersion: record.aggregationVersion,
    lastCalculatedAt: record.lastCalculatedAt.toISOString(),
    staleAt: record.staleAt?.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export function serializeRoomNodeState(record: {
  tripId: string;
  nodeId: string;
  state: string;
  explorationState: string | null;
  engagementScore: number | null;
  interestScore: number | null;
  disagreementScore: number | null;
  firstDiscoveredAt: Date | null;
  lastInteractedAt: Date | null;
  mentionCount: number;
  interactionCount: number;
  source: string | null;
  shownCount: number;
  lastShownAt: Date | null;
  aggregateSignal: unknown;
}): RoomNodeState {
  return {
    tripId: record.tripId,
    nodeId: record.nodeId,
    state: record.state as RoomNodeState["state"],
    explorationState: (record.explorationState ?? "seed") as RoomNodeState["explorationState"],
    engagementScore: record.engagementScore ?? 0,
    interestScore: record.interestScore ?? 0,
    disagreementScore: record.disagreementScore ?? 0,
    firstDiscoveredAt: record.firstDiscoveredAt?.toISOString(),
    lastInteractedAt: record.lastInteractedAt?.toISOString(),
    mentionCount: record.mentionCount,
    interactionCount: record.interactionCount,
    source: (record.source ?? "seed") as RoomNodeState["source"],
    shownCount: record.shownCount,
    lastShownAt: record.lastShownAt?.toISOString(),
    aggregateSignal: aggregateSignal(record.aggregateSignal)
  };
}

function targetType(value: string): "trip" | "node" | "material" | "plan" | "search" {
  if (value === "node" || value === "material" || value === "plan" || value === "search") return value;
  return "trip";
}

function constraintTargetType(value: string): "trip" | "node" | "material" | "plan" {
  if (value === "node" || value === "material" || value === "plan") return value;
  return "trip";
}

function signalTargetType(value: string): MemberSignal["targetType"] {
  if (value === "material" || value === "plan") return value;
  return "node";
}

function visibility(value: string): "group" | "ai_only" {
  return value === "ai_only" ? "ai_only" : "group";
}

function polarity(value: number): -1 | 0 | 1 {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function intensity(value: number): MemberSignal["intensity"] {
  if (value <= 0) return 0;
  if (value >= 5) return 5;
  return Math.round(value) as MemberSignal["intensity"];
}

function jsonRecord(value: unknown): JsonRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as JsonRecord;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function signalAttributes(value: unknown): MemberSignal["extractedAttributes"] {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is { key: string; polarity: -1 | 0 | 1; text: string } => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return (
        typeof record.key === "string" &&
        typeof record.text === "string" &&
        typeof record.polarity === "number"
      );
    })
    .map((item) => ({ ...item, polarity: polarity(item.polarity) }));
}

function memberStanceArray(value: unknown): RoomPlaceProfile["memberStances"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is RoomPlaceProfile["memberStances"][number] => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return (
        typeof record.memberId === "string" &&
        typeof record.stance === "string" &&
        typeof record.interestScore === "number" &&
        typeof record.summary === "string"
      );
    })
    .map((item) => ({
      memberId: item.memberId,
      displayName: typeof item.displayName === "string" ? item.displayName : undefined,
      stance: item.stance,
      interestScore: item.interestScore,
      summary: item.summary
    }));
}

function aggregateSignal(value: unknown): NonNullable<RoomNodeState["aggregateSignal"]> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return {
    positiveMembers: numberValue(record.positiveMembers),
    negativeMembers: numberValue(record.negativeMembers),
    interestedMembers: numberValue(record.interestedMembers),
    comments: numberValue(record.comments)
  };
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : 0;
}
