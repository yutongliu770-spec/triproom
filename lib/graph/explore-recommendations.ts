import { createTravelCard } from "@/lib/graph/cards";
import type {
  DestinationNode,
  DestinationRelation,
  MemberExploreState,
  MemberSignal,
  RoomNodeState,
  TravelCard
} from "@/lib/types";

export type ExploreRecommendationAction =
  | { type: "initial" }
  | { type: "next_cluster" }
  | { type: "focus_scope"; scopeNodeId: string }
  | { type: "focus_node"; nodeId: string }
  | { type: "clear_scope" }
  | { type: "search"; query: string }
  | { type: "bias"; text: string };

export interface ExploreRecommendationResult {
  cards: TravelCard[];
  state: MemberExploreState;
  scopeLabel: string;
  clusterLabel?: string;
  statusText: string;
  focusNodeId?: string;
  directPlaceNodeId?: string;
}

const CONCRETE_NODE_TYPES = new Set<DestinationNode["nodeType"]>([
  "district",
  "area",
  "attraction",
  "poi",
  "activity"
]);
const CLUSTER_NODE_TYPES = new Set<DestinationNode["nodeType"]>(["city", "region"]);
const CLUSTER_PRIORITY = [
  "kyoto",
  "tokyo",
  "osaka",
  "fuji-kawaguchiko",
  "hokkaido",
  "okinawa"
];
const MAX_SCOPE_CARD_COUNT = 24;

export function createInitialExploreState(input: {
  tripId: string;
  memberId: string;
  cards: TravelCard[];
}): MemberExploreState {
  return {
    tripId: input.tripId,
    memberId: input.memberId,
    recommendationBiasTags: [],
    seenPlaceIds: input.cards.map((card) => card.nodeId),
    dismissedPlaceIds: [],
    currentCardIndex: 0,
    updatedAt: new Date().toISOString()
  };
}

