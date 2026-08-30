import { describe, expect, it } from "vitest";
import { getDemoRoom } from "@/lib/demo/room";
import { DEFAULT_DEMO_TRIP_ID, QUICK_DEMO_TRIP_ID } from "@/lib/travel/mock-provider";

describe("demo seeds", () => {
  it("keeps the fresh demo as a true cold start", async () => {
    const room = await getDemoRoom(DEFAULT_DEMO_TRIP_ID);

    expect(room.trip.id).toBe(DEFAULT_DEMO_TRIP_ID);
    expect(room.trip.tripDurationDays).toBeUndefined();
    expect(room.initialActiveMemberIds).toEqual(["m-anna"]);
    expect(room.messages.map((message) => message.textContent)).toContain("我们想去日本旅游。");
    expect(room.signals).toHaveLength(0);
    expect(room.materials).toHaveLength(0);
    expect(room.memberPlaceProfiles).toHaveLength(0);
    expect(room.roomPlaceProfiles).toHaveLength(0);
  });

  it("preloads quick demo activity from raw seed evidence", async () => {
    const room = await getDemoRoom(QUICK_DEMO_TRIP_ID);

    expect(room.trip.id).toBe(QUICK_DEMO_TRIP_ID);
    expect(room.initialActiveMemberIds).toEqual(["m-anna", "m-bo", "m-chen", "m-ding"]);
    expect(room.messages.length).toBeGreaterThanOrEqual(6);
    expect(room.materials.map((material) => material.primaryNodeId)).toEqual(
      expect.arrayContaining(["kamakura", "usj", "gion-higashiyama"])
    );
    expect(room.evidences?.some((evidence) => evidence.targetId === "kamakura")).toBe(true);
    expect(room.signals.some((signal) => signal.targetId === "kamakura" && signal.evidenceId)).toBe(true);
    expect(room.placeOpinions?.some((opinion) => opinion.nodeId === "usj")).toBe(true);
    expect(room.memberPlaceProfiles?.some((profile) => profile.memberId === "m-anna" && profile.nodeId === "kamakura")).toBe(true);
    expect(room.roomPlaceProfiles?.some((profile) => profile.nodeId === "usj" && profile.disagreementScore > 0)).toBe(true);
    expect(room.roomNodeStates.some((state) => state.nodeId === "usj" && (state.interestScore ?? 0) > 0)).toBe(true);
    expect(room.roomNodeStates.some((state) => state.nodeId === "usj" && (state.disagreementScore ?? 0) > 0)).toBe(true);
  });
});
