import type {
  ChatMessage,
  DestinationNode,
  DestinationRelation,
  Material,
  MemberSignal,
  RoomNodeState
} from "@/lib/types";

export type SemanticZoomLevel = "country" | "city" | "local";

export interface PlaceExplorationState {
  nodeId: string;
  roomState?: RoomNodeState["state"];
  explorationState: NonNullable<RoomNodeState["explorationState"]>;
  engagementScore: number;
  interestScore: number;
  disagreementScore: number;
  mentionCount: number;
  interactionCount: number;
  materialCount: number;
  aggregateSignal: NonNullable<RoomNodeState["aggregateSignal"]>;
  childNodeIds: string[];
}

export interface UnresolvedPlaceMention {
  id: string;
  name: string;
  source: "conversation";
  status: "unresolved";
  reason: string;
}

export function computePlaceExplorationStates(input: {
  nodes: DestinationNode[];
  relations: DestinationRelation[];
  roomNodeStates: RoomNodeState[];
  signals: MemberSignal[];
  messages: ChatMessage[];
  materials: Material[];
}) {
  const directStates = new Map<string, PlaceExplorationState>();
  const childrenByNodeId = buildChildrenByNodeId(input.relations);

  for (const node of input.nodes) {
    const roomState = input.roomNodeStates.find((state) => state.nodeId === node.id);
    const nodeSignals = latestSignalsForNode(input.signals, node.id);
    const mentionCount = input.messages.filter((message) => messageMentionsNode(message, node)).length;
    const materialCount = input.materials.filter((material) => material.primaryNodeId === node.id).length;
    const commentCount = nodeSignals.filter((signal) => Boolean(signal.reason)).length;
    const interactionCount = nodeSignals.length + mentionCount + commentCount + materialCount;
    const positiveIntensity = nodeSignals
      .filter((signal) => signal.polarity > 0 || signal.signalType === "must_go")
      .reduce((total, signal) => total + signal.intensity, 0);
    const negativeIntensity = nodeSignals
      .filter((signal) => signal.polarity < 0 || signal.signalType === "hard_reject")
      .reduce((total, signal) => total + Math.abs(signal.intensity), 0);
    const wantToKnowCount = nodeSignals.filter((signal) => signal.signalType === "want_to_know").length;
    const engagementScore = clampScore(
      (roomState?.shownCount ?? 0) * 0.8 +
        mentionCount * 2 +
        nodeSignals.length * 2 +
        commentCount +
        materialCount
    );
    const interestScore = clampScore(positiveIntensity + wantToKnowCount * 0.7 - negativeIntensity * 0.8);
    const disagreementScore =
      positiveIntensity > 0 && negativeIntensity > 0
        ? clampScore(Math.min(positiveIntensity, negativeIntensity) + Math.min(engagementScore, 4))
        : 0;

    directStates.set(node.id, {
      nodeId: node.id,
      roomState: roomState?.state,
      explorationState: stateFromScores(roomState?.state, engagementScore, interestScore),
      engagementScore,
      interestScore,
      disagreementScore,
      mentionCount,
      interactionCount,
      materialCount,
      aggregateSignal: {
        positiveMembers: nodeSignals.filter((signal) => signal.polarity > 0).length,
        negativeMembers: nodeSignals.filter((signal) => signal.polarity < 0).length,
        interestedMembers: nodeSignals.filter(
          (signal) => signal.polarity > 0 || signal.signalType === "want_to_know"
        ).length,
        comments: commentCount
      },
      childNodeIds: childrenByNodeId.get(node.id) ?? []
    });
  }

  const aggregated = new Map(directStates);
  for (const node of input.nodes) {
    const direct = directStates.get(node.id);
    if (!direct) continue;

    const childStates = direct.childNodeIds
      .map((childNodeId) => directStates.get(childNodeId))
      .filter((state): state is PlaceExplorationState => Boolean(state));
    if (childStates.length === 0) continue;

    const topChildInterest = Math.max(...childStates.map((state) => state.interestScore), 0);
    const topChildEngagement = Math.max(...childStates.map((state) => state.engagementScore), 0);
    const topChildDisagreement = Math.max(...childStates.map((state) => state.disagreementScore), 0);
    const interestScore = clampScore(direct.interestScore + topChildInterest * 0.45);
    const engagementScore = clampScore(direct.engagementScore + topChildEngagement * 0.35);

    aggregated.set(node.id, {
      ...direct,
      interestScore,
      engagementScore,
      disagreementScore: clampScore(Math.max(direct.disagreementScore, topChildDisagreement * 0.6)),
      explorationState: stateFromScores(undefined, engagementScore, interestScore)
    });
  }

  return aggregated;
}