export function recommendExploreCards(input: {
  tripId: string;
  memberId: string;
  nodes: DestinationNode[];
  relations: DestinationRelation[];
  signals: MemberSignal[];
  roomNodeStates: RoomNodeState[];
  previousState?: MemberExploreState;
  action: ExploreRecommendationAction;
}): ExploreRecommendationResult {
  const previousState =
    input.previousState ??
    createInitialExploreState({ tripId: input.tripId, memberId: input.memberId, cards: [] });
  const action = input.action;
  const searchText = action.type === "search" ? action.query.trim() : "";
  const biasText = action.type === "bias" ? action.text : searchText;
  const parsedBias = parseRecommendationBias(biasText);
  const focusNode =
    action.type === "focus_node"
      ? input.nodes.find((node) => node.id === action.nodeId)
      : undefined;
  const directMatch = searchText ? findExactNode(searchText, input.nodes) : undefined;
  const matchedCluster = directMatch
    ? clusterForNode(directMatch, input.nodes)
    : searchText
      ? findCluster(searchText, input.nodes)
      : undefined;

  const nextState: MemberExploreState = {
    ...previousState,
    memberId: input.memberId,
    tripId: input.tripId,
    currentCardIndex: 0,
    queryScope: undefined,
    updatedAt: new Date().toISOString()
  };

  let directPlaceNodeId: string | undefined;
  let candidateClusterId = previousState.currentClusterNodeId;
  let focusNodeId = previousState.currentScopeNodeId ?? previousState.currentClusterNodeId;
  let candidates: DestinationNode[] = [];
  let statusText = "按地域小簇继续探索具体地点。";

  if (action.type === "clear_scope") {
    nextState.currentScopeNodeId = undefined;
    candidateClusterId = undefined;
    nextState.currentClusterNodeId = undefined;
    focusNodeId = "japan";
    statusText = "已回到全日本探索，会展示日本下面的全部地点卡片。";
  } else if (action.type === "next_cluster") {
    candidateClusterId = chooseNextCluster({
      nodes: input.nodes,
      relations: input.relations,
      seenPlaceIds: nextState.seenPlaceIds,
      currentClusterNodeId: previousState.currentClusterNodeId
    });
    nextState.currentClusterNodeId = candidateClusterId;
    nextState.currentScopeNodeId = candidateClusterId;
    focusNodeId = candidateClusterId;
    statusText = "换到另一个地区，继续看这个区域里的具体 Place。";
  } else if (action.type === "focus_scope") {
    const scope = input.nodes.find((node) => node.id === action.scopeNodeId);
    const cluster = scope ? clusterForNode(scope, input.nodes) : undefined;
    nextState.currentScopeNodeId = cluster?.id ?? action.scopeNodeId;
    nextState.currentClusterNodeId = cluster?.id ?? action.scopeNodeId;
    candidateClusterId = nextState.currentClusterNodeId;
    focusNodeId = nextState.currentScopeNodeId;
    statusText = `正在探索：${cluster?.canonicalName ?? scope?.canonicalName ?? "当前区域"}`;
  } else if (action.type === "focus_node" && focusNode && isConcreteExploreNode(focusNode)) {
    const cluster = clusterForNode(focusNode, input.nodes);
    directPlaceNodeId = focusNode.id;
    nextState.currentScopeNodeId = cluster?.id;
    nextState.currentClusterNodeId = cluster?.id;
    candidateClusterId = cluster?.id;
    focusNodeId = focusNode.id;
    statusText = `已定位到 ${focusNode.canonicalName}，会在${cluster?.canonicalName ?? "当前城市"}范围内继续探索。`;
  } else if (action.type === "focus_node" && focusNode && CLUSTER_NODE_TYPES.has(focusNode.nodeType)) {
    nextState.currentScopeNodeId = focusNode.id;
    nextState.currentClusterNodeId = focusNode.id;
    candidateClusterId = focusNode.id;
    focusNodeId = focusNode.id;
    statusText = `正在探索：${focusNode.canonicalName}`;
  } else if (action.type === "focus_node" && focusNode?.nodeType === "country") {
    nextState.currentScopeNodeId = undefined;
    candidateClusterId = undefined;
    nextState.currentClusterNodeId = undefined;
    focusNodeId = focusNode.id;
    statusText = `正在探索：${focusNode.canonicalName}`;
  } else if (action.type === "search" && directMatch && isConcreteExploreNode(directMatch)) {
    const cluster = clusterForNode(directMatch, input.nodes);
    directPlaceNodeId = directMatch.id;
    nextState.currentScopeNodeId = cluster?.id;
    nextState.currentClusterNodeId = cluster?.id;
    candidateClusterId = cluster?.id;
    focusNodeId = directMatch.id;
    statusText = `已定位到 ${directMatch.canonicalName}，可以继续探索${cluster?.canonicalName ?? "附近"}。`;
  } else if (action.type === "search" && matchedCluster) {
    nextState.currentScopeNodeId = matchedCluster.id;
    nextState.currentClusterNodeId = matchedCluster.id;
    candidateClusterId = matchedCluster.id;
    focusNodeId = matchedCluster.id;
    statusText = `正在探索：${matchedCluster.canonicalName}`;
  } else if ((action.type === "search" || action.type === "bias") && parsedBias.wantedTags.length > 0) {
    const shouldSetQueryScope = Boolean(searchText) || action.type === "bias";
    nextState.queryScope = shouldSetQueryScope ? biasText : undefined;
    nextState.recommendationBiasTags = mergeUnique([
      ...parsedBias.wantedTags,
      ...previousState.recommendationBiasTags
    ]).slice(0, 6);
    candidateClusterId = previousState.currentScopeNodeId ?? previousState.currentClusterNodeId;
    nextState.currentScopeNodeId = previousState.currentScopeNodeId;
    nextState.currentClusterNodeId = previousState.currentClusterNodeId;
    focusNodeId = nextState.currentScopeNodeId ?? "japan";
    statusText = `已把“${nextState.queryScope ?? "新的偏好"}”作为推荐倾向，但不会只看单一类型。`;
  } else if (action.type === "initial") {
    candidateClusterId = previousState.currentScopeNodeId ?? previousState.currentClusterNodeId;
    if (candidateClusterId) nextState.currentClusterNodeId = candidateClusterId;
  }

  if (directPlaceNodeId) {
    const directNode = input.nodes.find((node) => node.id === directPlaceNodeId);
    const clusterNodes = candidateClusterId
      ? concreteDescendants(candidateClusterId, input.nodes, input.relations)
      : [];
    candidates = [directNode, ...clusterNodes].filter(
      (node): node is DestinationNode => Boolean(node)
    );
  } else if (nextState.currentScopeNodeId) {
    candidates = concreteDescendants(nextState.currentScopeNodeId, input.nodes, input.relations);
  } else if (nextState.queryScope) {
    candidates = concreteNodes(input.nodes);
  } else {
    candidates = clusteredConcreteDescendants("japan", input.nodes, input.relations);
    focusNodeId = "japan";
  }

  const uniqueCandidates = uniqueNodes(candidates);
  const ranked = rankCandidates({
    candidates: uniqueCandidates,
    nodes: input.nodes,
    signals: input.signals,
    roomNodeStates: input.roomNodeStates,
    state: nextState,
    wantedTags: nextState.recommendationBiasTags,
    blockedTags: parsedBias.blockedTags,
    directPlaceNodeId
  });
  const ordered = shouldUseClusteredOrder(nextState, action)
    ? interleaveByCluster(ranked, input.nodes)
    : ranked;
  const selected = ordered.slice(0, MAX_SCOPE_CARD_COUNT);
  const fallback = fillRecommendationDeck(selected, uniqueCandidates);
  const cards = fallback.map((node) => createTravelCard(node, input.relations));
  const shownIds = cards.map((card) => card.nodeId);

  return {
    cards,
    state: {
      ...nextState,
      seenPlaceIds: mergeUnique([...nextState.seenPlaceIds, ...shownIds]).slice(-80),
      currentCardIndex: 0
    },
    scopeLabel: nextState.currentScopeNodeId
      ? `正在探索：${input.nodes.find((node) => node.id === nextState.currentScopeNodeId)?.canonicalName ?? "当前区域"}`
      : nextState.queryScope
        ? `当前倾向：${nextState.queryScope}`
        : "正在探索：日本",
    clusterLabel: input.nodes.find((node) => node.id === nextState.currentClusterNodeId)
      ?.canonicalName,
    statusText,
    focusNodeId,
    directPlaceNodeId
  };
}

