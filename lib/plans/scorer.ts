import type { PlanningContext } from "@/lib/plans/context-builder";
import type { PlanValidationResult } from "@/lib/plans/validator";
import type { PlanVariant } from "@/lib/types";

export interface PlanScoringBreakdown {
  memberPreferenceFit: number;
  groupFairness: number;
  routeFeasibility: number;
  schedulePace: number;
  budgetFit: number;
  dataConfidence: number;
}

export interface PlanScoreResult {
  score: number;
  breakdown: PlanScoringBreakdown;
}

export class PlanningScorer {
  score(plan: PlanVariant, context: PlanningContext, validation: PlanValidationResult): PlanScoreResult {
    const included = new Set(plan.includedNodeIds);
    const relevantMemberProfiles = context.memberPlaceProfiles.filter((profile) => included.has(profile.nodeId));
    const relevantRoomProfiles = context.roomPlaceProfiles.filter((profile) => included.has(profile.nodeId));
    const memberPreferenceFit = averageOr(
      relevantMemberProfiles.map((profile) => profile.interestScore * 10),
      78
    );
    const groupFairness = fairnessScore(relevantMemberProfiles, context.members.map((member) => member.id));
    const routeFeasibility = routeFeasibilityScore(plan);
    const schedulePace = schedulePaceScore(plan, context);
    const budgetFit = budgetFitScore(plan, context);
    const dataConfidence = averageOr(
      [
        ...relevantRoomProfiles.map((profile) => profile.engagementScore * 8 + profile.teamInterestScore * 2),
        context.keyEvidence.length ? 84 : 68
      ],
      72
    );
    const validationPenalty = validation.issues.reduce(
      (sum, issue) => sum + (issue.severity === "error" ? 45 : issue.severity === "warning" ? 5 : 1),
      0
    );
    const raw =
      memberPreferenceFit * 0.28 +
      groupFairness * 0.18 +
      routeFeasibility * 0.18 +
      schedulePace * 0.14 +
      budgetFit * 0.12 +
      dataConfidence * 0.1 -
      validationPenalty;

    const breakdown = {
      memberPreferenceFit: round(memberPreferenceFit),
      groupFairness: round(groupFairness),
      routeFeasibility: round(routeFeasibility),
      schedulePace: round(schedulePace),
      budgetFit: round(budgetFit),
      dataConfidence: round(dataConfidence)
    };

    return {
      score: Math.max(0, Math.min(100, Math.round(raw))),
      breakdown
    };
  }
}

export const planningScorer = new PlanningScorer();

function fairnessScore(profiles: PlanningContext["memberPlaceProfiles"], memberIds: string[]) {
  if (memberIds.length === 0) return 80;
  const scores = memberIds.map((memberId) => {
    const memberProfiles = profiles.filter((profile) => profile.memberId === memberId);
    return averageOr(memberProfiles.map((profile) => profile.interestScore * 10), 70);
  });
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  return Math.max(58, averageOr(scores, 72) - Math.max(0, max - min - 18) * 0.6);
}

function routeFeasibilityScore(plan: PlanVariant) {
  const routeIds = plan.route?.nodeIds ?? plan.includedNodeIds;
  const hasTokyo = routeIds.includes("tokyo");
  const hasKansai = routeIds.some((id) => ["osaka", "kyoto", "usj"].includes(id));
  const hasFuji = routeIds.some((id) => ["hakone", "fuji-kawaguchiko", "lake-kawaguchiko"].includes(id));
  let score = 92;
  if (hasTokyo && hasKansai) score -= 7;
  if (hasTokyo && hasKansai && hasFuji) score -= 8;
  if (routeIds.length > 10) score -= 5;
  return score;
}

function schedulePaceScore(plan: PlanVariant, context: PlanningContext) {
  const days = plan.itinerary ?? [];
  if (days.length === 0) return 55;
  const averagePlacesPerDay = days.reduce((sum, day) => sum + day.placeNodeIds.length, 0) / days.length;
  const wantsEasyPace = context.constraints.some((constraint) => constraint.constraintType === "pace");
  const target = wantsEasyPace ? 2.4 : 3.1;
  return Math.max(55, 96 - Math.abs(averagePlacesPerDay - target) * 14);
}

function budgetFitScore(plan: PlanVariant, context: PlanningContext) {
  const budgetConstraints = context.constraints.filter((constraint) => constraint.constraintType === "budget");
  if (budgetConstraints.length === 0) return plan.budgetIsEstimate ? 84 : 88;
  return /高|luxury|偏高/.test(plan.budgetText) ? 76 : 90;
}

function averageOr(values: number[], fallback: number) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return fallback;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function round(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)));
}
