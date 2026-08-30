export type CardType =
  | "destination"
  | "district"
  | "poi"
  | "activity"
  | "route_option"
  | "external_material";

export type ReactionType =
  | "want_to_go"
  | "neutral"
  | "not_interested"
  | "want_to_know"
  | "must_go"
  | "concern";

export type MaterialStatus =
  | "seen"
  | "interested"
  | "controversial"
  | "selected"
  | "dropped"
  | "unresolved";

export type ChatMessageType =
  | "user_text"
  | "user_voice"
  | "user_attachment"
  | "ai_text"
  | "ai_card_batch"
  | "reaction_event"
  | "material_saved_event"
  | "room_summary"
  | "plan_proposal"
  | "plan_revision"
  | "system_event";

export interface Member {
  id: string;
  displayName: string;
  avatarUrl?: string;
  role?: "organizer" | "member";
}

export interface Trip {
  id: string;
  name: string;
  inviteCode: string;
  roughDestination?: string;
  tripDurationDays?: number;
  roughDateText?: string;
  currentFocusNodeId?: string;
  members: Member[];
}

export interface DestinationNode {
  id: string;
  provider?: "seed" | "mock" | "google_places" | "mapbox" | "osm" | string;
  providerPlaceId?: string;
  canonicalName: string;
  aliases: string[];
  nodeType:
    | "country"
    | "region"
    | "city"
    | "district"
    | "area"
    | "attraction"
    | "poi"
    | "activity"
    | "transit_hub";
  parentId?: string;
  countryCode?: string;
  geo?: {
    latitude: number;
    longitude: number;
  };
  shortSummary: string;
  longDescription?: string;
  highlights: string[];
  tags: string[];
  suggestedStayText?: string;
  budgetBand?: "low" | "medium" | "high" | "luxury" | "unknown";
  heroImageUrl?: string;
  images?: Array<{
    url: string;
    alt: string;
    caption?: string;
  }>;
  imageAlt: string;
  dataSource?: string;
  dataFreshness?: "seed_static" | "cached" | "live" | "unresolved";
  dataAsOf?: string;
  lastSyncedAt?: string;
  popularityScore?: number;
  socialDiscovery?: SocialDiscoveryMetadata;
  isSeedData: boolean;
}

export interface SocialDiscoveryEntry {
  provider: "xiaohongshu";
  label: string;
  searchKeywords: string[];
  searchUrl: string;
}

export interface SocialDiscoveryMetadata {
  xiaohongshu?: SocialDiscoveryEntry;
}

export interface DestinationRelation {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relationType:
    | "contains"
    | "nearby_day_trip"
    | "pairs_well_with"
    | "alternative_to"
    | "requires_long_transfer"
    | "same_theme"
    | "reachable_from";
  metadata?: Record<string, unknown>;
  source?: string;
}

export interface RoomNodeState {
  tripId: string;
  nodeId: string;
  state:
    | "undiscovered"
    | "shown"
    | "opened"
    | "focused"
    | "pinned"
    | "selected"
    | "dismissed";
  explorationState?: "seed" | "discovered" | "engaged" | "candidate" | "selected";
  engagementScore?: number;
  interestScore?: number;
  disagreementScore?: number;
  firstDiscoveredAt?: string;
  lastInteractedAt?: string;
  mentionCount?: number;
  interactionCount?: number;
  source?: "seed" | "conversation" | "card" | "material" | "mock";
  shownCount: number;
  lastShownAt?: string;
  aggregateSignal?: {
    positiveMembers: number;
    negativeMembers: number;
    interestedMembers: number;
    comments: number;
  };
}

export type PlaceOpinionSourceType =
  | "group_chat"
  | "explore_comment"
  | "voice_comment"
  | "card_comment";

export type EvidenceAnalysisStatus = "pending" | "processing" | "completed" | "failed";

export type EvidenceType =
  | "chat_message"
  | "place_comment"
  | "voice_comment"
  | "reaction"
  | "search"
  | "material"
  | "upload"
  | "plan_feedback"
  | "system_event";