export function placeContextForNode(nodeId: string, nodes: DestinationNode[]) {
  const node = nodes.find((item) => item.id === nodeId);
  const cluster = node ? clusterForNode(node, nodes) : undefined;
  const parent = node?.parentId ? nodes.find((item) => item.id === node.parentId) : undefined;

  return {
    node,
    cluster,
    parent,
    label: [cluster?.canonicalName, parent && parent.id !== cluster?.id ? parent.canonicalName : undefined]
      .filter(Boolean)
      .join(" · ")
  };
}

function fillRecommendationDeck(
  selected: DestinationNode[],
  candidates: DestinationNode[]
) {
  const selectedIds = new Set(selected.map((node) => node.id));
  const filled = [...selected];

  for (const candidate of candidates) {
    if (filled.length >= MAX_SCOPE_CARD_COUNT) break;
    if (selectedIds.has(candidate.id)) continue;
    selectedIds.add(candidate.id);
    filled.push(candidate);
  }

  return filled;
}

function rankCandidates(input: {
  candidates: DestinationNode[];
  nodes: DestinationNode[];
  signals: MemberSignal[];
  roomNodeStates: RoomNodeState[];
  state: MemberExploreState;
  wantedTags: string[];
  blockedTags: string[];
  directPlaceNodeId?: string;
}) {
  const seen = new Set(input.state.seenPlaceIds);
  const wanted = new Set(input.wantedTags);
  const blocked = new Set(input.blockedTags);

  return uniqueNodes(input.candidates)
    .map((node) => {
      const tags = new Set([...node.tags, ...node.aliases.map((alias) => alias.toLowerCase())]);
      const wantedScore = Array.from(wanted).filter((tag) => tags.has(tag)).length;
      const blockedScore = Array.from(blocked).filter((tag) => tags.has(tag)).length;
      const signalScore = input.signals
        .filter((signal) => signal.targetType === "node" && signal.targetId === node.id)
        .reduce((sum, signal) => sum + signal.polarity * signal.intensity, 0);
      const roomState = input.roomNodeStates.find((state) => state.nodeId === node.id);
      const directScore = node.id === input.directPlaceNodeId ? 100 : 0;
      const seenPenalty = seen.has(node.id) && node.id !== input.directPlaceNodeId ? 18 : 0;

      return {
        node,
        score:
          directScore +
          (node.popularityScore ?? 50) / 10 +
          wantedScore * 8 +
          signalScore * 1.5 +
          (roomState?.interestScore ?? 0) * 0.8 -
          blockedScore * 14 -
          seenPenalty
      };
    })
    .filter((item) => item.score > -10)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.node);
}

