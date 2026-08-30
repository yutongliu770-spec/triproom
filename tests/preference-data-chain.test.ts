import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { ensureDemoRoomPersisted } from "@/lib/preferences/demo-persistence";
import { evidenceService } from "@/lib/preferences/evidence-service";
import { getPreferenceState } from "@/lib/preferences/state";

describe("preference data chain", () => {
  it("persists one user expression through Evidence, Signal, MemberPlaceProfile, and RoomPlaceProfile", async () => {
    if (!(await canUseDatabase())) {
      console.warn("Skipping database preference chain test because DATABASE_URL is not available.");
      return;
    }

    const tripId = "demo-japan-7d";
    const memberId = "m-anna";
    const text = "镰仓海边和电车很好看，但专门从东京跑一天有点不值。";
    const messageId = `msg-test-preference-${Date.now()}`;

    await ensureDemoRoomPersisted(tripId);
    const evidences = await evidenceService.recordChatMessage({
      id: messageId,
      tripId,
      memberId,
      text,
      visibility: "group",
      messageType: "user_text",
      createdAt: new Date().toISOString()
    });

    const state = await getPreferenceState(tripId);
    const kamakuraEvidence = evidences.find((evidence) => evidence.targetId === "kamakura");
    expect(kamakuraEvidence?.rawTextSnapshot).toBe(text);

    const serializedEvidence = state.evidences.find((evidence) => evidence.id === kamakuraEvidence?.id);
    expect(serializedEvidence?.analysisStatus).toBe("completed");

    const signals = state.signals.filter((signal) => signal.evidenceId === kamakuraEvidence?.id);
    expect(signals.map((signal) => signal.aspect)).toEqual(
      expect.arrayContaining(["sea", "train_experience", "time_cost"])
    );
    expect(signals.some((signal) => signal.conditionText?.includes("单独花一整天"))).toBe(true);

    const memberProfile = state.memberPlaceProfiles.find(
      (profile) => profile.memberId === memberId && profile.nodeId === "kamakura"
    );
    expect(memberProfile?.sourceEvidenceIds).toContain(kamakuraEvidence?.id);
    expect(memberProfile?.topSignalIds.length).toBeGreaterThan(0);
    expect(memberProfile?.interestScore).toBeGreaterThan(0);
    expect(memberProfile?.stance).toBe("conditional");
    expect(memberProfile?.positiveReasons.join(" ")).toContain("海边");
    expect(memberProfile?.negativeReasons.join(" ")).toContain("时间成本");
    expect(memberProfile?.summary).toContain("镰仓");

    const roomProfile = state.roomPlaceProfiles.find((profile) => profile.nodeId === "kamakura");
    expect(roomProfile?.sourceEvidenceIds).toContain(kamakuraEvidence?.id);
    expect(roomProfile?.topSignalIds.length).toBeGreaterThan(0);
    expect(roomProfile?.teamInterestScore).toBeGreaterThan(0);
    expect(roomProfile?.summary).toContain("镰仓");
    expect(roomProfile?.mainConcerns.join(" ")).toContain("时间成本");
  });
});

async function canUseDatabase() {
  if (!process.env.DATABASE_URL) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
