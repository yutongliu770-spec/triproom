import type { DestinationNode, DestinationRelation, TravelCard } from "@/lib/types";

export type TravelProviderSourceType = "mock" | "provider";

export interface RouteEstimate {
  fromNodeId: string;
  toNodeId: string;
  text: string;
  durationText?: string;
  mode?: "train" | "walk" | "bus" | "flight" | "mixed" | "unknown";
  sourceType: TravelProviderSourceType;
  isEstimate: true;
  asOf: string;
}

export interface BudgetEstimate {
  nodeId?: string;
  text: string;
  band: "low" | "medium" | "high" | "luxury" | "unknown";
  basis: string;
  sourceType: TravelProviderSourceType;
  isEstimate: true;
  asOf: string;
}

export interface HotelSearchResult {
  nodeId?: string;
  title: string;
  summary: string;
  budget: BudgetEstimate;
}

export interface FlightSearchResult {
  title: string;
  summary: string;
  sourceType: TravelProviderSourceType;
  isEstimate: true;
}

export interface WeatherResult {
  nodeId?: string;
  text: string;
  sourceType: TravelProviderSourceType;
  isEstimate: true;
  asOf: string;
}

export interface PlaceImage {
  url: string;
  alt: string;
  caption?: string;
}

export interface PlaceResolution {
  status: "resolved" | "unresolved";
  query: string;
  place?: DestinationNode;
  unresolvedMention?: {
    name: string;
    source: "conversation" | "user_share" | "ai_output";
    reason: string;
  };
}

export interface TravelProvider {
  searchDestinations(query: string, context?: unknown): Promise<DestinationNode[]>;
  searchPlaces(query: string, context?: unknown): Promise<DestinationNode[]>;
  getPopularPlaces(parentNodeId?: string, context?: unknown): Promise<DestinationNode[]>;
  getChildPlaces(parentNodeId: string, context?: unknown): Promise<DestinationNode[]>;
  getPlaceDetails(nodeId: string): Promise<DestinationNode | undefined>;
  getRelatedPlaces(nodeId: string, context?: unknown): Promise<DestinationNode[]>;
  resolvePlaceMention(name: string, context?: unknown): Promise<PlaceResolution>;
  getPlaceImages(nodeId: string): Promise<PlaceImage[]>;
  getRouteEstimate(fromNodeId: string, toNodeId: string): Promise<RouteEstimate>;
  getBudgetEstimate(input: { nodeId?: string; context?: unknown }): Promise<BudgetEstimate>;
  searchHotels(input: { nodeId?: string; query?: string }): Promise<HotelSearchResult[]>;
  searchFlights(input: { from?: string; to?: string; dateText?: string }): Promise<FlightSearchResult[]>;
  getWeather(input: { nodeId?: string; dateText?: string }): Promise<WeatherResult>;
  getAllNodes(): Promise<DestinationNode[]>;
  getAllRelations(): Promise<DestinationRelation[]>;
  getCardsForNodes(nodeIds: string[]): Promise<TravelCard[]>;
}
