import { describe, expect, it } from "vitest";
import {
  createInitialExploreState,
  recommendExploreCards
} from "@/lib/graph/explore-recommendations";
import { travelDataService } from "@/lib/travel/service";

describe("explore recommendations", () => {
  it("keeps a swipeable city deck after all places in that scope were already seen", async () => {
    const [nodes, relations] = await Promise.all([
      travelDataService.getAllNodes(),
      travelDataService.getAllRelations()
    ]);
    const kyotoPlaceIds = [
      "arashiyama",
      "fushimi-inari",
      "gion-higashiyama",
      "kiyomizu-dera"
    ];

    const result = recommendExploreCards({
      tripId: "demo-trip",
      memberId: "member-a",
      nodes,
      relations,
      signals: [],
      roomNodeStates: [],
      previousState: {
        ...createInitialExploreState({
          tripId: "demo-trip",
          memberId: "member-a",
          cards: []
        }),
        currentScopeNodeId: "kyoto",
        currentClusterNodeId: "kyoto",
        explorationPathNodeIds: ["japan", "kyoto"],
        seenPlaceIds: kyotoPlaceIds
      },
      action: { type: "focus_node", nodeId: "gion-higashiyama" }
    });

    expect(result.cards[0]?.nodeId).toBe("gion-higashiyama");
    expect(result.cards.map((card) => card.nodeId)).toEqual(
      expect.arrayContaining(["arashiyama", "fushimi-inari", "kiyomizu-dera"])
    );
    expect(result.cards.length).toBeGreaterThan(1);
  });
});