function chooseNextCluster(input: {
  nodes: DestinationNode[];
  relations: DestinationRelation[];
  seenPlaceIds: string[];
  currentClusterNodeId?: string;
}) {
  const seen = new Set(input.seenPlaceIds);
  const clusters = clusterNodes(input.nodes);
  const scored = clusters.map((cluster) => {
    const concrete = concreteDescendants(cluster.id, input.nodes, input.relations);
    const unseenCount = concrete.filter((node) => !seen.has(node.id)).length;
    const priority = CLUSTER_PRIORITY.indexOf(cluster.id);
    return {
      cluster,
      score:
        unseenCount * 4 +
        (cluster.id === input.currentClusterNodeId ? -8 : 0) +
        (priority >= 0 ? CLUSTER_PRIORITY.length - priority : 0)
    };
  });

  return scored.sort((a, b) => b.score - a.score)[0]?.cluster.id ?? "japan";
}

function findExactNode(query: string, nodes: DestinationNode[]) {
  const normalized = normalize(query);
  return nodes.find((node) =>
    [node.id, node.canonicalName, ...node.aliases].some((value) => normalize(value) === normalized)
  );
}

function findCluster(query: string, nodes: DestinationNode[]) {
  const normalized = normalize(query);
  return clusterNodes(nodes).find((node) =>
    [node.id, node.canonicalName, ...node.aliases].some(
      (value) => normalize(value).includes(normalized) || normalized.includes(normalize(value))
    )
  );
}

function parseRecommendationBias(text: string) {
  const wantedTags: string[] = [];
  const blockedTags: string[] = [];
  const normalized = text.toLowerCase();

  if (/自然|风景|山|湖|海|温泉|雪|花|岛|潜水|放松/.test(text)) {
    wantedTags.push("nature", "mountain", "lake", "sea", "onsen", "snow", "island", "relax");
  }
  if (/传统|寺|神社|文化|人文|古|京都|街道|步行/.test(text)) {
    wantedTags.push("culture", "temple", "shrine", "walking", "traditional");
  }
  if (/城市|购物|夜|美食|街区|东京|大阪/.test(text)) {
    wantedTags.push("city", "shopping", "night", "food");
  }
  if (/主题乐园|迪士尼|usj|环球|family/.test(normalized)) {
    wantedTags.push("theme_park", "family");
  }
  if (/不想|不要|少一?点|没.*兴趣|别/.test(text) && /主题乐园|迪士尼|usj|环球/.test(normalized)) {
    blockedTags.push("theme_park", "family");
  }

  return {
    wantedTags: mergeUnique(wantedTags),
    blockedTags: mergeUnique(blockedTags)
  };
}

