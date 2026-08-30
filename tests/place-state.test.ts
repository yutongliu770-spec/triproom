import { describe, expect, it } from "vitest";
import {
  computePlaceExplorationStates,
  detectMentionedPlaceIds,
  findUnresolvedPlaceMentions
} from "@/lib/graph/place-state";
import { getDemoRoom } from "@/lib/demo/room";
import type { ChatMessage, MemberSignal } from "@/lib/types";

describe("place exploration state", () => {
  it("aggregates room engagement, interest, disagreement, and unresolved mentions", async () => {
    const room = await getDemoRoom();
    const createdAt = "2026-08-24T10:00:00.000Z";
    const signals: MemberSignal[] = [
      signal("member-a", "tokyo-disney", "positive", 1, 5),
      signal("member-b", "tokyo-disney", "positive", 1, 5),
      signal("member-c", "tokyo-disney", "negative", -1, 3)
    ];
    const messages: ChatMessage[] = [
      {
        id: "msg-test-1",
        tripId: room.trip.id,
        authorType: "member",
        authorMemberId: "member-a",
        messageType: "user_text",
        textContent: "东京迪士尼很想去，也想看看清澄白河。",
        visibility: "group",
        createdAt
      }
    ];

    const stateMap = computePlaceExplorationStates({
      nodes: room.nodes,
      relations: room.relations,
      roomNodeStates: room.roomNodeStates,
      signals,
      messages,
      materials: room.materials
    });

    const disney = stateMap.get("tokyo-disney");
    const tokyo = stateMap.get("tokyo");

    expect(disney?.interestScore).toBeGreaterThan(0);
    expect(disney?.engagementScore).toBeGreaterThan(0);
    expect(disney?.disagreementScore).toBeGreaterThan(0);
    expect(disney?.explorationState).toBe("candidate");
    expect(tokyo?.interestScore).toBeGreaterThan(0);
    expect(tokyo?.childNodeIds).toContain("tokyo-disney");
    expect(detectMentionedPlaceIds("我想看东京和USJ", room.nodes)).toEqual(
      expect.arrayContaining(["tokyo", "usj"])
    );
    expect(findUnresolvedPlaceMentions(messages, room.nodes)[0]?.name).toBe("清澄白河");
  });
});

function signal(
  memberId: string,
  targetId: string,
  signalType: MemberSignal["signalType"],
  polarity: MemberSignal["polarity"],
  intensity: MemberSignal["intensity"]
): MemberSignal {
  return {
    id: `sig-${memberId}-${targetId}`,
    tripId: "demo-japan-7d",
    memberId,
    targetType: "node",
    targetId,
    signalType,
    polarity,
    intensity,
    visibility: "group",
    scope: "trip",
    confidence: 1,
    createdAt: "2026-08-24T10:00:00.000Z"
  };
}
