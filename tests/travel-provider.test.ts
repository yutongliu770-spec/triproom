import { describe, expect, it } from "vitest";
import { MockTravelProvider } from "@/lib/travel/mock-provider";
import { TravelDataService } from "@/lib/travel/service";

describe("TravelDataService with MockTravelProvider", () => {
  it("returns seed-backed destination cards through the provider abstraction", async () => {
    const service = new TravelDataService(new MockTravelProvider());
    const cards = await service.getCardsForNodes(["tokyo", "osaka"]);

    expect(cards).toHaveLength(2);
    expect(cards[0].title).toBe("东京");
    expect(cards[0].images?.length).toBeGreaterThan(1);
    expect(cards[0].budget?.basis).toContain("Mock Data");
    expect(cards[0].socialDiscovery?.xiaohongshu?.searchUrl).toContain(
      "https://www.xiaohongshu.com/search_result"
    );
    expect(cards[0].socialDiscovery?.xiaohongshu?.searchKeywords).toContain("东京 攻略");
  });

  it("resolves canonical places and keeps unknown mentions unresolved in mock mode", async () => {
    const service = new TravelDataService(new MockTravelProvider());
    const [popular, tokyoChildren, resolved, unresolved] = await Promise.all([
      service.getPopularPlaces("japan"),
      service.getChildPlaces("tokyo"),
      service.resolvePlaceMention("USJ"),
      service.resolvePlaceMention("清澄白河")
    ]);

    expect(popular.map((place) => place.id)).toContain("tokyo");
    expect(popular.find((place) => place.id === "tokyo")?.geo).toMatchObject({
      latitude: expect.any(Number),
      longitude: expect.any(Number)
    });
    expect(popular.find((place) => place.id === "tokyo")?.socialDiscovery?.xiaohongshu).toMatchObject({
      provider: "xiaohongshu",
      label: "小红书攻略"
    });
    expect(tokyoChildren.map((place) => place.id)).toContain("kamakura");
    expect(resolved.status).toBe("resolved");
    expect(resolved.place?.id).toBe("usj");
    expect(unresolved.status).toBe("unresolved");
    expect(unresolved.unresolvedMention?.reason).toContain("不能伪造坐标");
  });

  it("keeps unimplemented external capabilities as mock estimates", async () => {
    const service = new TravelDataService(new MockTravelProvider());
    const [route, hotels, flights, weather] = await Promise.all([
      service.getRouteEstimate("tokyo", "osaka"),
      service.searchHotels({ nodeId: "tokyo" }),
      service.searchFlights({ from: "Shanghai", to: "Tokyo" }),
      service.getWeather({ nodeId: "tokyo" })
    ]);

    expect(route.isEstimate).toBe(true);
    expect(hotels[0].summary).toContain("不接酒店 API");
    expect(flights[0].summary).toContain("不接航班 API");
    expect(weather.text).toContain("不接实时天气 API");
  });
});
