import type { DestinationNode, DestinationRelation } from "@/lib/types";
import type { PlaceExplorationState } from "@/lib/graph/place-state";

export type MapSemanticLevel = "country" | "region" | "city" | "district" | "attraction" | "poi";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface MapContext {
  level: MapSemanticLevel;
  place: DestinationNode;
  breadcrumb: DestinationNode[];
}

export interface FeaturedPlaceStats {
  totalFeaturedPlaces: number;
  exploredPlacesCount: number;
  engagedPlacesCount: number;
  candidatePlacesCount: number;
}

const CHILD_RELATION_TYPES = new Set([
  "contains",
  "nearby_day_trip",
  "pairs_well_with",
  "alternative_to",
  "reachable_from"
]);

export function semanticLevelForZoom(zoom: number): MapSemanticLevel {
  if (zoom <= 5) return "country";
  if (zoom <= 7) return "region";
  if (zoom <= 9) return "city";
  if (zoom <= 12) return "district";
  if (zoom <= 13) return "attraction";
  return "poi";
}

export function semanticZoomLabel(level: MapSemanticLevel) {
  if (level === "country") return "Country / Region";
  if (level === "region") return "Region / City";
  if (level === "city") return "City";
  if (level === "district") return "District / Attraction";
  if (level === "attraction") return "Attraction";
  return "POI";
}

export function focusZoomForNode(node: DestinationNode) {
  if (node.nodeType === "country") return 4;
  if (node.nodeType === "city" || node.nodeType === "region") return 8;
  if (node.nodeType === "district" || node.nodeType === "area") return 12;
  return 13;
}

export function resolveMapContext(input: {
  center: GeoPoint;
  zoom: number;
  nodes: DestinationNode[];
  relations: DestinationRelation[];
}): MapContext {
  const level = semanticLevelForZoom(input.zoom);
  const root = input.nodes.find((node) => node.id === "japan") ?? input.nodes[0];

  if (!root) {
    throw new Error("Map context requires at least one destination node.");
  }

  if (level === "country") {
    return {
      level,
      place: root,
      breadcrumb: [root]
    };
  }

  const topLevelPlaces = childPlaces("japan", input.nodes, input.relations).filter(isCountryLevelPlace);
  const city = nearestPlace(input.center, topLevelPlaces) ?? root;

  if (level === "region" || level === "city") {
    return {
      level,
      place: city,
      breadcrumb: breadcrumbForPlace(city.id, input.nodes)
    };
  }

  const cityChildren = childPlaces(city.id, input.nodes, input.relations);
  const district = nearestPlace(input.center, cityChildren) ?? city;

  if (level === "district") {
    return {
      level,
      place: district,
      breadcrumb: breadcrumbForPlace(district.id, input.nodes)
    };
  }

  const districtChildren = childPlaces(district.id, input.nodes, input.relations);
  const poi = nearestPlace(input.center, districtChildren) ?? district;

  return {
    level,
    place: poi,
    breadcrumb: breadcrumbForPlace(poi.id, input.nodes)
  };
}

export function getMapPlacesForContext(input: {
  context: MapContext;
  nodes: DestinationNode[];
  relations: DestinationRelation[];
}) {
  if (input.context.level === "country" || input.context.level === "region") {
    return childPlaces("japan", input.nodes, input.relations).filter(isCountryLevelPlace);
  }

  if (input.context.level === "city") {
    const city = cityLevelAncestor(input.context.place, input.nodes) ?? input.context.place;
    const children = childPlaces(city.id, input.nodes, input.relations);
    return children.length ? children : [city];
  }

  if (input.context.level === "district" || input.context.level === "attraction") {
    const children = childPlaces(input.context.place.id, input.nodes, input.relations);
    if (children.length) return children;

    const parent = input.context.place.parentId
      ? input.nodes.find((node) => node.id === input.context.place.parentId)
      : undefined;
    return parent ? childPlaces(parent.id, input.nodes, input.relations) : [input.context.place];
  }

  const children = childPlaces(input.context.place.id, input.nodes, input.relations);
  return children.length ? children : [input.context.place];
}