export interface Evidence {
  id: string;
  tripId: string;
  memberId?: string;
  targetType: "trip" | "node" | "material" | "plan" | "search";
  targetId?: string;
  evidenceType: EvidenceType;
  sourceEntityType: string;
  sourceEntityId?: string;
  sourceMessageId?: string;
  sourceMaterialId?: string;
  sourcePlaceOpinionId?: string;
  rawTextSnapshot?: string;
  rawPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  analysisStatus: EvidenceAnalysisStatus;
  analysisError?: string;
  visibility: "group" | "ai_only";
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PlaceOpinion {
  id: string;
  tripId: string;
  nodeId: string;
  memberId: string;
  sourceType: PlaceOpinionSourceType;
  sourceMessageId?: string;
  sourceEvidenceId?: string;
  content: string;
  reaction: ReactionType;
  visibility: "group" | "ai_only";
  signalType: MemberSignal["signalType"];
  createdAt: string;
  updatedAt?: string;
}

export interface MemberPlaceState {
  tripId: string;
  memberId: string;
  nodeId: string;
  reaction?: ReactionType;
  unreadCount: number;
  lastReadAt?: string;
  lastActivityAt?: string;
}

export interface MemberExploreState {
  tripId: string;
  memberId: string;
  currentScopeNodeId?: string;
  currentClusterNodeId?: string;
  explorationPathNodeIds?: string[];
  queryScope?: string;
  searchQuery?: string;
  recommendationBiasTags: string[];
  seenPlaceIds: string[];
  dismissedPlaceIds: string[];
  currentCardIndex: number;
  updatedAt: string;
}

export interface TravelCard {
  id: string;
  nodeId: string;
  type: Exclude<CardType, "route_option" | "external_material">;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  images?: Array<{
    url: string;
    alt: string;
    caption?: string;
  }>;
  imageAlt: string;
  shortSummary: string;
  highlights: string[];
  suggestedStay?: {
    minDays?: number;
    maxDays?: number;
    text: string;
  };
  budget?: {
    band: "low" | "medium" | "high" | "luxury" | "unknown";
    text: string;
    basis?: string;
    asOf?: string;
    isEstimate: boolean;
  };
  travelCost?: {
    text: string;
  };
  representativeItems?: Array<{
    name: string;
    nodeId?: string;
  }>;
  sourceSummary?: string;
  socialDiscovery?: SocialDiscoveryMetadata;
  actions: Array<"open" | "react" | "voice" | "comment" | "ask" | "expand">;
}

export interface ChatMessage {
  id: string;
  tripId: string;
  authorType: "member" | "ai" | "system";
  authorMemberId?: string;
  messageType: ChatMessageType;
  textContent?: string;
  payload?: Record<string, unknown>;
  visibility: "group" | "ai_only";
  replyToMessageId?: string;
  createdAt: string;
}

export interface Material {
  id: string;
  tripId: string;
  createdByType: "ai" | "member" | "system";
  createdByMemberId?: string;
  materialType: "card" | "url" | "image" | "screenshot" | "text" | "hotel" | "restaurant";
  sourceType:
    | "ai_recommendation"
    | "ai_seed"
    | "user_share"
    | "external_link"
    | "upload"
    | "external_search"
    | "social_media";
  sourceProvider?:
    | "seed"
    | "mock"
    | "user_upload"
    | "user_link"
    | "google_places"
    | "mapbox"
    | "osm"
    | "xiaohongshu"
    | "external_search"
    | "social_media"
    | string;
  sourceUrl?: string;
  rawText?: string;
  attachmentUrl?: string;
  title: string;
  summary?: string;
  status: MaterialStatus;
  primaryNodeId?: string;
  extractionStatus: "pending" | "success" | "partial" | "failed";
  extractionConfidence: number;
  createdAt: string;
}

export interface MemberSignal {
  id: string;
  tripId: string;
  memberId: string;
  evidenceId?: string;
  targetType: "node" | "material" | "plan";
  targetId: string;
  sourceMessageId?: string;
  sourceMaterialId?: string;
  sourcePlaceOpinionId?: string;
  signalType:
    | "exposed"
    | "opened"
    | "shared"
    | "want_to_know"
    | "positive"
    | "neutral"
    | "negative"
    | "must_go"
    | "hard_reject"
    | "concern"
    | "questioned";
  polarity: -1 | 0 | 1;
  intensity: 0 | 1 | 2 | 3 | 4 | 5;
  reason?: string;
  aspect?: string;
  intent?:
    | "want_to_go"
    | "avoid"
    | "learn_more"
    | "must_go"
    | "hard_reject"
    | "condition"
    | "concern"
    | "neutral"
    | string;
  conditionText?: string;
  constraintCandidate?: boolean;
  extractedAttributes?: Array<{
    key: string;
    polarity: -1 | 0 | 1;
    text: string;
  }>;
  visibility: "group" | "ai_only";
  scope: "trip";
  createdBy?: "user_action" | "rule" | "ai" | string;
  modelName?: string;
  modelVersion?: string;
  extractionRunId?: string;
  invalidatedAt?: string;
  confidence: number;
  createdAt: string;
}

export interface MemberConstraint {
  id: string;
  tripId: string;
  memberId?: string;
  targetType?: "trip" | "node" | "material" | "plan";
  targetId?: string;
  sourceKind: "explicit_user_input" | "derived_from_evidence" | "derived_from_signal" | "system_rule" | string;
  constraintType:
    | "budget"
    | "date"
    | "duration"
    | "mobility"
    | "pace"
    | "food"
    | "must_go"
    | "hard_reject"
    | "route_condition"
    | "lodging"
    | "other"
    | string;
  severity: "soft" | "strong" | "hard";
  polarity?: -1 | 0 | 1;
  priorityScore?: number;
  confidence?: number;
  summary: string;
  conditionText?: string;
  structuredValue?: Record<string, unknown>;
  evidenceIds?: string[];
  signalIds?: string[];
  status: "active" | "superseded" | "rejected" | "resolved" | "invalidated" | string;
  modelName?: string;
  modelVersion?: string;
  createdAt: string;
  updatedAt: string;
  invalidatedAt?: string;
}

export interface MemberPlaceProfile {
  id: string;
  tripId: string;
  memberId: string;
  nodeId: string;
  interestScore: number;
  positiveScore?: number;
  negativeScore?: number;
  confidenceScore: number;
  stance:
    | "strong_like"
    | "like"
    | "conditional"
    | "neutral"
    | "concerned"
    | "avoid"
    | "unknown"
    | string;
  summary: string;
  positiveReasons: string[];
  negativeReasons: string[];
  conditionText?: string;
  constraintSummary?: string;
  mustGo: boolean;
  hardReject: boolean;
  evidenceCount: number;
  signalCount: number;
  constraintIds?: string[];
  topSignalIds: string[];
  sourceEvidenceIds: string[];
  lastSignalAt?: string;
  aggregationVersion: string;
  lastCalculatedAt: string;
  staleAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomPlaceProfile {
  id: string;
  tripId: string;
  nodeId: string;
  teamInterestScore: number;
  engagementScore: number;
  disagreementScore: number;
  memberStances: Array<{
    memberId: string;
    displayName?: string;
    stance: string;
    interestScore: number;
    summary: string;
  }>;
  summary: string;
  commonPositiveReasons: string[];
  mainConcerns: string[];
  conditionalFitNotes?: string[];
  unresolvedQuestions?: string[];
  mustGoMemberIds?: string[];
  hardRejectMemberIds?: string[];
  memberProfileIds: string[];
  sourceEvidenceIds: string[];
  topSignalIds: string[];
  constraintIds?: string[];
  aggregationVersion: string;
  lastCalculatedAt: string;
  staleAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanVariant {
  id: string;
  tripId: string;
  version: number;
  title: string;
  summary: string;
  status: "draft" | "active" | "superseded" | "selected";
  totalDays?: number;
  segments: Array<{
    nodeId: string;
    name: string;
    days: number;
    representativeNodeIds: string[];
    experienceSummary: string;
    stayArea?: string;
  }>;
  score?: number;
  scoringBreakdown?: {
    memberPreferenceFit: number;
    groupFairness: number;
    routeFeasibility: number;
    schedulePace: number;
    budgetFit: number;
    dataConfidence: number;
  };
  validation?: {
    passed: boolean;
    issues: Array<{
      severity: "info" | "warning" | "error";
      code: string;
      message: string;
    }>;
  };
  itinerary?: Array<{
    day: number;
    city: string;
    area?: string;
    morning: string;
    afternoon: string;
    evening: string;
    stayArea: string;
    placeNodeIds: string[];
    transport: string;
    costText: string;
    imageNodeId?: string;
  }>;
  route?: {
    nodeIds: string[];
    summary: string;
  };
  planningContextSnapshotId?: string;
  modelName?: string;
  modelVersion?: string;
  includedNodeIds: string[];
  excludedHighlights: string[];
  mobilityText: string;
  budgetText: string;
  budgetIsEstimate: boolean;
  gains: string[];
  tradeoffs: string[];
  basedOnSignalIds: string[];
  unresolvedQuestions: string[];
  parentPlanId?: string;
  changeSummary?: string[];
  createdAt: string;
}

export interface DemoRoomData {
  trip: Trip;
  nodes: DestinationNode[];
  relations: DestinationRelation[];
  messages: ChatMessage[];
  materials: Material[];
  signals: MemberSignal[];
  evidences?: Evidence[];
  constraints?: MemberConstraint[];
  memberPlaceProfiles?: MemberPlaceProfile[];
  roomPlaceProfiles?: RoomPlaceProfile[];
  plans: PlanVariant[];
  roomNodeStates: RoomNodeState[];
  placeOpinions?: PlaceOpinion[];
  memberPlaceStates?: MemberPlaceState[];
  initialActiveMemberIds?: string[];
  persistenceMode?: "database" | "seed_fallback";
  initialCards: TravelCard[];
}
