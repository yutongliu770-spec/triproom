import type { DestinationNode, DestinationRelation, RoomNodeState } from "@/lib/types";

export function getExpandableNodeIds(
  focusNodeId: string,
  relations: DestinationRelation[],
  states: RoomNodeState[] = []
) {
  const dismissed = new Set(
    states.filter((state) => state.state === "dismissed").map((state) => state.nodeId)
  );

  const primaryChildren = relations
    .filter((relation) => relation.fromNodeId === focusNodeId && relation.relationType === "contains")
    .map((relation) => relation.toNodeId);

  const nearby = relations
    .filter(
      (relation) =>
        relation.fromNodeId === focusNodeId &&
        ["nearby_day_trip", "pairs_well_with", "alternative_to", "reachable_from"].includes(
          relation.relationType
        )
    )
    .map((relation) => relation.toNodeId);

  return [...new Set([...primaryChildren, ...nearby])].filter((nodeId) => !dismissed.has(nodeId));
}

export function focusNode(
  tripId: string,
  nodeId: string,
  nodes: DestinationNode[],
  currentStates: RoomNodeState[]
) {
  const knownNodeIds = new Set(nodes.map((node) => node.id));
  if (!knownNodeIds.has(nodeId)) {
    throw new Error(`Cannot focus unknown node: ${nodeId}`);
  }

  const stateByNode = new Map(currentStates.map((state) => [state.nodeId, state]));

  return nodes.map((node) => {
    const existing = stateByNode.get(node.id);
    if (node.id === nodeId) {
      return {
        tripId,
        nodeId,
        state: "focused" as const,
        explorationState: existing?.explorationState ?? "discovered",
        engagementScore: Math.max(existing?.engagementScore ?? 0, 1),
        interestScore: existing?.interestScore ?? 0,
        disagreementScore: existing?.disagreementScore ?? 0,
        firstDiscoveredAt: existing?.firstDiscoveredAt ?? new Date().toISOString(),
        lastInteractedAt: new Date().toISOString(),
        mentionCount: existing?.mentionCount ?? 0,
        interactionCount: (existing?.interactionCount ?? 0) + 1,
        source: existing?.source ?? "conversation",
        shownCount: Math.max(existing?.shownCount ?? 0, 1),
        lastShownAt: new Date().toISOString(),
        aggregateSignal: existing?.aggregateSignal
      };
    }

    if (existing?.state === "focused") {
      return { ...existing, state: "opened" as const };
    }

    return (
      existing ?? {
        tripId,
        nodeId: node.id,
        state: "undiscovered" as const,
        explorationState: "seed" as const,
        mentionCount: 0,
        interactionCount: 0,
        shownCount: 0
      }
    );
  });
}

export function breadcrumbForNode(nodeId: string, nodes: DestinationNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: DestinationNode[] = [];
  let current = byId.get(nodeId);

  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }

  return path;
}