export function computeFeaturedPlaceStats(input: {
  node: DestinationNode;
  nodes: DestinationNode[];
  relations: DestinationRelation[];
  states: Map<string, PlaceExplorationState>;
}): FeaturedPlaceStats {
  const descendantIds = collectDescendantIds(input.node.id, input.nodes, input.relations);
  const descendants = descendantIds
    .map((nodeId) => input.nodes.find((node) => node.id === nodeId))
    .filter((node): node is DestinationNode => Boolean(node))
    .filter((node) => node.nodeType !== "country");

  const exploredPlaces = descendants.filter((node) => isExplored(input.states.get(node.id)));
  const engagedPlaces = descendants.filter((node) => (input.states.get(node.id)?.engagementScore ?? 0) >= 4);
  const candidatePlaces = descendants.filter(
    (node) =>
      input.states.get(node.id)?.explorationState === "candidate" ||
      input.states.get(node.id)?.explorationState === "selected"
  );

  return {
    totalFeaturedPlaces: descendants.length,
    exploredPlacesCount: exploredPlaces.length,
    engagedPlacesCount: engagedPlaces.length,
    candidatePlacesCount: candidatePlaces.length
  };
}

export function breadcrumbForPlace(nodeId: string, nodes: DestinationNode[]) {
  const breadcrumb: DestinationNode[] = [];
  let current = nodes.find((node) => node.id === nodeId);

  while (current) {
    breadcrumb.unshift(current);
    current = current.parentId ? nodes.find((node) => node.id === current?.parentId) : undefined;
  }

  return breadcrumb;
}

export function childPlaces(
  parentNodeId: string,
  nodes: DestinationNode[],
  relations: DestinationRelation[]
) {
  const childIds = relations
    .filter(
      (relation) =>
        relation.fromNodeId === parentNodeId && CHILD_RELATION_TYPES.has(relation.relationType)
    )
    .map((relation) => relation.toNodeId);

  return childIds
    .map((childId) => nodes.find((node) => node.id === childId))
    .filter((node): node is DestinationNode => Boolean(node));
}

function collectDescendantIds(
  nodeId: string,
  nodes: DestinationNode[],
  relations: DestinationRelation[],
  seen = new Set<string>()
) {
  const children = childPlaces(nodeId, nodes, relations);

  for (const child of children) {
    if (seen.has(child.id)) continue;
    seen.add(child.id);
    collectDescendantIds(child.id, nodes, relations, seen);
  }

  return Array.from(seen);
}

function isCountryLevelPlace(node: DestinationNode) {
  return (
    ["region", "city"].includes(node.nodeType) &&
    (node.nodeType === "city" || !node.tags.includes("day_trip"))
  );
}

function nearestPlace(center: GeoPoint, places: DestinationNode[]) {
  return places
    .filter((place) => Boolean(place.geo))
    .reduce<DestinationNode | undefined>((nearest, place) => {
      if (!nearest?.geo) return place;
      return geoDistance(center, place.geo!) < geoDistance(center, nearest.geo) ? place : nearest;
    }, undefined);
}

function geoDistance(a: GeoPoint, b: GeoPoint) {
  const latitudeWeight = Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180);
  return (a.latitude - b.latitude) ** 2 + ((a.longitude - b.longitude) * latitudeWeight) ** 2;
}

function cityLevelAncestor(node: DestinationNode, nodes: DestinationNode[]) {
  let current: DestinationNode | undefined = node;

  while (current) {
    if (current.nodeType === "city" || current.nodeType === "region") return current;
    current = current.parentId ? nodes.find((item) => item.id === current?.parentId) : undefined;
  }

  return undefined;
}

function isExplored(state?: PlaceExplorationState) {
  return Boolean(
    state &&
      (state.explorationState !== "seed" ||
        ["shown", "opened", "focused", "pinned", "selected"].includes(state.roomState ?? ""))
  );
}
