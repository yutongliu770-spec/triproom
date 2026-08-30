import type { MemberSignal, ReactionType } from "@/lib/types";

export function signalTypeForReaction(reaction: ReactionType): MemberSignal["signalType"] {
  if (reaction === "want_to_know") return "want_to_know";
  if (reaction === "neutral") return "neutral";
  if (reaction === "not_interested") return "negative";
  if (reaction === "must_go") return "must_go";
  if (reaction === "concern") return "concern";
  return "positive";
}
