import { describe, expect, it } from "vitest";
import { getDemoRoom } from "@/lib/demo/room";
import {
  computeFeaturedPlaceStats,
  getMapPlacesForContext,
  resolveMapContext,
  semanticLevelForZoom
} from "@/lib/graph/map-context";
import { computePlaceExplorationStates } from "@/lib/graph/place-state";

describe("map context resolver", () => {
  it("keeps one continuous map while semantic zoom switches visible hierarchy", async () => {
    const room = await getDemoRoom();
    const states = computePlaceExplorationStates({
      nodes: room.nodes,
      relations: room.relations,
      roomNodeStates: room.roomNodeStates,
      signals: room.signals,
      messages: room.messages,
      materials: room.materials
    });

    expect(semanticLevelForZoom(4)).toBe("country");
    expect(semanticLevelForZoom(6)).toBe("region");
    expect(semanticLevelForZoom(8)).toBe("city");
    expect(semanticLevelForZoom(12)).toBe("district");
    expect(semanticLevelForZoom(13)).toBe("attraction");
    expect(semanticLevelForZoom(14)).toBe("poi");

    const japanContext = resolveMapContext({
      center: { latitude: 36.2048, longitude: 138.2529 },
      zoom: 4,
      nodes: room.nodes,
      relations: room.relations
    });
    const japanPlaceIds = getMapPlacesForContext({
      context: japanContext,
      nodes: room.nodes,
      relations: room.relations
    }).map((node) => node.id);

    expect(japanContext.breadcrumb.map((node) => node.id)).toEqual(["japan"]);
    expect(japanPlaceIds).toEqual(
      expect.arrayContaining(["tokyo", "osaka", "kyoto", "hokkaido", "okinawa"])
    );
    expect(japanPlaceIds).not.toContain("kamakura");
    expect(japanPlaceIds).not.toContain("asakusa-ueno");

    const tokyoContext = resolveMapContext({
      center: { latitude: 35.6764, longitude: 139.65 },
      zoom: 8,
      nodes: room.nodes,
      relations: room.relations
    });
    const tokyoPlaceIds = getMapPlacesForContext({
      context: tokyoContext,
      nodes: room.nodes,
      relations: room.relations
    }).map((node) => node.id);

    expect(tokyoContext.breadcrumb.map((node) => node.id)).toEqual(["japan", "tokyo"]);
    expect(tokyoPlaceIds).toEqual(
      expect.arrayContaining(["asakusa-ueno", "shibuya-shinjuku", "tokyo-disney", "kamakura"])
    );
    expect(tokyoPlaceIds).not.toContain("tokyo");

    const asakusaContext = resolveMapContext({
      center: { latitude: 35.7148, longitude: 139.7967 },
      zoom: 12,
      nodes: room.nodes,
      relations: room.relations
    });
    const asakusaPlaceIds = getMapPlacesForContext({
      context: asakusaContext,
      nodes: room.nodes,
      relations: room.relations
    }).map((node) => node.id);

    expect(asakusaContext.breadcrumb.map((node) => node.id)).toEqual([
      "japan",
      "tokyo",
      "asakusa-ueno"
    ]);
    expect(asakusaPlaceIds).toEqual(
      expect.arrayContaining(["sensoji", "nakamise-dori", "tokyo-skytree"])
    );

    const tokyo = room.nodes.find((node) => node.id === "tokyo");
    expect(tokyo).toBeTruthy();
    const stats = computeFeaturedPlaceStats({
      node: tokyo!,
      nodes: room.nodes,
      relations: room.relations,
      states
    });

    expect(stats.totalFeaturedPlaces).toBeGreaterThan(5);
    expect(stats.totalFeaturedPlaces).toBeGreaterThanOrEqual(stats.exploredPlacesCount);
  });
});
