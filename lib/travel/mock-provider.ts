import demoRoom from "@/seed/demo-room.json";
import japanDestinations from "@/seed/japan-destinations.json";
import { createTravelCard } from "@/lib/graph/cards";
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
  Material,
  MemberSignal,
  PlanVariant,
  RoomNodeState,
  Trip
} from "@/lib/types";

const nodes = (japanDestinations.nodes as DestinationNode[]).map(normalizeSeedNode);
const relations = japanDestinations.relations as DestinationRelation[];
const MOCK_AS_OF = "2026-08-23";

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

export function getMockDemoSeed() {
  const trip = demoRoom.trip as Trip;
  const messages = demoRoom.messages as ChatMessage[];
  const initialCardIds = initialExploreNodeIds();
  const materials: Material[] = [];

  const roomNodeStates: RoomNodeState[] = nodes.map((node) => ({
    tripId: trip.id,
    nodeId: node.id,
    state: node.id === "japan" ? "focused" : "undiscovered",
    shownCount: 0,
    lastShownAt: undefined,
    explorationState: "seed",
    engagementScore: 0,
    interestScore: 0,
    disagreementScore: 0,
    mentionCount: 0,
    interactionCount: 0,
    source: "seed"
  }));

  return {
    trip,
    messages,
    materials,
    roomNodeStates,
    signals: [] as MemberSignal[],
    plans: [] as PlanVariant[],
    initialCardIds
  };
}

function initialExploreNodeIds() {
  const clusterOrder = ["kyoto", "tokyo", "osaka", "fuji-kawaguchiko", "hokkaido", "okinawa"];
  const byCluster = new Map<string, string[]>();

  for (const clusterId of clusterOrder) {
    byCluster.set(clusterId, descendantExploreNodeIds(clusterId));
  }

  return clusterOrder.flatMap((clusterId) => byCluster.get(clusterId) ?? []);
}

function descendantExploreNodeIds(rootNodeId: string, seen = new Set<string>()) {
  const childIds = relations
    .filter(
      (relation) =>
        relation.fromNodeId === rootNodeId &&
        ["contains", "nearby_day_trip"].includes(relation.relationType)
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