export function getPlacesForSemanticZoom(input: {
  zoomLevel: SemanticZoomLevel;
  focusNodeId: string;
  nodes: DestinationNode[];
  relations: DestinationRelation[];
}) {
  const focusNode = input.nodes.find((node) => node.id === input.focusNodeId);
  const focusIsLarge = focusNode?.nodeType === "country" || focusNode?.nodeType === "region";

  if (input.zoomLevel === "country") {
    const parentNodeId = focusIsLarge ? input.focusNodeId : "japan";
    return childPlaces(parentNodeId, input.nodes, input.relations).filter((node) =>
      ["region", "city"].includes(node.nodeType) &&
      (node.nodeType === "city" || !node.tags.includes("day_trip"))
    );
  }

  if (input.zoomLevel === "city") {
    const parentNodeId = focusNode?.nodeType === "city" || focusNode?.nodeType === "region" ? input.focusNodeId : "tokyo";
    return childPlaces(parentNodeId, input.nodes, input.relations);
  }

  const localChildren = childPlaces(input.focusNodeId, input.nodes, input.relations);
  return localChildren.length ? localChildren : focusNode ? [focusNode] : [];
}

export function detectMentionedPlaceIds(text: string, nodes: DestinationNode[]) {
  if (!text.trim()) return [];

  return nodes
    .filter((node) => textMentionsNode(text, node))
    .map((node) => node.id);
}

export function findUnresolvedPlaceMentions(messages: ChatMessage[], nodes: DestinationNode[]) {
  const knownNames = new Set(
    nodes.flatMap((node) => [node.canonicalName, ...node.aliases]).map((name) => name.toLowerCase())
  );
  const mentions: UnresolvedPlaceMention[] = [];
  const unresolvedKeywords = ["清澄白河", "teamLab", "日光", "奈良", "吉祥寺"];

  for (const message of messages) {
    if (message.visibility !== "group" || !message.textContent) continue;
    for (const keyword of unresolvedKeywords) {
      if (!message.textContent.toLowerCase().includes(keyword.toLowerCase())) continue;
      const normalized = keyword.toLowerCase();
      if (knownNames.has(normalized)) continue;
      mentions.push({
        id: `unresolved-${normalized}`,
        name: keyword,
        source: "conversation",
        status: "unresolved",
        reason: "当前 MVP 不接真实地点 Provider，已保存为尚未定位的新发现地点。"
      });
    }
  }

  return Array.from(new Map(mentions.map((mention) => [mention.id, mention])).values());
}

function childPlaces(
  parentNodeId: string,
  nodes: DestinationNode[],
  relations: DestinationRelation[]
) {
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

function buildChildrenByNodeId(relations: DestinationRelation[]) {
  const childrenByNodeId = new Map<string, string[]>();

  for (const relation of relations) {
    if (!["contains", "nearby_day_trip", "pairs_well_with", "alternative_to"].includes(relation.relationType)) {
      continue;
    }
    const current = childrenByNodeId.get(relation.fromNodeId) ?? [];
    childrenByNodeId.set(relation.fromNodeId, [...current, relation.toNodeId]);
  }

  return childrenByNodeId;
}

function latestSignalsForNode(signals: MemberSignal[], nodeId: string) {
  const latestByMember = new Map<string, MemberSignal>();

  for (const signal of signals) {
    if (signal.visibility !== "group" || signal.targetType !== "node" || signal.targetId !== nodeId) {
      continue;
    }
    latestByMember.set(signal.memberId, signal);
  }

  return Array.from(latestByMember.values());
}

function messageMentionsNode(message: ChatMessage, node: DestinationNode) {
  return Boolean(
    message.visibility === "group" &&
      message.textContent &&
      textMentionsNode(message.textContent, node)
  );
}

function textMentionsNode(text: string, node: DestinationNode) {
  const normalizedText = text.toLowerCase();
  return [node.canonicalName, ...node.aliases].some((name) =>
    normalizedText.includes(name.toLowerCase())
  );
}

function stateFromScores(
  roomState: RoomNodeState["state"] | undefined,
  engagementScore: number,
  interestScore: number
): NonNullable<RoomNodeState["explorationState"]> {
  if (roomState === "selected") return "selected";
  if (interestScore >= 6) return "candidate";
  if (engagementScore >= 4) return "engaged";
  if (engagementScore > 0 || roomState === "shown" || roomState === "opened" || roomState === "focused") {
    return "discovered";
  }
  return "seed";
}

function clampScore(value: number) {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}
