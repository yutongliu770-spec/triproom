import type { MaterialStatus, MemberSignal } from "@/lib/types";

export function computeMaterialStatus(
  signals: MemberSignal[],
  materialId: string,
  primaryNodeId?: string
): MaterialStatus {
  const related = signals.filter(
    (signal) =>
      (signal.targetType === "material" && signal.targetId === materialId) ||
      (Boolean(primaryNodeId) &&
        signal.targetType === "node" &&
        signal.targetId === primaryNodeId)
  );

  if (related.length === 0) return "seen";

  const hasPositive = related.some((signal) => signal.polarity > 0 || signal.signalType === "must_go");
  const hasNegative = related.some(
    (signal) => signal.polarity < 0 || signal.signalType === "hard_reject"
  );

  if (hasPositive && hasNegative) return "controversial";
  if (hasPositive) return "interested";
  if (hasNegative) return "dropped";

  return "seen";
}
