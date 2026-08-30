import type { DestinationNode, DestinationRelation, TravelCard } from "@/lib/types";
import { getPlaceSocialDiscovery } from "@/lib/travel/social-discovery";

function nodeTypeToCardType(nodeType: DestinationNode["nodeType"]): TravelCard["type"] {
  if (nodeType === "district" || nodeType === "area") return "district";
  if (nodeType === "poi" || nodeType === "attraction") return "poi";
  if (nodeType === "activity") return "activity";
  return "destination";
}

export function createTravelCard(
  node: DestinationNode,
  relations: DestinationRelation[] = []
): TravelCard {
  const children = relations
    .filter((relation) => relation.fromNodeId === node.id && relation.relationType === "contains")
    .slice(0, 4);

  return {
    id: `card-${node.id}`,
    nodeId: node.id,
    type: nodeTypeToCardType(node.nodeType),
    title: node.canonicalName,
    subtitle: node.tags.slice(0, 2).join(" / "),
    imageUrl: node.heroImageUrl,
    images: node.images ?? (node.heroImageUrl ? [{ url: node.heroImageUrl, alt: node.imageAlt }] : []),
    imageAlt: node.imageAlt,
    shortSummary: node.shortSummary,
    highlights: node.highlights.slice(0, 4),
    suggestedStay: {
      text: node.suggestedStayText ?? "建议停留时间待确认"
    },
    budget: {
      band: node.budgetBand ?? "unknown",
      text: budgetText(node.budgetBand),
      basis: "参考估算 / Mock Data，未连接实时价格、库存或预订数据",
      asOf: node.dataAsOf,
      isEstimate: true
    },
    travelCost: {
      text: relationTravelText(node.id, relations) ?? "交通强度待结合路线确认"
    },
    representativeItems: children.map((relation) => ({
      name: relation.toNodeId,
      nodeId: relation.toNodeId
    })),
    sourceSummary: node.dataSource === "seed" ? "日本演示种子库" : node.dataSource,
    socialDiscovery: node.socialDiscovery ?? getPlaceSocialDiscovery(node),
    actions: ["open", "react", "voice", "comment", "ask", "expand"]
  };
}

function budgetText(band: DestinationNode["budgetBand"]) {
  switch (band) {
    case "low":
      return "预算档位：低，参考估算 / Mock Data";
    case "medium":
      return "预算档位：中，参考估算 / Mock Data";
    case "high":
      return "预算档位：偏高，参考估算 / Mock Data";
    case "luxury":
      return "预算档位：高，参考估算 / Mock Data";
    default:
      return "预算档位待确认";
  }
}

function relationTravelText(nodeId: string, relations: DestinationRelation[]) {
  const relation = relations.find(
    (item) =>
      item.toNodeId === nodeId &&
      (item.relationType === "nearby_day_trip" || item.relationType === "requires_long_transfer")
  );

  if (typeof relation?.metadata?.travelTimeText === "string") {
    return relation.metadata.travelTimeText;
  }

  if (typeof relation?.metadata?.reason === "string") {
    return relation.metadata.reason;
  }

  return undefined;
}
