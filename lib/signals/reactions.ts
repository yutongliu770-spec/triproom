import type { MemberSignal, ReactionType } from "@/lib/types";
import { signalTypeForReaction } from "@/lib/preferences/reaction";

const reactionMap: Record<
  ReactionType,
  Pick<MemberSignal, "signalType" | "polarity" | "intensity">
> = {
  want_to_go: { signalType: "positive", polarity: 1, intensity: 3 },
  neutral: { signalType: "neutral", polarity: 0, intensity: 1 },
  not_interested: { signalType: "negative", polarity: -1, intensity: 3 },
  want_to_know: { signalType: "want_to_know", polarity: 0, intensity: 2 },
  must_go: { signalType: "must_go", polarity: 1, intensity: 5 },
  concern: { signalType: "concern", polarity: -1, intensity: 4 }
};

export function reactionToSignal(input: {
  tripId: string;
  memberId: string;
  targetType: MemberSignal["targetType"];
  targetId: string;
  reaction: ReactionType;
  visibility?: MemberSignal["visibility"];
  reason?: string;
}): MemberSignal {
  const mapped = reactionMap[input.reaction];

  return {
    id: `sig-${input.memberId}-${input.targetId}-${input.reaction}-${Date.now()}`,
    tripId: input.tripId,
    memberId: input.memberId,
    targetType: input.targetType,
    targetId: input.targetId,
    signalType: signalTypeForReaction(input.reaction),
    polarity: mapped.polarity,
    intensity: mapped.intensity,
    reason: input.reason,
    aspect: "overall",
    intent: intentForReaction(input.reaction),
    conditionText: input.reaction === "concern" ? input.reason : undefined,
    constraintCandidate: input.reaction === "must_go" || input.reaction === "concern",
    visibility: input.visibility ?? "group",
    scope: "trip",
    createdBy: "user_action",
    confidence: 1,
    createdAt: new Date().toISOString()
  };
}

export function summarizeSignals(signals: MemberSignal[], targetId: string) {
  const targetSignals = signals.filter((signal) => signal.targetId === targetId);
  const positiveMembers = new Set(
    targetSignals
      .filter((signal) => signal.polarity > 0 || signal.signalType === "want_to_know")
      .map((signal) => signal.memberId)
  );
  const negativeMembers = new Set(
    targetSignals.filter((signal) => signal.polarity < 0).map((signal) => signal.memberId)
  );

  return {
    positiveMembers: positiveMembers.size,
    negativeMembers: negativeMembers.size,
    comments: targetSignals.filter((signal) => Boolean(signal.reason)).length,
    hasDivergence: positiveMembers.size > 0 && negativeMembers.size > 0
  };
}

function intentForReaction(reaction: ReactionType) {
  if (reaction === "want_to_go") return "want_to_go";
  if (reaction === "not_interested") return "avoid";
  if (reaction === "want_to_know") return "learn_more";
  if (reaction === "must_go") return "must_go";
  if (reaction === "concern") return "concern";
  return "neutral";
}
