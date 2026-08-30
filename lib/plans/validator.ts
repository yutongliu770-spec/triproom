import type { PlanningContext } from "@/lib/plans/context-builder";
import type { PlanVariant } from "@/lib/types";

export interface PlanValidationIssue {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
}

export interface PlanValidationResult {
  passed: boolean;
  issues: PlanValidationIssue[];
}

export class PlanValidator {
  validate(plan: PlanVariant, context: PlanningContext): PlanValidationResult {
    const issues: PlanValidationIssue[] = [];
    const knownNodeIds = new Set(context.destinationNodes.map((node) => node.id));
    const includedNodeIds = new Set(plan.includedNodeIds);

    if (!plan.totalDays || plan.totalDays <= 0) {
      issues.push({ severity: "error", code: "missing_total_days", message: "方案缺少总天数。" });
    }

    if (context.trip.tripDurationDays && plan.totalDays && plan.totalDays !== context.trip.tripDurationDays) {
      issues.push({
        severity: "warning",
        code: "duration_mismatch",
        message: `方案为 ${plan.totalDays} 天，当前 Room 期望约 ${context.trip.tripDurationDays} 天。`
      });
    }

    const itineraryDays = plan.itinerary?.length ?? 0;
    if (plan.totalDays && itineraryDays !== plan.totalDays) {
      issues.push({
        severity: "error",
        code: "itinerary_day_count",
        message: `完整行程为 ${itineraryDays} 天，但方案总天数为 ${plan.totalDays} 天。`
      });
    }

    for (const nodeId of plan.includedNodeIds) {
      if (!knownNodeIds.has(nodeId)) {
        issues.push({
          severity: "error",
          code: "unknown_place",
          message: `方案包含未知地点 ${nodeId}。`
        });
      }
    }

    const duplicatedNodes = duplicated(plan.includedNodeIds);
    if (duplicatedNodes.length > 0) {
      issues.push({
        severity: "warning",
        code: "duplicate_place",
        message: `方案重复包含地点：${duplicatedNodes.join("、")}。`
      });
    }

    for (const constraint of context.constraints) {
      if (constraint.status !== "active") continue;
      if (constraint.severity === "hard" && constraint.constraintType === "hard_reject" && constraint.targetType === "node" && constraint.targetId && includedNodeIds.has(constraint.targetId)) {
        issues.push({
          severity: "error",
          code: "hard_reject_included",
          message: `违反硬约束：${constraint.summary}`
        });
      }
      if (constraint.severity === "hard" && constraint.constraintType === "must_go" && constraint.targetType === "node" && constraint.targetId && !includedNodeIds.has(constraint.targetId)) {
        issues.push({
          severity: "error",
          code: "must_go_missing",
          message: `缺少必去地点：${constraint.summary}`
        });
      }
      if (constraint.constraintType === "pace" && /轻松|慢|少走路/.test(constraint.summary)) {
        const busyDays = (plan.itinerary ?? []).filter((day) => day.placeNodeIds.length >= 4);
        if (busyDays.length > 0) {
          issues.push({
            severity: constraint.severity === "hard" ? "error" : "warning",
            code: "pace_too_dense",
            message: `有 ${busyDays.length} 天安排偏满，可能不满足轻松节奏偏好。`
          });
        }
      }
    }

    const routeNodeIds = plan.route?.nodeIds ?? [];
    if (routeNodeIds.length < 2) {
      issues.push({
        severity: "warning",
        code: "route_too_short",
        message: "路线节点不足，地图展示可能不够清晰。"
      });
    }

    if (crossesKantoKansai(plan) && (plan.totalDays ?? 0) < 6) {
      issues.push({
        severity: "warning",
        code: "long_transfer_short_trip",
        message: "关东和关西同时出现，但总天数偏短，移动强度可能较高。"
      });
    }

    return {
      passed: !issues.some((issue) => issue.severity === "error"),
      issues
    };
  }
}

export const planValidator = new PlanValidator();

function duplicated(values: string[]) {
  const seen = new Set<string>();
  const result = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) result.add(value);
    seen.add(value);
  }
  return Array.from(result);
}

function crossesKantoKansai(plan: PlanVariant) {
  const ids = new Set(plan.includedNodeIds);
  return ids.has("tokyo") && (ids.has("osaka") || ids.has("kyoto") || ids.has("usj"));
}
