import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import type { ConstraintDraft } from "@/lib/preferences/model-provider";

export class ConstraintService {
  async createDerivedConstraints(input: {
    tripId: string;
    memberId?: string | null;
    evidenceId: string;
    signalIds: string[];
    modelName: string;
    modelVersion: string;
    constraints: ConstraintDraft[];
  }) {
    if (input.constraints.length === 0) return [];

    return Promise.all(
      input.constraints.map((constraint, index) =>
        prisma.memberConstraint.upsert({
          where: { id: `con-${input.evidenceId}-${index}` },
          create: {
            id: `con-${input.evidenceId}-${index}`,
            tripId: input.tripId,
            memberId: input.memberId ?? undefined,
            targetType: constraint.targetType,
            targetId: constraint.targetId,
            sourceKind: "derived_from_evidence",
            constraintType: constraint.constraintType,
            severity: constraint.severity,
            polarity: constraint.polarity,
            priorityScore: constraint.priorityScore,
            confidence: constraint.confidence,
            summary: constraint.summary,
            conditionText: constraint.conditionText,
            structuredValue: jsonInput(constraint.structuredValue),
            evidenceIds: jsonInput([input.evidenceId]),
            signalIds: jsonInput(input.signalIds),
            modelName: input.modelName,
            modelVersion: input.modelVersion
          },
          update: {
            targetType: constraint.targetType,
            targetId: constraint.targetId,
            constraintType: constraint.constraintType,
            severity: constraint.severity,
            polarity: constraint.polarity,
            priorityScore: constraint.priorityScore,
            confidence: constraint.confidence,
            summary: constraint.summary,
            conditionText: constraint.conditionText,
            structuredValue: jsonInput(constraint.structuredValue),
            evidenceIds: jsonInput([input.evidenceId]),
            signalIds: jsonInput(input.signalIds),
            status: "active",
            modelName: input.modelName,
            modelVersion: input.modelVersion,
            invalidatedAt: null
          }
        })
      )
    );
  }

  async createExplicitConstraint(input: {
    tripId: string;
    memberId?: string;
    targetType?: "trip" | "node" | "material" | "plan";
    targetId?: string;
    constraintType: string;
    severity: "soft" | "strong" | "hard";
    polarity?: -1 | 0 | 1;
    summary: string;
    conditionText?: string;
    structuredValue?: Record<string, unknown>;
  }) {
    return prisma.memberConstraint.create({
      data: {
        id: `con-${randomUUID()}`,
        tripId: input.tripId,
        memberId: input.memberId,
        targetType: input.targetType,
        targetId: input.targetId,
        sourceKind: "explicit_user_input",
        constraintType: input.constraintType,
        severity: input.severity,
        polarity: input.polarity,
        priorityScore: 1,
        confidence: 1,
        summary: input.summary,
        conditionText: input.conditionText,
        structuredValue: jsonInput(input.structuredValue)
      }
    });
  }
}

export const constraintService = new ConstraintService();

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}
