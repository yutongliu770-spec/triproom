import { MockTravelProvider } from "@/lib/travel/mock-provider";
import type { TravelProvider } from "@/lib/travel/provider";

export class TravelDataService {
  constructor(private readonly provider: TravelProvider) {}

  searchDestinations(...args: Parameters<TravelProvider["searchDestinations"]>) {
    return this.provider.searchDestinations(...args);
  }

  searchPlaces(...args: Parameters<TravelProvider["searchPlaces"]>) {
    return this.provider.searchPlaces(...args);
  }

  getPopularPlaces(...args: Parameters<TravelProvider["getPopularPlaces"]>) {
    return this.provider.getPopularPlaces(...args);
  }

  getChildPlaces(...args: Parameters<TravelProvider["getChildPlaces"]>) {
    return this.provider.getChildPlaces(...args);
  }

  getPlaceDetails(...args: Parameters<TravelProvider["getPlaceDetails"]>) {
    return this.provider.getPlaceDetails(...args);
  }

  getRelatedPlaces(...args: Parameters<TravelProvider["getRelatedPlaces"]>) {
    return this.provider.getRelatedPlaces(...args);
  }

  resolvePlaceMention(...args: Parameters<TravelProvider["resolvePlaceMention"]>) {
    return this.provider.resolvePlaceMention(...args);
  }

  getPlaceImages(...args: Parameters<TravelProvider["getPlaceImages"]>) {
    return this.provider.getPlaceImages(...args);
  }

  getRouteEstimate(...args: Parameters<TravelProvider["getRouteEstimate"]>) {
    return this.provider.getRouteEstimate(...args);
  }

  getBudgetEstimate(...args: Parameters<TravelProvider["getBudgetEstimate"]>) {
    return this.provider.getBudgetEstimate(...args);
  }

  searchHotels(...args: Parameters<TravelProvider["searchHotels"]>) {
    return this.provider.searchHotels(...args);
  }

  searchFlights(...args: Parameters<TravelProvider["searchFlights"]>) {
    return this.provider.searchFlights(...args);
  }

  getWeather(...args: Parameters<TravelProvider["getWeather"]>) {
    return this.provider.getWeather(...args);
  }

  getAllNodes() {
    return this.provider.getAllNodes();
  }

  getAllRelations() {
    return this.provider.getAllRelations();
  }

  getCardsForNodes(...args: Parameters<TravelProvider["getCardsForNodes"]>) {
    return this.provider.getCardsForNodes(...args);
  }
}

export function createTravelDataService() {
  return new TravelDataService(new MockTravelProvider());
}

export const travelDataService = createTravelDataService();