function clusterForNode(node: DestinationNode, nodes: DestinationNode[]) {
  let current: DestinationNode | undefined = node;

  while (current) {
    if (CLUSTER_NODE_TYPES.has(current.nodeType)) return current;
    current = current.parentId ? nodes.find((item) => item.id === current?.parentId) : undefined;
  }

  return undefined;
}

function concreteDescendants(
  nodeId: string,
  nodes: DestinationNode[],
  relations: DestinationRelation[],
  seen = new Set<string>()
): DestinationNode[] {
  const children = relations
    .filter(
      (relation) => relation.fromNodeId === nodeId && relation.relationType === "contains"
    )
    .map((relation) => nodes.find((node) => node.id === relation.toNodeId))
    .filter((node): node is DestinationNode => Boolean(node));
  const result: DestinationNode[] = [];

  for (const child of children) {
    if (seen.has(child.id)) continue;
    seen.add(child.id);
    if (isConcreteExploreNode(child)) result.push(child);
    result.push(...concreteDescendants(child.id, nodes, relations, seen));
  }

  return result;
}

function clusteredConcreteDescendants(
  nodeId: string,
  nodes: DestinationNode[],
  relations: DestinationRelation[]
) {
  const root = nodes.find((node) => node.id === nodeId);
  if (!root || root.nodeType !== "country") return concreteDescendants(nodeId, nodes, relations);

  return clusterNodes(nodes)
    .sort((left, right) => clusterPriority(left.id) - clusterPriority(right.id))
    .flatMap((cluster) => concreteDescendants(cluster.id, nodes, relations));
}

function shouldUseClusteredOrder(
  state: MemberExploreState,
  action: ExploreRecommendationAction
) {
  return (
    !state.currentScopeNodeId &&
    !state.queryScope &&
    (action.type === "initial" || action.type === "clear_scope")
  );
}

function interleaveByCluster(nodes: DestinationNode[], allNodes: DestinationNode[]) {
  const buckets = new Map<string, DestinationNode[]>();

  for (const node of nodes) {
    const clusterId = clusterForNode(node, allNodes)?.id ?? node.id;
    buckets.set(clusterId, [...(buckets.get(clusterId) ?? []), node]);
  }

  const orderedClusterIds = Array.from(buckets.keys()).sort(
    (left, right) => clusterPriority(left) - clusterPriority(right)
  );
  const maxBucketLength = Math.max(...Array.from(buckets.values()).map((bucket) => bucket.length), 0);
  const result: DestinationNode[] = [];

  for (let index = 0; index < maxBucketLength; index += 1) {
    for (const clusterId of orderedClusterIds) {
      const node = buckets.get(clusterId)?.[index];
      if (node) result.push(node);
    }
  }

  return result;
}

function concreteNodes(nodes: DestinationNode[]) {
  return nodes.filter((node) => isConcreteExploreNode(node));
}

function clusterNodes(nodes: DestinationNode[]) {
  return nodes.filter((node) => CLUSTER_NODE_TYPES.has(node.nodeType));
}

function clusterPriority(clusterId: string) {
  const index = CLUSTER_PRIORITY.indexOf(clusterId);
  return index >= 0 ? index : CLUSTER_PRIORITY.length;
}

function isConcreteExploreNode(node: DestinationNode) {
  if (CONCRETE_NODE_TYPES.has(node.nodeType)) return true;

  return (
    node.nodeType === "region" &&
    node.id !== "japan" &&
    node.tags.some((tag) =>
      ["day_trip", "onsen", "mountain", "lake", "sea", "island", "nature"].includes(tag)
    )
  );
}

function uniqueNodes(nodes: DestinationNode[]) {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

function mergeUnique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}
